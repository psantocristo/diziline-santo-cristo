/**
 * Reconciliação automática de PIX órfãos.
 * Para cada pagamento com status 'aguardando_pagamento' criado há mais de 30s
 * e há menos de 30 minutos, consulta o status no provedor e atualiza no banco.
 * Deve ser invocado periodicamente via pg_cron / agendador externo.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProviderId, providerGetStatus } from '../_shared/payment-providers.ts'
import { log } from '../_shared/logger.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: config } = await supabase
    .from('configuracoes_gateway')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (!config) {
    return new Response(JSON.stringify({ ok: false, error: 'sem_config' }), { headers: cors })
  }

  // Busca pagamentos aguardando há 30s a 30min
  const now = Date.now()
  const desde = new Date(now - 30 * 60 * 1000).toISOString()
  const ate = new Date(now - 30 * 1000).toISOString()

  const { data: pendentes } = await supabase
    .from('pagamentos')
    .select('id, gateway_id, provedor, created_at')
    .eq('status', 'aguardando_pagamento')
    .not('gateway_id', 'is', null)
    .gte('created_at', desde)
    .lte('created_at', ate)
    .limit(50)

  let pagos = 0
  let cancelados = 0
  let consultados = 0

  for (const p of pendentes || []) {
    if (!p.gateway_id || String(p.gateway_id).startsWith('SIM_')) continue
    const prov = (p.provedor || getProviderId(config)) as 'rede' | 'sicredi' | 'pagarme'
    if (prov === 'rede') continue // rede é reconciliado por webhook próprio

    consultados++
    try {
      const r = await providerGetStatus(config, p.gateway_id)
      if (r.status === 'pago') {
        await supabase.from('pagamentos').update({
          status: 'pago',
          pago_em: new Date().toISOString(),
          gateway_status: 'aprovado_reconciliacao',
        }).eq('id', p.id)
        pagos++
      } else if (r.status === 'cancelado') {
        await supabase.from('pagamentos').update({
          status: 'cancelado',
          cancelado_em: new Date().toISOString(),
          gateway_status: 'cancelado_reconciliacao',
        }).eq('id', p.id)
        cancelados++
      }
    } catch (err) {
      log('warn', 'reconciliacao_falhou', { pagamento_id: p.id, erro: String(err) })
    }
  }

  log('info', 'reconciliacao_concluida', { consultados, pagos, cancelados, candidatos: pendentes?.length || 0 })

  return new Response(JSON.stringify({
    ok: true, consultados, pagos, cancelados, candidatos: pendentes?.length || 0,
  }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})