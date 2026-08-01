import { Router, Request, Response } from 'express';
import { getMetrics } from '../services/metrics';
import { initPrinter, getPrinterStatus } from '../services/printer-connection';
import { printQueue } from '../services/print-queue';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/metrics — Métricas do sistema
 */
router.get('/metrics', (_req: Request, res: Response) => {
  const metrics = getMetrics();
  const printer = getPrinterStatus();

  res.json({
    ...metrics,
    printer: {
      ...printer,
      queue: printQueue.stats,
    },
  });
});

/**
 * POST /api/restart/printer — Reinicializa a impressora sem reiniciar o serviço
 */
router.post('/restart/printer', async (_req: Request, res: Response) => {
  try {
    logger.info('Reinicializando impressora...');
    await initPrinter();
    res.json({ success: true, message: 'Impressora reinicializada com sucesso' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
