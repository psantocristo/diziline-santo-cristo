import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticação e role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = claimsData.claims.sub;

    // Verificar se o caller é super_admin
    const { data: roleData } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas super_admin pode cadastrar servos.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Ler corpo da requisição
    const body = await req.json();
    const { nome, email, cpf, senha, comunidade_id } = body;

    if (!nome?.trim() || !email?.trim() || !senha) {
      return new Response(JSON.stringify({ error: 'Nome, e-mail e senha são obrigatórios.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (senha.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Usar service_role para criar o usuário
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Criar usuário no Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true, // Confirmar e-mail automaticamente
      user_metadata: { nome_completo: nome.trim() },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = authData.user.id;

    // 4. Inserir/atualizar profile (o trigger já cria, mas garantimos nome correto)
    await adminClient
      .from('profiles')
      .upsert({ id: newUserId, nome_completo: nome.trim(), email: email.trim().toLowerCase() });

    // 5. Remover a role 'paroquiano' gerada pelo trigger e adicionar 'admin'
    await adminClient.from('user_roles').delete().eq('user_id', newUserId).eq('role', 'paroquiano');
    
    const { error: roleError } = await adminClient.from('user_roles').insert({
      user_id: newUserId,
      role: 'admin',
    });

    if (roleError && !roleError.message.includes('duplicate')) {
      // Se já existe role admin, tudo bem
      if (!roleError.message.includes('unique')) {
        console.error('Erro ao inserir role:', roleError);
      }
    }

    // 6. Inserir na tabela servos
    const { error: servoError } = await adminClient.from('servos').insert({
      user_id: newUserId,
      nome: nome.trim(),
      cpf: cpf?.trim() || null,
      comunidade_id: comunidade_id || null,
      ativo: true,
      created_by: callerId,
    });

    if (servoError) {
      // Rollback: deletar o usuário criado
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: 'Erro ao cadastrar servo: ' + servoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId, nome: nome.trim() }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
