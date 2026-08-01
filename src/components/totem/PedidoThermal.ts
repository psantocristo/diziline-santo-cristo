/**
 * PedidoThermal.ts
 * Gera comprovante térmico 80mm para pedidos da loja (código de retirada).
 */

export interface DadosPedido {
  codigoRetirada: string;
  total: number;
  itens: { nome: string; quantidade: number; preco: number }[];
  nomeCliente?: string;
  dataHora: Date;
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function gerarHTML(dados: DadosPedido): string {
  const itensRows = dados.itens.map(i =>
    `<div class="row"><span>${i.quantidade}x ${i.nome}</span><span>${formatarReais(i.preco * i.quantidade)}</span></div>`
  ).join('');

  const clienteRow = dados.nomeCliente
    ? `<div class="row"><span>Cliente</span><span class="bold">${dados.nomeCliente}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Pedido ${dados.codigoRetirada}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      width: 80mm;
      max-width: 80mm;
      color: #000;
      background: #fff;
      padding: 3mm;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 2px 0;
    }
    .row span:first-child { color: #444; margin-right: 6px; }
    .code-box {
      border: 3px solid #000;
      padding: 8px;
      margin: 8px 0;
      text-align: center;
    }
    .code-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #444; }
    .code-value { font-size: 24px; font-weight: bold; letter-spacing: 3px; margin-top: 2px; }
    .total-box {
      border: 2px solid #000;
      padding: 5px 8px;
      margin: 6px 0;
      text-align: center;
    }
    .total-label { font-size: 9px; letter-spacing: 2px; color: #444; }
    .total-valor { font-size: 18px; font-weight: bold; }
    @media print {
      body { padding: 1mm; width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:13px;letter-spacing:1px;">PEDIDO — LOJA</div>
  <hr class="divider-solid" />

  <div class="row"><span>Data</span><span>${formatarDataHora(dados.dataHora)}</span></div>
  ${clienteRow}

  <hr class="divider" />

  ${itensRows}

  <div class="total-box">
    <div class="total-label">Total</div>
    <div class="total-valor">${formatarReais(dados.total)}</div>
  </div>

  <div class="code-box">
    <div class="code-label">Código de Retirada</div>
    <div class="code-value">${dados.codigoRetirada}</div>
  </div>

  <hr class="divider" />
  <div class="center" style="font-size:10px;color:#444;">
    Apresente este código no caixa<br/>para retirar seus produtos.
  </div>
</body>
</html>`;
}

/**
 * Abre janela dedicada e imprime o comprovante do pedido.
 */
export function imprimirPedido(dados: DadosPedido): void {
  const html = gerarHTML(dados);
  const win = window.open('', '_blank', 'width=400,height=600,menubar=no,toolbar=no,location=no');
  if (!win) {
    console.warn('Popup bloqueado.');
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
