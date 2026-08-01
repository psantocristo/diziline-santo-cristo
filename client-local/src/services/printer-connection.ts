/**
 * PrinterConnection — Gerenciamento da conexão com a impressora.
 * Mantém device/printer como singleton, reconecta com backoff exponencial.
 */
import { config } from '../config';
import logger from '../utils/logger';
import { DeviceStatus } from '../types';

let device: any = null;
let printer: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let isConnected = false;

const MAX_BACKOFF = 60_000; // 60s máximo
const BASE_BACKOFF = 5_000; // 5s inicial

/**
 * Inicializa a conexão com a impressora
 */
export async function initPrinter(): Promise<void> {
  try {
    const escpos = await import('escpos');

    switch (config.printer.type) {
      case 'usb': {
        const escposUsb = await import('escpos-usb');
        device = new escposUsb.USB(config.printer.usb.vid, config.printer.usb.pid);
        break;
      }
      case 'serial': {
        const escposSerial = await import('escpos-serialport');
        device = new escposSerial.SerialPort(config.printer.serial.port, {
          baudRate: config.printer.serial.baud,
        });
        break;
      }
      case 'network': {
        const escposNet = await import('escpos-network');
        device = new escposNet.Network(config.printer.network.ip, config.printer.network.port);
        break;
      }
    }

    printer = new escpos.Printer(device);
    isConnected = true;
    reconnectAttempts = 0;
    logger.info(`Impressora ${config.printer.type} inicializada`);

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  } catch (err) {
    isConnected = false;
    logger.error('Erro ao inicializar impressora:', err);
    scheduleReconnect();
    throw err;
  }
}

/**
 * Reconexão com backoff exponencial: 5s → 10s → 20s → 40s → 60s (cap)
 */
function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const delay = Math.min(BASE_BACKOFF * Math.pow(2, reconnectAttempts), MAX_BACKOFF);
  reconnectAttempts++;

  logger.info(`Próxima tentativa de reconexão em ${Math.round(delay / 1000)}s (tentativa #${reconnectAttempts})`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await initPrinter();
      logger.info('✅ Impressora reconectada automaticamente');
    } catch {
      // scheduleReconnect já chamado dentro de initPrinter
    }
  }, delay);
}

/**
 * Retorna o status da impressora
 */
export function getPrinterStatus(): DeviceStatus {
  return {
    connected: isConnected && device !== null && printer !== null,
    model: config.printer.type.toUpperCase(),
  };
}

/**
 * Retorna device + printer para uso nos módulos de impressão
 */
export function getDeviceAndPrinter(): { device: any; printer: any } {
  if (!device || !printer) {
    throw new Error('Impressora não inicializada');
  }
  return { device, printer };
}

/**
 * Marca a impressora como desconectada e agenda reconexão
 */
export function markDisconnected(): void {
  isConnected = false;
  scheduleReconnect();
}

/**
 * Fecha a conexão da impressora (para graceful shutdown)
 */
export async function closePrinter(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (device) {
    try {
      device.close?.();
    } catch { /* ignore */ }
    device = null;
    printer = null;
    isConnected = false;
  }
}
