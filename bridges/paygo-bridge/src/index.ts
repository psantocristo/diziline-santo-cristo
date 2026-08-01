/**
 * Bridge HTTP para PayGo PGWebLib.
 *
 * PGWebLib expõe um servidor WebSocket local (porta padrão 60906) usando
 * protocolo JSON definido pela Setis. Esta bridge traduz HTTP REST → WS
 * para que o client-local consuma do mesmo jeito que os outros provedores.
 *
 * Em `BRIDGE_MODE=sandbox` responde sem conectar no WebSocket.
 */
import express from 'express';

const PORT = parseInt(process.env.PORT || '9999', 10);
const MODE = (process.env.BRIDGE_MODE || 'sandbox') as 'sandbox' | 'production';
const PGWEBLIB_WS = process.env.PGWEBLIB_WS_URL || 'ws://localhost:60906';

const app = express();
app.use(express.json({ limit: '1mb' }));

interface TxBody {
  action: 'credit' | 'debit';
  amount: number;
  installments: number;
  terminalId: string;
  reference: string;
}

function rnd(n = 6) { return Math.floor(Math.random() * 10 ** n).toString().padStart(n, '0'); }

function sandboxTx(b: TxBody) {
  const tail = b.amount % 100;
  if (tail === 99) return { status: 'TIMEOUT', returnCode: 'TIMEOUT', message: 'Timeout (sandbox)' };
  if (tail === 13) return { status: 'DENIED', returnCode: '51', message: 'Recusada (sandbox)' };
  return { status: 'OK', approved: true, nsu: rnd(), authorization: rnd(), cardBrand: 'ELO', message: 'Aprovada (sandbox)' };
}

async function productionTx(b: TxBody) {
  // TODO real: abrir WS em PGWEBLIB_WS, enviar
  //   { "Identificador": 0, "Operacao": b.action === 'credit' ? 'VDC' : 'VDD',
  //     "Valor": (b.amount/100).toFixed(2).replace('.', ','),
  //     "QtdParcelas": b.installments, "DocumentoFiscal": b.reference }
  // ler eventos até { "Resultado": "SUCESSO" | "ERRO" }
  // mapear NSU, Autorizacao, Bandeira.
  return { status: 'ERROR', returnCode: 'NOT_IMPL', message: 'PGWebLib WS não conectado' };
}

app.get('/status', (_req, res) => res.json({ ok: true, version: `paygo-bridge-${MODE}`, terminal: 'PAYGO' }));

app.post('/transaction', async (req, res) => {
  try {
    const r = MODE === 'sandbox' ? sandboxTx(req.body) : await productionTx(req.body);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

app.post('/confirm', (_req, res) => res.json({ ok: true }));
app.post('/cancel', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`⚙️  paygo-bridge [${MODE}] ouvindo em http://localhost:${PORT} → WS ${PGWEBLIB_WS}`);
});
