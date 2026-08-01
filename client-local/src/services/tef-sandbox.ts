/**
 * Simulador TEF — emula resposta de qualquer provedor sem hardware real.
 *
 * Ativado quando `TEF_MODE=sandbox` ou `TEF_MODE=simulacao`. É determinístico:
 *   - amount terminado em "00" centavos  → APROVADA
 *   - amount terminado em "13"          → RECUSADA por insuficiência (returnCode 51)
 *   - amount terminado em "99"          → TIMEOUT
 *   - outros valores                    → APROVADA após 2.5s
 *
 * Útil para validar todo o pipeline (UI, webhook, recibo) sem maquininha física.
 */
import { config } from '../config';
import logger from '../utils/logger';
import type { NormalizedTxPayload, NormalizedTxResult, ProviderId } from './tef-adapters';

const BRANDS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD'];

function rnd(n = 6) {
  return Math.floor(Math.random() * 10 ** n)
    .toString()
    .padStart(n, '0');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isSandboxMode(): boolean {
  const mode = (process.env.TEF_MODE || '').toLowerCase();
  return mode === 'sandbox' || mode === 'simulacao' || mode === 'simulation';
}

export async function sandboxStatus(provider: ProviderId) {
  await sleep(150);
  return {
    ok: true,
    firmware: `SANDBOX-${provider}-1.0.0`,
    serial: `SBX${rnd(8)}`,
  };
}

export async function sandboxTransaction(
  provider: ProviderId,
  p: NormalizedTxPayload,
  timeoutMs: number,
): Promise<NormalizedTxResult> {
  const tail = p.amount % 100;
  logger.info('[SANDBOX TEF] iniciando', { provider, amount: p.amount, tail, ref: p.reference });

  // simula tempo do operador inserir cartão (1.5–3s)
  await sleep(Math.min(2500, timeoutMs - 500));

  if (tail === 99) {
    await sleep(Math.min(timeoutMs, 3000));
    return {
      approved: false,
      returnCode: 'TIMEOUT',
      message: '[SANDBOX] Timeout aguardando resposta do PINPad',
      raw: { sandbox: true, scenario: 'timeout' },
    };
  }

  if (tail === 13) {
    return {
      approved: false,
      nsu: rnd(6),
      returnCode: '51',
      message: '[SANDBOX] Saldo insuficiente / cartão recusado pelo emissor',
      raw: { sandbox: true, scenario: 'declined' },
    };
  }

  const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
  return {
    approved: true,
    nsu: rnd(6),
    authCode: rnd(6),
    brand,
    returnCode: '00',
    message: `[SANDBOX] Transação aprovada (${provider})`,
    raw: { sandbox: true, provider, scenario: 'approved' },
  };
}

export async function sandboxConfirm(_nsu: string) {
  await sleep(120);
  return true;
}

export async function sandboxCancel(_nsu?: string) {
  await sleep(200);
  return true;
}

// helper para banner no log de boot
export function logSandboxBanner() {
  if (!isSandboxMode()) return;
  logger.warn(
    '\n╔══════════════════════════════════════════════════════════════╗\n' +
      '║  ⚠️  TEF EM MODO SANDBOX — nenhuma maquininha real é usada   ║\n' +
      '║  Valores terminados em .13 = RECUSADA · .99 = TIMEOUT        ║\n' +
      `║  Provedor ativo: ${(config.tef.provider || 'connect_tef').padEnd(43)}║\n` +
      '╚══════════════════════════════════════════════════════════════╝',
  );
}
