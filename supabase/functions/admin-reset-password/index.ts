import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar identidade do caller
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminUserId = claimsData.claims.sub as string;

    // Verificar se é admin ou super_admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', adminUserId).in('role', ['admin', 'super_admin']).limit(1);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem redefinir senhas.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { user_id, nova_senha } = await req.json();

    if (!user_id || !nova_senha) {
      return new Response(JSON.stringify({ error: 'user_id e nova_senha são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (nova_senha.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar info do alvo para o log
    const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);
    const targetEmail = targetUser?.user?.email || 'desconhecido';

    // Buscar nome do admin
    const { data: adminProfile } = await adminClient.from('profiles').select('nome_completo').eq('id', adminUserId).single();
    const adminNome = adminProfile?.nome_completo || 'Admin';

    // Redefinir a senha
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, { password: nova_senha });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Registrar log de auditoria
    await adminClient.from('logs_auditoria').insert({
      acao: 'reset_senha',
      entidade: 'auth.users',
      entidade_id: user_id,
      user_id: adminUserId,
      detalhes: {
        email_alvo: targetEmail,
        admin_nome: adminNome,
        admin_email: claimsData.claims.email,
      },
    });

    return new Response(JSON.stringify({ success: true, message: `Senha redefinida com sucesso para ${targetEmail}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
