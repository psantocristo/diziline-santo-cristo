import express from 'express';
import cors from 'cors';
import { config } from './config';
import { CLIENT_VERSION } from './version';
import logger from './utils/logger';
import healthRoutes from './routes/health';
import printerRoutes from './routes/printer';
import pinpadRoutes from './routes/pinpad';
import configPageRoutes from './routes/config-page';
import setupPageRoutes from './routes/setup-page';
import setupApiRoutes from './routes/setup-api';
import systemRoutes from './routes/system';
import { initPrinter, closePrinter } from './services/printer-connection';
import { printQueue } from './services/print-queue';
import { checkTefConnection } from './services/tef-client';
import { errorHandler } from './middleware/error-handler';
import { metricsMiddleware } from './middleware/metrics-middleware';

const isSetupMode = process.env.MODE === 'setup';
const app = express();

// ── Middleware ──────────────────────────────────────────
app.use(cors({
  origin: [...config.security.corsOrigins, 'http://localhost:8080', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Client-Token'],
}));


app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);

// Rotas do setup (sem autenticação)
if (isSetupMode) {
  app.use('/', setupPageRoutes);
  app.use('/api', setupApiRoutes);
  app.get('/', (_req, res) => res.redirect('/setup'));
}

// Autenticação por token (se configurado) — pula rotas de setup
app.use('/api', (req, res, next) => {
  if (isSetupMode && req.path.startsWith('/setup')) return next();
  if (config.security.apiToken) {
    const token = req.headers['x-client-token'];
    if (token !== config.security.apiToken) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  }
  next();
});

// ── Rotas ──────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api', printerRoutes);
app.use('/api', pinpadRoutes);
app.use('/api', systemRoutes);
app.use('/api', configPageRoutes);

// ── Middleware de erro centralizado ────────────────────
app.use(errorHandler);

// ── Graceful Shutdown ──────────────────────────────────
let server: ReturnType<typeof app.listen>;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} recebido. Encerrando graciosamente...`);

  // 1. Parar de aceitar novas conexões
  if (server) {
    server.close(() => logger.info('Servidor HTTP encerrado'));
  }

  // 2. Aguardar fila de impressão esvaziar (max 10s)
  const queueStats = printQueue.stats;
  if (queueStats.pending > 0 || queueStats.processing) {
    logger.info(`Aguardando ${queueStats.pending} jobs de impressão...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  printQueue.clear();

  // 3. Fechar impressora
  await closePrinter();
  logger.info('Impressora fechada');

  logger.info('Shutdown completo. Até mais! 👋');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Tratar erros não capturados
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// ── Inicialização ──────────────────────────────────────
async function start() {
  logger.info('═══════════════════════════════════════');
  logger.info(`  DízimoSC Client Local v${CLIENT_VERSION}`);
  logger.info('═══════════════════════════════════════');

  // Inicializa impressora
  try {
    await initPrinter();
    logger.info('✅ Impressora conectada');
  } catch (err) {
    logger.warn('⚠️  Impressora não encontrada — reconexão automática ativa');
  }

  // Verifica conexão TEF
  if (config.tef.enabled) {
    if (config.tef.mode === 'sandbox' || config.tef.mode === 'simulacao') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { logSandboxBanner } = require('./services/tef-sandbox');
      logSandboxBanner();
      logger.info(`✅ TEF em modo ${config.tef.mode.toUpperCase()} (simulador interno — sem hardware)`);
    } else {
      const tefOk = await checkTefConnection();
      logger.info(tefOk ? '✅ PINPad conectado' : '⚠️  PINPad não encontrado');
    }
  } else {
    logger.info('ℹ️  TEF desabilitado');
  }

  // Inicia servidor HTTP somente em localhost
  server = app.listen(config.port, '127.0.0.1', () => {
    logger.info(`🚀 Servidor rodando em http://localhost:${config.port}`);
    logger.info(`   CORS: ${config.security.corsOrigin}`);
    logger.info(`   Rate Limit: ativado`);
    logger.info(`   Fila de impressão: ativada`);
    logger.info(`   Validação Zod: ativada`);
    logger.info('═══════════════════════════════════════');
  });
}

start().catch((err) => {
  logger.error('Falha ao iniciar:', err);
  process.exit(1);
});
