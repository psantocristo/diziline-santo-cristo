import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getPrinterStatus } from '../services/printer-connection';
import { getPinpadStatus } from '../services/tef-client';

const router = Router();

/**
 * GET /config — Página HTML de status e configuração (somente leitura)
 */
router.get('/config', (_req: Request, res: Response) => {
  const printer = getPrinterStatus();
  const pinpad = getPinpadStatus();

  const badge = (ok: boolean) =>
    ok ? '<span class="badge ok">● Conectado</span>' : '<span class="badge off">● Desconectado</span>';

  const mask = (val?: string | null) => {
    if (!val) return '<em class="dim">não configurado</em>';
    if (val.length <= 6) return '••••••';
    return val.slice(0, 3) + '•'.repeat(val.length - 6) + val.slice(-3);
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DízimoSC Client — Configuração</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e4e4e7; padding: 2rem; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    .sub { color: #71717a; font-size: 0.85rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #1a1b23; border: 1px solid #27272a; border-radius: 12px; padding: 1.25rem; }
    .card h2 { font-size: 0.95rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
    .row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #27272a; font-size: 0.85rem; }
    .row:last-child { border: none; }
    .label { color: #a1a1aa; }
    .val { font-family: 'Cascadia Code', monospace; color: #e4e4e7; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; }
    .badge.ok { background: #064e3b; color: #34d399; }
    .badge.off { background: #450a0a; color: #f87171; }
    .dim { color: #52525b; }
    .warn { background: #451a03; border-color: #78350f; color: #fbbf24; font-size: 0.8rem; padding: 0.75rem 1rem; border-radius: 8px; margin-top: 1rem; }
    .footer { color: #52525b; font-size: 0.75rem; text-align: center; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>⚙️ DízimoSC Client Local</h1>
  <p class="sub">v2.0.0 — Configuração e status dos dispositivos — <strong>somente leitura</strong></p>

  <div class="grid">
    <div class="card">
      <h2>🖨️ Impressora Térmica ${badge(printer.connected)}</h2>
      <div class="row"><span class="label">Tipo de conexão</span><span class="val">${config.printer.type.toUpperCase()}</span></div>
      ${config.printer.type === 'usb' ? `
      <div class="row"><span class="label">Vendor ID</span><span class="val">0x${config.printer.usb.vid.toString(16).padStart(4, '0')}</span></div>
      <div class="row"><span class="label">Product ID</span><span class="val">0x${config.printer.usb.pid.toString(16).padStart(4, '0')}</span></div>
      ` : ''}
      ${config.printer.type === 'serial' ? `
      <div class="row"><span class="label">Porta Serial</span><span class="val">${config.printer.serial.port}</span></div>
      <div class="row"><span class="label">Baud Rate</span><span class="val">${config.printer.serial.baud}</span></div>
      ` : ''}
      ${config.printer.type === 'network' ? `
      <div class="row"><span class="label">IP</span><span class="val">${config.printer.network.ip}</span></div>
      <div class="row"><span class="label">Porta</span><span class="val">${config.printer.network.port}</span></div>
      ` : ''}
      <div class="row"><span class="label">Modelo</span><span class="val">${printer.model || '<em class="dim">auto-detectar</em>'}</span></div>
    </div>

    <div class="card">
      <h2>💳 PINPad / TEF ${badge(pinpad.connected)}</h2>
      <div class="row"><span class="label">TEF habilitado</span><span class="val">${config.tef.enabled ? 'Sim' : 'Não'}</span></div>
      <div class="row"><span class="label">Provedor</span><span class="val">${config.tef.provider}</span></div>
      <div class="row"><span class="label">Middleware URL</span><span class="val">${config.tef.middlewareUrl}</span></div>
      <div class="row"><span class="label">Terminal ID</span><span class="val">${config.tef.terminalId}</span></div>
      <div class="row"><span class="label">Timeout</span><span class="val">${config.tef.timeoutSeconds}s</span></div>
      ${pinpad.firmware ? `<div class="row"><span class="label">Firmware</span><span class="val">${pinpad.firmware}</span></div>` : ''}
      ${pinpad.serial ? `<div class="row"><span class="label">Serial</span><span class="val">${pinpad.serial}</span></div>` : ''}
      ${pinpad.lastTransaction ? `<div class="row"><span class="label">Última tx</span><span class="val">${pinpad.lastTransaction.status} — ${new Date(pinpad.lastTransaction.at).toLocaleTimeString('pt-BR')}</span></div>` : ''}
    </div>

    <div class="card">
      <h2>🖥️ Servidor</h2>
      <div class="row"><span class="label">Porta</span><span class="val">${config.port}</span></div>
      <div class="row"><span class="label">CORS Origin</span><span class="val">${config.security.corsOrigin}</span></div>
      <div class="row"><span class="label">Token API</span><span class="val">${mask(config.security.apiToken)}</span></div>
    </div>

    <div class="card">
      <h2>📋 Logs</h2>
      <div class="row"><span class="label">Nível</span><span class="val">${config.logging.level.toUpperCase()}</span></div>
      <div class="row"><span class="label">Diretório</span><span class="val">${config.logging.dir}</span></div>
      <div class="row"><span class="label">Retenção</span><span class="val">${config.logging.maxFiles} dias</span></div>
    </div>
  </div>

  <div class="warn">
    ⚠️ Esta página é somente leitura. Para alterar configurações, edite o arquivo <code>.env</code> e reinicie o serviço.
  </div>

  <p class="footer">DízimoSC Client Local v2.0.0 — Porta ${config.port}</p>

  <script>setTimeout(() => location.reload(), 15000);</script>
</body>
</html>`;

  res.type('html').send(html);
});

export default router;
