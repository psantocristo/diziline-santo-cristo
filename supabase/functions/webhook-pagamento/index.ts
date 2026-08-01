/**
 * Webhook público para receber callbacks de status dos provedores
 * Sicredi (Sipag) e Pagar.me. Atualiza o pagamento correspondente
 * no banco. Deploy com `verify_jwt = false`.
 *
 * URLs a cadastrar no painel de cada provedor:
 *   https://<projeto>.functions.supabase.co/webhook-pagamento?provedor=pagarme
 *   https://<projeto>.functions.supabase.co/webhook-pagamento?provedor=sicredi
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

async function hmacValidate(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    const expected = signature.replace(/^sha256=/i, '').trim().toLowerCase()
    return hex === expected
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const url = new URL(req.url)
  const provedor = (url.searchParams.get('provedor') || '').toLowerCase()
  const rawBody = await req.text()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Carregar webhook_secret e modo das configurações
  const { data: config } = await supabase
    .from('configuracoes_gateway')
    .select('webhook_secret, provedor, modo, webhook_hmac_obrigatorio')
    .limit(1)
    .single()

  const sig =
    req.headers.get('x-hub-signature-256') ||
    req.headers.get('x-signature') ||
    req.headers.get('x-pagarme-signature') ||
    ''

  const emProducao = (config?.modo || '').toLowerCase() === 'producao'

  // ── Sicredi: o BACEN prevê entrega do callback com mTLS, que o Supabase não
  // valida. Autenticamos por segredo compartilhado na URL cadastrada no Sicredi:
  //   .../webhook-pagamento?provedor=sicredi&s=<SICREDI_WEBHOOK_SECRET>
  // (também aceito no header `x-webhook-secret`).
  let sicrediSecretOk = false
  if (provedor === 'sicredi') {
    const esperado = Deno.env.get('SICREDI_WEBHOOK_SECRET') || ''
    const recebido = url.searchParams.get('s') || req.headers.get('x-webhook-secret') || ''
    sicrediSecretOk = !!esperado && recebido === esperado
    if (esperado && !sicrediSecretOk) {
      await supabase.from('logs_webhook').insert({
        evento: 'sicredi:segredo_invalido',
        payload: rawBody.slice(0, 1000),
        erro: 'Segredo do webhook Sicredi ausente ou divergente',
        status_processamento: 'rejeitado',
      })
      return new Response('Invalid webhook secret', { status: 401, headers: cors })
    }
    if (!esperado && emProducao) {
      await supabase.from('logs_webhook').insert({
        evento: 'sicredi:segredo_ausente',
        payload: rawBody.slice(0, 1000),
        erro: 'SICREDI_WEBHOOK_SECRET não configurado em modo produção',
        status_processamento: 'rejeitado',
      })
      return new Response('Webhook secret not configured', { status: 401, headers: cors })
    }
  }

  // Sicredi não assina o corpo com HMAC — o segredo da URL já autenticou.
  const exigirHmac = (config?.webhook_hmac_obrigatorio ?? true) && emProducao && !sicrediSecretOk

  // Em produção: HMAC é obrigatório. Sem secret configurado ou assinatura inválida = rejeita.
  if (exigirHmac) {

    if (!config?.webhook_secret) {
      await supabase.from('logs_webhook').insert({
        evento: `${provedor}:webhook_secret_ausente`,
        payload: rawBody.slice(0, 1000),
        erro: 'webhook_secret não configurado em modo produção',
        status_processamento: 'rejeitado',
      })
      return new Response('Webhook secret not configured', { status: 401, headers: cors })
    }
    if (!sig || !(await hmacValidate(config.webhook_secret, rawBody, sig))) {
      await supabase.from('logs_webhook').insert({
        evento: `${provedor}:assinatura_invalida`,
        payload: rawBody.slice(0, 1000),
        erro: 'Assinatura HMAC inválida ou ausente',
        status_processamento: 'rejeitado',
      })
      return new Response('Invalid signature', { status: 401, headers: cors })
    }
  } else if (config?.webhook_secret && sig) {
    // Em sandbox/simulação: se o provedor enviar assinatura, validamos por consistência;
    // se não enviar, aceitamos (não bloqueia testes).
    if (!(await hmacValidate(config.webhook_secret, rawBody, sig))) {
      await supabase.from('logs_webhook').insert({
        evento: `${provedor}:assinatura_invalida_sandbox`,
        payload: rawBody.slice(0, 1000),
        erro: 'Assinatura HMAC inválida (sandbox)',
        status_processamento: 'rejeitado',
      })
      return new Response('Invalid signature', { status: 401, headers: cors })
    }
  }

  let payload: any
  try { payload = JSON.parse(rawBody) } catch {
    return new Response('Invalid JSON', { status: 400, headers: cors })
  }

  // Extrair gateway_id, código interno e status de acordo com o provedor
  let gatewayId: string | null = null
  let codigoInterno: string | null = null  // referência (`code`/`txid`) usada na criação
  let status: 'pago' | 'cancelado' | 'aguardando' = 'aguardando'
  let evento = `${provedor}:webhook`

  if (provedor === 'pagarme') {
    // Pagar.me: { type: 'charge.paid', data: { id, status, code, order: { code } } }
    evento = payload?.type || evento
    gatewayId = payload?.data?.id || null
    codigoInterno = payload?.data?.code || payload?.data?.order?.code || null
    const s = String(payload?.data?.status || '').toLowerCase()
    if (['paid', 'authorized'].includes(s)) status = 'pago'
    else if (['canceled', 'failed', 'expired', 'voided', 'refunded'].includes(s)) status = 'cancelado'
  } else if (provedor === 'sicredi') {
    // Sicredi PIX (padrão BACEN): { pix: [{ txid, valor, horario }] } no callback de confirmação
    // ou { txid, status } em consultas. Tratamos ambos.
    evento = payload?.evento || (payload?.pix ? 'pix.recebido' : evento)
    if (Array.isArray(payload?.pix) && payload.pix[0]) {
      // Callback de confirmação de pagamento PIX recebido — sempre = pago
      gatewayId = payload.pix[0].txid || null
      codigoInterno = gatewayId
      status = 'pago'
    } else {
      gatewayId = payload?.txid || payload?.id || null
      codigoInterno = gatewayId
      const s = String(payload?.status || '').toUpperCase()
      if (['CONCLUIDA', 'CONCLUÍDA', 'PAID', 'APROVADO'].includes(s)) status = 'pago'
      else if (['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP', 'CANCELADA', 'REJEITADA', 'EXPIRADA'].includes(s)) status = 'cancelado'
    }
  } else {
    return new Response('Provedor desconhecido', { status: 400, headers: cors })
  }

  if (!gatewayId && !codigoInterno) {
    await supabase.from('logs_webhook').insert({
      evento, payload, status_processamento: 'ignorado', erro: 'gateway_id e code ausentes',
    })
    return new Response('OK', { headers: cors })
  }

  // Localizar pagamento — primeiro por gateway_id, depois pelo code (que mapeia ao pagamento_id)
  let pagamento: { id: string; status: string } | null = null
  if (gatewayId) {
    const r = await supabase
      .from('pagamentos')
      .select('id, status')
      .eq('gateway_id', gatewayId)
      .maybeSingle()
    pagamento = r.data
  }
  if (!pagamento && codigoInterno) {
    // O `code`/`txid` foi gerado a partir do UUID do pagamento (sem hífens, truncado).
    // Como UUIDs são únicos pelos primeiros 16 chars, fazemos um match prefixado.
    const prefix = codigoInterno.replace(/[^a-f0-9]/gi, '').slice(0, 8).toLowerCase()
    if (prefix.length === 8) {
      const r = await supabase
        .from('pagamentos')
        .select('id, status')
        .ilike('id', `${prefix.slice(0, 8)}%`)
        .limit(2)
      if (r.data && r.data.length === 1) pagamento = r.data[0]
    }
  }

  if (pagamento && pagamento.status !== 'pago' && status !== 'aguardando') {
    const update: Record<string, unknown> = {
      status: status === 'pago' ? 'pago' : 'cancelado',
      gateway_status: `webhook_${status}`,
      gateway_payload: payload,
    }
    if (status === 'pago') update.pago_em = new Date().toISOString()
    else update.cancelado_em = new Date().toISOString()

    await supabase.from('pagamentos').update(update).eq('id', pagamento.id)
  }

  await supabase.from('logs_webhook').insert({
    evento, payload,
    pagamento_id: pagamento?.id || null,
    status_processamento: pagamento ? 'processado' : 'pagamento_nao_encontrado',
  })

  return new Response('OK', { headers: cors })
})