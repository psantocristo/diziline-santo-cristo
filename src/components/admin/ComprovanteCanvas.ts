/**
 * ComprovanteCanvas.ts
 * Gera um comprovante PNG (800×520px) usando apenas a Canvas 2D API nativa do browser.
 * Sem dependências externas.
 */

export interface DadosPagamento {
  id: string;
  valor: number;
  tipo: string;
  metodo: string;
  status: string;
  pago_em: string | null;
  codigo_autenticacao: string | null;
  nome_contribuinte?: string | null;
  paroquianos?: { nome_completo: string } | null;
  campanhas?: { nome: string } | null;
  parcelas?: number | null;
  mes_referencia?: string | null;
}

export interface DadosParoquia {
  nome?: string | null;
  cnpj?: string | null;
  site?: string | null;
  telefone?: string | null;
  logoUrl?: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  dizimo: 'Dízimo', oferta: 'Oferta', campanha: 'Campanha', eventual: 'Eventual',
};
const METODO_LABELS: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
};

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function gerarComprovantePNG(
  pagamento: DadosPagamento,
  paroquia: DadosParoquia
): Promise<void> {
  const W = 800;
  const H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Cores ─────────────────────────────────────────────────
  const GOLD = '#C9A84C';
  const GOLD_DARK = '#8B6914';
  const WINE = '#7B1C2A';
  const WINE_DARK = '#4A0E18';
  const WHITE = '#FFFFFF';
  const LIGHT_BG = '#FBF8F0';
  const GRAY = '#6B7280';

  // ── Fundo geral ───────────────────────────────────────────
  ctx.fillStyle = LIGHT_BG;
  ctx.fillRect(0, 0, W, H);

  // ── Cabeçalho gradiente dourado ───────────────────────────
  const headerH = 110;
  const headerGrad = ctx.createLinearGradient(0, 0, W, headerH);
  headerGrad.addColorStop(0, WINE_DARK);
  headerGrad.addColorStop(0.5, WINE);
  headerGrad.addColorStop(1, GOLD_DARK);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, headerH);

  // Logo (se disponível)
  let logoX = 32;
  const logoSize = 70;
  if (paroquia.logoUrl) {
    const img = await carregarImagem(paroquia.logoUrl);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, headerH / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, logoX, (headerH - logoSize) / 2, logoSize, logoSize);
      ctx.restore();
      logoX = logoX + logoSize + 16;
    }
  }

  // Título no cabeçalho
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 11px Georgia, serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('COMPROVANTE DE CONTRIBUIÇÃO', logoX, 36);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = WHITE;
  ctx.font = 'bold 18px Georgia, serif';
  ctx.fillText(paroquia.nome || 'Paróquia', logoX, 62);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Georgia, serif';
  const subInfo = [paroquia.cnpj ? `CNPJ: ${paroquia.cnpj}` : '', paroquia.telefone || ''].filter(Boolean).join('  ·  ');
  ctx.fillText(subInfo, logoX, 84);

  // Linha separadora dourada
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(W, headerH);
  ctx.stroke();

  // ── Valor central ─────────────────────────────────────────
  const valY = headerH + 58;
  ctx.fillStyle = WINE;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(formatarValor(pagamento.valor), W / 2, valY);

  // Selo PAGO
  const sealW = 100;
  const sealH = 28;
  const sealX = W / 2 - sealW / 2;
  const sealY = valY + 10;
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.roundRect(sealX, sealY, sealW, sealH, 14);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillText('✓ PAGO', W / 2, sealY + 19);

  // ── Linha divisória ───────────────────────────────────────
  const divY = valY + 52;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(32, divY);
  ctx.lineTo(W - 32, divY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Grid de dados ─────────────────────────────────────────
  ctx.textAlign = 'left';
  const nome = (pagamento.paroquianos as any)?.nome_completo || pagamento.nome_contribuinte || 'Anônimo';

  // Formatar mês de referência para dízimo
  const mesRefLabel = (() => {
    if (pagamento.tipo !== 'dizimo' || !pagamento.mes_referencia) return null;
    const d = new Date(pagamento.mes_referencia + 'T12:00:00');
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  const campos = [
    { label: pagamento.tipo === 'dizimo' ? 'Dizimista' : 'Fiel', value: nome },
    { label: 'Tipo de Contribuição', value: TIPO_LABELS[pagamento.tipo] || pagamento.tipo },
    ...(mesRefLabel ? [{ label: 'Mês de Referência', value: mesRefLabel }] : []),
    { label: 'Método de Pagamento', value: METODO_LABELS[pagamento.metodo] || pagamento.metodo },
    { label: 'Data de Pagamento', value: formatarData(pagamento.pago_em) },
    { label: 'Parcelas', value: pagamento.parcelas ? `${pagamento.parcelas}x` : '1x' },
    ...(pagamento.campanhas ? [{ label: 'Campanha', value: (pagamento.campanhas as any).nome }] : []),
  ];

  const colW = (W - 64) / 2;
  const startY = divY + 22;
  const rowH = 44;

  campos.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 32 + col * colW;
    const y = startY + row * rowH;

    ctx.fillStyle = GRAY;
    ctx.font = '10px Georgia, serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(c.label.toUpperCase(), x, y);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = WINE_DARK;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText(c.value, x, y + 16);
  });

  // ── Bloco de autenticação ─────────────────────────────────
  const authY = H - 100;
  const authGrad = ctx.createLinearGradient(32, authY, W - 32, authY);
  authGrad.addColorStop(0, 'rgba(201,168,76,0.12)');
  authGrad.addColorStop(1, 'rgba(123,28,42,0.08)');
  ctx.fillStyle = authGrad;
  ctx.beginPath();
  ctx.roundRect(32, authY, W - 64, 48, 8);
  ctx.fill();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(32, authY, W - 64, 48, 8);
  ctx.stroke();

  ctx.fillStyle = GOLD_DARK;
  ctx.font = '11px Georgia, serif';
  ctx.fillText('🔐  CÓDIGO DE AUTENTICAÇÃO', 50, authY + 16);

  ctx.fillStyle = WINE;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(pagamento.codigo_autenticacao || '—', 50, authY + 36);

  // ID truncado (direita)
  ctx.textAlign = 'right';
  ctx.fillStyle = GRAY;
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(`ID: ${pagamento.id.slice(0, 16)}...`, W - 48, authY + 36);

  // ── Rodapé ────────────────────────────────────────────────
  const footerY = H - 40;
  const footerGrad = ctx.createLinearGradient(0, footerY, W, H);
  footerGrad.addColorStop(0, WINE);
  footerGrad.addColorStop(1, WINE_DARK);
  ctx.fillStyle = footerGrad;
  ctx.fillRect(0, footerY, W, 40);

  ctx.fillStyle = GOLD;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('🙏 Deus lhe pague!', W / 2, footerY + 17);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px Georgia, serif';
  const rodapeInfo = [paroquia.site, paroquia.telefone].filter(Boolean).join('  ·  ');
  ctx.fillText(rodapeInfo || 'Sistema de Dízimo', W / 2, footerY + 32);

  // ── Download ──────────────────────────────────────────────
  const data = pagamento.pago_em ? new Date(pagamento.pago_em) : new Date();
  const dataStr = `${String(data.getDate()).padStart(2, '0')}${String(data.getMonth() + 1).padStart(2, '0')}${data.getFullYear()}`;
  const codigo = (pagamento.codigo_autenticacao || pagamento.id.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '');
  const nomeArquivo = `comprovante_${codigo}_${dataStr}.png`;

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
