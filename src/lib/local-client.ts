/**
 * DízimoSC Local Client Bridge
 * Detecta e comunica com o client-local rodando na máquina Windows.
 */

const LOCAL_BASE = 'http://localhost:3847/api';
const PING_TIMEOUT = 3000;

// ── Token de autenticação ──────────────────────────────
const TOKEN_STORAGE_KEY = 'dizimo.localClientToken';

let _apiToken: string | null = (() => {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
})();

/**
 * Define o token de autenticação para o client local.
 * Persistido em localStorage para sobreviver a recargas do totem.
 */
export function setLocalClientToken(token: string): void {
  _apiToken = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* storage indisponível */ }
  invalidateHealthCache();
}

/** Token atualmente configurado (ou null). */
export function getLocalClientToken(): string | null {
  return _apiToken;
}


/**
 * Retorna os headers padrão incluindo autenticação
 */
function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (_apiToken) headers['X-Client-Token'] = _apiToken;
  return headers;
}

// ── Types ──────────────────────────────────────────────
export interface LocalDeviceStatus {
  connected: boolean;
  model?: string;
  error?: string;
  firmware?: string;
  serial?: string;
  lastTransaction?: {
    at: string;
    status: string;
    nsu?: string;
  };
}

export interface LocalHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  devices: {
    printer: LocalDeviceStatus;
    pinpad: LocalDeviceStatus;
  };
  uptime: number;
}

export interface LocalPrintData {
  pagamentoId?: string;
  valor: number;
  tipo: 'dizimo' | 'oferta' | 'campanha' | 'eventual';
  metodo: 'pix' | 'credito' | 'debito';
  nomeContribuinte?: string;
  mesReferencia?: string;
  dataHora: string;
  cnpj?: string;
  site?: string;
  parcelas?: number;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  pixCopiaCola?: string;
  /** Personalização do comprovante (corte da guilhotina, campos visíveis, textos). */
  config?: Partial<import('./comprovante-config').ComprovanteConfig>;

}

export interface TefPayRequest {
  pagamentoId: string;
  valor: number;
  tipo: 'credito' | 'debito';
  parcelas?: number;
}

export interface TefResult {
  success: boolean;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  message?: string;
  returnCode?: string;
}

export interface TefStatusResponse {
  status: 'pending' | 'approved' | 'declined' | 'error' | 'not_found';
  message?: string;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  returnCode?: string;
}

// ── Cache de status ──────────────────────────────────────
let _cachedHealth: LocalHealthResponse | null = null;
let _lastCheck = 0;
const CACHE_TTL = 5000; // 5s

/**
 * Verifica se o client local está rodando
 */
export async function isLocalClientRunning(): Promise<boolean> {
  try {
    const health = await getLocalHealth();
    return health !== null;
  } catch {
    return false;
  }
}

/**
 * Busca o health check do client local (com cache de 5s)
 */
export async function getLocalHealth(): Promise<LocalHealthResponse | null> {
  const now = Date.now();
  if (_cachedHealth && now - _lastCheck < CACHE_TTL) return _cachedHealth;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT);

    const res = await fetch(`${LOCAL_BASE}/health`, {
      signal: controller.signal,
      headers: getHeaders(),
    });
    clearTimeout(timeout);

    if (!res.ok) { _cachedHealth = null; return null; }

    _cachedHealth = await res.json();
    _lastCheck = now;
    return _cachedHealth;
  } catch {
    _cachedHealth = null;
    return null;
  }
}

/**
 * Invalida o cache para forçar uma nova verificação
 */
export function invalidateHealthCache(): void {
  _cachedHealth = null;
  _lastCheck = 0;
}

// ── Impressora ──────────────────────────────────────────

/**
 * Imprime comprovante na impressora térmica local
 */
export async function printComprovante(data: LocalPrintData): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/print`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: 'comprovante', data }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

/**
 * Imprime página de teste
 */
export async function printTestPage(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/print/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

/**
 * Imprime QR Code PIX nativo na impressora térmica
 */
export async function printPixQrCode(pixCopiaCola: string, valor?: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/print`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: 'pix-qrcode', pixCopiaCola, valor }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

// ── TEF — Polling-based (usado pelo Totem) ──────────────

/**
 * Cria uma transação TEF no client local (retorna txId imediatamente)
 */
export async function createTefPayment(request: TefPayRequest): Promise<{ success: boolean; transaction_id?: string; message?: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/pay`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

/**
 * Consulta status de uma transação TEF por txId
 */
export async function getTefTransactionStatus(txId: string): Promise<TefStatusResponse> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/status/${encodeURIComponent(txId)}`, {
      headers: getHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { status: 'error', message: err.message || 'Client local não disponível' };
  }
}

/**
 * Confirma transação aprovada
 */
export async function confirmTefTransaction(txId: string): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/confirm/${encodeURIComponent(txId)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.success;
  } catch {
    return false;
  }
}

/**
 * Desfaz transação recusada
 */
export async function undoTefTransaction(txId: string): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/undo/${encodeURIComponent(txId)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.success;
  } catch {
    return false;
  }
}

// ── TEF — SSE-based (alternativo) ──────────────────────

/**
 * Inicia transação TEF via SSE e retorna callbacks
 */
export function startTefPayment(
  request: TefPayRequest,
  callbacks: {
    onStatus?: (step: string, message: string) => void;
    onResult?: (result: TefResult) => void;
    onError?: (message: string) => void;
  }
): { cancel: () => void } {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${LOCAL_BASE}/tef/pay/sse`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) { callbacks.onError?.('Sem resposta do client local'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
          else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'status') callbacks.onStatus?.(data.step, data.message);
              else if (currentEvent === 'result') callbacks.onResult?.(data);
              else if (currentEvent === 'error') callbacks.onError?.(data.message);
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') callbacks.onError?.(err.message || 'Erro na comunicação TEF');
    }
  })();

  return {
    cancel: () => {
      controller.abort();
      fetch(`${LOCAL_BASE}/tef/cancel`, { method: 'POST', headers: getHeaders() }).catch(() => {});
    },
  };
}

/**
 * Cancela transação TEF em andamento
 */
export async function cancelTef(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/cancel`, { method: 'POST', headers: getHeaders() });
    const data = await res.json();
    return data.success;
  } catch {
    return false;
  }
}

/**
 * Status geral do PINPad
 */
export async function getTefStatus(): Promise<LocalDeviceStatus | null> {
  try {
    const res = await fetch(`${LOCAL_BASE}/tef/status`, { headers: getHeaders() });
    return await res.json();
  } catch {
    return null;
  }
}

// ── Pedido / Loja ──────────────────────────────────────────

export interface LocalPedidoPrintData {
  codigoRetirada: string;
  total: number;
  itens: { nome: string; quantidade: number; preco: number }[];
  nomeCliente?: string;
  dataHora: Date;
}

/**
 * Imprime comprovante de pedido (código de retirada) na impressora térmica local
 */
export async function printPedido(data: LocalPedidoPrintData): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/print`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        type: 'pedido',
        pedido: {
          codigoRetirada: data.codigoRetirada,
          total: data.total,
          itens: data.itens,
          nomeCliente: data.nomeCliente,
          dataHora: data.dataHora.toISOString(),
        },
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

// ── Sistema ──────────────────────────────────────────────

/**
 * Métricas do client local
 */
export async function getLocalMetrics(): Promise<any | null> {
  try {
    const res = await fetch(`${LOCAL_BASE}/metrics`, { headers: getHeaders() });
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Reinicializa a impressora remotamente
 */
export async function restartPrinter(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${LOCAL_BASE}/restart/printer`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Client local não disponível' };
  }
}

/**
 * Status da fila de impressão
 */
export async function getPrintQueueStatus(): Promise<any | null> {
  try {
    const res = await fetch(`${LOCAL_BASE}/print/queue`, { headers: getHeaders() });
    return await res.json();
  } catch {
    return null;
  }
}
