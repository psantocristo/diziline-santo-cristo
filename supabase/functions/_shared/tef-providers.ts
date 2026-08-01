/**
 * Camada de abstração para múltiplos provedores TEF (pinpad físico).
 * Cada provedor é um middleware local que escuta numa porta e expõe
 * endpoints HTTP — o que muda é o formato do payload.
 *
 * Suportados:
 *   - connect_tef    (padrão atual — Connect TEF da Rede)
 *   - sipag          (Sicredi Sipag Integrado / Sitef)
 *   - pagarme_stone  (Pagar.me Maquininha / Stone TEF)
 *   - paygo          (PayGo / SiTef genérico)
 */

import { withRetry, log } from './logger.ts'

export type TefProviderId = 'connect_tef' | 'sipag' | 'pagarme_stone' | 'paygo'

export interface TefPaymentInput {
  amount: number           // centavos
  type: 'credit' | 'debit'
  installments?: number
  reference: string
  terminalId?: string
}

export interface TefResult {
  success: boolean
  status: 'aprovado' | 'aguardando' | 'recusado' | 'erro'
  transactionId?: string
  message?: string
  raw?: any
}

function authHeaders(config: any): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.middleware_token) h['Authorization'] = `Bearer ${config.middleware_token}`
  return h
}

function getTefProviderId(config: any): TefProviderId {
  const p = String(config?.provedor_tef || 'connect_tef').toLowerCase()
  if (['sipag', 'pagarme_stone', 'paygo'].includes(p)) return p as TefProviderId
  return 'connect_tef'
}

function buildPath(provider: TefProviderId, endpoint: 'create' | 'status', txId?: string): string {
  switch (provider) {
    case 'sipag':
      return endpoint === 'create' ? '/sipag/transacao' : `/sipag/transacao/${txId}`
    case 'pagarme_stone':
      return endpoint === 'create' ? '/stone/charges' : `/stone/charges/${txId}`
    case 'paygo':
      return endpoint === 'create' ? '/paygo/iniciar' : `/paygo/consultar/${txId}`
    default:
      return endpoint === 'create' ? '/transactions' : `/transactions/${txId}`
  }
}

/**
 * Endpoint de health-check por provedor.
 * Cada middleware expõe um caminho distinto para "ping" — usar `/status` genérico
 * provoca falsos negativos com Sipag (/v1/ping), Stone (/StoneCode/ping), etc.
 */
function buildHealthPath(provider: TefProviderId): string {
  switch (provider) {
    case 'sipag':         return '/v1/ping'
    case 'pagarme_stone': return '/StoneCode/ping'
    case 'paygo':         return '/paygo/status'
    default:              return '/status'
  }
}

function buildCreatePayload(provider: TefProviderId, input: TefPaymentInput): Record<string, unknown> {
  switch (provider) {
    case 'sipag':
      return {
        valor: input.amount,
        tipo: input.type === 'credit' ? 'CREDITO' : 'DEBITO',
        parcelas: input.installments || 1,
        referencia: input.reference,
        terminal: input.terminalId,
      }
    case 'pagarme_stone':
      return {
        amount: input.amount,
        payment_method: input.type === 'credit' ? 'credit_card' : 'debit_card',
        installments: input.installments || 1,
        reference_id: input.reference,
        stone_code: input.terminalId,
      }
    case 'paygo':
      return {
        operacao: input.type === 'credit' ? 'CRT' : 'DBT',
        valor: (input.amount / 100).toFixed(2),
        parcelas: input.installments || 1,
        documento: input.reference,
      }
    default:
      return {
        amount: input.amount,
        type: input.type,
        installments: input.installments || 1,
        terminal_id: input.terminalId,
        reference: input.reference,
      }
  }
}

function parseTefResponse(provider: TefProviderId, data: any): { status: TefResult['status']; transactionId?: string; message?: string } {
  if (!data) return { status: 'erro', message: 'Resposta vazia do middleware TEF' }
  switch (provider) {
    case 'sipag': {
      const s = String(data.status || data.situacao || '').toUpperCase()
      if (s === 'APROVADO' || s === 'CONFIRMADA') return { status: 'aprovado', transactionId: data.nsu || data.id, message: data.mensagem }
      if (s === 'NEGADO' || s === 'CANCELADO') return { status: 'recusado', transactionId: data.nsu, message: data.mensagem }
      return { status: 'aguardando', transactionId: data.nsu || data.id }
    }
    case 'pagarme_stone': {
      const s = String(data.status || '').toLowerCase()
      if (s === 'paid' || s === 'authorized') return { status: 'aprovado', transactionId: data.id, message: data.message }
      if (s === 'failed' || s === 'canceled') return { status: 'recusado', transactionId: data.id, message: data.message }
      return { status: 'aguardando', transactionId: data.id }
    }
    case 'paygo': {
      const code = String(data.codigoResposta || data.codigo || '').trim()
      if (code === '0' || code === '00') return { status: 'aprovado', transactionId: data.nsuHost || data.nsu, message: data.mensagem }
      if (code) return { status: 'recusado', transactionId: data.nsu, message: data.mensagem }
      return { status: 'aguardando', transactionId: data.nsu }
    }
    default: {
      const s = String(data.status || '').toLowerCase()
      if (s === 'approved') return { status: 'aprovado', transactionId: data.transaction_id || data.id, message: data.message }
      if (s === 'declined' || s === 'error') return { status: 'recusado', transactionId: data.transaction_id, message: data.message }
      return { status: 'aguardando', transactionId: data.transaction_id || data.id }
    }
  }
}

export async function tefTestConnection(config: any): Promise<{ ok: boolean; message: string }> {
  if (!config.middleware_url) return { ok: false, message: 'URL do middleware não configurada' }
  const provider = getTefProviderId(config)
  const healthPath = buildHealthPath(provider)
  try {
    const resp = await fetch(`${config.middleware_url}${healthPath}`, {
      method: 'GET',
      headers: authHeaders(config),
      signal: AbortSignal.timeout((config.timeout_segundos || 10) * 1000),
    })
    if (!resp.ok) return { ok: false, message: `Middleware ${provider} retornou ${resp.status}` }
    return { ok: true, message: `Conectado ao middleware ${provider}` }
  } catch (e: any) {
    return { ok: false, message: `Falha (${provider}): ${e.message}` }
  }
}

export async function tefCreatePayment(config: any, input: TefPaymentInput): Promise<TefResult> {
  if (!config.middleware_url) return { success: false, status: 'erro', message: 'URL do middleware não configurada' }
  const provider = getTefProviderId(config)
  try {
    // Retry exponencial: rede instável / middleware ocupado não devem falhar de imediato.
    const resp = await withRetry(
      () => fetch(`${config.middleware_url}${buildPath(provider, 'create')}`, {
        method: 'POST',
        headers: authHeaders(config),
        body: JSON.stringify(buildCreatePayload(provider, input)),
        signal: AbortSignal.timeout((config.timeout_segundos || 60) * 1000),
      }),
      { tentativas: 2, baseMs: 500, onRetry: (err, n) => log('warn', 'tef_retry', { provider, tentativa: n, erro: String(err) }) },
    )
    const ct = resp.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return { success: false, status: 'erro', message: `Middleware ${provider} retornou resposta não-JSON (${resp.status})` }
    }
    const data = await resp.json()
    if (!resp.ok) return { success: false, status: 'erro', message: data?.message || `Erro ${resp.status}`, raw: data }
    const parsed = parseTefResponse(provider, data)
    return { success: true, status: parsed.status, transactionId: parsed.transactionId, message: parsed.message, raw: data }
  } catch (e: any) {
    return { success: false, status: 'erro', message: e.message }
  }
}

export async function tefCheckStatus(config: any, txId: string): Promise<TefResult> {
  if (!config.middleware_url) return { success: false, status: 'erro', message: 'URL do middleware não configurada' }
  const provider = getTefProviderId(config)
  try {
    const resp = await fetch(`${config.middleware_url}${buildPath(provider, 'status', txId)}`, {
      method: 'GET',
      headers: authHeaders(config),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resp.ok) return { success: false, status: 'erro', message: `Middleware ${provider} ${resp.status}` }
    const data = await resp.json().catch(() => ({}))
    const parsed = parseTefResponse(provider, data)
    return { success: true, status: parsed.status, transactionId: parsed.transactionId, message: parsed.message, raw: data }
  } catch (e: any) {
    return { success: false, status: 'erro', message: e.message }
  }
}