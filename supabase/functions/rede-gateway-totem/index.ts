import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getRedeMessage, isApproved } from '../_shared/rede-codes.ts'
import {
  getProviderId,
  providerCreatePix,
  providerCreateCard,
} from '../_shared/payment-providers.ts'

function formatRedeDateTime(date: Date): string {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const y = brt.getUTCFullYear()
  const m = String(brt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(brt.getUTCDate()).padStart(2, '0')
  const h = String(brt.getUTCHours()).padStart(2, '0')
  const min = String(brt.getUTCMinutes()).padStart(2, '0')
  const s = String(brt.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}:${s}-0300`
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GATEWAY_TIMEOUT_MS = 60_000
const MAX_RETRIES = 3

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  try {
    const resp = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    })
    if (resp.status >= 400 && resp.status < 500) return resp
    if (!resp.ok) throw new Error(`Gateway ${resp.status}`)
    return resp
  } catch (err: any) {
    console.error(`fetchWithRetry tentativa ${attempt}/${MAX_RETRIES}:`, err.message)
    if (attempt >= MAX_RETRIES) {
      throw new Error(`Gateway indisponível após ${MAX_RETRIES} tentativas: ${err.message}`)
    }
    const delay = 2000 * Math.pow(2, attempt - 1)
    await new Promise(r => setTimeout(r, delay))
    return fetchWithRetry(url, options, attempt + 1)
  }
}

// ─── Auth helper ───────────────────────────────────────
async function authenticateRequest(req: Request, corsHeaders: Record<string, string>): Promise<{ userId: string; userRole: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabaseUser.auth.getClaims(token)
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const userId = data.claims.sub as string

  // Verificar role via service_role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['totem', 'admin', 'super_admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const userRole = roleData?.role ?? null

  if (!userRole) {
    return new Response(JSON.stringify({ error: 'Forbidden: sem permissão para operar no totem' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return { userId, userRole }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Autenticação JWT ──
    const authResult = await authenticateRequest(req, corsHeaders)
    if (authResult instanceof Response) return authResult
    const { userId, userRole } = authResult

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, pagamento_id } = body

    if (!pagamento_id) {
      return jsonError('pagamento_id obrigatório', 400, corsHeaders)
    }

    // Verificar que o pagamento existe (auth já validada acima — totem/admin)
    const { data: pagamento, error: pagErr } = await supabase
      .from('pagamentos')
      .select('id, status, origem, valor, metodo, paroquiano_id, nome_contribuinte, cpf_contribuinte')
      .eq('id', pagamento_id)
      .maybeSingle()

    if (pagErr) {
      console.error('Erro ao buscar pagamento:', pagErr.message, 'id=', pagamento_id)
      return jsonError(`Falha ao localizar pagamento: ${pagErr.message}`, 500, corsHeaders)
    }
    if (!pagamento) {
      console.error('Pagamento não encontrado. id=', pagamento_id)
      return jsonError('Pagamento não encontrado. Reinicie o fluxo e tente novamente.', 404, corsHeaders)
    }
    if (!['totem', 'maquininha'].includes(pagamento.origem)) {
      console.error('Origem inválida:', pagamento.origem, 'id=', pagamento_id)
      return jsonError(`Pagamento com origem inválida: ${pagamento.origem}`, 400, corsHeaders)
    }

    if (pagamento.status !== 'aguardando_pagamento') {
      return jsonError(`Pagamento já está com status "${pagamento.status}". Reinicie o fluxo.`, 400, corsHeaders)
    }


    // Buscar configuração do gateway
    const { data: config, error: cfgErr } = await supabase
      .from('configuracoes_gateway')
      .select('*')
      .limit(1)
      .single()

    if (cfgErr || !config) {
      return jsonError('Configurações do gateway não encontradas', 500, corsHeaders)
    }

    if (action === 'create-pix') {
      return await criarPix(supabase, pagamento, config, body, corsHeaders)
    }

    if (action === 'create-card') {
      return await processarCartao(supabase, pagamento, config, body, corsHeaders)
    }

    return jsonError(`Ação desconhecida: ${action}`, 400, corsHeaders)

  } catch (err: any) {
    console.error('Erro no rede-gateway-totem:', err.message)
    return jsonError(err.message || 'Erro interno', 500, corsHeaders)
  }
})

function jsonError(message: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function gerarReference(pagamentoId: string): string {
  return pagamentoId.replace(/-/g, '').replace(/\D/g, '').slice(0, 16)
}

async function getOAuthToken(config: any): Promise<string> {
  if (!config.client_id || !config.client_secret) {
    throw new Error('Credenciais OAuth não configuradas')
  }

  const oauthUrl = config.modo === 'producao'
    ? (config.oauth_url_producao || 'https://api.userede.com.br/redelabs/oauth2/token')
    : (config.oauth_url_sandbox || 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token')

  const credentials = btoa(`${config.client_id}:${config.client_secret}`)
  const resp = await fetchWithRetry(oauthUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Falha OAuth (${resp.status}): ${body}`)
  }

  const tokenData = await resp.json()
  if (!tokenData.access_token) throw new Error('Token não retornado pela API da Rede')
  return tokenData.access_token
}

async function criarPix(supabase: any, pagamento: any, config: any, body: any, corsHeaders: Record<string, string>) {
  const { valor } = body

  if (config.modo === 'simulacao') {
    const fakeQr = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865802BR5925PAROQUIA6009SAO PAULO62070503***6304${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const expiracao = new Date(Date.now() + (config.pix_expiracao_minutos || 10) * 60 * 1000).toISOString()

    await supabase.from('pagamentos').update({
      gateway_id: `SIM_${Date.now()}`,
      gateway_status: 'simulacao_aguardando',
      pix_qrcode: fakeQr,
      pix_copia_cola: fakeQr,
      pix_expiracao: expiracao,
    }).eq('id', pagamento.id)

    return new Response(JSON.stringify({
      success: true,
      simulacao: true,
      pix_qrcode: fakeQr,
      pix_copia_cola: fakeQr,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── Dispatcher: provedores alternativos (Sicredi / Pagar.me) ──
  const providerId = getProviderId(config)
  if (providerId !== 'rede') {
    const valorCentavos = Math.round(Number(valor || pagamento.valor) * 100)
    const r = await providerCreatePix(config, {
      amount: valorCentavos,
      reference: gerarReference(pagamento.id),
      expiracaoMinutos: config.pix_expiracao_minutos || 10,
      descricao: 'Doação - DízimoSC',
      payer: (pagamento.cpf_contribuinte || pagamento.nome_contribuinte) ? {
        taxId: pagamento.cpf_contribuinte || undefined,
        name: pagamento.nome_contribuinte || undefined,
      } : undefined,
    })
    if (!r.success) {
      return new Response(JSON.stringify({ success: false, message: r.errorMessage || 'Falha PIX' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const expiracao = new Date(Date.now() + (config.pix_expiracao_minutos || 10) * 60 * 1000).toISOString()
    await supabase.from('pagamentos').update({
      gateway_id: r.gatewayId,
      gateway_status: 'aguardando',
      pix_qrcode: r.qrCode,
      pix_copia_cola: r.copyPaste,
      pix_expiracao: expiracao,
      gateway_payload: r.raw,
      provedor: providerId,
    }).eq('id', pagamento.id)
    return new Response(JSON.stringify({
      success: true,
      pix_qrcode: r.qrCode,
      pix_copia_cola: r.copyPaste,
      gateway_id: r.gatewayId,
      provedor: providerId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const accessToken = await getOAuthToken(config)
    const baseUrl = config.modo === 'producao'
      ? (config.producao_url || 'https://api.userede.com.br/erede')
      : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

    const valorCentavos = Math.round(Number(valor || pagamento.valor) * 100)
    const reference = gerarReference(pagamento.id)

    const pixPayload = {
      kind: 'Pix',
      amount: valorCentavos,
      reference,
      qrCode: {
        dateTimeExpiration: formatRedeDateTime(new Date(Date.now() + (config.pix_expiracao_minutos || 10) * 60 * 1000)),
      },
    }

    const pixResp = await fetchWithRetry(`${baseUrl}/v2/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pixPayload),
    })

    const pixContentType = pixResp.headers.get('content-type') || ''
    let pixData: any
    if (pixContentType.includes('application/json')) {
      pixData = await pixResp.json()
    } else {
      const rawText = await pixResp.text()
      console.error('Resposta não-JSON da API Rede (PIX):', rawText.substring(0, 100))
      throw new Error(`Erro API Rede (${pixResp.status}): resposta inválida (não-JSON)`)
    }

    if (!pixResp.ok) {
      console.error('Erro API Rede (PIX):', pixResp.status, pixData?.returnCode || '')
      throw new Error(`Erro API Rede (${pixResp.status}): ${pixData?.returnMessage || 'erro desconhecido'}`)
    }

    const expiracao = new Date(Date.now() + (config.pix_expiracao_minutos || 10) * 60 * 1000).toISOString()

    const qrCode =
      pixData.qrCodeResponse?.qrCodeImage ||
      pixData.pix?.qrCode ||
      pixData.qr_code ||
      null

    const copyAndPaste =
      pixData.qrCodeResponse?.qrCodeData ||
      pixData.pix?.copyAndPaste ||
      pixData.pix_copy_paste ||
      null

    const gatewayId = pixData.tid || pixData.id || null

    // Sanitizar gateway_payload: remover campos sensíveis antes de salvar
    const safePayload = sanitizeGatewayPayload(pixData)

    await supabase.from('pagamentos').update({
      gateway_id: gatewayId,
      gateway_status: pixData.returnMessage || 'aguardando',
      pix_qrcode: qrCode,
      pix_copia_cola: copyAndPaste,
      pix_expiracao: expiracao,
      gateway_payload: safePayload,
    }).eq('id', pagamento.id)

    return new Response(JSON.stringify({
      success: true,
      pix_qrcode: qrCode,
      pix_copia_cola: copyAndPaste,
      gateway_id: gatewayId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Erro ao criar PIX:', err.message)
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processarCartao(supabase: any, pagamento: any, config: any, body: any, corsHeaders: Record<string, string>) {
  const { tipo, card, cpf: cpfManual } = body

  if (!card?.numero || !card?.nome || !card?.validade || !card?.cvv) {
    return jsonError('Dados do cartão incompletos', 400, corsHeaders)
  }

  // Validar formato básico do cartão
  const cardNumClean = String(card.numero).replace(/\D/g, '')
  if (cardNumClean.length < 13 || cardNumClean.length > 19) {
    return jsonError('Número do cartão inválido', 400, corsHeaders)
  }
  if (String(card.cvv).replace(/\D/g, '').length < 3) {
    return jsonError('CVV inválido', 400, corsHeaders)
  }

  let cpfFinal: string | null = null

  if (pagamento.paroquiano_id) {
    const { data: paroquiano } = await supabase
      .from('paroquianos')
      .select('cpf')
      .eq('id', pagamento.paroquiano_id)
      .maybeSingle()

    cpfFinal = paroquiano?.cpf?.replace(/\D/g, '') || null
  } else {
    cpfFinal = cpfManual ? String(cpfManual).replace(/\D/g, '') : null

    if (!cpfFinal || cpfFinal.length !== 11) {
      return jsonError('CPF obrigatório para pagamento com cartão', 400, corsHeaders)
    }
  }

  if (config.modo === 'simulacao') {
    const primeiros4 = cardNumClean.slice(0, 4)
    if (primeiros4 === '0000' || primeiros4 === '1111') {
      await supabase.from('pagamentos').update({
        gateway_status: 'simulacao_recusado',
      }).eq('id', pagamento.id)
      return new Response(JSON.stringify({ success: false, message: 'Cartão recusado (simulação)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const pagoEm = new Date().toISOString()
    await supabase.from('pagamentos').update({
      status: 'pago',
      pago_em: pagoEm,
      gateway_id: `SIM_CARD_${Date.now()}`,
      gateway_status: 'simulacao_aprovado',
    }).eq('id', pagamento.id)

    return new Response(JSON.stringify({
      success: true,
      simulacao: true,
      pago_em: pagoEm,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── Dispatcher: provedores alternativos ──
  const providerId = getProviderId(config)
  if (providerId !== 'rede') {
    const [mesStr, anoStr] = card.validade.split('/')
    const expMonth = parseInt(mesStr, 10)
    const expYear = 2000 + parseInt(anoStr ?? '', 10)
    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) return jsonError('Mês de validade inválido', 400, corsHeaders)
    if (isNaN(expYear) || expYear < 2024 || expYear > 2099) return jsonError('Ano de validade inválido', 400, corsHeaders)
    const r = await providerCreateCard(config, {
      amount: Math.round(Number(pagamento.valor) * 100),
      reference: gerarReference(pagamento.id),
      tipo: tipo === 'credito' ? 'credito' : 'debito',
      card: {
        numero: cardNumClean,
        nome: card.nome,
        expMonth, expYear,
        cvv: String(card.cvv),
      },
      consumer: cpfFinal ? { taxId: cpfFinal, name: card.nome } : undefined,
      installments: tipo === 'credito' ? 1 : undefined,
    })
    const pagoEm = new Date().toISOString()
    const safePayload = sanitizeGatewayPayload(r.raw)
    await supabase.from('pagamentos').update({
      status: r.approved ? 'pago' : 'cancelado',
      pago_em: r.approved ? pagoEm : null,
      gateway_id: r.gatewayId,
      gateway_status: r.status || (r.approved ? 'aprovado' : 'recusado'),
      gateway_payload: safePayload,
      provedor: providerId,
    }).eq('id', pagamento.id)
    if (!r.approved) {
      return new Response(JSON.stringify({ success: false, message: r.errorMessage || 'Cartão recusado', provedor: providerId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    return new Response(JSON.stringify({ success: true, pago_em: pagoEm, gateway_id: r.gatewayId, provedor: providerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const accessToken = await getOAuthToken(config)
    const baseUrl = config.modo === 'producao'
      ? (config.producao_url || 'https://api.userede.com.br/erede')
      : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

    const valorCentavos = Math.round(Number(pagamento.valor) * 100)
    const [mesStr, anoStr] = card.validade.split('/')
    const expMonth = parseInt(mesStr, 10)
    const expYear = 2000 + parseInt(anoStr ?? '', 10)

    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
      return jsonError('Mês de validade inválido', 400, corsHeaders)
    }
    if (isNaN(expYear) || expYear < 2024 || expYear > 2099) {
      return jsonError('Ano de validade inválido', 400, corsHeaders)
    }

    if (!config.merchant_id) {
      return jsonError('merchant_id não configurado', 500, corsHeaders)
    }

    const reference = gerarReference(pagamento.id)
    const affiliationNum = parseInt(config.merchant_id, 10)
    if (isNaN(affiliationNum)) {
      return jsonError(`merchant_id inválido`, 500, corsHeaders)
    }

    const isCredit = tipo === 'credito'
    const cardPayload: Record<string, unknown> = {
      kind: isCredit ? 'credit' : 'debit',
      amount: valorCentavos,
      reference,
      cardNumber: cardNumClean,
      cardholderName: card.nome,
      expirationMonth: expMonth,
      expirationYear: expYear,
      securityCode: String(card.cvv),
    }

    if (isCredit) {
      cardPayload.installments = 1
    }

    if (cpfFinal) {
      cardPayload.consumer = {
        taxId: cpfFinal,
        name: card.nome,
      }
    }

    // Log seguro: apenas últimos 4 dígitos
    console.log('Cartão processado:', {
      tipo: isCredit ? 'credit' : 'debit',
      amount: valorCentavos,
      cardLast4: cardNumClean.slice(-4),
      reference,
    })

    const cardResp = await fetchWithRetry(`${baseUrl}/v2/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardPayload),
    })

    const cardContentType = cardResp.headers.get('content-type') || ''
    let cardData: any
    if (cardContentType.includes('application/json')) {
      cardData = await cardResp.json()
    } else {
      const rawText = await cardResp.text()
      console.error('Resposta não-JSON da API Rede (cartão):', rawText.substring(0, 100))
      throw new Error(`Erro API Rede (${cardResp.status}): resposta inválida`)
    }

    if (!cardResp.ok) {
      if (cardData?.returnCode) {
        const friendlyMsg = getRedeMessage(cardData.returnCode, cardData.returnMessage)
        const safePayload = sanitizeGatewayPayload(cardData)
        await supabase.from('pagamentos').update({
          status: 'cancelado',
          gateway_id: cardData.tid || cardData.id,
          gateway_status: cardData.returnMessage || 'recusado',
          gateway_payload: safePayload,
        }).eq('id', pagamento.id)
        return new Response(JSON.stringify({
          success: false,
          message: friendlyMsg,
          returnCode: String(cardData.returnCode),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        success: false,
        message: `Erro do gateway Rede (HTTP ${cardResp.status}). Tente novamente ou verifique os dados do cartão.`,
        httpStatus: cardResp.status,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aprovado = isApproved(cardData.returnCode)
    const pagoEm = new Date().toISOString()
    const safePayload = sanitizeGatewayPayload(cardData)

    await supabase.from('pagamentos').update({
      status: aprovado ? 'pago' : 'cancelado',
      pago_em: aprovado ? pagoEm : null,
      gateway_id: cardData.tid || cardData.id,
      gateway_status: cardData.returnMessage || (aprovado ? 'aprovado' : 'recusado'),
      gateway_payload: safePayload,
    }).eq('id', pagamento.id)

    if (!aprovado) {
      const friendlyMsg = getRedeMessage(cardData.returnCode, cardData.returnMessage)
      return new Response(JSON.stringify({
        success: false,
        message: friendlyMsg,
        returnCode: String(cardData.returnCode),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      pago_em: pagoEm,
      gateway_id: cardData.tid || cardData.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Erro ao processar cartão:', err.message)
    return new Response(JSON.stringify({ success: false, message: err.message || 'Erro interno ao processar cartão' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Remove dados sensíveis do payload do gateway antes de salvar no banco
 */
function sanitizeGatewayPayload(data: any): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}
  const safe = { ...data }
  // Remover dados de cartão que possam estar na resposta
  delete safe.cardNumber
  delete safe.securityCode
  delete safe.cardholderName
  delete safe.consumer
  // Mascarar BIN se presente
  if (safe.cardBin) {
    safe.cardBin = String(safe.cardBin).slice(0, 4) + '****'
  }
  if (safe.last4) {
    safe.last4 = safe.last4
  }
  return safe
}
