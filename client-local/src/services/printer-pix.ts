/**
 * Impressão de QR Code PIX nativo via ESC/POS.
 */
import { getDeviceAndPrinter, markDisconnected } from './printer-connection';
import { printQueue } from './print-queue';
import * as ESC from '../utils/escpos-commands';
import logger from '../utils/logger';

export async function printPixQrCode(pixCopiaCola: string, valor?: number): Promise<void> {
  return printQueue.enqueue(() => doPrintPixQrCode(pixCopiaCola, valor));
}

async function doPrintPixQrCode(pixCopiaCola: string, valor?: number): Promise<void> {
  const { device, printer } = getDeviceAndPrinter();

  return new Promise((resolve, reject) => {
    device.open((err: any) => {
      if (err) { markDisconnected(); return reject(err); }

      try {
        printer
          .align('ct').style('b').size(1, 1)
          .text('PAGAMENTO VIA PIX')
          .style('normal').text(ESC.LINE_SOLID);

        if (valor) {
          printer.text('').style('b').size(2, 2)
            .text(ESC.formatBRL(valor))
            .size(1, 1).style('normal').text('');
        }

        printer.text('Escaneie o QR Code abaixo:').text('');
        const qrBuffer = ESC.generateQRCode(pixCopiaCola, 8, 49);
        printer.buffer.write(qrBuffer);

        printer
          .text('').text(ESC.LINE_DASHED)
          .text('Ou copie o código no verso')
          .feed(3).cut().close();

        logger.info('QR Code PIX impresso');
        resolve();
      } catch (printErr) {
        logger.error('Erro ao imprimir QR Code:', printErr);
        reject(printErr);
      }
    });
  });
}
