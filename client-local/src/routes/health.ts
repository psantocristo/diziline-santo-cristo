import { Router, Request, Response } from 'express';
import { getPrinterStatus } from '../services/printer-connection';
import { getPinpadStatus, checkTefConnection } from '../services/tef-client';
import { getActiveProviderId } from '../services/tef-adapters';
import { HealthResponse } from '../types';
import { CLIENT_VERSION } from '../version';

const router = Router();
const startTime = Date.now();

// ── Cache do health check TEF ──────────────────────────
let cachedTefOk: boolean | null = null;
let lastTefCheck = 0;
const TEF_CACHE_TTL = 10_000; // 10s

async function getCachedTefStatus(): Promise<void> {
  const now = Date.now();
  if (cachedTefOk !== null && now - lastTefCheck < TEF_CACHE_TTL) return;
  cachedTefOk = await checkTefConnection();
  lastTefCheck = now;
}

router.get('/health', async (_req: Request, res: Response) => {
  await getCachedTefStatus();

  const printerStatus = getPrinterStatus();
  const pinpadStatus = getPinpadStatus();

  const health: HealthResponse = {
    status: printerStatus.connected ? 'ok' : 'degraded',
    version: CLIENT_VERSION,
    devices: {
      printer: printerStatus,
      pinpad: pinpadStatus,
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  res.json({ ...health, tef_provider: getActiveProviderId() });
});

export default router;
