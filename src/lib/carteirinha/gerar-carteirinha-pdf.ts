/**
 * Carteirinha Oficial do Dizimista — Gerador de PDF
 * Tamanho ISO/IEC 7810 ID-1: 85.60 × 53.98 mm (cartão de crédito)
 * Página: 91.60 × 59.98 mm (sangria de 3 mm em cada lado)
 * Inclui marcas de corte (crop marks) e frente/verso em páginas separadas.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface DadosCarteirinha {
  nomeParoquia: string;
  logoUrl?: string | null;
  logoParoquiaUrl?: string | null;       // logo específico da paróquia (exibido na frente, direita)
  nomeCompleto: string;
  cpf?: string | null;
  registroId?: string | null;          // matricula_paroquial
  dataInicio?: string | null;          // ISO yyyy-mm-dd
  status: 'ativo' | 'inativo' | 'pendente' | string;
  fotoUrl?: string | null;             // assinada/pública
  qrPayload: string;                   // texto/URL que será codificado
  rodape?: string;                     // ex: site ou frase
}

// ─── Constantes de layout (mm) ─────────────────────────────
const CARD_W = 85.6;
const CARD_H = 53.98;
const BLEED = 3;
const PAGE_W = CARD_W + BLEED * 2;
const PAGE_H = CARD_H + BLEED * 2;

const COLORS = {
  bordo: [90, 26, 26] as [number, number, number],          // #5a1a1a
  bordoDark: [60, 14, 14] as [number, number, number],
  ouro: [201, 168, 76] as [number, number, number],         // #c9a84c
  ouroClaro: [240, 215, 140] as [number, number, number],
  marfim: [252, 248, 238] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
  preto: [20, 20, 20] as [number, number, number],
};

// ─── Helpers ───────────────────────────────────────────────
async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Recorta uma imagem (dataURL) em um canvas quadrado de alta resolução para a foto. */
async function squareCropDataUrl(src: string, sizePx = 800): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sizePx;
      canvas.height = sizePx;
      const ctx = canvas.getContext('2d')!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, sizePx, sizePx);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Mede as dimensões naturais de uma imagem (dataURL/URL). */
async function measureImage(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Ajusta uma imagem dentro de uma caixa preservando aspecto (contain), centralizada. */
function fitContain(
  bx: number, by: number, bw: number, bh: number,
  size: { w: number; h: number } | null,
): { x: number; y: number; w: number; h: number } {
  if (!size || !size.w || !size.h) return { x: bx, y: by, w: bw, h: bh };
  const ratio = size.w / size.h;
  let w = bw;
  let h = bw / ratio;
  if (h > bh) { h = bh; w = bh * ratio; }
  const x = bx + (bw - w) / 2;
  const y = by + (bh - h) / 2;
  return { x, y, w, h };
}

function formatMesAno(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso + 'T12:00:00');
    const s = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    // "jan. de 2021" -> "Jan/2021"
    const partes = s.replace(/\./g, '').replace(' de ', '/').split('/');
    if (partes.length === 2) {
      const mes = partes[0].charAt(0).toUpperCase() + partes[0].slice(1);
      return `${mes}/${partes[1]}`;
    }
    return s;
  } catch {
    return '—';
  }
}

function formatCpf(cpf?: string | null): string {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatRegistro(reg?: string | null): string {
  if (!reg) return '—';
  // Se for puramente numérico (>=4 dígitos), formata 000.000-0
  const d = reg.replace(/\D/g, '');
  if (d.length >= 4 && d.length <= 9 && d === reg.replace(/\s/g, '')) {
    const body = d.slice(0, d.length - 1);
    const dv = d.slice(-1);
    return body.replace(/(\d{3})(?=\d)/g, '$1.') + '-' + dv;
  }
  return reg;
}

// ─── Marcas de corte ───────────────────────────────────────
function drawCropMarks(doc: jsPDF, pageW: number, pageH: number, bleed: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);
  const L = 2.5; // comprimento da marca
  const gap = 0.5;
  const corners = [
    { x: bleed, y: bleed },
    { x: pageW - bleed, y: bleed },
    { x: bleed, y: pageH - bleed },
    { x: pageW - bleed, y: pageH - bleed },
  ];
  corners.forEach(({ x, y }) => {
    // horizontais
    if (x === bleed) {
      doc.line(0, y, L, y);
      doc.line(0, y - 0.0001, L, y - 0.0001); // só estética
    } else {
      doc.line(pageW - L, y, pageW, y);
    }
    // verticais
    if (y === bleed) {
      doc.line(x, 0, x, L);
    } else {
      doc.line(x, pageH - L, x, pageH);
    }
  });
  void gap;
}

// ─── Frente ────────────────────────────────────────────────
async function drawFrente(
  doc: jsPDF,
  dados: DadosCarteirinha,
  fotoDataUrl: string | null,
  brasaoDataUrl: string | null,
  logoParoquiaDataUrl: string | null,
  brasaoSize: { w: number; h: number } | null,
  logoParoquiaSize: { w: number; h: number } | null,
) {
  doc.setFillColor(...COLORS.bordo);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  const cx = BLEED;
  const cy = BLEED;
  doc.setFillColor(...COLORS.bordo);
  doc.roundedRect(cx, cy, CARD_W, CARD_H, 2.5, 2.5, 'F');

  // Padrão decorativo sutil
  doc.setFillColor(120, 40, 40);
  [
    { x: 10, y: 14, rx: 3.2, ry: 2.4 },
    { x: 70, y: 38, rx: 4, ry: 2.6 },
    { x: 80, y: 22, rx: 2.3, ry: 1.5 },
  ].forEach((b) => doc.ellipse(cx + b.x, cy + b.y, b.rx, b.ry, 'F'));

  // Borda dourada interna
  doc.setDrawColor(...COLORS.ouro);
  doc.setLineWidth(0.25);
  doc.roundedRect(cx + 1.2, cy + 1.2, CARD_W - 2.4, CARD_H - 2.4, 2, 2, 'S');

  // Header: brasão (esq) + título (centro) + logo paróquia (dir)
  const headerY = cy + 3.5;
  const headerH = 9;
  if (brasaoDataUrl) {
    try {
      const f = fitContain(cx + 4, headerY, headerH, headerH, brasaoSize);
      doc.addImage(brasaoDataUrl, 'PNG', f.x, f.y, f.w, f.h, undefined, 'FAST');
    } catch { /* */ }
  }
  if (logoParoquiaDataUrl) {
    try {
      const lx = cx + CARD_W - 4 - headerH;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(lx, headerY, headerH, headerH, 1.2, 1.2, 'F');
      doc.setDrawColor(...COLORS.ouro);
      doc.setLineWidth(0.2);
      doc.roundedRect(lx, headerY, headerH, headerH, 1.2, 1.2, 'S');
      const pad = 0.7;
      const f = fitContain(lx + pad, headerY + pad, headerH - pad * 2, headerH - pad * 2, logoParoquiaSize);
      doc.addImage(logoParoquiaDataUrl, 'PNG', f.x, f.y, f.w, f.h, undefined, 'FAST');
    } catch { /* */ }
  }

  // Título centralizado entre brasão e logo, com wrap em até 2 linhas
  doc.setTextColor(...COLORS.marfim);
  doc.setFont('times', 'bold');
  const tituloUpper = (dados.nomeParoquia || '').toUpperCase();
  const tituloFontPt = tituloUpper.length > 40 ? 6 : tituloUpper.length > 26 ? 7 : 8;
  doc.setFontSize(tituloFontPt);
  const tituloX = cx + 4 + headerH + 1.5;
  const tituloMaxW = CARD_W - 8 - headerH * 2 - 3;
  const linhas = doc.splitTextToSize(tituloUpper, tituloMaxW).slice(0, 2);
  const lineH = tituloFontPt * 0.42;
  const blockH = lineH * linhas.length;
  // Centralização vertical no header
  let ty = headerY + headerH / 2 - blockH / 2 + tituloFontPt * 0.32;
  linhas.forEach((l: string) => {
    doc.text(l, tituloX + tituloMaxW / 2, ty, { align: 'center' });
    ty += lineH;
  });

  // Foto 22×28
  const fotoX = cx + 4;
  const fotoY = cy + 14.5;
  const fotoW = 22;
  const fotoH = 28;
  doc.setFillColor(...COLORS.ouro);
  doc.roundedRect(fotoX - 0.6, fotoY - 0.6, fotoW + 1.2, fotoH + 1.2, 2, 2, 'F');
  if (fotoDataUrl) {
    try {
      doc.addImage(fotoDataUrl, 'JPEG', fotoX, fotoY, fotoW, fotoH, undefined, 'FAST');
    } catch { /* */ }
  } else {
    doc.setFillColor(220, 210, 190);
    doc.roundedRect(fotoX, fotoY, fotoW, fotoH, 1.6, 1.6, 'F');
    doc.setTextColor(...COLORS.bordoDark);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    const iniciais = (dados.nomeCompleto || '')
      .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'DZ';
    doc.text(iniciais, fotoX + fotoW / 2, fotoY + fotoH / 2 + 2, { align: 'center' });
  }

  // Bloco de dados
  const colX = cx + 30;
  const colW = CARD_W - 30 - 4;

  const label = (txt: string, x: number, y: number) => {
    doc.setTextColor(...COLORS.ouro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.text(txt, x, y);
  };

  let y = cy + 17;
  label('NOME COMPLETO', colX, y);
  y += 3.2;
  doc.setTextColor(...COLORS.marfim);
  doc.setFont('times', 'bold');
  // Ajusta tamanho conforme comprimento para evitar overflow
  const nomeUpper = (dados.nomeCompleto || '—');
  let nomePt = 9;
  doc.setFontSize(nomePt);
  while (doc.getTextWidth(nomeUpper) > colW && nomePt > 6.5) {
    nomePt -= 0.5;
    doc.setFontSize(nomePt);
  }
  const nomeFit = doc.splitTextToSize(nomeUpper, colW).slice(0, 1)[0];
  doc.text(nomeFit, colX, y);

  // separador dourado
  y += 4;
  doc.setDrawColor(...COLORS.ouro);
  doc.setLineWidth(0.15);
  doc.line(colX, y, colX + colW, y);

  y += 3.2;
  label('REGISTRO', colX, y);
  label('DESDE', colX + colW / 2, y);
  y += 3;
  doc.setTextColor(...COLORS.marfim);
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.text(formatRegistro(dados.registroId), colX, y);
  doc.text(formatMesAno(dados.dataInicio), colX + colW / 2, y);

  // Rodapé: paróquia (esq) + status pill (dir)
  const footerY = cy + CARD_H - 5;
  const statusTexto = (dados.status || '').toUpperCase() === 'ATIVO'
    ? 'DIZIMISTA ATIVO'
    : `DIZIMISTA ${(dados.status || 'INATIVO').toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  const pillTxtW = doc.getTextWidth(statusTexto);
  const pillW = pillTxtW + 5;
  const pillH = 4.4;
  const pillX = cx + CARD_W - pillW - 4;
  const pillY = footerY - pillH / 2;
  doc.setFillColor(...COLORS.ouro);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'F');
  doc.setFillColor(...COLORS.ouroClaro);
  doc.roundedRect(pillX + 0.3, pillY + 0.3, pillW - 0.6, pillH / 2 - 0.3, 1.7, 1.7, 'F');
  doc.setTextColor(...COLORS.bordoDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text(statusTexto, pillX + pillW / 2, pillY + pillH / 2 + 1, { align: 'center' });

  // paróquia rodapé esq
  doc.setTextColor(...COLORS.marfim);
  doc.setFont('times', 'italic');
  doc.setFontSize(5);
  const paroquiaMaxW = pillX - (cx + 4) - 2;
  const par = doc.splitTextToSize(dados.nomeParoquia || '', paroquiaMaxW)[0];
  doc.text(par, cx + 4, footerY + 1);

  drawCropMarks(doc, PAGE_W, PAGE_H, BLEED);
}


// ─── Verso ─────────────────────────────────────────────────
async function drawVerso(
  doc: jsPDF,
  dados: DadosCarteirinha,
  qrDataUrl: string,
  brasaoDataUrl: string | null,
  logoParoquiaDataUrl: string | null,
  brasaoSize: { w: number; h: number } | null,
  logoParoquiaSize: { w: number; h: number } | null,
) {
  doc.setFillColor(...COLORS.bordo);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  const cx = BLEED;
  const cy = BLEED;
  doc.setFillColor(...COLORS.marfim);
  doc.roundedRect(cx, cy, CARD_W, CARD_H, 2.5, 2.5, 'F');

  doc.setDrawColor(...COLORS.ouro);
  doc.setLineWidth(0.25);
  doc.roundedRect(cx + 1.2, cy + 1.2, CARD_W - 2.4, CARD_H - 2.4, 2, 2, 'S');

  // Header: brasão esq + título centro + logo paróquia dir
  const hY = cy + 3.5;
  const hH = 7;
  if (brasaoDataUrl) {
    try {
      const f = fitContain(cx + 4, hY, hH, hH, brasaoSize);
      doc.addImage(brasaoDataUrl, 'PNG', f.x, f.y, f.w, f.h, undefined, 'FAST');
    } catch { /* */ }
  }
  if (logoParoquiaDataUrl) {
    try {
      const lx = cx + CARD_W - 4 - hH;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(lx, hY, hH, hH, 1, 1, 'F');
      doc.setDrawColor(...COLORS.ouro);
      doc.setLineWidth(0.15);
      doc.roundedRect(lx, hY, hH, hH, 1, 1, 'S');
      const pad = 0.5;
      const f = fitContain(lx + pad, hY + pad, hH - pad * 2, hH - pad * 2, logoParoquiaSize);
      doc.addImage(logoParoquiaDataUrl, 'PNG', f.x, f.y, f.w, f.h, undefined, 'FAST');
    } catch { /* */ }
  }
  doc.setTextColor(...COLORS.bordoDark);
  doc.setFont('times', 'bold');
  doc.setFontSize(5.5);
  doc.text('IDENTIFICAÇÃO OFICIAL DO DIZIMISTA', cx + CARD_W / 2, hY + hH / 2 + 1, { align: 'center' });
  // linha dourada
  doc.setDrawColor(...COLORS.ouro);
  doc.setLineWidth(0.2);
  doc.line(cx + 4, cy + 12, cx + CARD_W - 4, cy + 12);


  // QR à esquerda
  const qrSize = 24;
  const qrX = cx + 4;
  const qrY = cy + 13.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 0.8, 0.8, 'F');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Coluna de dados à direita
  const dx = cx + 32;
  const dw = CARD_W - 32 - 4;
  const linhas: [string, string][] = [
    ['Nome', dados.nomeCompleto || '—'],
    ['Registro', formatRegistro(dados.registroId)],
    ['CPF', formatCpf(dados.cpf)],
    ['Desde', formatMesAno(dados.dataInicio)],
    ['Status', ((dados.status || 'inativo').toLowerCase() === 'ativo') ? 'Ativo' : (dados.status || 'Inativo')],
  ];
  let ly = cy + 14.5;
  const rowH = 5.2;
  linhas.forEach(([k, v]) => {
    doc.setTextColor(138, 106, 31);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.text(k.toUpperCase(), dx, ly);
    doc.setTextColor(...COLORS.bordoDark);
    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    const fit = doc.splitTextToSize(v, dw).slice(0, 1)[0];
    doc.text(fit, dx, ly + 2.8);
    ly += rowH;
  });

  // Rodapé
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(110, 80, 30);
  doc.text(
    'Escaneie para validar a autenticidade do dizimista.',
    cx + CARD_W / 2,
    cy + CARD_H - 5.5,
    { align: 'center' },
  );
  doc.setFont('times', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.bordoDark);
  const rodape = dados.rodape && dados.rodape !== dados.nomeParoquia
    ? `${dados.nomeParoquia} · ${dados.rodape}`
    : dados.nomeParoquia;
  doc.text(rodape, cx + CARD_W / 2, cy + CARD_H - 2.5, { align: 'center' });

  drawCropMarks(doc, PAGE_W, PAGE_H, BLEED);
}

// ─── Gerador principal ────────────────────────────────────
export interface OpcoesCarteirinha {
  /** Inclui página de verso com QR Code. Default: true */
  incluirVerso?: boolean;
  /** Caminho do brasão (PNG). Default: /images/certificados/brasao-diocese.png */
  brasaoPath?: string;
}

export async function gerarCarteirinhaPDF(
  dados: DadosCarteirinha,
  opts: OpcoesCarteirinha = {},
): Promise<jsPDF> {
  const { incluirVerso = true, brasaoPath = '/images/certificados/brasao-diocese.png' } = opts;

  const doc = new jsPDF({
    orientation: 'landscape',
    format: [PAGE_W, PAGE_H],
    unit: 'mm',
  });

  const [fotoRaw, brasao, logoParoquia] = await Promise.all([
    dados.fotoUrl ? loadImageDataUrl(dados.fotoUrl) : Promise.resolve(null),
    loadImageDataUrl(brasaoPath),
    dados.logoParoquiaUrl ? loadImageDataUrl(dados.logoParoquiaUrl) : Promise.resolve(null),
  ]);

  const [fotoQuadrada, brasaoSize, logoParoquiaSize] = await Promise.all([
    fotoRaw ? squareCropDataUrl(fotoRaw, 900) : Promise.resolve(null),
    brasao ? measureImage(brasao) : Promise.resolve(null),
    logoParoquia ? measureImage(logoParoquia) : Promise.resolve(null),
  ]);

  const qrDataUrl = await QRCode.toDataURL(dados.qrPayload, {
    width: 1024,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#5a1a1a', light: '#ffffff' },
  });

  await drawFrente(doc, dados, fotoQuadrada, brasao, logoParoquia, brasaoSize, logoParoquiaSize);

  if (incluirVerso) {
    doc.addPage([PAGE_W, PAGE_H], 'landscape');
    await drawVerso(doc, dados, qrDataUrl, brasao, logoParoquia, brasaoSize, logoParoquiaSize);
  }

  return doc;
}

// ─── Folha A4 com 10 carteirinhas (2 colunas × 5 linhas) ──
export async function gerarFolhaA4Carteirinhas(
  lista: DadosCarteirinha[],
  opts: OpcoesCarteirinha = {},
): Promise<jsPDF> {
  const { brasaoPath = '/images/certificados/brasao-diocese.png' } = opts;
  const A4_W = 210;
  const A4_H = 297;
  const cols = 2;
  const rows = 5;
  const marginX = (A4_W - cols * CARD_W) / (cols + 1);
  const marginY = (A4_H - rows * CARD_H) / (rows + 1);

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
  const brasao = await loadImageDataUrl(brasaoPath);
  const brasaoSize = brasao ? await measureImage(brasao) : null;

  const drawCardAt = async (d: DadosCarteirinha, ox: number, oy: number) => {
    // Fundo
    doc.setFillColor(...COLORS.bordo);
    doc.roundedRect(ox, oy, CARD_W, CARD_H, 2.5, 2.5, 'F');
    doc.setFillColor(120, 40, 40);
    [
      { x: 10, y: 14, rx: 3.2, ry: 2.4 },
      { x: 70, y: 38, rx: 4, ry: 2.6 },
      { x: 80, y: 22, rx: 2.3, ry: 1.5 },
    ].forEach((b) => doc.ellipse(ox + b.x, oy + b.y, b.rx, b.ry, 'F'));
    doc.setDrawColor(...COLORS.ouro);
    doc.setLineWidth(0.25);
    doc.roundedRect(ox + 1.2, oy + 1.2, CARD_W - 2.4, CARD_H - 2.4, 2, 2, 'S');

    if (brasao) {
      try {
        const f = fitContain(ox + 4, oy + 4, 11, 11, brasaoSize);
        doc.addImage(brasao, 'PNG', f.x, f.y, f.w, f.h);
      } catch { /* */ }
    }

    doc.setTextColor(...COLORS.marfim);
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    const linhas = doc.splitTextToSize((d.nomeParoquia || '').toUpperCase(), 38).slice(0, 3);
    let ty = oy + 7.5;
    linhas.forEach((l: string) => { doc.text(l, ox + 17, ty); ty += 3.6; });

    // Foto opcional
    const fotoRaw = d.fotoUrl ? await loadImageDataUrl(d.fotoUrl) : null;
    const fotoQ = fotoRaw ? await squareCropDataUrl(fotoRaw, 700) : null;
    const fX = ox + 4, fY = oy + 21, fS = 22;
    doc.setFillColor(...COLORS.ouro);
    doc.roundedRect(fX - 0.7, fY - 0.7, fS + 1.4, fS + 1.4, 2, 2, 'F');
    if (fotoQ) {
      try { doc.addImage(fotoQ, 'JPEG', fX, fY, fS, fS); } catch { /* */ }
    } else {
      doc.setFillColor(220, 210, 190);
      doc.roundedRect(fX, fY, fS, fS, 1.8, 1.8, 'F');
    }

    // Texto direita
    const colX = ox + 30;
    const colW = CARD_W - 30 - 4;
    doc.setTextColor(...COLORS.ouro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('NOME COMPLETO', colX, oy + 23);
    doc.setTextColor(...COLORS.marfim);
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(d.nomeCompleto || '—', colW)[0], colX, oy + 27);

    doc.setTextColor(...COLORS.ouro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('REGISTRO', colX, oy + 33);
    doc.text('DESDE', colX + colW / 2, oy + 33);
    doc.setTextColor(...COLORS.marfim);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(formatRegistro(d.registroId), colX, oy + 37);
    doc.text(formatMesAno(d.dataInicio), colX + colW / 2, oy + 37);

    doc.setTextColor(...COLORS.ouro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('CPF', colX, oy + 43);
    doc.setTextColor(...COLORS.marfim);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(formatCpf(d.cpf), colX, oy + 47);
  };

  // Marcas de corte da folha (apenas linhas finas no entorno de cada cartão)
  const drawCutMarks = (ox: number, oy: number) => {
    doc.setDrawColor(150);
    doc.setLineWidth(0.1);
    const L = 1.5;
    doc.line(ox - L, oy, ox - 0.3, oy);
    doc.line(ox, oy - L, ox, oy - 0.3);
    doc.line(ox + CARD_W + 0.3, oy, ox + CARD_W + L, oy);
    doc.line(ox + CARD_W, oy - L, ox + CARD_W, oy - 0.3);
    doc.line(ox - L, oy + CARD_H, ox - 0.3, oy + CARD_H);
    doc.line(ox, oy + CARD_H + 0.3, ox, oy + CARD_H + L);
    doc.line(ox + CARD_W + 0.3, oy + CARD_H, ox + CARD_W + L, oy + CARD_H);
    doc.line(ox + CARD_W, oy + CARD_H + 0.3, ox + CARD_W, oy + CARD_H + L);
  };

  const porPagina = cols * rows;
  for (let i = 0; i < lista.length; i++) {
    const pg = Math.floor(i / porPagina);
    const idx = i % porPagina;
    if (idx === 0 && pg > 0) doc.addPage('a4', 'portrait');
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox = marginX + col * (CARD_W + marginX);
    const oy = marginY + row * (CARD_H + marginY);
    await drawCardAt(lista[i], ox, oy);
    drawCutMarks(ox, oy);
  }

  return doc;
}
