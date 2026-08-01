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
    // 1. Validar autenticação
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

    // 2. Verificar se o caller é admin ou super_admin
    const { data: roleData } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem cadastrar dizimistas com conta de acesso.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Ler e validar corpo da requisição
    const body = await req.json();
    const {
      nome_completo, email, senha,
      cpf, telefone, comunidade_id, status,
      data_inicio_dizimista, data_nascimento, valor_sugerido, observacoes,
      endereco, cidade, estado, cep, matricula_paroquial
    } = body;

    if (!nome_completo?.trim()) {
      return new Response(JSON.stringify({ error: 'Nome completo é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: 'E-mail é obrigatório para criar conta de acesso.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!senha || senha.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3b. Validar CPF (se informado)
    if (cpf?.trim()) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11 || /^(\d)\1{10}$/.test(cpfLimpo)) {
        return new Response(JSON.stringify({ error: 'CPF inválido.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Algoritmo de validação dos dígitos verificadores
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
      let resto = (soma * 10) % 11;
      if (resto === 10) resto = 0;
      if (resto !== parseInt(cpfLimpo.charAt(9))) {
        return new Response(JSON.stringify({ error: 'CPF inválido.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      soma = 0;
      for (let i = 0; i < 10; i++) soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10) resto = 0;
      if (resto !== parseInt(cpfLimpo.charAt(10))) {
        return new Response(JSON.stringify({ error: 'CPF inválido.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3c. Verificar duplicidade de CPF
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (cpf?.trim()) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const { data: existente } = await adminClient
        .from('paroquianos')
        .select('id, nome_completo')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (existente) {
        return new Response(JSON.stringify({ error: `CPF já cadastrado para: ${existente.nome_completo}` }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3d. Verificar duplicidade por nome + data_nascimento
    if (data_nascimento && nome_completo?.trim()) {
      const { data: similares } = await adminClient
        .from('paroquianos')
        .select('id, nome_completo')
        .eq('data_nascimento', data_nascimento);

      const nomeNorm = nome_completo.trim().toLowerCase();
      const dup = (similares || []).find((s: any) => s.nome_completo.trim().toLowerCase() === nomeNorm);
      if (dup) {
        return new Response(JSON.stringify({ error: `Possível duplicidade: "${dup.nome_completo}" com mesma data de nascimento.` }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Criar o usuário no auth (adminClient já criado acima)

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo: nome_completo.trim() },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = authData.user.id;

    // 5. Garantir que o profile tem o nome correto (trigger já cria, mas upsert corrige)
    await adminClient
      .from('profiles')
      .upsert({ id: newUserId, nome_completo: nome_completo.trim(), email: email.trim().toLowerCase() });

    // 6. Inserir na tabela paroquianos com user_id vinculado
    const paroquianoPayload: Record<string, any> = {
      user_id: newUserId,
      nome_completo: nome_completo.trim(),
      email: email.trim().toLowerCase(),
      cpf: cpf?.trim() || null,
      telefone: telefone?.trim() || null,
      comunidade_id: comunidade_id || null,
      status: status || 'ativo',
      data_inicio_dizimista: data_inicio_dizimista || new Date().toISOString().split('T')[0],
      data_nascimento: data_nascimento || null,
      valor_sugerido: valor_sugerido ? Number(valor_sugerido) : null,
      observacoes: observacoes?.trim() || null,
      endereco: endereco?.trim() || null,
      cidade: cidade?.trim() || null,
      estado: estado?.trim() || null,
      cep: cep?.trim() || null,
      matricula_paroquial: matricula_paroquial?.trim() || null,
    };

    const { data: paroquianoData, error: paroquianoError } = await adminClient
      .from('paroquianos')
      .insert(paroquianoPayload)
      .select('id')
      .single();

    if (paroquianoError) {
      // Rollback: deletar o usuário criado
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: 'Erro ao cadastrar dizimista: ' + paroquianoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      paroquiano_id: paroquianoData.id,
      nome: nome_completo.trim()
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
