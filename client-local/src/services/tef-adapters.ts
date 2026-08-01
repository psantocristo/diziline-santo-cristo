/**
 * Adaptadores TEF — normaliza a comunicação com diferentes middlewares de pinpad.
 *
 * Cada provedor expõe um servidor HTTP local com endpoints próprios. Este módulo
 * mapeia o payload interno {action, amount, installments, terminalId, reference}
 * para o formato de cada SDK e devolve o resultado normalizado:
 *   { approved, nsu, authCode, brand, message, returnCode }
 */
import { config } from '../config';
import logger from '../utils/logger';

export interface NormalizedTxPayload {
  action: 'credit' | 'debit';
  amount: number; // centavos
  installments: number;
  terminalId: string;
  reference: string;
}

export interface NormalizedTxResult {
  approved: boolean;
  nsu?: string;
  authCode?: string;
  brand?: string;
  message?: string;
  returnCode?: string;
  raw?: any;
}

export type ProviderId = 'connect_tef' | 'sipag' | 'pagarme_stone' | 'paygo';

interface ProviderAdapter {
  id: ProviderId;
  baseUrl(): string;
  status(): Promise<{ ok: boolean; firmware?: string; serial?: string }>;
  transaction(p: NormalizedTxPayload, timeoutMs: number): Promise<NormalizedTxResult>;
  confirm(nsu: string): Promise<boolean>;
  cancel(nsu?: string): Promise<boolean>;
}

// ── helpers ─────────────────────────────────────────────────────────────
async function postJson(url: string, body: any, timeoutMs: number) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, data: { raw: text } }; }
}

async function getJson(url: string, timeoutMs = 3000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return {}; }
}

// ── Connect TEF / SiTef (padrão original) ───────────────────────────────
const connectTefAdapter: ProviderAdapter = {
  id: 'connect_tef',
  baseUrl: () => config.tef.middlewareUrl,
  async status() {
    const data = await getJson(`${this.baseUrl()}/status`);
    return { ok: data !== null, firmware: data?.firmware, serial: data?.serial };
  },
  async transaction(p, timeoutMs) {
    const r = await postJson(`${this.baseUrl()}/transaction`, p, timeoutMs);
    const d = r.data || {};
    return {
      approved: !!d.approved,
      nsu: d.nsu,
      authCode: d.authCode,
      brand: d.brand,
      message: d.message,
      returnCode: d.returnCode,
      raw: d,
    };
  },
  async confirm(nsu) {
    const r = await postJson(`${this.baseUrl()}/confirm`, { nsu, terminalId: config.tef.terminalId }, 5000);
    return r.ok;
  },
  async cancel(nsu) {
    const r = await postJson(`${this.baseUrl()}/cancel`, { nsu, terminalId: config.tef.terminalId }, 5000);
    return r.ok;
  },
};

// ── Sipag Integrado (Sicredi) ───────────────────────────────────────────
const sipagAdapter: ProviderAdapter = {
  id: 'sipag',
  baseUrl: () => config.tef.sipagUrl,
  async status() {
    const data = await getJson(`${this.baseUrl()}/v1/ping`);
    return { ok: data !== null, firmware: data?.versao, serial: data?.serial };
  },
  async transaction(p, timeoutMs) {
    const body = {
      operacao: p.action === 'credit' ? 'VENDA_CREDITO' : 'VENDA_DEBITO',
      valorCentavos: p.amount,
      parcelas: p.installments,
      tipoParcelamento: p.installments > 1 ? 'LOJA' : 'AVISTA',
      identificadorPdv: p.terminalId,
      referencia: p.reference,
    };
    const r = await postJson(`${this.baseUrl()}/v1/transacao`, body, timeoutMs);
    const d = r.data || {};
    return {
      approved: d.codigoResposta === '00' || d.status === 'APROVADA',
      nsu: d.nsuLocal || d.nsuHost,
      authCode: d.codigoAutorizacao,
      brand: d.bandeira,
      message: d.mensagemResposta,
      returnCode: d.codigoResposta,
      raw: d,
    };
  },
  async confirm(nsu) {
    const r = await postJson(`${this.baseUrl()}/v1/confirmacao`, { nsu, identificadorPdv: config.tef.terminalId }, 5000);
    return r.ok;
  },
  async cancel(nsu) {
    const r = await postJson(`${this.baseUrl()}/v1/cancelamento`, { nsu, identificadorPdv: config.tef.terminalId }, 5000);
    return r.ok;
  },
};

// ── Pagar.me Stone Connect ──────────────────────────────────────────────
const pagarmeStoneAdapter: ProviderAdapter = {
  id: 'pagarme_stone',
  baseUrl: () => config.tef.pagarmeStoneUrl,
  async status() {
    const data = await getJson(`${this.baseUrl()}/StoneCode/ping`);
    return { ok: data !== null, firmware: data?.version, serial: data?.stoneCode };
  },
  async transaction(p, timeoutMs) {
    const body = {
      Amount: p.amount,
      InstalmentCount: p.installments,
      InstalmentType: p.installments > 1 ? 2 : 0, // 0=AVista, 2=Merchant
      Type: p.action === 'credit' ? 1 : 2,        // 1=Credit, 2=Debit
      InitiatorTransactionKey: p.reference,
    };
    const r = await postJson(`${this.baseUrl()}/Sale`, body, timeoutMs);
    const d = r.data || {};
    return {
      approved: d.Status === 0 || d.Approved === true,
      nsu: d.Nsu || d.AcquirerTransactionKey,
      authCode: d.AuthorizationCode,
      brand: d.BrandName,
      message: d.ResponseReason || d.Message,
      returnCode: d.AcquirerResponseCode,
      raw: d,
    };
  },
  async confirm() { return true; }, // Stone confirma na própria Sale
  async cancel(nsu) {
    const r = await postJson(`${this.baseUrl()}/Cancel`, { AcquirerTransactionKey: nsu }, 5000);
    return r.ok;
  },
};

// ── PayGo PGWebLib ──────────────────────────────────────────────────────
const paygoAdapter: ProviderAdapter = {
  id: 'paygo',
  baseUrl: () => config.tef.paygoUrl,
  async status() {
    const data = await getJson(`${this.baseUrl()}/status`);
    return { ok: data !== null, firmware: data?.version, serial: data?.terminal };
  },
  async transaction(p, timeoutMs) {
    const body = {
      operation: p.action === 'credit' ? 'SALE_CREDIT' : 'SALE_DEBIT',
      amountCents: p.amount,
      installments: p.installments,
      pdv: p.terminalId,
      docId: p.reference,
    };
    const r = await postJson(`${this.baseUrl()}/transaction`, body, timeoutMs);
    const d = r.data || {};
    return {
      approved: d.status === 'OK' || d.approved === true,
      nsu: d.nsu,
      authCode: d.authorization,
      brand: d.cardBrand,
      message: d.message,
      returnCode: d.returnCode,
      raw: d,
    };
  },
  async confirm(nsu) {
    const r = await postJson(`${this.baseUrl()}/confirm`, { nsu }, 5000);
    return r.ok;
  },
  async cancel(nsu) {
    const r = await postJson(`${this.baseUrl()}/cancel`, { nsu }, 5000);
    return r.ok;
  },
};

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  connect_tef: connectTefAdapter,
  sipag: sipagAdapter,
  pagarme_stone: pagarmeStoneAdapter,
  paygo: paygoAdapter,
};

export function getAdapter(): ProviderAdapter {
  const id = (config.tef.provider || 'connect_tef') as ProviderId;
  const real = ADAPTERS[id] || connectTefAdapter;

  // Em modo sandbox/simulação, envolvemos o adapter no simulador interno.
  if (config.tef.mode === 'sandbox' || config.tef.mode === 'simulacao') {
    // import lazy para evitar ciclo
    const sbx = require('./tef-sandbox') as typeof import('./tef-sandbox');
    return {
      id: real.id,
      baseUrl: () => `sandbox://${real.id}`,
      status: () => sbx.sandboxStatus(real.id),
      transaction: (p, t) => sbx.sandboxTransaction(real.id, p, t),
      confirm: (nsu) => sbx.sandboxConfirm(nsu),
      cancel: (nsu) => sbx.sandboxCancel(nsu),
    };
  }
  return real;
}

export function getActiveProviderId(): ProviderId {
  return (config.tef.provider || 'connect_tef') as ProviderId;
}