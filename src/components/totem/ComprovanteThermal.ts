/**
 * ComprovanteThermal.ts
 * Gerador de comprovante térmico 58/80mm autocontido.
 * Abre uma janela dedicada com HTML puro e dispara o diálogo de impressão.
 * Respeita a personalização salva em configuracoes_paroquia.comprovante_config.
 */

import {
  ComprovanteConfig,
  DEFAULT_COMPROVANTE_CONFIG,
  getComprovanteConfig,
  mergeConfig,
} from "@/lib/comprovante-config";

export interface DadosComprovante {
  pagamentoId?: string;
  valor: number;
  tipo: string;
  metodo: string;
  nomeContribuinte?: string;
  citacao?: { ref: string; texto: string };
  dataHora: Date;
  cnpjParoquia?: string;
  siteParoquia?: string;
  telefoneParoquia?: string;
  mesReferencia?: Date | string | null;
}

const TIPO_LABEL: Record<string, string> = {
  dizimo: "Dízimo",
  oferta: "Oferta",
  campanha: "Campanha",
  eventual: "Doação",
};

const METODO_LABEL: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
};

function formatarReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataHora(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatarMesReferencia(mes: Date | string | null | undefined): string | null {
  if (!mes) return null;
  const d = typeof mes === 'string' ? new Date(mes + 'T12:00:00') : mes;
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function logoParaBase64(logoUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function gerarHTML(
  dados: DadosComprovante,
  logoBase64: string | null,
  cfg: ComprovanteConfig
): string {
  const {
    pagamentoId, valor, tipo, metodo, nomeContribuinte, dataHora,
    cnpjParoquia, siteParoquia, telefoneParoquia, mesReferencia, citacao,
  } = dados;

  const larguraMm = cfg.larguraPapelMm || 80;
  const isCompacto = ['oferta', 'campanha', 'eventual'].includes(tipo);

  const logoTag = (!isCompacto && cfg.mostrarLogo && logoBase64)
    ? `<img src="${logoBase64}" alt="Logo" style="max-width:35mm;max-height:18mm;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : "";

  const contribuinteLabel = tipo === 'dizimo' ? 'Dizimista' : 'Fiel';
  const contribuinteRow = (cfg.mostrarContribuinte && nomeContribuinte)
    ? `<div class="row"><span>${contribuinteLabel}</span><span class="bold" style="max-width:55%;text-align:right;">${nomeContribuinte}</span></div>`
    : "";

  const mesRef = formatarMesReferencia(mesReferencia);
  const mesReferenciaRow = (cfg.mostrarMesReferencia && tipo === 'dizimo' && mesRef)
    ? `<div class="row highlight-row"><span>Mês de Referência</span><span class="bold">${mesRef}</span></div>`
    : '';

  const idRow = (cfg.mostrarId && !isCompacto && pagamentoId)
    ? `<div class="row"><span>ID</span><span class="mono" style="font-size:9px;">#${pagamentoId.slice(0, 8).toUpperCase()}</span></div>`
    : "";

  const statusRow = cfg.mostrarStatus
    ? `<div class="row"><span>Status</span><span class="status-badge">PAGO ✓</span></div>`
    : "";

  const citacaoBlock = (cfg.mostrarCitacao && citacao)
    ? `<div class="center" style="font-size:10px;font-style:italic;margin:6px 0;padding:4px;border:1px dashed #000;">
         "${citacao.texto}"<br/><span class="bold">— ${citacao.ref}</span>
       </div>` : "";

  if (isCompacto) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Comprovante</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.4;width:${larguraMm}mm;max-width:${larguraMm}mm;color:#000;background:#fff;padding:2mm 3mm}
  .center{text-align:center}.bold{font-weight:bold}
  .divider{border:none;border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between;align-items:flex-start;margin:2px 0}
  .row span:first-child{color:#444;white-space:nowrap;margin-right:6px}
  .valor{font-size:16px;font-weight:bold;margin:4px 0}
  .status-badge{display:inline-block;border:1px solid #000;padding:1px 6px;font-size:9px;font-weight:bold}
  @media print{body{padding:1mm;width:${larguraMm}mm}@page{margin:0;size:${larguraMm}mm auto}}
</style></head><body>
  <div class="center bold" style="font-size:11px;letter-spacing:1px;">COMPROVANTE</div>
  <hr class="divider"/>
  <div class="row"><span>Data</span><span>${formatarDataHora(dataHora)}</span></div>
  <div class="row"><span>Tipo</span><span class="bold">${TIPO_LABEL[tipo] || tipo}</span></div>
  <div class="row"><span>Método</span><span class="bold">${METODO_LABEL[metodo] || metodo}</span></div>
  ${contribuinteRow}
  <div class="center valor">${formatarReais(valor)}</div>
  ${statusRow}
  ${citacaoBlock}
  <hr class="divider"/>
  ${cfg.mostrarBencao ? `<div class="center bold" style="font-size:11px;">${cfg.textoBencao} 🙏</div>` : ''}
</body></html>`;
  }

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${cfg.tituloDocumento}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.45;width:${larguraMm}mm;max-width:${larguraMm}mm;color:#000;background:#fff;padding:4mm 3mm}
  .center{text-align:center}.bold{font-weight:bold}.mono{font-family:'Courier New',monospace}
  .small{font-size:9px;color:#444}.mt4{margin-top:4px}.mb4{margin-bottom:4px}
  .divider{border:none;border-top:1px dashed #000;margin:6px 0}
  .divider-solid{border:none;border-top:2px solid #000;margin:6px 0}
  .row{display:flex;justify-content:space-between;align-items:flex-start;margin:3px 0}
  .row span:first-child{color:#444;white-space:nowrap;margin-right:6px}
  .highlight-row{border:1px dashed #000;padding:3px 5px;margin:5px 0;background:#f5f5f5}
  .highlight-row span:first-child{color:#000;font-weight:bold}
  .total-box{border:2px solid #000;padding:6px 8px;margin:8px 0;text-align:center}
  .total-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#444;margin-bottom:2px}
  .total-valor{font-size:20px;font-weight:bold;letter-spacing:1px}
  .status-badge{display:inline-block;border:1px solid #000;padding:1px 8px;font-size:10px;font-weight:bold;letter-spacing:1px}
  .parish-sub{font-size:10px;color:#333}
  .doc-title{font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase}
  .footer-blessing{font-size:12px;font-weight:bold;margin-bottom:4px}
  .footer-info{font-size:9px;color:#444;line-height:1.6}
  @media print{body{padding:2mm;width:${larguraMm}mm}@page{margin:0;size:${larguraMm}mm auto}}
</style></head><body>
  <div class="center mb4">
    ${logoTag}
    ${cfg.mostrarCnpj && cnpjParoquia ? `<div class="parish-sub mt4">CNPJ: ${cnpjParoquia}</div>` : ''}
  </div>
  <hr class="divider-solid"/>
  <div class="center"><span class="doc-title">${cfg.tituloDocumento}</span></div>
  <hr class="divider-solid"/>
  <div style="margin:6px 0;">
    <div class="row"><span>Data / Hora</span><span class="bold">${formatarDataHora(dataHora)}</span></div>
    <div class="row"><span>Tipo</span><span class="bold">${TIPO_LABEL[tipo] || tipo}</span></div>
    ${mesReferenciaRow}
    ${contribuinteRow}
  </div>
  <div class="total-box">
    <div class="total-label">Valor Total</div>
    <div class="total-valor">${formatarReais(valor)}</div>
  </div>
  <div style="margin:6px 0;">
    <div class="row"><span>Método</span><span class="bold">${METODO_LABEL[metodo] || metodo}</span></div>
    ${idRow}
    ${statusRow}
  </div>
  ${citacaoBlock}
  <hr class="divider"/>
  <div class="center" style="margin-top:6px;">
    ${cfg.mostrarBencao ? `<div class="footer-blessing">${cfg.textoBencao} 🙏</div>` : ''}
    <div class="footer-info">
      ${cfg.mostrarSite && siteParoquia ? `${siteParoquia}<br/>` : ''}
      ${cfg.mostrarTelefone && telefoneParoquia ? `Tel: ${telefoneParoquia}<br/>` : ''}
      ${cfg.mostrarRodapeGuarde ? `<br/><span class="small">${cfg.textoRodape}</span>` : ''}
    </div>
  </div>
</body></html>`;
}

/**
 * Abre uma janela dedicada e imprime o comprovante térmico.
 * Aceita config explícita; caso contrário busca no Supabase (cache).
 */
export async function imprimirComprovante(
  dados: DadosComprovante,
  logoSrc?: string,
  configOverride?: Partial<ComprovanteConfig>
): Promise<void> {
  const cfgBase = configOverride
    ? mergeConfig(configOverride)
    : await getComprovanteConfig().catch(() => DEFAULT_COMPROVANTE_CONFIG);

  const logoBase64 = (cfgBase.mostrarLogo && logoSrc) ? await logoParaBase64(logoSrc) : null;
  const html = gerarHTML(dados, logoBase64, cfgBase);

  const win = window.open("", "_blank", "width=400,height=600,menubar=no,toolbar=no,location=no");
  if (!win) {
    console.warn("Popup bloqueado. Verifique as permissões do navegador.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  }, 400);
}
