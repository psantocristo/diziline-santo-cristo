/**
 * Mapeamento de returnCode da API e.Rede para mensagens amigáveis.
 * Usado nas Edge Functions (Deno).
 */

export interface RedeErrorInfo {
  codigo: string
  mensagem: string
  detalhe: string
}

const REDE_CODES: Record<string, { msg: string; det: string }> = {
  '00': { msg: 'Transação Aprovada', det: '' },
  '000': { msg: 'Transação Aprovada', det: '' },
  '74': { msg: 'Instituição sem comunicação', det: 'O banco emissor está temporariamente indisponível.' },
  '53': { msg: 'Transação Inválida', det: 'Dados da transação incorretos.' },
  '88': { msg: 'Dados ausentes', det: 'Dados obrigatórios não foram informados.' },
}

// Transação não autorizada
for (const c of ['50','52','54','55','57','59','61','62','64','66','67','68','70','71','73','75','78','79','80','82','83','84','85','87','89','90','91','93','94','95','97','99']) {
  REDE_CODES[c] = { msg: 'Transação não autorizada', det: 'O banco emissor não autorizou. Tente outro cartão ou entre em contato com o banco.' }
}
// Estabelecimento Inválido
for (const c of ['51','92','98']) {
  REDE_CODES[c] = { msg: 'Estabelecimento Inválido', det: 'Problema com credenciais do estabelecimento.' }
}
// Problemas com o cartão
for (const c of ['58','63','65','69','72','77','96']) {
  REDE_CODES[c] = { msg: 'Problemas com o cartão', det: 'Verifique os dados do cartão. Se persistir, entre em contato com a central do cartão.' }
}
// Dado Inválido
for (const c of ['56','60']) {
  REDE_CODES[c] = { msg: 'Dado Inválido', det: 'Um ou mais dados enviados são inválidos.' }
}
// Refazer transação
for (const c of ['76','86']) {
  REDE_CODES[c] = { msg: 'Refaça a transação', det: 'Dados obrigatórios ausentes. Tente novamente.' }
}

export function getRedeMessage(returnCode: string | number | null | undefined, fallbackMessage?: string): string {
  if (returnCode == null) return fallbackMessage || 'Erro desconhecido'
  const code = String(returnCode).trim()
  const info = REDE_CODES[code]
  if (info) {
    if (info.msg === 'Transação Aprovada') return info.msg
    return `${info.msg}. ${info.det}`
  }
  return fallbackMessage || `Erro desconhecido (código ${code})`
}

export function isApproved(returnCode: string | number | null | undefined): boolean {
  return ['00', '000'].includes(String(returnCode ?? '').trim())
}
