/**
 * Comandos ESC/POS para impressoras térmicas 80mm
 * Referência: Epson ESC/POS Command Reference
 */

// Inicialização
export const INIT = Buffer.from([0x1B, 0x40]); // ESC @

// Alinhamento
export const ALIGN_LEFT = Buffer.from([0x1B, 0x61, 0x00]);
export const ALIGN_CENTER = Buffer.from([0x1B, 0x61, 0x01]);
export const ALIGN_RIGHT = Buffer.from([0x1B, 0x61, 0x02]);

// Estilo de texto
export const BOLD_ON = Buffer.from([0x1B, 0x45, 0x01]);
export const BOLD_OFF = Buffer.from([0x1B, 0x45, 0x00]);
export const UNDERLINE_ON = Buffer.from([0x1B, 0x2D, 0x01]);
export const UNDERLINE_OFF = Buffer.from([0x1B, 0x2D, 0x00]);
export const DOUBLE_HEIGHT = Buffer.from([0x1D, 0x21, 0x01]);
export const DOUBLE_WIDTH = Buffer.from([0x1D, 0x21, 0x10]);
export const DOUBLE_SIZE = Buffer.from([0x1D, 0x21, 0x11]);
export const NORMAL_SIZE = Buffer.from([0x1D, 0x21, 0x00]);

// Alimentação e corte
export const FEED_LINE = Buffer.from([0x0A]);
export const FEED_3_LINES = Buffer.from([0x1B, 0x64, 0x03]);
export const FEED_5_LINES = Buffer.from([0x1B, 0x64, 0x05]);
export const CUT_PARTIAL = Buffer.from([0x1D, 0x56, 0x01]);
export const CUT_FULL = Buffer.from([0x1D, 0x56, 0x00]);

// Separadores (48 colunas para 80mm)
export const LINE_DASHED = '-'.repeat(48);
export const LINE_SOLID = '='.repeat(48);
export const LINE_DOTS = '.'.repeat(48);

/**
 * Formata uma linha com label à esquerda e valor à direita
 * Total de 48 colunas para impressora 80mm
 */
export function formatRow(label: string, value: string, cols = 48): string {
  const spaces = cols - label.length - value.length;
  if (spaces < 1) return `${label} ${value}`;
  return `${label}${' '.repeat(spaces)}${value}`;
}

/**
 * Formata valor em Reais
 */
export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata data/hora no padrão brasileiro
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

// ═══════════════════════════════════════════════════════
// QR Code ESC/POS — Comandos nativos para impressoras compatíveis
// Ref: GS ( k — QR Code function (Epson TM series, Elgin, Bematech, etc.)
// ═══════════════════════════════════════════════════════

/**
 * Gera os buffers ESC/POS para imprimir um QR Code nativo.
 *
 * @param data - String a codificar (ex: payload PIX Copia e Cola)
 * @param moduleSize - Tamanho do módulo (1-16, padrão 6)
 * @param errorCorrection - Nível de correção: 48=L, 49=M, 50=Q, 51=H (padrão M)
 * @returns Buffer concatenado pronto para enviar à impressora
 */
export function generateQRCode(
  data: string,
  moduleSize = 6,
  errorCorrection = 49 // 'M'
): Buffer {
  const dataBytes = Buffer.from(data, 'utf-8');
  const dataLen = dataBytes.length;

  // Função 165 — Selecionar modelo (Model 2)
  const selectModel = Buffer.from([
    0x1D, 0x28, 0x6B,
    0x04, 0x00,       // pL, pH (4 bytes de parâmetro)
    0x31, 0x41,       // cn=49, fn=65
    0x32, 0x00,       // Model 2, 0
  ]);

  // Função 167 — Definir tamanho do módulo
  const setSize = Buffer.from([
    0x1D, 0x28, 0x6B,
    0x03, 0x00,       // pL, pH
    0x31, 0x43,       // cn=49, fn=67
    moduleSize,
  ]);

  // Função 169 — Definir nível de correção de erro
  const setErrorCorrection = Buffer.from([
    0x1D, 0x28, 0x6B,
    0x03, 0x00,       // pL, pH
    0x31, 0x45,       // cn=49, fn=69
    errorCorrection,
  ]);

  // Função 180 — Armazenar dados do QR Code
  // pL e pH calculados: dataLen + 3
  const storeLen = dataLen + 3;
  const pL = storeLen & 0xFF;
  const pH = (storeLen >> 8) & 0xFF;

  const storeHeader = Buffer.from([
    0x1D, 0x28, 0x6B,
    pL, pH,
    0x31, 0x50, 0x30, // cn=49, fn=80, m=48
  ]);

  const storeData = Buffer.concat([storeHeader, dataBytes]);

  // Função 181 — Imprimir QR Code armazenado
  const printQR = Buffer.from([
    0x1D, 0x28, 0x6B,
    0x03, 0x00,       // pL, pH
    0x31, 0x51, 0x30, // cn=49, fn=81, m=48
  ]);

  return Buffer.concat([
    selectModel,
    setSize,
    setErrorCorrection,
    storeData,
    printQR,
  ]);
}
