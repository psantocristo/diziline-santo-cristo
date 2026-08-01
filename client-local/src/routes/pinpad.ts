import { Router, Request, Response } from 'express';
import {
  processPayment, cancelTransaction, getPinpadStatus,
  startTransaction, getTransactionStatus, confirmTransaction, undoTransaction,
} from '../services/tef-client';
import { TefPayRequest } from '../types';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rate-limiter';
import { tefPaySchema } from '../schemas';
import logger from '../utils/logger';

const router = Router();

// Rate limit: max 5 transações por 60s por IP
const tefLimiter = rateLimit(5, 60_000);

/**
 * POST /api/tef/pay — Inicia transação (polling-based)
 */
router.post('/tef/pay', tefLimiter, validateBody(tefPaySchema), (req: Request, res: Response) => {
  const body = req.body as TefPayRequest;

  try {
    const txId = startTransaction(body);
    logger.info('Transação TEF iniciada', { txId, pagamentoId: body.pagamentoId });
    res.json({ success: true, transaction_id: txId });
  } catch (err: any) {
    logger.error('Erro ao iniciar transação:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/tef/status/:txId — Consulta status de uma transação
 */
router.get('/tef/status/:txId', (req: Request, res: Response) => {
  const { txId } = req.params;
  const tx = getTransactionStatus(txId);

  if (!tx) {
    return res.status(404).json({ status: 'not_found', message: 'Transação não encontrada' });
  }

  const statusMap: Record<string, string> = {
    pending: 'pending',
    approved: 'approved',
    declined: 'declined',
    error: 'error',
  };

  res.json({
    status: statusMap[tx.status] || tx.status,
    message: tx.message,
    nsu: tx.result?.nsu,
    autorizacao: tx.result?.autorizacao,
    bandeira: tx.result?.bandeira,
    returnCode: tx.result?.returnCode,
  });
});

/**
 * POST /api/tef/confirm/:txId — Confirma transação aprovada
 */
router.post('/tef/confirm/:txId', async (req: Request, res: Response) => {
  const { txId } = req.params;
  const ok = await confirmTransaction(txId);
  res.json({ success: ok });
});

/**
 * POST /api/tef/undo/:txId — Desfaz transação
 */
router.post('/tef/undo/:txId', async (req: Request, res: Response) => {
  const { txId } = req.params;
  const ok = await undoTransaction(txId);
  res.json({ success: ok });
});

/**
 * POST /api/tef/pay/sse — Inicia transação via SSE
 */
router.post('/tef/pay/sse', tefLimiter, validateBody(tefPaySchema), async (req: Request, res: Response) => {
  const body = req.body as TefPayRequest;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    for await (const event of processPayment(body)) {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
  } catch (err: any) {
    logger.error('Erro no SSE TEF:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

/**
 * POST /api/tef/cancel — Cancela transação em andamento
 */
router.post('/tef/cancel', async (_req: Request, res: Response) => {
  const ok = await cancelTransaction();
  res.json({ success: ok });
});

/**
 * GET /api/tef/status — Status geral do PINPad
 */
router.get('/tef/status', (_req: Request, res: Response) => {
  res.json(getPinpadStatus());
});

export default router;
