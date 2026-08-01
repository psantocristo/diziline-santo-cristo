import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3847', 10),

  printer: {
    type: (process.env.PRINTER_TYPE || 'usb') as 'usb' | 'serial' | 'network',
    usb: {
      vid: parseInt(process.env.PRINTER_VID || '0x04b8', 16),
      pid: parseInt(process.env.PRINTER_PID || '0x0202', 16),
    },
    serial: {
      port: process.env.PRINTER_SERIAL_PORT || 'COM3',
      baud: parseInt(process.env.PRINTER_SERIAL_BAUD || '9600', 10),
    },
    network: {
      ip: process.env.PRINTER_NETWORK_IP || '192.168.1.100',
      port: parseInt(process.env.PRINTER_NETWORK_PORT || '9100', 10),
    },
  },

  tef: {
    enabled: process.env.TEF_ENABLED === 'true',
    provider: (process.env.TEF_PROVIDER || 'connect_tef') as
      | 'connect_tef'
      | 'sipag'
      | 'pagarme_stone'
      | 'paygo',
    // 'producao' | 'sandbox' | 'simulacao' — sandbox/simulacao usam o simulador interno
    mode: (process.env.TEF_MODE || 'producao').toLowerCase() as 'producao' | 'sandbox' | 'simulacao',
    middlewareUrl: process.env.TEF_MIDDLEWARE_URL || 'http://localhost:8090',
    sipagUrl: process.env.TEF_SIPAG_URL || 'http://localhost:60906',
    pagarmeStoneUrl: process.env.TEF_PAGARME_STONE_URL || 'http://localhost:9000',
    paygoUrl: process.env.TEF_PAYGO_URL || 'http://localhost:9999',
    terminalId: process.env.TEF_TERMINAL_ID || 'DIZSC001',
    timeoutSeconds: parseInt(process.env.TEF_TIMEOUT_SECONDS || '120', 10),
  },

  security: {
    /** Aceita múltiplas origens separadas por vírgula (domínio próprio + workers.dev). */
    corsOrigin: process.env.CORS_ORIGIN || 'https://dizimosc.acathosec.workers.dev',
    corsOrigins: (process.env.CORS_ORIGIN || 'https://dizimosc.acathosec.workers.dev')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    apiToken: process.env.API_TOKEN || '',
  },


  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '30', 10),
  },
};
