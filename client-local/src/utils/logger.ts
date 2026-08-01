import winston from 'winston';
import Transport from 'winston-transport';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

// Garante que o diretório de logs existe
const logDir = path.resolve(config.logging.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ──────────────────────────────────────────────────────────────
// Ring buffer in-memory de logs recentes — consumido pelo
// endpoint /api/setup/logs do Setup Wizard.
// ──────────────────────────────────────────────────────────────
export interface LogEntry {
  ts: string;        // ISO timestamp
  level: string;
  message: string;
  meta?: Record<string, any>;
}

const RING_SIZE = 500;
const ring: LogEntry[] = [];

class RingBufferTransport extends Transport {
  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));
    const { level, message, timestamp, stack, ...meta } = info;
    const entry: LogEntry = {
      ts: typeof timestamp === 'string' ? new Date(timestamp).toISOString() : new Date().toISOString(),
      level: String(level || 'info').toLowerCase(),
      message: stack ? `${message}\n${stack}` : String(message ?? ''),
      meta: Object.keys(meta).length ? meta : undefined,
    };
    ring.push(entry);
    if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
    callback();
  }
}

export function getRecentLogs(opts: { limit?: number; level?: string; search?: string } = {}): LogEntry[] {
  const { limit = 200, level, search } = opts;
  const levelRank: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const min = level ? levelRank[level] ?? 0 : 0;
  const q = (search || '').toLowerCase();
  const filtered = ring.filter((e) => {
    if ((levelRank[e.level] ?? 1) < min) return false;
    if (q && !e.message.toLowerCase().includes(q)) return false;
    return true;
  });
  return filtered.slice(-limit);
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'dizimo-client-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: `${config.logging.maxFiles}d`,
      maxSize: '10m',
    }),
    new RingBufferTransport({ level: 'debug' }),
  ],
});

export default logger;
