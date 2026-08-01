/**
 * Impressão de página de teste.
 */
import { config } from '../config';
import { getDeviceAndPrinter, markDisconnected } from './printer-connection';
import { printQueue } from './print-queue';
import * as ESC from '../utils/escpos-commands';
import logger from '../utils/logger';

export async function printTestPage(): Promise<void> {
  return printQueue.enqueue(() => doPrintTestPage());
}

async function doPrintTestPage(): Promise<void> {
  const { device, printer } = getDeviceAndPrinter();

  return new Promise((resolve, reject) => {
    device.open((err: any) => {
      if (err) { markDisconnected(); return reject(err); }

      try {
        printer
          .align('ct').style('b').size(2, 2)
          .text('DízimoSC')
          .size(1, 1).style('normal')
          .text(ESC.LINE_SOLID)
          .text('Teste de impressão')
          .text(`Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
          .text(`Tipo: ${config.printer.type}`)
          .text(ESC.LINE_SOLID)
          .text('Teste de QR Code:')
          .text('');

        const testQr = ESC.generateQRCode('https://dizimosc.lovable.app', 5, 49);
        printer.buffer.write(testQr);

        printer
          .text('').text(ESC.LINE_SOLID)
          .text('Impressora configurada corretamente!')
          .feed(3).cut().close();

        logger.info('Página de teste impressa');
        resolve();
      } catch (printErr) {
        logger.error('Erro ao imprimir teste:', printErr);
        reject(printErr);
      }
    });
  });
}
