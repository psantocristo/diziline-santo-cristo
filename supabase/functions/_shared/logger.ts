/**
 * Logger estruturado em JSON — facilita ingestão por ferramentas de log.
 * Usage: log('info', 'pagamento_criado', { pagamento_id, valor })
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function log(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

/** Retry exponencial para chamadas HTTP transientes. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { tentativas?: number; baseMs?: number; onRetry?: (err: unknown, tentativa: number) => void } = {},
): Promise<T> {
  const tentativas = opts.tentativas ?? 3
  const baseMs = opts.baseMs ?? 300
  let lastErr: unknown
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      opts.onRetry?.(err, i + 1)
      if (i === tentativas - 1) break
      await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)))
    }
  }
  throw lastErr
}