import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getRedeMessage, isApproved } from '../_shared/rede-codes.ts'
import {
  getProviderId,
  providerCreatePix,
  providerCreateCard,
  providerTestConnection,
  sicrediDiagnostics,
  sicrediWebhookRegister,
  sicrediWebhookUrl,
} from '../_shared/payment-providers.ts'


function formatRedeDateTime(date: Date): string {
  // Formato 24 chars: "YYYY-MM-DDThh:mm:ss-0300"
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const datePart = brt.toISOString().split('.')[0] // "YYYY-MM-DDTHH:MM:SS"
  return `${datePart}-0300` // 24 caracteres
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {


  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validar JWT localmente via getClaims (mais rápido que getUser, sem round-trip)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = claimsData.claims.sub as string

    // Usar service role para verificar role e ler config sensível
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar a role do usuário autenticado
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['dizimista', 'admin', 'super_admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const userRole = roleData?.role ?? null

    const body = await req.json()
    const { action } = body

    // Ação de teste de conexão: restrita a super_admin
    if (action === 'test-connection') {
      if (userRole !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: apenas super_admin pode testar a conexão' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return await testConnection(supabaseAdmin, corsHeaders)
    }

    // Diagnóstico Sicredi (proxy mTLS → OAuth → cobrança → status → webhook)
    if (action === 'sicredi-diagnostics' || action === 'sicredi-webhook-register') {
      if (userRole !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: apenas super_admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const config = await getConfig(supabaseAdmin)
      if (getProviderId(config) !== 'sicredi') {
        return new Response(
          JSON.stringify({ error: 'O provedor ativo não é o Sicredi. Ative-o em Configurações → Gateway.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (action === 'sicredi-webhook-register') {
        const r = await sicrediWebhookRegister(config)
        return new Response(JSON.stringify(r), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const r = await sicrediDiagnostics(config, { criarCobranca: body.criarCobranca === true })
      return new Response(JSON.stringify({ ...r, webhookUrl: sicrediWebhookUrl(), modo: config.modo }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // PIX e cartão: permitido para usuário autenticado dono do pagamento
    if (action === 'create-pix') {
      return await createPixTransaction(supabaseAdmin, body, userId, userRole, corsHeaders)
    }

    if (action === 'create-card') {
      return await createCardTransaction(supabaseAdmin, body, userId, userRole, corsHeaders)
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('Erro no rede-gateway:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getConfig(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from('configuracoes_gateway')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) throw new Error('Configurações do gateway não encontradas')
  return data
}

async function getOAuthToken(config: any): Promise<string> {
  const clientId = config.client_id
  const clientSecret = config.client_secret

  if (!clientId || !clientSecret) {
    throw new Error('Client ID (PV) e Client Secret não configurados. Configure-os em Administração → Configurações.')
  }

  const oauthUrl = config.modo === 'producao'
    ? (config.oauth_url_producao || 'https://api.userede.com.br/redelabs/oauth2/token')
    : (config.oauth_url_sandbox || 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token')

  const credentials = btoa(`${clientId}:${clientSecret}`)

  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Falha na autenticação OAuth (${resp.status}): ${body}`)
  }

  const tokenData = await resp.json()
  if (!tokenData.access_token) {
    throw new Error('Token de acesso não retornado pela API da Rede')
  }

  return tokenData.access_token
}

async function testConnection(supabaseAdmin: any, corsHeaders: Record<string, string>) {
  try {
    const config = await getConfig(supabaseAdmin)

    // Dispatcher para Sicredi/Pagar.me
    const provider = getProviderId(config)
    if (provider !== 'rede') {
      if (config.modo === 'simulacao') {
        return new Response(JSON.stringify({
          success: false,
          message: `Modo Simulação ativo (provedor: ${provider}). Mude para Sandbox ou Produção para testar.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const r = await providerTestConnection(config)
      await supabaseAdmin.from('logs_auditoria').insert({
        acao: 'test_connection_gateway',
        entidade: 'configuracoes_gateway',
        detalhes: { provedor: provider, modo: config.modo, ok: r.ok },
      })
      return new Response(JSON.stringify({ success: r.ok, message: r.message, provedor: provider, modo: config.modo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (config.modo === 'simulacao') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Modo Simulação ativo. Mude para Sandbox ou Produção para testar a conexão real.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Se o token foi gerado com sucesso, as credenciais OAuth são válidas.
    // Não é necessário verificar o endpoint de transações — um 401 nele é esperado
    // quando se usa credenciais de produção contra o ambiente sandbox e vice-versa.
    const accessToken = await getOAuthToken(config)

    // Verificação secundária opcional — tratamos 401 como "credenciais OK, ambiente errado"
    let endpointStatus: number | null = null
    try {
      const baseUrl = config.modo === 'producao'
        ? (config.producao_url || 'https://api.userede.com.br/erede')
        : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

      const checkResp = await fetch(`${baseUrl}/v2/transactions?reference=TEST_CONN`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      endpointStatus = checkResp.status
    } catch (_) {
      // Ignorar erros de rede no check secundário
    }

    // Registrar log de auditoria
    await supabaseAdmin.from('logs_auditoria').insert({
      acao: 'test_connection_rede',
      entidade: 'configuracoes_gateway',
      detalhes: { modo: config.modo, oauth_ok: true, endpoint_status: endpointStatus },
    })

    const endpointNote = endpointStatus === 401
      ? ' (endpoint de transações retornou 401 — esperado quando usando credenciais de produção no modo sandbox)'
      : endpointStatus ? ` (endpoint HTTP ${endpointStatus})` : ''

    return new Response(JSON.stringify({
      success: true,
      message: `✅ Credenciais OAuth válidas! Token gerado com sucesso (modo: ${config.modo})${endpointNote}`,
      modo: config.modo,
      oauth_ok: true,
      endpoint_status: endpointStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      message: `❌ ${err.message}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function createPixTransaction(supabaseAdmin: any, body: any, userId: string, userRole: string | null, corsHeaders: Record<string, string>) {
  try {
    const config = await getConfig(supabaseAdmin)
    const { pagamento_id, valor, referencia, descricao } = body

    if (!pagamento_id) {
      return new Response(JSON.stringify({ success: false, message: 'pagamento_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isPrivileged = userRole === 'admin' || userRole === 'super_admin'
    let pagamentoQuery = supabaseAdmin
      .from('pagamentos')
      .select('id, status, valor, user_id, origem, paroquiano_id, nome_contribuinte, cpf_contribuinte, tipo, mes_referencia, paroquianos(nome_completo, cpf)')
      .eq('id', pagamento_id)
      .eq('origem', 'web')
      .eq('status', 'aguardando_pagamento')

    if (!isPrivileged) {
      pagamentoQuery = pagamentoQuery.eq('user_id', userId)
    }

    const { data: pagamento, error: pagamentoErr } = await pagamentoQuery.maybeSingle()

    if (pagamentoErr || !pagamento) {
      return new Response(JSON.stringify({ success: false, message: 'Pagamento não encontrado ou sem permissão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 🛡️ Pré-validação: bloqueia geração de PIX se já existe dízimo pago no mesmo mês
    if (pagamento.tipo === 'dizimo' && pagamento.paroquiano_id && pagamento.mes_referencia) {
      const { data: jaPago } = await supabaseAdmin
        .from('pagamentos').select('id')
        .eq('paroquiano_id', pagamento.paroquiano_id)
        .eq('tipo', 'dizimo')
        .eq('mes_referencia', pagamento.mes_referencia)
        .eq('status', 'pago')
        .neq('id', pagamento_id)
        .limit(1).maybeSingle()
      if (jaPago) {
        await supabaseAdmin.from('pagamentos').update({
          status: 'cancelado', cancelado_em: new Date().toISOString(),
          gateway_status: 'bloqueado_dizimo_ja_pago_mes',
        }).eq('id', pagamento_id)
        return new Response(JSON.stringify({
          success: false, message: 'Este mês já foi pago.',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }


    const valorCentavos = Math.round(Number(valor || pagamento.valor) * 100)

    if (config.modo === 'simulacao') {
      const fakeQrCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865802BR5925PAROQUIA6009SAO PAULO62070503***6304${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      return new Response(JSON.stringify({
        success: true,
        simulacao: true,
        pix_qrcode: fakeQrCode,
        pix_copia_cola: fakeQrCode,
        gateway_id: `SIM_${Date.now()}`,
        expiracao: new Date(Date.now() + (config.pix_expiracao_minutos || 30) * 60 * 1000).toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Dispatcher para provedores alternativos ──
    const provider = getProviderId(config)
    if (provider !== 'rede') {
      const payerName = pagamento.nome_contribuinte || (pagamento as any).paroquianos?.nome_completo || undefined
      const payerTax = pagamento.cpf_contribuinte || (pagamento as any).paroquianos?.cpf || undefined
      const r = await providerCreatePix(config, {
        amount: valorCentavos,
        reference: referencia || pagamento_id.replace(/-/g, '').slice(0, 25),
        expiracaoMinutos: config.pix_expiracao_minutos || 30,
        descricao,
        payer: (payerName || payerTax) ? { name: payerName, taxId: payerTax } : undefined,
      })
      if (!r.success) {
        return new Response(JSON.stringify({ success: false, message: r.errorMessage || 'Falha ao gerar PIX' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      await supabaseAdmin.from('pagamentos').update({
        pix_qrcode: r.qrCode,
        pix_copia_cola: r.copyPaste,
        gateway_id: r.gatewayId,
        gateway_payload: r.raw,
        gateway_status: 'qrcode_gerado',
        provedor: provider,
      }).eq('id', pagamento_id)
      return new Response(JSON.stringify({
        success: true,
        pix_qrcode: r.qrCode,
        pix_copia_cola: r.copyPaste,
        gateway_id: r.gatewayId,
        provedor: provider,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const accessToken = await getOAuthToken(config)

    const baseUrl = config.modo === 'producao'
      ? (config.producao_url || 'https://api.userede.com.br/erede')
      : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

    const expirationDate = formatRedeDateTime(new Date(Date.now() + (config.pix_expiracao_minutos || 30) * 60 * 1000))
    
    // Primeiro, tentar SEM dateTimeExpiration para diagnosticar se o sandbox aceita PIX
    const pixPayload: Record<string, any> = {
      kind: 'Pix',
      amount: valorCentavos,
      reference: referencia || pagamento_id.replace(/-/g, '').slice(0, 16),
    }

    // Incluir dateTimeExpiration para todos os modos (sandbox e produção exigem)
    pixPayload.qrCode = {
      dateTimeExpiration: expirationDate,
    }

    // Log seguro: sem dados sensíveis
    console.log('[PIX] Modo:', config.modo, '| Valor:', valorCentavos)

    const pixResp = await fetch(`${baseUrl}/v2/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pixPayload),
    })

    const contentType = pixResp.headers.get('content-type') || ''
    let pixData: any

    if (!contentType.includes('application/json')) {
      const raw = await pixResp.text()
      console.error('[PIX] Resposta não-JSON da Rede, status:', pixResp.status)
      throw new Error(`Erro API Rede (${pixResp.status}): resposta inválida do gateway`)
    }

    try {
      pixData = await pixResp.json()
    } catch (parseErr) {
      console.error('[PIX] Falha ao parsear JSON:', parseErr)
      throw new Error('Resposta malformada do gateway de pagamento')
    }

    console.log('[PIX] Resposta status:', pixResp.status, '| returnCode:', pixData?.returnCode || '-')

    if (!pixResp.ok) {
      throw new Error(`Erro na API da Rede (${pixResp.status}): ${JSON.stringify(pixData)}`)
    }

    const qrCode =
      pixData.qrCodeResponse?.qrCodeImage ||
      pixData.pix?.qrCode ||
      pixData.qr_code ||
      null

    const copyAndPaste =
      pixData.qrCodeResponse?.qrCodeData ||
      pixData.pix?.copyAndPaste ||
      pixData.pix_copy_paste ||
      pixData.qr_code_text ||
      null

    const gatewayId = pixData.tid || pixData.id || null

    if (!qrCode && !copyAndPaste) {
      console.error('[PIX] Estrutura inesperada da resposta:', JSON.stringify(pixData))
      throw new Error('PIX gerado sem dados de QR Code/copia e cola')
    }

    // Persistir QR Code e gateway_id no banco
    await supabaseAdmin.from('pagamentos').update({
      pix_qrcode: qrCode,
      pix_copia_cola: copyAndPaste,
      gateway_id: gatewayId,
      gateway_payload: pixData,
      gateway_status: pixData.returnMessage || 'qrcode_gerado',
      provedor: 'rede',
    }).eq('id', pagamento_id)

    return new Response(JSON.stringify({
      success: true,
      pix_qrcode: qrCode,
      pix_copia_cola: copyAndPaste,
      gateway_id: gatewayId,
      gateway_payload: pixData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message || 'Erro ao gerar PIX' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function createCardTransaction(supabaseAdmin: any, body: any, userId: string, userRole: string | null, corsHeaders: Record<string, string>) {
  try {
    const config = await getConfig(supabaseAdmin)
    const { pagamento_id, tipo, card, valor } = body

    if (!pagamento_id || !card?.numero || !card?.nome || !card?.validade || !card?.cvv) {
      return new Response(JSON.stringify({ success: false, message: 'Dados do cartão incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar que o pagamento existe, é da web, pertence ao usuário (exceto admin/super_admin) e está em estado válido
    const isPrivileged = userRole === 'admin' || userRole === 'super_admin'
    let pagamentoQuery = supabaseAdmin
      .from('pagamentos')
      .select('id, status, valor, metodo, origem, user_id, tipo, mes_referencia, paroquiano_id')
      .eq('id', pagamento_id)
      .eq('origem', 'web')
      .eq('status', 'aguardando_pagamento')

    if (!isPrivileged) {
      pagamentoQuery = pagamentoQuery.eq('user_id', userId)
    }

    const { data: pagamento, error: pagErr } = await pagamentoQuery.maybeSingle()

    if (pagErr || !pagamento) {
      return new Response(JSON.stringify({ success: false, message: 'Pagamento não encontrado ou sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 🛡️ Pré-validação: bloqueia cobrança se já existe dízimo pago no mesmo mês
    if (pagamento.tipo === 'dizimo' && pagamento.paroquiano_id && pagamento.mes_referencia) {
      const { data: jaPago } = await supabaseAdmin
        .from('pagamentos')
        .select('id')
        .eq('paroquiano_id', pagamento.paroquiano_id)
        .eq('tipo', 'dizimo')
        .eq('mes_referencia', pagamento.mes_referencia)
        .eq('status', 'pago')
        .neq('id', pagamento_id)
        .limit(1)
        .maybeSingle()
      if (jaPago) {
        await supabaseAdmin.from('pagamentos').update({
          status: 'cancelado', cancelado_em: new Date().toISOString(),
          gateway_status: 'bloqueado_dizimo_ja_pago_mes',
        }).eq('id', pagamento_id)
        return new Response(JSON.stringify({
          success: false,
          message: 'Este mês já foi pago. Cobrança cancelada antes de processar o cartão.',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const valorFinal = Number(valor || pagamento.valor)
    if (!valorFinal || valorFinal <= 0 || valorFinal > 50000) {
      return new Response(JSON.stringify({ success: false, message: 'Valor inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }


    // Modo simulação
    if (config.modo === 'simulacao') {
      const primeiros4 = card.numero.slice(0, 4)
      if (primeiros4 === '0000' || primeiros4 === '1111') {
        await supabaseAdmin.from('pagamentos').update({ status: 'cancelado', cancelado_em: new Date().toISOString(), gateway_status: 'simulacao_recusado' }).eq('id', pagamento_id)
        return new Response(JSON.stringify({ success: false, message: 'Cartão recusado (simulação)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const pagoEm = new Date().toISOString()
      await supabaseAdmin.from('pagamentos').update({ status: 'pago', pago_em: pagoEm, gateway_id: `SIM_CARD_${Date.now()}`, gateway_status: 'simulacao_aprovado' }).eq('id', pagamento_id)
      return new Response(JSON.stringify({ success: true, simulacao: true, pago_em: pagoEm }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Dispatcher para provedores alternativos ──
    const provider = getProviderId(config)
    if (provider !== 'rede') {
      const [mesStr, anoStr] = card.validade.split('/')
      const r = await providerCreateCard(config, {
        amount: Math.round(valorFinal * 100),
        reference: pagamento_id.replace(/-/g, '').slice(0, 25),
        tipo: tipo === 'credito' ? 'credito' : 'debito',
        card: {
          numero: String(card.numero).replace(/\D/g, ''),
          nome: card.nome,
          expMonth: parseInt(mesStr, 10),
          expYear: 2000 + parseInt(anoStr ?? '', 10),
          cvv: String(card.cvv),
        },
        installments: tipo === 'credito' ? 1 : undefined,
      })
      const pagoEm = new Date().toISOString()
      await supabaseAdmin.from('pagamentos').update({
        status: r.approved ? 'pago' : 'cancelado',
        pago_em: r.approved ? pagoEm : null,
        cancelado_em: r.approved ? null : pagoEm,
        gateway_id: r.gatewayId,
        gateway_status: r.status || (r.approved ? 'aprovado' : 'recusado'),
        gateway_payload: r.raw,
        provedor: provider,
      }).eq('id', pagamento_id)
      if (!r.approved) {
        return new Response(JSON.stringify({ success: false, message: r.errorMessage || 'Cartão recusado', provedor: provider }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ success: true, pago_em: pagoEm, gateway_id: r.gatewayId, provedor: provider }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Modo real (sandbox ou producao)
    const accessToken = await getOAuthToken(config)
    const baseUrl = config.modo === 'producao'
      ? (config.producao_url || 'https://api.userede.com.br/erede')
      : (config.sandbox_url || 'https://sandbox-erede.useredecloud.com.br')

    const valorCentavos = Math.round(valorFinal * 100)
    const [mesStr, anoStr] = card.validade.split('/')
    const expMonth = parseInt(mesStr, 10)
    const expYear = 2000 + parseInt(anoStr ?? '', 10)

    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
      return new Response(JSON.stringify({ success: false, message: 'Mês de validade inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (isNaN(expYear) || expYear < 2024 || expYear > 2099) {
      return new Response(JSON.stringify({ success: false, message: 'Ano de validade inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const reference = pagamento_id.replace(/-/g, '').replace(/\D/g, '').slice(0, 16)

    const isCredit = tipo === 'credito'
    const cardPayload: Record<string, unknown> = {
      kind: isCredit ? 'credit' : 'debit',
      amount: valorCentavos,
      reference,
      cardNumber: card.numero,
      cardholderName: card.nome,
      expirationMonth: expMonth,
      expirationYear: expYear,
      securityCode: card.cvv,
    }

    // installments só é permitido para crédito — enviar para débito causa returnCode 54
    if (isCredit) {
      cardPayload.installments = 1
    }

    const cardResp = await fetch(`${baseUrl}/v2/transactions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    })

    const cardContentType = cardResp.headers.get('content-type') || ''
    let cardData: any
    if (cardContentType.includes('application/json')) {
      cardData = await cardResp.json()
    } else {
      const rawText = await cardResp.text()
      console.error('Resposta não-JSON (cartão web):', rawText.substring(0, 300))
      throw new Error(`Erro API Rede (${cardResp.status}): resposta inválida`)
    }

    if (!cardResp.ok) {
      const friendlyMsg = getRedeMessage(cardData?.returnCode, cardData?.returnMessage)
      await supabaseAdmin.from('pagamentos').update({
        status: 'cancelado',
        cancelado_em: new Date().toISOString(),
        gateway_status: cardData?.returnMessage || `HTTP ${cardResp.status}`,
        gateway_payload: cardData,
      }).eq('id', pagamento_id)
      return new Response(JSON.stringify({
        success: false,
        message: friendlyMsg,
        returnCode: cardData?.returnCode ? String(cardData.returnCode) : undefined,
        httpStatus: cardResp.status,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const aprovado = isApproved(cardData.returnCode)
    const pagoEm = new Date().toISOString()

    await supabaseAdmin.from('pagamentos').update({
      status: aprovado ? 'pago' : 'cancelado',
      pago_em: aprovado ? pagoEm : null,
      cancelado_em: aprovado ? null : pagoEm,
      gateway_id: cardData.tid || cardData.id,
      gateway_status: cardData.returnMessage || (aprovado ? 'aprovado' : 'recusado'),
      gateway_payload: cardData,
    }).eq('id', pagamento_id)

    if (!aprovado) {
      const friendlyMsg = getRedeMessage(cardData.returnCode, cardData.returnMessage)
      return new Response(JSON.stringify({ success: false, message: friendlyMsg, returnCode: String(cardData.returnCode) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, pago_em: pagoEm, gateway_id: cardData.tid || cardData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Erro ao processar cartão (web):', err)
    return new Response(JSON.stringify({ success: false, message: err.message || 'Erro ao processar cartão' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
