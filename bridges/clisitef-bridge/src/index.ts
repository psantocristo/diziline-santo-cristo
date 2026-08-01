/**
 * Bridge HTTP genérica para CliSiTef.dll (Software Express / Rede Connect TEF).
 *
 * - BRIDGE_MODE=sandbox → simulador local (sem DLL).
 * - BRIDGE_MODE=production → carrega CliSiTef.dll via FFI (koffi).
 *
 * Para produção:
 *   1. Instalar a CliSiTef oficial em C:\Program Files (x86)\Software Express\
 *   2. Copiar `CliSiTef.dll` (x64) para esta pasta OU configurar CLISITEF_DLL_PATH
 *   3. `npm install koffi` (somente em Windows)
 *   4. Preencher os blocos `// TODO real` abaixo com os símbolos da DLL.
 *
 * Os nomes dos símbolos seguem a documentação oficial CliSiTef Manual v3:
 *   - ConfiguraIntSiTefInterativo
 *   - IniciaFuncaoSiTefInterativo
 *   - ContinuaFuncaoSiTefInterativo
 *   - FinalizaTransacaoSiTefInterativo
 */
import express from 'express';

const PORT = parseInt(process.env.PORT || '8090', 10);
const MODE = (process.env.BRIDGE_MODE || 'sandbox') as 'sandbox' | 'production';

const app = express();
app.use(express.json({ limit: '1mb' }));

interface TxBody {
  action: 'credit' | 'debit';
  amount: number; // centavos
  installments: number;
  terminalId: string;
  reference: string;
}

// ─────────────────────────────────────────────────────────────
// SANDBOX
// ─────────────────────────────────────────────────────────────
function sandboxTx(b: TxBody) {
  const tail = b.amount % 100;
  const rnd = (n = 6) => Math.floor(Math.random() * 10 ** n).toString().padStart(n, '0');
  if (tail === 99) return { approved: false, returnCode: 'TIMEOUT', message: 'Timeout (sandbox)' };
  if (tail === 13) return { approved: false, returnCode: '51', message: 'Saldo insuficiente (sandbox)' };
  return { approved: true, nsu: rnd(), authCode: rnd(), brand: 'VISA', returnCode: '0', message: 'Aprovada (sandbox)' };
}

// ─────────────────────────────────────────────────────────────
// PRODUÇÃO — FFI para CliSiTef.dll
// ─────────────────────────────────────────────────────────────
let dll: any = null;
function loadDll() {
  if (dll) return dll;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const koffi = require('koffi');
  const dllPath = process.env.CLISITEF_DLL_PATH || './CliSiTef.dll';
  const lib = koffi.load(dllPath);

  // TODO real: ajustar assinaturas conforme manual CliSiTef
  dll = {
    Configura: lib.func('int ConfiguraIntSiTefInterativo(str, str, str, str, str)'),
    Inicia: lib.func('int IniciaFuncaoSiTefInterativo(int, str, str, str, str, str, str)'),
    Continua: lib.func('int ContinuaFuncaoSiTefInterativo(_Out_ int*, _Out_ int*, _Out_ str*, _Out_ str*, _Out_ int*, _Out_ int*)'),
    Finaliza: lib.func('int FinalizaTransacaoSiTefInterativo(int, int, str, str, str)'),
  };
  return dll;
}

async function productionTx(b: TxBody) {
  const d = loadDll();
  // TODO real: implementar laço Continua até StatusCode != 10000
  // Códigos: Função 0=Venda Crédito, 2=Débito ; valor em string "0,00"
  const funcId = b.action === 'credit' ? 0 : 2;
  const valor = (b.amount / 100).toFixed(2).replace('.', ',');
  const rc = d.Inicia(funcId, valor, b.reference.slice(0, 14), '000000', '000000', b.terminalId, '');
  if (rc !== 10000) return { approved: false, returnCode: String(rc), message: 'Falha ao iniciar SiTef' };
  // ... laço Continua/Finaliza omitido — implementar conforme manual
  return { approved: false, returnCode: 'NOT_IMPL', message: 'CliSiTef FFI: laço Continua/Finaliza pendente' };
}

// ─────────────────────────────────────────────────────────────
// Rotas
// ─────────────────────────────────────────────────────────────
app.get('/status', (_req, res) => {
  res.json({ ok: true, firmware: `clisitef-bridge-${MODE}`, serial: 'CLISITEF' });
});

app.post('/transaction', async (req, res) => {
  try {
    const body = req.body as TxBody;
    const r = MODE === 'sandbox' ? sandboxTx(body) : await productionTx(body);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ approved: false, message: e.message });
  }
});

app.post('/confirm', (_req, res) => res.json({ ok: true }));
app.post('/cancel', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🔌 clisitef-bridge [${MODE}] ouvindo em http://localhost:${PORT}`);
});
