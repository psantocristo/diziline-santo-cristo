export interface ComprovanteDados {
  pagamentoId?: string;
  valor: number;
  tipo: 'dizimo' | 'oferta' | 'campanha' | 'eventual';
  metodo: 'pix' | 'credito' | 'debito';
  nomeContribuinte?: string;
  mesReferencia?: string;
  dataHora: string;
  cnpj?: string;
  site?: string;
  parcelas?: number;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  pixCopiaCola?: string;
  /** Configuração de impressão (corte/feed). Se ausente, usa defaults Epson TM-T20. */
  config?: {
    corteTipo?: 'partial' | 'full' | 'none';
    linhasAvancoFinal?: number;
    mostrarCnpj?: boolean;
    mostrarSite?: boolean;
    mostrarId?: boolean;
    mostrarStatus?: boolean;
    mostrarContribuinte?: boolean;
    mostrarMesReferencia?: boolean;
    mostrarBencao?: boolean;
    mostrarRodapeGuarde?: boolean;
    textoBencao?: string;
    textoRodape?: string;
    tituloDocumento?: string;
  };
}

export interface PedidoPrintData {
  codigoRetirada: string;
  total: number;
  itens: { nome: string; quantidade: number; preco: number }[];
  nomeCliente?: string;
  dataHora: string;
}

export interface PrintRequest {
  type: 'comprovante' | 'teste' | 'relatorio' | 'pix-qrcode' | 'pedido';
  data?: ComprovanteDados;
  pixCopiaCola?: string;
  valor?: number;
  pedido?: PedidoPrintData;
}

export interface TefPayRequest {
  pagamentoId: string;
  valor: number;
  tipo: 'credito' | 'debito';
  parcelas?: number;
}

export interface TefResult {
  success: boolean;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  message?: string;
  returnCode?: string;
}

export interface DeviceStatus {
  connected: boolean;
  model?: string;
  error?: string;
  firmware?: string;
  serial?: string;
  lastTransaction?: {
    at: string;
    status: string;
    nsu?: string;
  };
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  devices: {
    printer: DeviceStatus;
    pinpad: DeviceStatus;
  };
  uptime: number;
}
