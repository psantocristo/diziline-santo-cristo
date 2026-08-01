import { config } from '../config';
import logger from '../utils/logger';
import { TefPayRequest, TefResult, DeviceStatus } from '../types';
import { getAdapter, getActiveProviderId } from './tef-adapters';

let pinpadConnected = false;
let pinpadFirmware: string | undefined;
let pinpadSerial: string | undefined;
let lastTransaction: { at: string; status: string; nsu?: string } | undefined;

// ── Transaction state management ──────────────────────────
interface TransactionState {
  status: 'pending' | 'approved' | 'declined' | 'error';
  result?: TefResult;
  message?: string;
  middlewareResponse?: any;
  createdAt: number;
}

const transactions = new Map<string, TransactionState>();

// Cleanup old transactions after 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, tx] of transactions) {
    if (tx.createdAt < cutoff) transactions.delete(id);
  }
}, 60_000);

/**
 * Verifica se o middleware TEF está acessível
 */
export async function checkTefConnection(): Promise<boolean> {
  if (!config.tef.enabled) return false;

  try {
    const st = await getAdapter().status();
    pinpadConnected = st.ok;
    if (st.firmware) pinpadFirmware = st.firmware;
    if (st.serial) pinpadSerial = st.serial;
    return pinpadConnected;
  } catch {
    pinpadConnected = false;
    return false;
  }
}

/**
 * Retorna o status do PINPad
 */
export function getPinpadStatus(): DeviceStatus {
  return {
    connected: pinpadConnected,
    model: `${getActiveProviderId()} · ${config.tef.terminalId}`,
    firmware: pinpadFirmware,
    serial: pinpadSerial,
    lastTransaction,
  };
}

export function recordLastTransaction(status: string, nsu?: string): void {
  lastTransaction = { at: new Date().toISOString(), status, nsu };
}

/**
 * Inicia uma transação TEF (não-bloqueante)
 * Retorna o txId imediatamente e processa em background
 */
export function startTransaction(request: TefPayRequest): string {
  const txId = `TEF_${Date.now()}_${request.pagamentoId.slice(0, 8)}`;

  transactions.set(txId, { status: 'pending', createdAt: Date.now(), message: 'Iniciando transação...' });

  // Processa em background
  processTransactionAsync(txId, request).catch((err) => {
    logger.error('Erro na transação TEF em background:', err);
    transactions.set(txId, {
      status: 'error',
      message: err.message || 'Erro desconhecido',
      createdAt: Date.now(),
    });
  });

  return txId;
}

/**
 * Processa a transação de forma assíncrona
 */
async function processTransactionAsync(txId: string, request: TefPayRequest): Promise<void> {
  if (!config.tef.enabled) {
    transactions.set(txId, { status: 'error', message: 'TEF desabilitado', createdAt: Date.now() });
    return;
  }

  const adapter = getAdapter();
  logger.info('Iniciando transação TEF', {
    txId,
    pagamentoId: request.pagamentoId,
    valor: request.valor,
    tipo: request.tipo,
    provider: adapter.id,
  });

  const payload = {
    action: request.tipo === 'credito' ? 'credit' : 'debit',
    amount: Math.round(request.valor * 100), // centavos
    installments: request.parcelas || 1,
    terminalId: config.tef.terminalId,
    reference: request.pagamentoId,
  } as const;

  try {
    const result = await adapter.transaction(
      { ...payload, action: payload.action as 'credit' | 'debit' },
      config.tef.timeoutSeconds * 1000,
    );

    if (result.approved) {
      const tefResult: TefResult = {
        success: true,
        nsu: result.nsu,
        autorizacao: result.authCode,
        bandeira: result.brand,
      };

      transactions.set(txId, {
        status: 'approved',
        result: tefResult,
        middlewareResponse: result,
        message: 'Pagamento aprovado!',
        createdAt: Date.now(),
      });

      recordLastTransaction('approved', result.nsu);
      logger.info('Transação TEF aprovada', { txId, pagamentoId: request.pagamentoId, nsu: result.nsu, provider: adapter.id });
    } else {
      transactions.set(txId, {
        status: 'declined',
        result: {
          success: false,
          message: result.message || 'Transação não aprovada',
          returnCode: result.returnCode,
        },
        middlewareResponse: result,
        message: result.message || 'Transação recusada',
        createdAt: Date.now(),
      });

      recordLastTransaction('declined');
      logger.warn('Transação TEF recusada', { txId, pagamentoId: request.pagamentoId, returnCode: result.returnCode, provider: adapter.id });
    }
  } catch (err: any) {
    logger.error('Erro na transação TEF:', err);
    transactions.set(txId, {
      status: 'error',
      message: err.message || 'Erro na comunicação com o PINPad',
      createdAt: Date.now(),
    });
  }
}

/**
 * Retorna o status de uma transação específica
 */
export function getTransactionStatus(txId: string): { status: string; message?: string; result?: TefResult } | null {
  const tx = transactions.get(txId);
  if (!tx) return null;
  return { status: tx.status, message: tx.message, result: tx.result };
}

/**
 * Confirma uma transação aprovada junto ao middleware
 */
export async function confirmTransaction(txId: string): Promise<boolean> {
  const tx = transactions.get(txId);
  if (!tx || tx.status !== 'approved') return false;

  try {
    await getAdapter().confirm(tx.result?.nsu || '');
    logger.info('Transação confirmada', { txId });
    return true;
  } catch (err) {
    logger.error('Erro ao confirmar transação:', err);
    return false;
  }
}

/**
 * Desfaz/estorna uma transação recusada ou com erro
 */
export async function undoTransaction(txId: string): Promise<boolean> {
  const tx = transactions.get(txId);
  if (!tx) return false;

  try {
    await getAdapter().cancel(tx.result?.nsu);
    logger.info('Transação desfeita', { txId });
    transactions.delete(txId);
    return true;
  } catch (err) {
    logger.error('Erro ao desfazer transação:', err);
    return false;
  }
}

/**
 * Cancela a transação em andamento
 */
export async function cancelTransaction(): Promise<boolean> {
  try {
    return await getAdapter().cancel();
  } catch {
    return false;
  }
}

/**
 * Inicia uma transação TEF via SSE (Server-Sent Events)
 * Mantido para compatibilidade com o fluxo SSE
 */
export async function* processPayment(
  request: TefPayRequest
): AsyncGenerator<{ event: string; data: any }> {
  if (!config.tef.enabled) {
    yield { event: 'error', data: { message: 'TEF desabilitado' } };
    return;
  }

  const adapter = getAdapter();
  logger.info('Iniciando transação TEF (SSE)', { pagamentoId: request.pagamentoId, valor: request.valor, tipo: request.tipo, provider: adapter.id });

  yield { event: 'status', data: { step: 'iniciando', message: 'Iniciando transação...' } };

  try {
    const payload = {
      action: (request.tipo === 'credito' ? 'credit' : 'debit') as 'credit' | 'debit',
      amount: Math.round(request.valor * 100),
      installments: request.parcelas || 1,
      terminalId: config.tef.terminalId,
      reference: request.pagamentoId,
    };

    yield { event: 'status', data: { step: 'aguardando_cartao', message: 'Insira ou aproxime o cartão no PINPad' } };

    const result = await adapter.transaction(payload, config.tef.timeoutSeconds * 1000);

    if (result.approved) {
      yield { event: 'status', data: { step: 'aprovado', message: 'Pagamento aprovado!' } };
      yield { event: 'result', data: { success: true, nsu: result.nsu, autorizacao: result.authCode, bandeira: result.brand } as TefResult };

      if (result.nsu) await adapter.confirm(result.nsu);
    } else {
      yield { event: 'result', data: { success: false, message: result.message || 'Transação não aprovada', returnCode: result.returnCode } as TefResult };
    }
  } catch (err: any) {
    logger.error('Erro na transação TEF (SSE):', err);
    yield { event: 'error', data: { message: err.message || 'Erro na comunicação com o PINPad' } };
  }
}
