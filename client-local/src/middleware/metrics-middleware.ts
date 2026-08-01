/**
 * Middleware para registrar métricas de cada request.
 */
import { Request, Response, NextFunction } from 'express';
import { recordRequest } from '../services/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = `${req.method} ${req.route?.path || req.path}`;
    const isError = res.statusCode >= 400;
    recordRequest(route, duration, isError);
  });

  next();
}
