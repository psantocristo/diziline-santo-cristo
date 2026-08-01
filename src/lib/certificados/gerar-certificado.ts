/**
 * Gerador de Certificados Paroquiais em PDF
 * Layout de duas colunas: imagem temática à esquerda, texto à direita
 * Segue o modelo da "Lembrança da Crisma" da Paróquia Senhor Santo Cristo
 */
import jsPDF from 'jspdf';
import type { DadosCertificado, TipoCertificado } from './types';

// ─── Títulos por tipo ──────────────────────────────────────
const TITULOS: Record<TipoCertificado, { titulo: string; subtitulo: string }> = {
  batismo: { titulo: 'Lembrança do Batismo', subtitulo: 'Sacramento da Iniciação Cristã' },
  primeira_eucaristia: { titulo: 'Lembrança da Primeira Eucaristia', subtitulo: 'Sacramento da Eucaristia' },
  crisma: { titulo: 'Lembrança da Crisma', subtitulo: 'Sacramento da Confirmação' },
  casamento: { titulo: 'Lembrança do Matrimônio', subtitulo: 'Sacramento do Matrimônio' },
  curso_batismo: { titulo: 'Certificado de Curso de Batismo', subtitulo: 'Preparação para o Sacramento' },
  curso_noivos: { titulo: 'Certificado de Curso de Noivos', subtitulo: 'Preparação para o Matrimônio' },
};

const IMAGE_PATHS: Record<TipoCertificado, string> = {
  batismo: '/images/certificados/batismo.png',
  primeira_eucaristia: '/images/certificados/primeira_eucaristia.png',
  crisma: '/images/certificados/crisma.png',
  casamento: '/images/certificados/casamento.png',
  curso_batismo: '/images/certificados/curso_batismo.png',
  curso_noivos: '/images/certificados/curso_noivos.png',
};

const BRASAO_PATH = '/images/certificados/brasao-diocese.png';

// ─── Scale helper ────────────────────────────────────────────
function getScale(w: number): number {
  return w / 210;
}

function fs(base: number, s: number): number {
  const adjusted = 0.3 + 0.7 * s;
  return Math.max(base * adjusted, 5);
}

// ─── Image Helpers ──────────────────────────────────────────
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imageToDataURL(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Layout constants ────────────────────────────────────────
const LEFT_COL_RATIO = 0.38;
const MARGIN = 6; // mm base margin
const BG_COLOR: [number, number, number] = [252, 248, 238]; // warm beige
const PRIMARY_COLOR = '#5a2a10'; // warm brown
const SECONDARY_COLOR = '#8b6914'; // gold-brown
const TEXT_COLOR = '#333333';
const LIGHT_TEXT = '#666666';

// ─── Drawing functions ───────────────────────────────────────

function drawBackground(doc: jsPDF, w: number, h: number) {
  doc.setFillColor(BG_COLOR[0], BG_COLOR[1], BG_COLOR[2]);
  doc.rect(0, 0, w, h, 'F');
}

function drawBorder(doc: jsPDF, w: number, h: number, s: number) {
  const m = 4 * s;
  // Outer border
  doc.setDrawColor(PRIMARY_COLOR);
  doc.setLineWidth(0.8 * s);
  doc.rect(m, m, w - m * 2, h - m * 2);

  // Inner border
  const m2 = 6 * s;
  doc.setDrawColor(SECONDARY_COLOR);
  doc.setLineWidth(0.3 * s);
  doc.rect(m2, m2, w - m2 * 2, h - m2 * 2);
}

function drawLeftColumn(doc: jsPDF, w: number, h: number, s: number, img?: HTMLImageElement, brasao?: HTMLImageElement) {
  const colW = w * LEFT_COL_RATIO;
  const margin = 8 * s;

  // Brasão at top-left
  if (brasao) {
    const bH = 14 * s;
    const bW = bH * (brasao.width / brasao.height);
    const dataUrl = imageToDataURL(brasao);
    const bx = (colW - bW) / 2;
    doc.addImage(dataUrl, 'PNG', bx, margin + 2 * s, bW, bH);
  }

  // Thematic image filling the left column (below brasão)
  if (img) {
    const imgTop = brasao ? (margin + 18 * s) : (margin + 4 * s);
    const imgBottom = h - margin;
    const availH = imgBottom - imgTop;
    const availW = colW - 2 * s;

    const ratio = img.width / img.height;
    let imgW = availW;
    let imgH = imgW / ratio;

    if (imgH > availH) {
      imgH = availH;
      imgW = imgH * ratio;
    }

    const imgX = (colW - imgW) / 2;
    const imgY = imgTop + (availH - imgH) / 2;

    try {
      doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
    } catch { /* fallback */ }

    const dataUrl = imageToDataURL(img);
    doc.addImage(dataUrl, 'PNG', imgX, imgY, imgW, imgH);

    try {
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    } catch { /* fallback */ }
  }

  // Vertical separator line
  doc.setDrawColor(SECONDARY_COLOR);
  doc.setLineWidth(0.3 * s);
  doc.line(colW, 8 * s, colW, h - 8 * s);
}

function drawRightHeader(doc: jsPDF, w: number, s: number, dados: DadosCertificado, tipo: TipoCertificado): number {
  const colStart = w * LEFT_COL_RATIO + 6 * s;
  const colEnd = w - 8 * s;
  const colCenter = (colStart + colEnd) / 2;
  const colW = colEnd - colStart;

  let y = 12 * s;

  // Parish name
  doc.setFont('times', 'bold');
  doc.setFontSize(fs(12, s));
  doc.setTextColor(PRIMARY_COLOR);
  const parishLines = doc.splitTextToSize(`Paróquia ${dados.nomeParoquia.toUpperCase()}`, colW);
  parishLines.forEach((line: string) => {
    doc.text(line, colCenter, y, { align: 'center' });
    y += fs(12, s) * 0.45;
  });

  y += 2 * s;

  // Diocese subtitle
  doc.setFont('times', 'italic');
  doc.setFontSize(fs(8, s));
  doc.setTextColor(LIGHT_TEXT);
  doc.text('Diocese de São Miguel Paulista/SP', colCenter, y, { align: 'center' });
  y += 6 * s;

  // Decorative line
  doc.setDrawColor(SECONDARY_COLOR);
  doc.setLineWidth(0.2 * s);
  doc.line(colStart + 8 * s, y, colEnd - 8 * s, y);
  y += 6 * s;

  // Certificate title (cursive-style)
  const { titulo } = TITULOS[tipo];
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(fs(18, s));
  doc.setTextColor(SECONDARY_COLOR);
  doc.text(titulo, colCenter, y, { align: 'center' });
  y += 8 * s;

  return y;
}

function drawBodyText(doc: jsPDF, w: number, h: number, s: number, dados: DadosCertificado): number {
  const colStart = w * LEFT_COL_RATIO + 8 * s;
  const colEnd = w - 10 * s;
  const colW = colEnd - colStart;
  const colCenter = (colStart + colEnd) / 2;

  let y = drawRightHeader(doc, w, s, dados, dados.tipo);

  // Build flowing body text based on the custom text or a generated paragraph
  const bodyText = dados.textoPersonalizado || '';

  if (bodyText) {
    doc.setFont('times', 'normal');
    doc.setFontSize(fs(9.5, s));
    doc.setTextColor(TEXT_COLOR);
    const lineHeight = fs(9.5, s) * 0.5;
    const lines = doc.splitTextToSize(bodyText, colW);
    const maxY = h - 38 * s;

    for (const line of lines) {
      if (y > maxY) break;
      doc.text(line, colStart, y);
      y += lineHeight;
    }
  }

  return y;
}

function drawSignature(doc: jsPDF, w: number, h: number, s: number, dados: DadosCertificado) {
  const colStart = w * LEFT_COL_RATIO + 8 * s;
  const colEnd = w - 10 * s;
  const colCenter = (colStart + colEnd) / 2;

  // Location and date
  let y = h - 32 * s;
  doc.setFont('times', 'normal');
  doc.setFontSize(fs(8.5, s));
  doc.setTextColor(TEXT_COLOR);

  const localDate = dados.dataCerimonia
    ? `São Paulo/SP, ${formatDate(dados.dataCerimonia)}.`
    : 'São Paulo/SP.';
  doc.text(localDate, colCenter, y, { align: 'center' });

  // Signature line
  y += 8 * s;
  doc.setDrawColor(PRIMARY_COLOR);
  doc.setLineWidth(0.3 * s);
  doc.line(colCenter - 25 * s, y, colCenter + 25 * s, y);

  // Paróco name
  y += 4 * s;
  doc.setFont('times', 'bold');
  doc.setFontSize(fs(9, s));
  doc.setTextColor(PRIMARY_COLOR);
  doc.text(dados.parocoNome || 'Pároco', colCenter, y, { align: 'center' });

  // Footer address
  y = h - 10 * s;
  doc.setFont('times', 'normal');
  doc.setFontSize(fs(5.5, s));
  doc.setTextColor(LIGHT_TEXT);
  doc.text('RUA DOS TEXTEIS, 653 - Cidade Tiradentes - São Paulo/SP - CEP: 08490-600', colCenter, y, { align: 'center' });
  y += 3 * s;
  doc.text('(11) 2285-5089 - e-mail: paroqsantocristo@bol.com.br', colCenter, y, { align: 'center' });
}

// ─── Gerador principal ─────────────────────────────────────
export async function gerarCertificadoPDF(dados: DadosCertificado): Promise<jsPDF> {
  const isA4 = dados.tamanho === 'A4';
  const fmt = isA4 ? 'a4' : 'a5';

  const doc = new jsPDF({ orientation: 'landscape', format: fmt, unit: 'mm' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const s = getScale(h); // scale based on height since landscape

  const [img, brasao] = await Promise.all([
    loadImage(IMAGE_PATHS[dados.tipo]).catch(() => undefined),
    loadImage(BRASAO_PATH).catch(() => undefined),
  ]);

  // Draw all layers
  drawBackground(doc, w, h);
  drawBorder(doc, w, h, s);
  drawLeftColumn(doc, w, h, s, img, brasao);
  drawBodyText(doc, w, h, s, dados);
  drawSignature(doc, w, h, s, dados);

  return doc;
}
