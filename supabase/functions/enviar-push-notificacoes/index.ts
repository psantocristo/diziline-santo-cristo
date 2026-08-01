// Cron diário 09:00 BRT — envia push de:
// - Aniversário
// - Lembrete do melhor dia de pagamento
// - Dízimo atrasado (3+ dias após melhor_dia, ou após dia 10 se sem preferência)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@diziline.com.br';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

function hojeBRT(): Date {
  const now = new Date();
  // São Paulo é UTC-3 (sem horário de verão desde 2019)
  return new Date(now.getTime() - 3 * 3600 * 1000);
}

async function enviarPush(admin: any, sub: any, payload: any) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 3600, urgency: 'normal' },
    );
    return { ok: true };
  } catch (e: any) {
    const status = e?.statusCode;
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return { ok: false, error: e?.message || String(e), status };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const hoje = hojeBRT();
    const hojeISO = hoje.toISOString().slice(0, 10);
    const diaHoje = hoje.getUTCDate();
    const mesHoje = hoje.getUTCMonth() + 1;
    const inicioMes = `${hoje.getUTCFullYear()}-${String(mesHoje).padStart(2, '0')}-01`;

    // Flags de ativação (default true caso ainda não migrado)
    const { data: cfg } = await admin
      .from('configuracoes_paroquia')
      .select('notif_aniversario_ativo, notif_melhor_dia_ativo, notif_atraso_ativo')
      .limit(1)
      .maybeSingle();
    const flagAniv = (cfg as any)?.notif_aniversario_ativo ?? true;
    const flagMelhorDia = (cfg as any)?.notif_melhor_dia_ativo ?? true;
    const flagAtraso = (cfg as any)?.notif_atraso_ativo ?? true;

    // 1. Carrega todos paroquianos ativos com push ativo
    const { data: pars } = await admin
      .from('paroquianos')
      .select('id, user_id, nome_completo, data_nascimento, melhor_dia_pagamento, notificacoes_push_ativas, status')
      .eq('status', 'ativo')
      .eq('notificacoes_push_ativas', true);

    const stats = { aniversario: 0, lembrete: 0, atraso: 0, falhas: 0, total_envios: 0 };

    const enviar = async (userId: string, tipo: string, title: string, body: string, url: string) => {
      // Dedup
      const { error: dupErr } = await admin
        .from('notificacoes_enviadas')
        .insert({ user_id: userId, tipo, referencia: hojeISO, payload: { title, body, url } });
      if (dupErr) return; // já enviado ou conflito

      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
      if (!subs || subs.length === 0) return;
      for (const s of subs) {
        const r = await enviarPush(admin, s, { title, body, url, tag: tipo });
        if (r.ok) stats.total_envios++;
        else stats.falhas++;
      }
    };

    for (const p of pars || []) {
      // Aniversário
      if (flagAniv && p.data_nascimento) {
        const [_, m, d] = p.data_nascimento.split('-').map((n: string) => parseInt(n, 10));
        if (m === mesHoje && d === diaHoje) {
          stats.aniversario++;
          await enviar(
            p.user_id,
            'aniversario',
            '🎂 Feliz aniversário!',
            `${p.nome_completo.split(' ')[0]}, que Deus abençoe seu dia com paz e alegria. 🙏`,
            '/paroquiano',
          );
        }
      }

      // Se nem o lembrete nem o atraso estão ativos, pula a checagem de pagamento
      if (!flagMelhorDia && !flagAtraso) continue;

      // Checa se já pagou dízimo referente a este mês
      // Considera tanto pagamentos com mes_referencia = mês atual (inclui pagamento antecipado)
      // quanto pagamentos sem mes_referencia realizados dentro do mês corrente.
      const fimMes = `${hoje.getUTCFullYear()}-${String(mesHoje).padStart(2, '0')}-${new Date(Date.UTC(hoje.getUTCFullYear(), mesHoje, 0)).getUTCDate()}`;
      const { count: pagoRef } = await admin
        .from('pagamentos')
        .select('id', { count: 'exact', head: true })
        .eq('paroquiano_id', p.id)
        .eq('tipo', 'dizimo')
        .eq('status', 'pago')
        .gte('mes_referencia', inicioMes)
        .lte('mes_referencia', fimMes);

      let jaPagou = (pagoRef || 0) > 0;
      if (!jaPagou) {
        const { count: pagoLegacy } = await admin
          .from('pagamentos')
          .select('id', { count: 'exact', head: true })
          .eq('paroquiano_id', p.id)
          .eq('tipo', 'dizimo')
          .eq('status', 'pago')
          .is('mes_referencia', null)
          .gte('created_at', inicioMes);
        jaPagou = (pagoLegacy || 0) > 0;
      }
      if (jaPagou) continue;


      // Lembrete no melhor dia
      if (flagMelhorDia && p.melhor_dia_pagamento && p.melhor_dia_pagamento === diaHoje) {
        stats.lembrete++;
        await enviar(
          p.user_id,
          'lembrete_melhor_dia',
          '💝 Hoje é o seu dia de contribuir',
          'Dedique um momento e faça seu dízimo com alegria. Toque aqui para contribuir.',
          '/paroquiano/contribuir',
        );
      }

      // Dízimo atrasado
      if (flagAtraso) {
        const diaCorte = p.melhor_dia_pagamento ? p.melhor_dia_pagamento + 3 : 10;
        if (diaHoje > diaCorte) {
          stats.atraso++;
          await enviar(
            p.user_id,
            'dizimo_atrasado',
            '⏰ Seu dízimo está pendente',
            'Você ainda não fez sua contribuição este mês. Toque para regularizar agora.',
            '/paroquiano/contribuir',
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stats, data: hojeISO, flags: { flagAniv, flagMelhorDia, flagAtraso } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
