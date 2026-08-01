/**
 * Schemas Zod para validação de requests.
 */
import { z } from 'zod';

export const comprovanteConfigSchema = z.object({
  corteTipo: z.enum(['partial', 'full', 'none']).optional(),
  linhasAvancoFinal: z.number().int().min(0).max(12).optional(),
  mostrarCnpj: z.boolean().optional(),
  mostrarSite: z.boolean().optional(),
  mostrarId: z.boolean().optional(),
  mostrarStatus: z.boolean().optional(),
  mostrarContribuinte: z.boolean().optional(),
  mostrarMesReferencia: z.boolean().optional(),
  mostrarBencao: z.boolean().optional(),
  mostrarRodapeGuarde: z.boolean().optional(),
  textoBencao: z.string().max(120).optional(),
  textoRodape: z.string().max(120).optional(),
  tituloDocumento: z.string().max(60).optional(),
  larguraPapelMm: z.union([z.literal(58), z.literal(80)]).optional(),
  codePage: z.string().max(20).optional(),
}).partial().passthrough();

export const comprovanteSchema = z.object({
  pagamentoId: z.string().max(100).optional(),
  valor: z.number().positive().max(999999),
  tipo: z.enum(['dizimo', 'oferta', 'campanha', 'eventual']),
  metodo: z.enum(['pix', 'credito', 'debito']),
  nomeContribuinte: z.string().max(200).optional(),
  mesReferencia: z.string().max(20).optional(),
  dataHora: z.string(),
  cnpj: z.string().max(20).optional(),
  site: z.string().max(200).optional(),
  parcelas: z.number().int().min(1).max(24).optional(),
  nsu: z.string().max(50).optional(),
  autorizacao: z.string().max(50).optional(),
  bandeira: z.string().max(50).optional(),
  pixCopiaCola: z.string().max(2000).optional(),
  config: comprovanteConfigSchema.optional(),
});


export const pedidoSchema = z.object({
  codigoRetirada: z.string().min(1).max(20),
  total: z.number().positive().max(999999),
  itens: z.array(z.object({
    nome: z.string().min(1).max(200),
    quantidade: z.number().int().positive().max(999),
    preco: z.number().positive().max(999999),
  })).min(1).max(100),
  nomeCliente: z.string().max(200).optional(),
  dataHora: z.string(),
});

export const printRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('comprovante'),
    data: comprovanteSchema,
  }),
  z.object({
    type: z.literal('pix-qrcode'),
    pixCopiaCola: z.string().min(1).max(2000),
    valor: z.number().positive().max(999999).optional(),
  }),
  z.object({
    type: z.literal('pedido'),
    pedido: pedidoSchema,
  }),
]);

export const tefPaySchema = z.object({
  pagamentoId: z.string().min(1).max(100),
  valor: z.number().positive().max(999999),
  tipo: z.enum(['credito', 'debito']),
  parcelas: z.number().int().min(1).max(24).optional(),
});

export const setupSaveSchema = z.object({
  port: z.union([z.string(), z.number()]).optional(),
  corsOrigin: z.string().max(500).optional(),
  apiToken: z.string().max(200).optional(),
  printerType: z.enum(['usb', 'serial', 'network']).optional(),
  printerVid: z.string().max(10).optional(),
  printerPid: z.string().max(10).optional(),
  printerSerialPort: z.string().max(20).optional(),
  printerSerialBaud: z.union([z.string(), z.number()]).optional(),
  printerNetworkIp: z.string().max(50).optional(),
  printerNetworkPort: z.union([z.string(), z.number()]).optional(),
  tefEnabled: z.boolean().optional(),
  tefProvider: z.enum(['connect_tef', 'sipag', 'pagarme_stone', 'paygo']).optional(),
  tefMode: z.enum(['producao', 'sandbox', 'simulacao']).optional(),
  tefMiddlewareUrl: z.string().max(500).optional(),
  tefSipagUrl: z.string().max(500).optional(),
  tefPagarmeStoneUrl: z.string().max(500).optional(),
  tefPaygoUrl: z.string().max(500).optional(),
  tefTerminalId: z.string().max(50).optional(),
  tefTimeout: z.union([z.string(), z.number()]).optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  logDir: z.string().max(200).optional(),
  logMaxFiles: z.union([z.string(), z.number()]).optional(),
});
