/**
 * Camada de abstração para múltiplos gateways de pagamento online.
 *
 * Provedores suportados:
 *   - rede      → e.Rede (PIX + cartão crédito/débito) — implementado inline em rede-gateway/*
 *   - sicredi   → Sicredi (PIX via API Cobranças PIX, padrão BACEN)
 *   - pagarme   → Pagar.me v5 (PIX + cartão crédito/débito)
 *
 * Todas as chamadas HTTP usam:
 *   - timeout de 30s (AbortSignal)
 *   - Idempotency-Key (UUID) para evitar cobrança duplicada
 *   - retry exponencial em erros 5xx (até 2 tentativas)
 */

export type ProviderId = 'rede' | 'sicredi' | 'pagarme'

export interface PixInput {
  amount: number          // em centavos
  reference: string       // ID interno (UUID sem hífen, máx 25-35 chars)
  expiracaoMinutos: number
  descricao?: string
  payer?: { taxId?: string; name?: string }
}

export interface PixResult {
  success: boolean
  qrCode?: string | null          // imagem base64 OU URL
  copyPaste?: string | null       // texto copia-e-cola (EMV BR-Code)
  gatewayId?: string | null
  expiracao?: string              // ISO 8601
  raw?: any
  errorMessage?: string
}

export interface CardInput {
  amount: number
  reference: string
  tipo: 'credito' | 'debito'
  card: { numero: string; nome: string; expMonth: number; expYear: number; cvv: string }
  consumer?: { taxId?: string; name?: string; email?: string }
  installments?: number
}

export interface CardResult {
  success: boolean
  approved: boolean
  gatewayId?: string | null
  status?: string
  returnCode?: string | null
  raw?: any
  errorMessage?: string
}

export interface TestResult { ok: boolean; message: string; modo?: string }
export interface StatusResult { status: 'pago' | 'aguardando' | 'cancelado' | 'desconhecido'; raw?: any }

/* ─────────────────────────────────────────────────────────────────────
 * Helpers HTTP — timeout, idempotency, retry em 5xx
 * ─────────────────────────────────────────────────────────────────── */

const HTTP_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

interface FetchOpts extends RequestInit {
  timeoutMs?: number
  retries?: number
}

async function httpRequest(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = HTTP_TIMEOUT_MS, retries = MAX_RETRIES, ...init } = opts
  let lastErr: unknown = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      // Retry só em 5xx (server-side transient)
      if (resp.status >= 500 && resp.status <= 599 && attempt < retries) {
        const backoff = 300 * Math.pow(2, attempt) // 300ms, 600ms
        await new Promise(r => setTimeout(r, backoff))
        continue
      }
      return resp
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      // Abort/network — retry com backoff
      if (attempt < retries) {
        const backoff = 300 * Math.pow(2, attempt)
        await new Promise(r => setTimeout(r, backoff))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Falha de rede ao chamar gateway')
}

function makeIdempotencyKey(reference: string): string {
  // Determinístico por referência — Pagar.me/Stripe rejeitam corpos diferentes
  // com mesma chave; assim 2 cliques no botão "Pagar" não duplicam cobrança.
  return `dizimosc-${reference}`
}

async function safeJson(resp: Response): Promise<any> {
  const ct = resp.headers.get('content-type') || ''
  if (!ct.includes('json')) {
    const txt = await resp.text().catch(() => '')
    return { _nonJson: true, _raw: txt.slice(0, 500) }
  }
  return resp.json().catch(() => ({}))
}

/* ─────────────────────────────────────────────────────────────────────
 * SICREDI — PIX (API Cobranças PIX, padrão BACEN)
 *
 * Documentação oficial: https://developer.sicredi.com.br/
 *   - OAuth2 client_credentials, scope: "cob.write cob.read pix.read"
 *   - PUT /api/v2/cob/{txid}  (criar/atualizar cobrança imediata)
 *   - GET /api/v2/cob/{txid}  (consultar)
 *
 * Pré-requisitos no painel admin (extra_config):
 *   chave_pix              → chave PIX recebedora (CNPJ/email/telefone/UUID)
 *   pix_base_url_producao  → opcional, default 'https://api-pix.sicredi.com.br'
 *   pix_base_url_sandbox   → opcional, default 'https://api-pix-h.sicredi.com.br'
 *
 * Observação importante sobre mTLS:
 *   A API de PIX da Sicredi em produção exige certificado mTLS. Edge Functions
 *   não suportam mTLS nativamente. Em produção a paróquia precisa:
 *     (a) usar sandbox para testes, OU
 *     (b) cadastrar IPs whitelisted da Sicredi (raro), OU
 *     (c) usar um proxy mTLS próprio (servidor da paróquia) e apontar
 *         pix_base_url_producao para esse proxy.
 *   Em sandbox, mTLS é dispensável — funciona direto.
 * ─────────────────────────────────────────────────────────────────── */

const sicrediTokenCache = new Map<string, { token: string; exp: number }>()

function sicrediOAuthUrl(config: any): string {
  if (config.modo === 'producao') {
    return config.oauth_url_producao
      || config.extra_config?.oauth_url_producao
      || 'https://api-pix.sicredi.com.br/oauth/token'
  }
  return config.oauth_url_sandbox
    || config.extra_config?.oauth_url_sandbox
    || 'https://api-pix-h.sicredi.com.br/oauth/token'
}

function sicrediPixBaseUrl(config: any): string {
  if (config.modo === 'producao') {
    return config.producao_url
      || config.extra_config?.pix_base_url_producao
      || 'https://api-pix.sicredi.com.br'
  }
  return config.sandbox_url
    || config.extra_config?.pix_base_url_sandbox
    || 'https://api-pix-h.sicredi.com.br'
}

/**
 * Quando a paróquia usa um proxy mTLS (ex.: Cloudflare Worker), as URLs
 * de OAuth/PIX já apontam para o proxy. Este helper injeta o header
 * `x-proxy-secret` esperado pelo proxy, lendo o valor de uma variável
 * de ambiente nomeada em `extra_config.mtls_proxy_secret_name`
 * (padrão: `SICREDI_PROXY_SECRET`).
 *
 * Se a env não existir, nenhum header é injetado — assim sandbox/local
 * continuam funcionando sem proxy.
 */
function sicrediProxyHeaders(config: any): Record<string, string> {
  const url = config.extra_config?.mtls_proxy_url
  if (!url) return {}
  const secretName = config.extra_config?.mtls_proxy_secret_name || 'SICREDI_PROXY_SECRET'
  const value = Deno.env.get(secretName)
  if (!value) return {}
  return { 'x-proxy-secret': value }
}

async function sicrediToken(config: any): Promise<string> {
  if (!config.client_id || !config.client_secret) {
    throw new Error('Sicredi: client_id/client_secret não configurados em Configurações → Gateway')
  }
  const url = sicrediOAuthUrl(config)
  const cacheKey = `${url}::${config.client_id}`
  const now = Date.now()
  const cached = sicrediTokenCache.get(cacheKey)
  if (cached && cached.exp - 30_000 > now) return cached.token

  const credentials = btoa(`${config.client_id}:${config.client_secret}`)
  const resp = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      ...sicrediProxyHeaders(config),
    },
    body: 'grant_type=client_credentials&scope=' +
      encodeURIComponent('cob.write cob.read pix.read webhook.write webhook.read'),
  })

  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    if (resp.status === 401 && t.includes('invalid_client')) {
      throw new Error(
        `Sicredi OAuth 401 invalid_client. Verifique: (1) as credenciais precisam ser as da API Pix ` +
        `(Portal → APIs de Recebimento → Pix → Certificados e credenciais, ou Internet Banking → Acesso API Pix → ` +
        `Gerenciar Credenciais) — credenciais de "Minhas Aplicações"/app do portal NÃO funcionam; ` +
        `(2) o ambiente precisa bater (credencial de homologação só funciona em ${'api-pix-h'}, produção só em api-pix); ` +
        `(3) a chamada precisa sair com o certificado mTLS (proxy) vinculado a essas credenciais.`,
      )
    }
    throw new Error(`Sicredi OAuth falhou (${resp.status}): ${t.slice(0, 200)}`)
  }

  const data = await resp.json()
  if (!data.access_token) throw new Error('Sicredi: access_token ausente na resposta OAuth')
  const ttlMs = (Number(data.expires_in) || 600) * 1000
  sicrediTokenCache.set(cacheKey, { token: data.access_token, exp: now + ttlMs })
  return data.access_token
}

/** Sicredi exige txid alfanumérico de 26 a 35 chars (BACEN). */
function sicrediTxid(reference: string): string {
  const clean = reference.replace(/[^a-zA-Z0-9]/g, '')
  // Garante mínimo de 26 chars preenchendo com hash do timestamp
  if (clean.length >= 26) return clean.slice(0, 35)
  const filler = (Date.now().toString(36) + crypto.randomUUID().replace(/-/g, ''))
    .slice(0, 26 - clean.length)
  return (clean + filler).slice(0, 35)
}

async function sicrediCreatePix(config: any, input: PixInput): Promise<PixResult> {
  try {
    const chavePix = config.extra_config?.chave_pix || config.merchant_id
    if (!chavePix) {
      return {
        success: false,
        errorMessage: 'Sicredi: chave PIX recebedora não configurada (extra_config.chave_pix)',
      }
    }

    const token = await sicrediToken(config)
    const txid = sicrediTxid(input.reference)

    // Payload padrão BACEN (BR Cobranças PIX)
    const payload: Record<string, unknown> = {
      calendario: { expiracao: input.expiracaoMinutos * 60 }, // segundos
      valor: { original: (input.amount / 100).toFixed(2) },
      chave: chavePix,
      solicitacaoPagador: (input.descricao || 'Doação à paróquia').slice(0, 140),
    }
    if (input.payer?.taxId) {
      const tax = input.payer.taxId.replace(/\D/g, '')
      payload.devedor = tax.length === 14
        ? { cnpj: tax, nome: (input.payer.name || 'Doador').slice(0, 200) }
        : { cpf: tax, nome: (input.payer.name || 'Doador').slice(0, 200) }
    }

    const url = `${sicrediPixBaseUrl(config)}/api/v2/cob/${txid}`
    const resp = await httpRequest(url, {
      method: 'PUT', // PUT com txid = idempotente por design (BACEN)
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...sicrediProxyHeaders(config),
      },
      body: JSON.stringify(payload),
    })

    const data = await safeJson(resp)
    if (!resp.ok) {
      return {
        success: false,
        errorMessage: data?.detail || data?.message || data?._raw || `Sicredi PIX erro ${resp.status}`,
        raw: data,
      }
    }

    // Resposta BACEN: { txid, status, calendario, brcode|pixCopiaECola, location/loc.id }
    const copyPaste = data.brcode || data.pixCopiaECola || null
    // Sicredi geralmente retorna apenas o copia-e-cola; QR Code é gerado no client
    // a partir do brcode. Quando vem `loc.id`, podemos pedir a imagem em
    // GET /api/v2/loc/{id}/qrcode — mas isso é opcional, o front gera o QR.

    return {
      success: true,
      qrCode: null,
      copyPaste,
      gatewayId: data.txid || txid,
      expiracao: data.calendario?.expiracao
        ? new Date(Date.now() + Number(data.calendario.expiracao) * 1000).toISOString()
        : new Date(Date.now() + input.expiracaoMinutos * 60_000).toISOString(),
      raw: data,
    }
  } catch (e: any) {
    return { success: false, errorMessage: e.message || 'Erro desconhecido Sicredi' }
  }
}

async function sicrediGetStatus(config: any, gatewayId: string): Promise<StatusResult> {
  try {
    const token = await sicrediToken(config)
    const resp = await httpRequest(
      `${sicrediPixBaseUrl(config)}/api/v2/cob/${gatewayId}`,
      { headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...sicrediProxyHeaders(config),
      } },
    )
    if (!resp.ok) return { status: 'desconhecido' }
    const data = await safeJson(resp)
    const s = String(data?.status || '').toUpperCase()
    if (['CONCLUIDA', 'CONCLUÍDA'].includes(s)) return { status: 'pago', raw: data }
    if (['REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'].includes(s)) {
      return { status: 'cancelado', raw: data }
    }
    return { status: 'aguardando', raw: data }
  } catch {
    return { status: 'desconhecido' }
  }
}

async function sicrediTest(config: any): Promise<TestResult> {
  try {
    await sicrediToken(config)
    const chave = config.extra_config?.chave_pix || config.merchant_id
    if (!chave) {
      return {
        ok: false,
        message: '⚠️ OAuth OK, mas chave PIX recebedora não configurada (extra_config.chave_pix).',
      }
    }
    return {
      ok: true,
      message: `✅ Sicredi PIX — credenciais válidas (${config.modo}) | chave: ${String(chave).slice(0, 4)}***`,
      modo: config.modo,
    }
  } catch (e: any) {
    return { ok: false, message: `❌ Sicredi: ${e.message}` }
  }
}

/* ─────────────────────────────────────────────────────────────────────
 * SICREDI — Webhook PIX (PUT/GET/DELETE /api/v2/webhook/{chave})
 *
 * O Sicredi entrega o callback no endpoint cadastrado para a chave PIX.
 * Como o BACEN prevê mTLS na entrega (que o Supabase não valida), usamos
 * um segredo compartilhado na querystring da URL cadastrada:
 *   .../webhook-pagamento?provedor=sicredi&s=<SICREDI_WEBHOOK_SECRET>
 * ─────────────────────────────────────────────────────────────────── */

function sicrediChave(config: any): string {
  const chave = config.extra_config?.chave_pix || config.merchant_id
  if (!chave) throw new Error('Chave PIX recebedora não configurada (Configurações → Gateway → Sicredi)')
  return String(chave)
}

/** URL pública do webhook desta instalação, já com o segredo compartilhado. */
export function sicrediWebhookUrl(): string {
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  const secret = Deno.env.get('SICREDI_WEBHOOK_SECRET') || ''
  const qs = secret ? `&s=${encodeURIComponent(secret)}` : ''
  return `${base}/functions/v1/webhook-pagamento?provedor=sicredi${qs}`
}

export async function sicrediWebhookRegister(config: any): Promise<{ ok: boolean; message: string; url?: string }> {
  try {
    const chave = sicrediChave(config)
    const token = await sicrediToken(config)
    const webhookUrl = sicrediWebhookUrl()
    if (!Deno.env.get('SICREDI_WEBHOOK_SECRET')) {
      return { ok: false, message: '❌ Segredo SICREDI_WEBHOOK_SECRET não configurado nos secrets do Supabase.' }
    }
    const resp = await httpRequest(`${sicrediPixBaseUrl(config)}/api/v2/webhook/${encodeURIComponent(chave)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...sicrediProxyHeaders(config),
      },
      body: JSON.stringify({ webhookUrl }),
    })
    const data = await safeJson(resp)
    if (!resp.ok) {
      return {
        ok: false,
        message: `❌ Sicredi webhook (${resp.status}): ${data?.detail || data?.message || data?._raw || 'falha ao cadastrar'}`,
      }
    }
    return { ok: true, message: '✅ Webhook cadastrado no Sicredi para a chave PIX.', url: webhookUrl }
  } catch (e: any) {
    return { ok: false, message: `❌ ${e.message}` }
  }
}

export async function sicrediWebhookGet(config: any): Promise<{ ok: boolean; message: string; url?: string }> {
  try {
    const chave = sicrediChave(config)
    const token = await sicrediToken(config)
    const resp = await httpRequest(`${sicrediPixBaseUrl(config)}/api/v2/webhook/${encodeURIComponent(chave)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...sicrediProxyHeaders(config),
      },
    })
    const data = await safeJson(resp)
    if (resp.status === 404) return { ok: false, message: '⚠️ Nenhum webhook cadastrado para esta chave PIX.' }
    if (!resp.ok) return { ok: false, message: `❌ Consulta webhook falhou (${resp.status})` }
    return { ok: true, message: `✅ Webhook ativo: ${data?.webhookUrl || '—'}`, url: data?.webhookUrl }
  } catch (e: any) {
    return { ok: false, message: `❌ ${e.message}` }
  }
}

/* ─────────────────────────────────────────────────────────────────────
 * SICREDI — Diagnóstico ponta a ponta (usado em /admin/diagnostico)
 * ─────────────────────────────────────────────────────────────────── */

export interface SicrediStep {
  id: string
  titulo: string
  ok: boolean
  detalhe: string
  extra?: Record<string, unknown>
}

export async function sicrediDiagnostics(
  config: any,
  opts: { criarCobranca?: boolean } = {},
): Promise<{ steps: SicrediStep[]; ok: boolean }> {
  const steps: SicrediStep[] = []
  const push = (s: SicrediStep) => { steps.push(s); return s.ok }

  // 1) Proxy mTLS
  const proxyUrl: string | undefined = config.extra_config?.mtls_proxy_url
  const secretName = config.extra_config?.mtls_proxy_secret_name || 'SICREDI_PROXY_SECRET'
  if (proxyUrl) {
    const temSegredo = !!Deno.env.get(secretName)
    let detalhe = ''
    let ok = false
    try {
      const r = await httpRequest(`${proxyUrl.replace(/\/$/, '')}/status`, {
        headers: temSegredo ? { 'x-proxy-secret': Deno.env.get(secretName)! } : {},
      })
      const body = await safeJson(r)
      ok = r.ok
      detalhe = ok
        ? `Proxy online (${body?.host || proxyUrl})`
        : `Proxy respondeu ${r.status}${r.status === 403 ? ' — segredo divergente' : ''}`
    } catch (e: any) {
      detalhe = `Proxy inacessível: ${e.message}`
    }
    if (!temSegredo) detalhe += ` | ⚠️ secret "${secretName}" ausente no Supabase`
    push({ id: 'proxy', titulo: 'Proxy mTLS (Cloudflare Worker)', ok, detalhe })
  } else {
    push({
      id: 'proxy',
      titulo: 'Proxy mTLS (Cloudflare Worker)',
      ok: true,
      detalhe: 'Não configurado — ok para homologação/sandbox. Obrigatório em produção.',
    })
  }

  // 2) OAuth
  let token = ''
  try {
    token = await sicrediToken(config)
    push({ id: 'oauth', titulo: 'OAuth2 client_credentials', ok: true, detalhe: `Token obtido (${token.slice(0, 8)}…)` })
  } catch (e: any) {
    push({ id: 'oauth', titulo: 'OAuth2 client_credentials', ok: false, detalhe: e.message })
    return { steps, ok: false }
  }

  // 3) Chave PIX + cobrança de teste
  let txid: string | null = null
  try {
    const chave = sicrediChave(config)
    if (opts.criarCobranca) {
      const r = await sicrediCreatePix(config, {
        amount: 1,
        reference: `diag${crypto.randomUUID().replace(/-/g, '')}`,
        descricao: 'Teste de integração Diziline',
        expiracaoMinutos: 15,
      })
      txid = r.gatewayId || null
      push({
        id: 'cob',
        titulo: 'Cobrança PIX de teste (R$ 0,01)',
        ok: r.success,
        detalhe: r.success ? `txid ${txid}` : (r.errorMessage || 'falha'),
        extra: r.success ? { copyPaste: r.copyPaste, txid } : undefined,
      })
    } else {
      push({ id: 'cob', titulo: 'Chave PIX recebedora', ok: true, detalhe: `${chave.slice(0, 4)}***` })
    }
  } catch (e: any) {
    push({ id: 'cob', titulo: 'Cobrança PIX de teste', ok: false, detalhe: e.message })
  }

  // 4) Consulta de status da cobrança criada
  if (txid) {
    const st = await sicrediGetStatus(config, txid)
    push({
      id: 'status',
      titulo: 'Consulta de status da cobrança',
      ok: st.status !== 'desconhecido',
      detalhe: `status = ${st.status}`,
    })
  }

  // 5) Webhook
  const wh = await sicrediWebhookGet(config)
  push({
    id: 'webhook',
    titulo: 'Webhook PIX registrado',
    ok: wh.ok,
    detalhe: wh.message,
    extra: { esperado: sicrediWebhookUrl() },
  })

  return { steps, ok: steps.every((s) => s.ok) }
}


/* ─────────────────────────────────────────────────────────────────────
 * PAGAR.ME v5 — Basic Auth com Secret Key, Idempotency-Key, retry 5xx
 * Documentação: https://docs.pagar.me/reference
 *
 * Não há host de sandbox — o modo é determinado pela própria chave
 * (sk_test_* vs sk_live_*). A UI deve avisar o admin de usar a chave
 * correta de acordo com config.modo.
 * ─────────────────────────────────────────────────────────────────── */

const PAGARME_BASE = 'https://api.pagar.me/core/v5'

function pagarmeSecretKey(config: any): string {
  // Prioridade 1: variável de ambiente referenciada (mais seguro — não trafega no banco)
  if (config.api_key_secret_name) {
    const v = Deno.env.get(config.api_key_secret_name)
    if (v) return v
  }
  // Prioridade 2: campo direto (compatibilidade)
  if (config.api_key) return config.api_key
  throw new Error('Pagar.me: Secret Key não configurada em Configurações → Gateway')
}

function pagarmeHeaders(config: any, idempotencyKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Authorization': `Basic ${btoa(`${pagarmeSecretKey(config)}:`)}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (idempotencyKey) h['Idempotency-Key'] = idempotencyKey
  return h
}

/** Validação ambiente vs chave — evita usar chave de teste em prod e vice-versa. */
function pagarmeCheckKeyMode(config: any): void {
  let key = ''
  try { key = pagarmeSecretKey(config) } catch { return }
  const isTest = key.startsWith('sk_test_')
  const isLive = key.startsWith('sk_') && !isTest
  if (config.modo === 'producao' && isTest) {
    throw new Error('Pagar.me: você está em modo PRODUÇÃO mas a Secret Key é de TESTE (sk_test_*). Troque para sk_live_*.')
  }
  if (config.modo === 'sandbox' && isLive) {
    throw new Error('Pagar.me: você está em modo SANDBOX mas a Secret Key é de PRODUÇÃO. Troque para sk_test_*.')
  }
}

function pagarmeCustomerPayload(input: { consumer?: { taxId?: string; name?: string; email?: string } }, fallbackName: string, reference: string) {
  const taxIdRaw = input.consumer?.taxId?.replace(/\D/g, '')
  const taxIdValid = taxIdRaw && (taxIdRaw.length === 11 || taxIdRaw.length === 14) ? taxIdRaw : null
  const customer: Record<string, unknown> = {
    name: input.consumer?.name || fallbackName || 'Doador',
    // E-mail único por pagamento evita problemas de dedupe do Pagar.me
    email: input.consumer?.email || `doador+${reference}@paroquiasantocristo.com.br`,
    type: 'individual',
  }
  if (taxIdValid) {
    customer.document = taxIdValid
    customer.document_type = taxIdValid.length === 14 ? 'cnpj' : 'cpf'
  }
  return customer
}

async function pagarmeCreatePix(config: any, input: PixInput): Promise<PixResult> {
  try {
    pagarmeCheckKeyMode(config)
    const idempotencyKey = makeIdempotencyKey(`pix-${input.reference}`)

    const payload = {
      items: [{
        amount: input.amount,
        description: (input.descricao || 'Doação à paróquia').slice(0, 256),
        quantity: 1,
      }],
      customer: pagarmeCustomerPayload({ consumer: input.payer ? { taxId: input.payer.taxId, name: input.payer.name } : undefined }, 'Doador', input.reference),
      payments: [{
        payment_method: 'pix',
        pix: {
          expires_in: input.expiracaoMinutos * 60,
          additional_information: [{ name: 'Origem', value: 'DizimoSC' }],
        },
      }],
      code: input.reference,
    }

    const resp = await httpRequest(`${PAGARME_BASE}/orders`, {
      method: 'POST',
      headers: pagarmeHeaders(config, idempotencyKey),
      body: JSON.stringify(payload),
    })
    const data = await safeJson(resp)

    if (!resp.ok) {
      const msg = data?.errors
        ? Object.values(data.errors).flat().join('; ')
        : data?.message || `Pagar.me PIX erro ${resp.status}`
      return { success: false, errorMessage: msg, raw: data }
    }

    const charge = data?.charges?.[0]
    const lastTx = charge?.last_transaction
    if (!lastTx?.qr_code && !lastTx?.qr_code_url) {
      return { success: false, errorMessage: 'Pagar.me retornou ordem sem QR Code', raw: data }
    }

    return {
      success: true,
      qrCode: lastTx.qr_code_url || null,       // URL da imagem PNG do QR
      copyPaste: lastTx.qr_code || null,         // EMV BR-Code
      gatewayId: charge?.id || data?.id || null, // ID da charge (usado em status/webhook)
      expiracao: lastTx.expires_at
        || new Date(Date.now() + input.expiracaoMinutos * 60_000).toISOString(),
      raw: data,
    }
  } catch (e: any) {
    return { success: false, errorMessage: e.message || 'Erro desconhecido Pagar.me' }
  }
}

async function pagarmeCreateCard(config: any, input: CardInput): Promise<CardResult> {
  try {
    pagarmeCheckKeyMode(config)
    const idempotencyKey = makeIdempotencyKey(`card-${input.reference}`)
    const isCredit = input.tipo === 'credito'

    const cardData = {
      number: input.card.numero.replace(/\D/g, ''),
      holder_name: input.card.nome.trim().toUpperCase(),
      exp_month: input.card.expMonth,
      exp_year: input.card.expYear,
      cvv: input.card.cvv,
    }

    const payload: Record<string, unknown> = {
      items: [{
        amount: input.amount,
        description: 'Doação à paróquia',
        quantity: 1,
      }],
      customer: pagarmeCustomerPayload(input, input.card.nome, input.reference),
      payments: [{
        payment_method: isCredit ? 'credit_card' : 'debit_card',
        [isCredit ? 'credit_card' : 'debit_card']: isCredit
          ? {
              installments: Math.max(1, Math.min(12, input.installments || 1)),
              statement_descriptor: 'PAROQUIASC',
              card: cardData,
              operation_type: 'auth_and_capture',
            }
          : {
              statement_descriptor: 'PAROQUIASC',
              card: cardData,
            },
      }],
      code: input.reference,
    }

    const resp = await httpRequest(`${PAGARME_BASE}/orders`, {
      method: 'POST',
      headers: pagarmeHeaders(config, idempotencyKey),
      body: JSON.stringify(payload),
    })
    const data = await safeJson(resp)

    if (!resp.ok && resp.status >= 400 && resp.status < 500) {
      const msg = data?.errors
        ? Object.values(data.errors).flat().join('; ')
        : data?.message || `Pagar.me cartão erro ${resp.status}`
      return { success: false, approved: false, errorMessage: msg, raw: data }
    }

    const charge = data?.charges?.[0]
    const status = String(charge?.status || data?.status || '').toLowerCase()
    const approved = status === 'paid' || status === 'authorized'
    const lastTx = charge?.last_transaction

    return {
      success: resp.ok,
      approved,
      gatewayId: charge?.id || data?.id || null,
      status: charge?.status || data?.status || (approved ? 'paid' : 'failed'),
      returnCode: lastTx?.acquirer_return_code || lastTx?.gateway_response?.code || null,
      raw: data,
      errorMessage: approved
        ? undefined
        : (lastTx?.acquirer_message
          || lastTx?.gateway_response?.errors?.[0]?.message
          || data?.message
          || `Pagar.me recusou (${status || resp.status})`),
    }
  } catch (e: any) {
    return { success: false, approved: false, errorMessage: e.message || 'Erro desconhecido Pagar.me' }
  }
}

async function pagarmeGetStatus(config: any, gatewayId: string): Promise<StatusResult> {
  try {
    pagarmeCheckKeyMode(config)
    const resp = await httpRequest(
      `${PAGARME_BASE}/charges/${gatewayId}`,
      { headers: pagarmeHeaders(config) },
    )
    if (!resp.ok) return { status: 'desconhecido' }
    const data = await safeJson(resp)
    const s = String(data?.status || '').toLowerCase()
    if (['paid', 'authorized'].includes(s)) return { status: 'pago', raw: data }
    if (['canceled', 'failed', 'expired', 'voided', 'refunded'].includes(s)) return { status: 'cancelado', raw: data }
    return { status: 'aguardando', raw: data }
  } catch {
    return { status: 'desconhecido' }
  }
}

async function pagarmeTest(config: any): Promise<TestResult> {
  try {
    pagarmeCheckKeyMode(config)
    // /merchants é endpoint de leitura barato — valida chave sem cobrar
    const resp = await httpRequest(`${PAGARME_BASE}/merchants`, { headers: pagarmeHeaders(config) })
    if (resp.status === 401) return { ok: false, message: '❌ Pagar.me: Secret Key inválida (401)' }
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return { ok: false, message: `❌ Pagar.me (HTTP ${resp.status}): ${t.slice(0, 150)}` }
    }
    return { ok: true, message: `✅ Pagar.me — Secret Key válida (modo: ${config.modo})`, modo: config.modo }
  } catch (e: any) {
    return { ok: false, message: `❌ Pagar.me: ${e.message}` }
  }
}

/* ─────────────────────────────────────────────────────────────────────
 * DISPATCHER — Sicredi/Pagar.me. Quando provedor === 'rede', o caller
 * deve usar a lógica inline em rede-gateway/rede-gateway-totem.
 * ─────────────────────────────────────────────────────────────────── */

export function getProviderId(config: any): ProviderId {
  const p = String(config?.provedor || 'rede').toLowerCase()
  if (p === 'sicredi' || p === 'pagarme') return p
  return 'rede'
}

export async function providerCreatePix(config: any, input: PixInput): Promise<PixResult> {
  const p = getProviderId(config)
  if (p === 'sicredi') return sicrediCreatePix(config, input)
  if (p === 'pagarme') return pagarmeCreatePix(config, input)
  return { success: false, errorMessage: 'Provedor não suportado neste dispatcher' }
}

export async function providerCreateCard(config: any, input: CardInput): Promise<CardResult> {
  const p = getProviderId(config)
  if (p === 'pagarme') return pagarmeCreateCard(config, input)
  if (p === 'sicredi') {
    return {
      success: false,
      approved: false,
      errorMessage: 'Sicredi: pagamento por cartão não está disponível neste integrador. Configure o totem para PIX ou troque o provedor para Pagar.me/Rede.',
    }
  }
  return { success: false, approved: false, errorMessage: 'Provedor não suportado neste dispatcher' }
}

export async function providerGetStatus(config: any, gatewayId: string): Promise<StatusResult> {
  const p = getProviderId(config)
  if (p === 'sicredi') return sicrediGetStatus(config, gatewayId)
  if (p === 'pagarme') return pagarmeGetStatus(config, gatewayId)
  return { status: 'desconhecido' }
}

export async function providerTestConnection(config: any): Promise<TestResult> {
  const p = getProviderId(config)
  if (p === 'sicredi') return sicrediTest(config)
  if (p === 'pagarme') return pagarmeTest(config)
  return { ok: false, message: 'Dispatcher chamado para provedor "rede" — use lógica inline da Rede' }
}
