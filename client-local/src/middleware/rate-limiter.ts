/**
 * Rate limiter simples baseado em IP (sem dependência externa).
 * Protege contra flood de requisições (botão pressionado várias vezes).
 */
import { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

// Limpa buckets expirados a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 60_000);

/**
 * Cria um middleware de rate limiting.
 * @param maxRequests Número máximo de requests por janela
 * @param windowMs Tamanho da janela em ms
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Muitas requisições. Aguarde alguns segundos.',
      });
      return;
    }

    next();
  };
}
