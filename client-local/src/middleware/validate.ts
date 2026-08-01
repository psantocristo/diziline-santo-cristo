/**
 * Middleware de validação de request body usando Zod.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      res.status(400).json({ success: false, message: `Dados inválidos: ${errors}` });
      return;
    }
    req.body = result.data;
    next();
  };
}
