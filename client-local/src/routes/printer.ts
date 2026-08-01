import { Router, Request, Response } from 'express';
import { printComprovante } from '../services/printer-comprovante';
import { printTestPage } from '../services/printer-test';
import { printPixQrCode } from '../services/printer-pix';
import { printPedido } from '../services/printer-pedido';
import { printQueue } from '../services/print-queue';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rate-limiter';
import { printRequestSchema } from '../schemas';
import logger from '../utils/logger';

const router = Router();

// Rate limit: max 10 impressões por 30s por IP
const printLimiter = rateLimit(10, 30_000);

router.post('/print', printLimiter, validateBody(printRequestSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body.type === 'comprovante') {
      await printComprovante(body.data);
      res.json({ success: true, message: 'Comprovante impresso com sucesso' });
    } else if (body.type === 'pix-qrcode') {
      await printPixQrCode(body.pixCopiaCola, body.valor);
      res.json({ success: true, message: 'QR Code PIX impresso com sucesso' });
    } else if (body.type === 'pedido') {
      await printPedido(body.pedido);
      res.json({ success: true, message: 'Pedido impresso com sucesso' });
    }
  } catch (err: any) {
    logger.error('Erro ao imprimir:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/print/test', rateLimit(3, 30_000), async (_req: Request, res: Response) => {
  try {
    await printTestPage();
    res.json({ success: true, message: 'Página de teste impressa' });
  } catch (err: any) {
    logger.error('Erro ao imprimir teste:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Status da fila de impressão
router.get('/print/queue', (_req: Request, res: Response) => {
  res.json(printQueue.stats);
});

export default router;
