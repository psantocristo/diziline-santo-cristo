/**
 * Impressão de comprovante de pedido (código de retirada).
 */
import { PedidoPrintData } from '../types';
import { getDeviceAndPrinter, markDisconnected } from './printer-connection';
import { printQueue } from './print-queue';
import * as ESC from '../utils/escpos-commands';
import logger from '../utils/logger';

export async function printPedido(dados: PedidoPrintData): Promise<void> {
  return printQueue.enqueue(() => doPrintPedido(dados));
}

async function doPrintPedido(dados: PedidoPrintData): Promise<void> {
  const { device, printer } = getDeviceAndPrinter();

  return new Promise((resolve, reject) => {
    device.open((err: any) => {
      if (err) { markDisconnected(); return reject(err); }

      try {
        printer
          .align('ct').style('b').size(1, 1)
          .text('PEDIDO — LOJA')
          .style('normal').text(ESC.LINE_SOLID).align('lt');

        if (dados.dataHora) printer.text(ESC.formatRow('Data', ESC.formatDateTime(dados.dataHora)));
        if (dados.nomeCliente) printer.text(ESC.formatRow('Cliente', dados.nomeCliente));

        printer.text(ESC.LINE_DASHED);

        for (const item of dados.itens) {
          const subtotal = (item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          printer.text(ESC.formatRow(`${item.quantidade}x ${item.nome}`, subtotal));
        }

        printer
          .text(ESC.LINE_DASHED).align('ct').style('b').size(2, 2)
          .text(ESC.formatBRL(dados.total))
          .size(1, 1).style('normal')
          .text(ESC.LINE_SOLID).align('ct').style('b')
          .text('CÓDIGO DE RETIRADA')
          .size(2, 2).text(dados.codigoRetirada)
          .size(1, 1).style('normal')
          .text(ESC.LINE_SOLID)
          .text('Apresente no caixa')
          .text('para retirar seus produtos.')
          .feed(3).cut().close();

        logger.info('Pedido impresso com sucesso', { codigo: dados.codigoRetirada });
        resolve();
      } catch (printErr) {
        logger.error('Erro ao imprimir pedido:', printErr);
        reject(printErr);
      }
    });
  });
}
