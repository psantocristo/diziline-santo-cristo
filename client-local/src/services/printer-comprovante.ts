/**
 * Impressão de comprovantes de contribuição (dízimo, oferta, campanha, eventual).
 * Respeita a personalização vinda do servidor (corte da guilhotina, campos visíveis, textos).
 */
import { ComprovanteDados } from '../types';
import { getDeviceAndPrinter, markDisconnected } from './printer-connection';
import { printQueue } from './print-queue';
import * as ESC from '../utils/escpos-commands';
import logger from '../utils/logger';

const TIPO_LABEL: Record<string, string> = {
  dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Doação',
};
const METODO_LABEL: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito',
};

const DEFAULT_CFG = {
  corteTipo: 'partial' as 'partial' | 'full' | 'none',
  linhasAvancoFinal: 3,
  mostrarCnpj: true,
  mostrarSite: true,
  mostrarId: true,
  mostrarStatus: true,
  mostrarContribuinte: true,
  mostrarMesReferencia: true,
  mostrarBencao: true,
  mostrarRodapeGuarde: true,
  textoBencao: 'Deus lhe pague!',
  textoRodape: 'Guarde este comprovante.',
  tituloDocumento: 'COMPROVANTE DE CONTRIBUIÇÃO',
};

export async function printComprovante(dados: ComprovanteDados): Promise<void> {
  return printQueue.enqueue(() => doPrintComprovante(dados));
}

async function doPrintComprovante(dados: ComprovanteDados): Promise<void> {
  const { device, printer } = getDeviceAndPrinter();
  const cfg = { ...DEFAULT_CFG, ...(dados.config || {}) };

  const isCompacto = ['oferta', 'campanha', 'eventual'].includes(dados.tipo);
  const mesRef = dados.mesReferencia
    ? new Date(dados.mesReferencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  // Helper para corte conforme config
  const finalizarImpressao = () => {
    printer.feed(Math.max(1, cfg.linhasAvancoFinal));
    if (cfg.corteTipo === 'full') {
      // node-thermal-printer aceita cut(true) para corte total em algumas versões;
      // usar buffer direto garante compatibilidade.
      printer.buffer.write(ESC.CUT_FULL);
    } else if (cfg.corteTipo === 'partial') {
      printer.cut(); // padrão = parcial
    }
    // 'none' apenas avança papel
    printer.close();
  };

  return new Promise((resolve, reject) => {
    device.open((err: any) => {
      if (err) {
        markDisconnected();
        return reject(err);
      }

      try {
        if (isCompacto) {
          printer
            .align('ct').style('b').text('COMPROVANTE').style('normal')
            .text(ESC.LINE_DASHED).align('lt')
            .text(ESC.formatRow('Data', ESC.formatDateTime(dados.dataHora)))
            .text(ESC.formatRow('Tipo', TIPO_LABEL[dados.tipo] || dados.tipo))
            .text(ESC.formatRow('Método', METODO_LABEL[dados.metodo] || dados.metodo));

          if (cfg.mostrarContribuinte && dados.nomeContribuinte) {
            printer.text(ESC.formatRow(dados.tipo === 'dizimo' ? 'Dizimista' : 'Fiel', dados.nomeContribuinte));
          }

          printer
            .text(ESC.LINE_DASHED).align('ct').style('b')
            .text(ESC.formatBRL(dados.valor)).style('normal')
            .text(ESC.LINE_DASHED).align('lt');

          if (cfg.mostrarStatus) printer.text(ESC.formatRow('Status', 'PAGO ✓'));

          printer.text(ESC.LINE_DASHED).align('ct').style('b');
          if (cfg.mostrarBencao) printer.text(`${cfg.textoBencao} 🙏`);
          printer.style('normal');

          finalizarImpressao();
        } else {
          printer
            .align('ct').style('b').size(1, 1)
            .text(cfg.tituloDocumento)
            .style('normal').text(ESC.LINE_SOLID).align('lt')
            .text(ESC.formatRow('Data/Hora', ESC.formatDateTime(dados.dataHora)))
            .text(ESC.formatRow('Tipo', TIPO_LABEL[dados.tipo] || dados.tipo));

          if (cfg.mostrarMesReferencia && dados.tipo === 'dizimo' && mesRef) {
            printer.text(ESC.formatRow('Mês Ref.', mesRef));
          }
          if (cfg.mostrarContribuinte && dados.nomeContribuinte) {
            printer.text(ESC.formatRow(dados.tipo === 'dizimo' ? 'Dizimista' : 'Fiel', dados.nomeContribuinte));
          }

          printer
            .text(ESC.LINE_DASHED).align('ct').style('b').size(2, 2)
            .text(ESC.formatBRL(dados.valor)).size(1, 1).style('normal')
            .text(ESC.LINE_DASHED).align('lt')
            .text(ESC.formatRow('Método', METODO_LABEL[dados.metodo] || dados.metodo));

          if (dados.parcelas && dados.parcelas > 1) printer.text(ESC.formatRow('Parcelas', `${dados.parcelas}x`));
          if (dados.nsu) printer.text(ESC.formatRow('NSU', dados.nsu));
          if (dados.autorizacao) printer.text(ESC.formatRow('Autorização', dados.autorizacao));
          if (dados.bandeira) printer.text(ESC.formatRow('Bandeira', dados.bandeira));
          if (cfg.mostrarId && dados.pagamentoId) {
            printer.text(ESC.formatRow('ID', `#${dados.pagamentoId.slice(0, 8).toUpperCase()}`));
          }

          if (cfg.mostrarStatus) printer.text(ESC.formatRow('Status', 'PAGO ✓'));
          printer.text(ESC.LINE_DASHED);

          if (dados.metodo === 'pix' && dados.pixCopiaCola) {
            printer.align('ct').text('').style('b')
              .text('PIX — Escaneie para verificar')
              .style('normal').text('');
            const qrBuffer = ESC.generateQRCode(dados.pixCopiaCola, 6, 49);
            printer.buffer.write(qrBuffer);
            printer.text('').text(ESC.LINE_DASHED);
          }

          printer.align('ct').style('b');
          if (cfg.mostrarBencao) printer.text(`${cfg.textoBencao} 🙏`);
          printer.style('normal');

          if (cfg.mostrarSite && dados.site) printer.text(dados.site);
          if (cfg.mostrarCnpj && dados.cnpj) printer.text(`CNPJ: ${dados.cnpj}`);

          if (cfg.mostrarRodapeGuarde) printer.text('').text(cfg.textoRodape);

          finalizarImpressao();
        }

        logger.info('Comprovante impresso com sucesso', { pagamentoId: dados.pagamentoId, corte: cfg.corteTipo });
        resolve();
      } catch (printErr) {
        logger.error('Erro durante impressão:', printErr);
        reject(printErr);
      }
    });
  });
}
