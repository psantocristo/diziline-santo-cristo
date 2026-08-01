import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { validateBody } from '../middleware/validate';
import { setupSaveSchema } from '../schemas';
import logger, { getRecentLogs } from '../utils/logger';
import { explainError } from '../utils/error-explainer';

const router = Router();


// ─────────────────────────────────────────────────────────────
// Catálogo de impressoras térmicas conhecidas (USB VID/PID)
// Usado para nomear devices detectados e oferecer presets.
// ─────────────────────────────────────────────────────────────
const KNOWN_PRINTERS: Array<{ vid: number; pid: number; name: string; family: string }> = [
  { vid: 0x04b8, pid: 0x0202, name: 'Epson TM-T20',  family: 'epson' },
  { vid: 0x04b8, pid: 0x0e15, name: 'Epson TM-T20II', family: 'epson' },
  { vid: 0x04b8, pid: 0x0e28, name: 'Epson TM-T20X',  family: 'epson' },
  { vid: 0x04b8, pid: 0x0e03, name: 'Epson TM-T88V',  family: 'epson' },
  { vid: 0x0b1b, pid: 0x0003, name: 'Bematech MP-4200 TH', family: 'bematech' },
  { vid: 0x0dd4, pid: 0x0205, name: 'Elgin i9',       family: 'elgin' },
  { vid: 0x0dd4, pid: 0x0186, name: 'Elgin i7',       family: 'elgin' },
  { vid: 0x0fe6, pid: 0x811e, name: 'Daruma DR800',   family: 'daruma' },
  { vid: 0x154f, pid: 0x154f, name: 'Control iD Print iD Touch', family: 'controlid' },
];

function describeUsb(vid: number, pid: number): { name: string; family: string } {
  const known = KNOWN_PRINTERS.find((p) => p.vid === vid && p.pid === pid);
  if (known) return { name: known.name, family: known.family };
  return { name: `Dispositivo USB ${toHex(vid)}:${toHex(pid)}`, family: 'desconhecida' };
}

function toHex(n: number): string {
  return '0x' + n.toString(16).padStart(4, '0');
}

// ─────────────────────────────────────────────────────────────
// GET /api/setup/discover — Descobre impressoras USB, COMs e info do sistema
// ─────────────────────────────────────────────────────────────
router.get('/setup/discover', async (_req: Request, res: Response) => {
  const out: any = {
    usb: [] as Array<{ vid: string; pid: string; name: string; family: string }>,
    serial: [] as Array<{ path: string; manufacturer?: string; pnpId?: string }>,
    knownPresets: KNOWN_PRINTERS.map((p) => ({
      vid: toHex(p.vid), pid: toHex(p.pid), name: p.name, family: p.family,
    })),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
  };

  // USB
  try {
    const usb = await import('usb');
    const devices = (usb as any).getDeviceList?.() || (usb as any).default?.getDeviceList?.() || [];
    for (const d of devices) {
      const desc = d.deviceDescriptor;
      if (!desc) continue;
      const { name, family } = describeUsb(desc.idVendor, desc.idProduct);
      out.usb.push({
        vid: toHex(desc.idVendor),
        pid: toHex(desc.idProduct),
        name,
        family,
      });
    }
  } catch (err: any) {
    out.usbError = err.message;
  }

  // Serial
  try {
    const sp = await import('serialport');
    const ports = await (sp as any).SerialPort.list();
    out.serial = ports.map((p: any) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      pnpId: p.pnpId,
    }));
  } catch (err: any) {
    out.serialError = err.message;
  }

  res.json(out);
});

// ─────────────────────────────────────────────────────────────
// POST /api/setup/test-printer — Abre device e imprime cupom de teste
// Body: { type, vid?, pid?, serialPort?, baud?, ip?, port? }
// ─────────────────────────────────────────────────────────────
router.post('/setup/test-printer', async (req: Request, res: Response) => {
  const cfg = req.body || {};
  const type = cfg.type as 'usb' | 'serial' | 'network';
  const t0 = Date.now();
  logger.info('[setup] test-printer iniciado', { type });

  try {
    const escpos = await import('escpos');
    let device: any;
    let ctx: 'printer-usb' | 'printer-serial' | 'printer-network' = 'printer-usb';

    if (type === 'usb') {
      const vid = parseInt(String(cfg.vid || '0x04b8'), 16);
      const pid = parseInt(String(cfg.pid || '0x0202'), 16);
      const escposUsb = await import('escpos-usb');
      device = new (escposUsb as any).USB(vid, pid);
      ctx = 'printer-usb';
    } else if (type === 'serial') {
      const escposSerial = await import('escpos-serialport');
      device = new (escposSerial as any).SerialPort(cfg.serialPort || 'COM3', {
        baudRate: parseInt(String(cfg.baud || 9600), 10),
      });
      ctx = 'printer-serial';
    } else if (type === 'network') {
      const escposNet = await import('escpos-network');
      device = new (escposNet as any).Network(cfg.ip || '192.168.1.100', parseInt(String(cfg.port || 9100), 10));
      ctx = 'printer-network';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Tipo de impressora inválido',
        cause: `Tipo recebido: "${type}"`,
        fix: 'Use "usb", "serial" ou "network".',
      });
    }

    const printer = new (escpos as any).Printer(device);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout ao abrir impressora (5s)')), 5000);
      device.open((err: any) => {
        clearTimeout(timeout);
        if (err) return reject(err);
        try {
          printer
            .align('ct').style('b').size(2, 2).text('DízimoSC')
            .size(1, 1).style('normal')
            .text('--------------------------------')
            .text('TESTE DO ASSISTENTE')
            .text(`Conexão: ${String(type).toUpperCase()}`)
            .text(`Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
            .text('--------------------------------')
            .text('Se voce esta lendo este cupom,')
            .text('a impressora esta funcionando!')
            .feed(3).cut().close();
          resolve();
        } catch (e) { reject(e); }
      });
    });

    logger.info('[setup] test-printer OK', { type, latencyMs: Date.now() - t0 });
    res.json({
      success: true,
      message: `Impressora respondeu e cortou o papel (${Date.now() - t0}ms). Verifique o cupom físico.`,
      latencyMs: Date.now() - t0,
    });
  } catch (err: any) {
    const ctx = type === 'serial' ? 'printer-serial' : type === 'network' ? 'printer-network' : 'printer-usb';
    const explained = explainError(err, ctx);
    logger.warn('[setup] test-printer FALHOU', { type, error: explained.raw });
    res.json({ success: false, ...explained });
  }
});


// ─────────────────────────────────────────────────────────────
// POST /api/setup/test-pinpad — Faz ping no middleware do provedor
// Body: { provider, url, terminalId? }
// ─────────────────────────────────────────────────────────────
router.post('/setup/test-pinpad', async (req: Request, res: Response) => {
  const { provider = 'connect_tef', url } = req.body || {};
  if (!url) {
    return res.json({
      success: false,
      message: 'URL do middleware não informada',
      cause: 'O campo "URL do Middleware" está vazio.',
      fix: 'Informe o endereço HTTP do daemon (ex.: http://localhost:8090).',
    });
  }

  const t0 = Date.now();
  const candidates: Record<string, string[]> = {
    connect_tef:   ['/health', '/status', '/'],
    sipag:         ['/api/health', '/status', '/'],
    pagarme_stone: ['/health', '/status', '/'],
    paygo:         ['/health', '/status', '/'],
  };
  const paths = candidates[provider] || ['/'];

  let lastErr: any = null;
  for (const p of paths) {
    const target = url.replace(/\/$/, '') + p;
    try {
      const r = await fetch(target, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (r.ok || r.status === 404 || r.status === 405) {
        logger.info('[setup] test-pinpad OK', { provider, endpoint: target, status: r.status });
        return res.json({
          success: true,
          message: `Middleware respondeu em ${target} (HTTP ${r.status}, ${Date.now() - t0}ms)`,
          endpoint: target,
          status: r.status,
          latencyMs: Date.now() - t0,
        });
      }
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (err: any) {
      lastErr = err;
    }
  }

  const explained = explainError(lastErr || new Error('Sem resposta'), 'pinpad');
  logger.warn('[setup] test-pinpad FALHOU', { provider, url, error: explained.raw });
  res.json({
    success: false,
    message: `Sem resposta em ${url} (provedor ${provider})`,
    cause: explained.cause || `Tentei ${paths.join(', ')} — todas falharam.`,
    fix: explained.fix || `Confirme que o middleware do ${provider} está rodando. Veja bridges/${provider}-bridge/README.md.`,
    raw: explained.raw,
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/setup/test-cors — Verifica acesso ao sistema web
// ─────────────────────────────────────────────────────────────
router.post('/setup/test-cors', async (req: Request, res: Response) => {
  const url = (req.body?.corsOrigin || '').replace(/\/$/, '');
  if (!url) {
    return res.json({
      success: false,
      message: 'URL do sistema não informada',
      cause: 'Campo "URL do sistema" vazio.',
      fix: 'Informe a URL onde o painel admin está publicado (ex.: https://dizimosc.lovable.app).',
    });
  }
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      logger.info('[setup] test-cors OK', { url, latencyMs: Date.now() - t0 });
      return res.json({
        success: true,
        message: `Sistema acessível em ${url} (${Date.now() - t0}ms)`,
        latencyMs: Date.now() - t0,
      });
    }
    res.json({
      success: false,
      message: `HTTP ${r.status} em ${url}`,
      cause: 'O servidor respondeu mas com status de erro.',
      fix: 'Verifique se a URL está correta e se o sistema está publicado.',
    });
  } catch (err: any) {
    const explained = explainError(err, 'cors');
    logger.warn('[setup] test-cors FALHOU', { url, error: explained.raw });
    res.json({ success: false, ...explained });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/setup/check-token — Validação de formato
// ─────────────────────────────────────────────────────────────
router.post('/setup/check-token', (req: Request, res: Response) => {
  const token = String(req.body?.apiToken || '').trim();
  if (!token) {
    return res.json({
      success: false,
      message: 'Token vazio',
      cause: 'Nenhum token foi colado no campo.',
      fix: 'Acesse o painel admin → Diagnóstico → Tokens e gere um novo token.',
    });
  }
  if (token.length < 20) {
    return res.json({
      success: false,
      message: `Token muito curto (${token.length} caracteres)`,
      cause: 'Tokens válidos têm pelo menos 20 caracteres — você provavelmente copiou só parte.',
      fix: 'Selecione o token inteiro no painel admin (Ctrl+A no campo) antes de copiar.',
    });
  }
  if (/\s/.test(token)) {
    return res.json({
      success: false,
      message: 'Token contém espaços',
      cause: 'Espaços ou quebras de linha entraram junto na cópia.',
      fix: 'Limpe o campo e cole novamente, sem espaços antes/depois.',
    });
  }
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const looksHex  = /^[0-9a-f]{32,}$/i.test(token);
  const looksB64  = /^[A-Za-z0-9+/=_-]{20,}$/.test(token);
  if (looksUuid || looksHex || looksB64) {
    return res.json({ success: true, message: `Formato válido (${token.length} caracteres)` });
  }
  res.json({
    success: false,
    message: 'Formato de token inesperado',
    cause: 'O token deve ser um UUID, hexadecimal (32+ chars) ou base64.',
    fix: 'Confira se você copiou de /admin/diagnostico#tokens — outros campos do painel não funcionam aqui.',
  });
});
type ResultRow = { ok: boolean; message: string; cause?: string; fix?: string };



// ─────────────────────────────────────────────────────────────
// POST /api/setup/save — Grava o .env
// ─────────────────────────────────────────────────────────────
router.post('/setup/save', validateBody(setupSaveSchema), async (req: Request, res: Response) => {
  try {
    const c = req.body;

    const lines: string[] = [
      '# ═══════════════════════════════════════',
      '# DízimoSC Client Local — Configuração',
      '# Gerado pelo Assistente de Configuração',
      `# ${new Date().toLocaleString('pt-BR')}`,
      '# ═══════════════════════════════════════',
      '',
      '# Servidor',
      `PORT=${c.port || 3847}`,
      `CORS_ORIGIN=${c.corsOrigin || 'https://dizimosc.lovable.app'}`,
      `API_TOKEN=${c.apiToken || ''}`,
      '',
      '# Impressora Térmica',
      `PRINTER_TYPE=${c.printerType || 'usb'}`,
    ];

    if (c.printerType === 'usb') {
      lines.push(`PRINTER_VID=${c.printerVid || '0x04b8'}`);
      lines.push(`PRINTER_PID=${c.printerPid || '0x0202'}`);
    } else if (c.printerType === 'serial') {
      lines.push(`PRINTER_SERIAL_PORT=${c.printerSerialPort || 'COM3'}`);
      lines.push(`PRINTER_SERIAL_BAUD=${c.printerSerialBaud || '9600'}`);
    } else if (c.printerType === 'network') {
      lines.push(`PRINTER_NETWORK_IP=${c.printerNetworkIp || '192.168.1.100'}`);
      lines.push(`PRINTER_NETWORK_PORT=${c.printerNetworkPort || '9100'}`);
    }

    lines.push('');
    lines.push('# TEF / PINPad');
    lines.push(`TEF_ENABLED=${c.tefEnabled ? 'true' : 'false'}`);
    lines.push(`TEF_PROVIDER=${c.tefProvider || 'connect_tef'}`);
    lines.push(`TEF_MODE=${c.tefMode || 'sandbox'}`);
    lines.push(`TEF_MIDDLEWARE_URL=${c.tefMiddlewareUrl || 'http://localhost:8090'}`);
    lines.push(`TEF_SIPAG_URL=${c.tefSipagUrl || 'http://localhost:60906'}`);
    lines.push(`TEF_PAGARME_STONE_URL=${c.tefPagarmeStoneUrl || 'http://localhost:9000'}`);
    lines.push(`TEF_PAYGO_URL=${c.tefPaygoUrl || 'http://localhost:9999'}`);
    lines.push(`TEF_TERMINAL_ID=${c.tefTerminalId || 'DIZSC001'}`);
    lines.push(`TEF_TIMEOUT_SECONDS=${c.tefTimeout || '120'}`);

    lines.push('');
    lines.push('# Logs');
    lines.push(`LOG_LEVEL=${c.logLevel || 'info'}`);
    lines.push(`LOG_DIR=${c.logDir || './logs'}`);
    lines.push(`LOG_MAX_FILES=${c.logMaxFiles || '30'}`);

    const envPath = path.resolve(__dirname, '../../.env');
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');

    res.json({
      success: true,
      message: 'Configuração salva em .env! Reinicie o serviço para aplicar.',
      envPath,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/setup/test-all — Roda todos os testes
// ─────────────────────────────────────────────────────────────
router.post('/setup/test-all', async (req: Request, res: Response) => {
  const c = req.body || {};
  const results: Record<string, ResultRow> = {};

  // 1) Sistema remoto
  try {
    const url = (c.corsOrigin || 'https://dizimosc.lovable.app').replace(/\/$/, '');
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      results.remote = { ok: true, message: `Acessível (${url})` };
    } else {
      results.remote = {
        ok: false, message: `HTTP ${r.status} em ${url}`,
        cause: 'Servidor respondeu com status de erro.',
        fix: 'Confirme a URL no painel publicado e tente novamente.',
      };
    }
  } catch (err: any) {
    const ex = explainError(err, 'cors');
    results.remote = { ok: false, message: ex.message, cause: ex.cause, fix: ex.fix };
  }

  // 2) Token
  const token = String(c.apiToken || '').trim();
  if (!token) {
    results.token = { ok: false, message: 'Não informado', cause: 'Campo vazio.', fix: 'Cole o token gerado em /admin/diagnostico#tokens.' };
  } else if (token.length < 20) {
    results.token = { ok: false, message: `Muito curto (${token.length} chars)`, cause: 'Tokens válidos têm ≥ 20 caracteres.', fix: 'Selecione o token inteiro antes de copiar.' };
  } else if (/\s/.test(token)) {
    results.token = { ok: false, message: 'Token contém espaços', cause: 'Espaços/quebras de linha entraram na cópia.', fix: 'Cole novamente sem espaços nas pontas.' };
  } else {
    results.token = { ok: true, message: `Formato válido (${token.length} chars)` };
  }

  // 3) Impressora
  try {
    const r = await fetch(`http://localhost:${process.env.PORT || 3847}/api/setup/test-printer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: c.printerType || 'usb',
        vid: c.printerVid, pid: c.printerPid,
        serialPort: c.printerSerialPort, baud: c.printerSerialBaud,
        ip: c.printerNetworkIp, port: c.printerNetworkPort,
      }),
    });
    const d: any = await r.json();
    results.printer = { ok: !!d.success, message: d.message, cause: d.cause, fix: d.fix };
  } catch (err: any) {
    results.printer = { ok: false, message: err.message, cause: 'Falha interna ao chamar /api/setup/test-printer.' };
  }

  // 4) PINPad
  if (c.tefEnabled) {
    try {
      const r = await fetch(`http://localhost:${process.env.PORT || 3847}/api/setup/test-pinpad`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: c.tefProvider,
          url: c.tefMiddlewareUrl || c.tefSipagUrl || c.tefPagarmeStoneUrl || c.tefPaygoUrl,
        }),
      });
      const d: any = await r.json();
      results.pinpad = { ok: !!d.success, message: d.message, cause: d.cause, fix: d.fix };
    } catch (err: any) {
      results.pinpad = { ok: false, message: err.message, cause: 'Falha interna ao chamar /api/setup/test-pinpad.' };
    }
  } else {
    results.pinpad = { ok: true, message: 'TEF desabilitado (pulado)' };
  }

  logger.info('[setup] test-all executado', { results });
  res.json({ success: true, results });
});



// ─────────────────────────────────────────────────────────────
// GET /api/setup/logs — Retorna logs em memória do ring buffer
// Query: ?limit=200&level=info&search=texto&format=json|txt
// ─────────────────────────────────────────────────────────────
router.get('/setup/logs', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || 200), 10) || 200, 500);
  const level = req.query.level ? String(req.query.level) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;
  const format = String(req.query.format || 'json');

  const entries = getRecentLogs({ limit, level, search });

  if (format === 'txt') {
    const lines = entries.map((e) => {
      const meta = e.meta ? ` ${JSON.stringify(e.meta)}` : '';
      return `[${e.ts}] ${e.level.toUpperCase()}: ${e.message}${meta}`;
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dizimo-logs-${Date.now()}.txt"`);
    return res.send(lines.join('\n'));
  }

  res.json({ count: entries.length, entries });
});

export default router;
