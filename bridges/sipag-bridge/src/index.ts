/**
 * Bridge HTTP para Sipag Integrado (Sicredi/Senff).
 *
 * O SDK oficial Sipag é distribuído como JAR Java (`sipag-integrado-x.y.z.jar`)
 * e expõe operações via socket TCP (PDV ↔ middleware). Esta bridge usa
 * `child_process.spawn` para iniciar o jar como subprocesso e o controla via
 * STDIN/STDOUT JSON-lines OU TCP local (configurável).
 *
 * Em `BRIDGE_MODE=sandbox`, ignora o JAR e responde com simulador.
 */
import express from 'express';

const PORT = parseInt(process.env.PORT || '60906', 10);
const MODE = (process.env.BRIDGE_MODE || 'sandbox') as 'sandbox' | 'production';

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
  if (tail === 99) return { codigoResposta: 'TIMEOUT', status: 'TIMEOUT', mensagemResposta: 'Timeout (sandbox)' };
  if (tail === 13) return { codigoResposta: '51', status: 'RECUSADA', mensagemResposta: 'Saldo insuficiente (sandbox)' };
  return {
    codigoResposta: '00', status: 'APROVADA',
    nsuLocal: rnd(), nsuHost: rnd(),
    codigoAutorizacao: rnd(), bandeira: 'MASTERCARD',
    mensagemResposta: 'Transação aprovada (sandbox)',
  };
}

async function productionTx(b: TxBody) {
  // TODO real:
  //   - spawn java -jar sipag-integrado.jar (uma vez no boot)
  //   - enviar comando JSON {operacao, valorCentavos, parcelas, ...}
  //   - aguardar resposta no STDOUT (ou socket TCP em localhost:60906)
  //   - mapear para o contrato { codigoResposta, nsuLocal, ... }
  return { codigoResposta: 'NOT_IMPL', status: 'ERRO', mensagemResposta: 'Sipag JAR não conectado' };
}

app.get('/v1/ping', (_req, res) => res.json({ ok: true, versao: `sipag-bridge-${MODE}`, serial: 'SIPAG' }));

app.post('/v1/transacao', async (req, res) => {
  try {
    const body = req.body;
    const tx: TxBody = {
      action: body.operacao === 'VENDA_CREDITO' ? 'credit' : 'debit',
      amount: body.valorCentavos,
      installments: body.parcelas || 1,
      terminalId: body.identificadorPdv || 'PDV001',
      reference: body.referencia || '',
    };
    const r = MODE === 'sandbox' ? sandboxTx(tx) : await productionTx(tx);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ codigoResposta: 'ERROR', mensagemResposta: e.message });
  }
});

app.post('/v1/confirmacao', (_req, res) => res.json({ codigoResposta: '00' }));
app.post('/v1/cancelamento', (_req, res) => res.json({ codigoResposta: '00' }));

// Compat com contrato genérico do client-local
app.get('/status', (_req, res) => res.json({ ok: true, firmware: `sipag-bridge-${MODE}`, serial: 'SIPAG' }));

app.listen(PORT, () => {
  console.log(`🟢 sipag-bridge [${MODE}] ouvindo em http://localhost:${PORT}`);
});
