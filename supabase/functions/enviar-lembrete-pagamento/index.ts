// Admin envia lembrete de pagamento (push) para dizimistas
// Modos: 'todos' | 'pendentes_mes' | 'paroquiano'
// Requer role admin/super_admin via JWT
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    const roles = (roleData || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('super_admin')) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const modo: 'todos' | 'pendentes_mes' | 'paroquiano' = body.modo || 'pendentes_mes';
    const paroquianoId: string | undefined = body.paroquiano_id;
    const titulo: string = (body.titulo || '💝 Lembrete do seu dízimo').slice(0, 80);
    const mensagem: string = (body.mensagem || 'Que tal dedicar um momento e fazer sua contribuição hoje? Toque aqui para abrir.').slice(0, 200);

    // Carrega paroquianos alvo
    let q = admin
      .from('paroquianos')
      .select('id, user_id, nome_completo')
      .eq('status', 'ativo')
      .eq('notificacoes_push_ativas', true)
      .not('user_id', 'is', null);

    if (modo === 'paroquiano' && paroquianoId) q = q.eq('id', paroquianoId);
    const { data: pars } = await q;
    let alvos = pars || [];

    if (modo === 'pendentes_mes') {
      const now = new Date();
      const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const inicioMesTs = inicioMes + 'T00:00:00Z';
      const ids = alvos.map((p: any) => p.id);
      if (ids.length) {
        // Pagos pelo mes_referencia (inclui pagamento antecipado)
        const { data: pagosRef } = await admin
          .from('pagamentos')
          .select('paroquiano_id')
          .in('paroquiano_id', ids)
          .eq('tipo', 'dizimo')
          .eq('status', 'pago')
          .gte('mes_referencia', inicioMes)
          .lte('mes_referencia', fimMes);
        // Fallback legado: sem mes_referencia mas criados no mês
        const { data: pagosLegacy } = await admin
          .from('pagamentos')
          .select('paroquiano_id')
          .in('paroquiano_id', ids)
          .eq('tipo', 'dizimo')
          .eq('status', 'pago')
          .is('mes_referencia', null)
          .gte('created_at', inicioMesTs);
        const pagosSet = new Set([
          ...(pagosRef || []).map((p: any) => p.paroquiano_id),
          ...(pagosLegacy || []).map((p: any) => p.paroquiano_id),
        ]);
        alvos = alvos.filter((p: any) => !pagosSet.has(p.id));
      }
    }


    const hojeISO = new Date().toISOString().slice(0, 10);
    let enviados = 0, falhas = 0, semDispositivo = 0;
    const payload = { title: titulo, body: mensagem, url: '/paroquiano/contribuir', tag: 'lembrete_admin' };

    for (const p of alvos) {
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', p.user_id);
      if (!subs || subs.length === 0) { semDispositivo++; continue; }
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 24 * 3600, urgency: 'normal' },
          );
          enviados++;
        } catch (e: any) {
          falhas++;
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }
      await admin.from('notificacoes_enviadas').insert({
        user_id: p.user_id, tipo: 'lembrete_admin', referencia: hojeISO + '-' + Date.now(), payload,
      });
    }

    return new Response(JSON.stringify({
      ok: true, modo, alvos: alvos.length, enviados, falhas, sem_dispositivo: semDispositivo,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
