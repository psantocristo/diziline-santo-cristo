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

    // 2. Verificar se o caller é super_admin
    const { data: roleData } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas super_admin pode ativar/inativar colaboradores.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Ler body
    const body = await req.json();
    const { servo_id, user_id, ativo } = body;

    if (!servo_id || !user_id || typeof ativo !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos: servo_id, user_id e ativo são obrigatórios.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Usar service_role para todas as operações privilegiadas
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 5. Atualizar servos.ativo
    const { error: servoError } = await adminClient
      .from('servos')
      .update({ ativo })
      .eq('id', servo_id);

    if (servoError) {
      return new Response(JSON.stringify({ error: 'Erro ao atualizar colaborador: ' + servoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Gerenciar role 'admin' em user_roles
    if (ativo) {
      // Ativar: inserir role admin (ignorar se já existe)
      const { error: insertError } = await adminClient
        .from('user_roles')
        .insert({ user_id, role: 'admin' });

      if (insertError && !insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
        console.error('Erro ao inserir role admin:', insertError);
      }
    } else {
      // Inativar: remover role admin
      const { error: deleteError } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('role', 'admin');

      if (deleteError) {
        console.error('Erro ao remover role admin:', deleteError);
      }
    }

    return new Response(JSON.stringify({ success: true, ativo }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
