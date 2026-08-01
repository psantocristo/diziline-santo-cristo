import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, clientIdFromRequest } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate-limit: até 5 cadastros/hora por IP (anti-spam)
    const supabaseRL = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const rlOk = await checkRateLimit(supabaseRL, 'register-dizimista', clientIdFromRequest(req), 5, 3600);
    if (!rlOk) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { nome_completo, email, senha, cpf, telefone, data_nascimento, comunidade_id, estado_civil, membros_familia, melhor_dia_pagamento } = body;

    // 1. Validações básicas
    if (!nome_completo?.trim()) {
      return new Response(JSON.stringify({ error: 'Nome completo é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: 'E-mail é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!senha || senha.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!cpf?.trim()) {
      return new Response(JSON.stringify({ error: 'CPF é obrigatório.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!data_nascimento) {
      return new Response(JSON.stringify({ error: 'Data de nascimento é obrigatória.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validar CPF (checksum)
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11 || /^(\d)\1{10}$/.test(cpfLimpo)) {
      return new Response(JSON.stringify({ error: 'CPF inválido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    // 3. Verificar cadastro_aberto
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: config } = await adminClient
      .from('configuracoes_paroquia')
      .select('cadastro_aberto')
      .limit(1)
      .single();

    if (!config?.cadastro_aberto) {
      return new Response(JSON.stringify({ error: 'Cadastros estão desabilitados no momento.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Verificar duplicidade de CPF
    const { data: existenteCpf } = await adminClient
      .from('paroquianos')
      .select('id, nome_completo')
      .eq('cpf', cpfLimpo)
      .maybeSingle();

    if (existenteCpf) {
      return new Response(JSON.stringify({ error: `CPF já cadastrado para: ${existenteCpf.nome_completo}` }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Verificar duplicidade nome + data_nascimento
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

    // 6. Gerar matrícula sequencial
    const { data: matriculaData, error: matriculaError } = await adminClient.rpc('gerar_matricula_paroquial');
    if (matriculaError) {
      console.error('Erro ao gerar matrícula:', matriculaError);
      return new Response(JSON.stringify({ error: 'Erro ao gerar matrícula paroquial.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const matricula = matriculaData as string;

    // 7. Criar usuário no auth (SEM email_confirm — dizimista precisa confirmar)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: false,
      user_metadata: { nome_completo: nome_completo.trim() },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = authData.user.id;

    // 8. Garantir profile
    await adminClient
      .from('profiles')
      .upsert({ id: newUserId, nome_completo: nome_completo.trim(), email: email.trim().toLowerCase() });

    // 9. Inserir paroquiano
    const { data: paroquianoData, error: paroquianoError } = await adminClient
      .from('paroquianos')
      .insert({
        user_id: newUserId,
        nome_completo: nome_completo.trim(),
        email: email.trim().toLowerCase(),
        cpf: cpfLimpo,
        telefone: telefone?.trim() || null,
        data_nascimento: data_nascimento || null,
        comunidade_id: comunidade_id || null,
        estado_civil: estado_civil || null,
        melhor_dia_pagamento: (typeof melhor_dia_pagamento === 'number' && melhor_dia_pagamento >= 1 && melhor_dia_pagamento <= 31) ? melhor_dia_pagamento : null,
        status: 'ativo',
        data_inicio_dizimista: new Date().toISOString().split('T')[0],
        matricula_paroquial: matricula,
      })
      .select('id')
      .single();

    if (paroquianoError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: 'Erro ao cadastrar dizimista: ' + paroquianoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 10. Inserir membros da família (se houver)
    if (Array.isArray(membros_familia) && membros_familia.length > 0) {
      const membrosInsert = membros_familia
        .filter((m: any) => m.nome?.trim())
        .map((m: any) => ({
          paroquiano_id: paroquianoData.id,
          nome: m.nome.trim(),
          parentesco: m.parentesco || 'outro',
          data_nascimento: m.data_nascimento || null,
        }));
      if (membrosInsert.length > 0) {
        await adminClient.from('membros_familia').insert(membrosInsert);
      }
    }

    // 11. Notificar admin
    await adminClient.from('notificacoes_admin').insert({
      tipo: 'novo_dizimista',
      titulo: `Novo dizimista: ${nome_completo.trim()}`,
      mensagem: `${nome_completo.trim()} se cadastrou como dizimista. Matrícula: ${matricula}. CPF: ${cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}.`,
      dados: { paroquiano_id: paroquianoData.id, user_id: newUserId, matricula },
    });

    return new Response(JSON.stringify({
      success: true,
      nome: nome_completo.trim(),
      matricula,
      paroquiano_id: paroquianoData.id,
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
