import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

router.get('/setup', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getSetupHTML(config));
});

function getSetupHTML(c: any): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DízimoSC — Assistente de Configuração</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0b1220;--card:#111a2e;--card-2:#0f172a;--border:#1f2a44;--border-2:#2b3a5e;
  --accent:#3b82f6;--accent-hover:#2563eb;--success:#22c55e;--error:#ef4444;--warn:#f59e0b;
  --text:#e2e8f0;--muted:#94a3b8;--input-bg:#0a1024;
}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(180deg,#0a1024 0%,#0b1220 100%);color:var(--text);min-height:100vh;padding:2rem 1rem}
.container{max-width:880px;margin:0 auto}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem}
h1{font-size:1.6rem;font-weight:700;display:flex;align-items:center;gap:.5rem}
.subtitle{color:var(--muted);margin-bottom:1.5rem;font-size:.9rem}
.stepbar{display:flex;gap:.5rem;margin-bottom:1.5rem;overflow-x:auto;padding-bottom:.25rem}
.step{flex:1;min-width:120px;padding:.6rem .75rem;background:var(--card-2);border:1px solid var(--border);border-radius:8px;font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:.4rem;cursor:pointer;transition:all .2s;white-space:nowrap}
.step.active{border-color:var(--accent);color:var(--text);background:rgba(59,130,246,.08)}
.step.ok{border-color:var(--success);color:#a7f3d0}
.step.fail{border-color:var(--error);color:#fecaca}
.step .dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
.section{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:1.5rem;margin-bottom:1.25rem;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.section-title{font-size:1.1rem;font-weight:600;margin-bottom:.25rem;display:flex;align-items:center;gap:.5rem}
.section-desc{color:var(--muted);font-size:.82rem;margin-bottom:1rem;line-height:1.45}
.field{margin-bottom:1rem}
.field:last-child{margin-bottom:0}
label{display:block;font-size:.82rem;font-weight:500;margin-bottom:.35rem;color:var(--muted)}
input,select{width:100%;padding:.6rem .75rem;background:var(--input-bg);border:1px solid var(--border-2);border-radius:8px;color:var(--text);font-size:.9rem;outline:none;transition:border-color .2s}
input:focus,select:focus{border-color:var(--accent)}
.row{display:flex;gap:.75rem;flex-wrap:wrap}
.row .field{flex:1;min-width:140px}
.toggle-row{display:flex;align-items:center;gap:.75rem;cursor:pointer;user-select:none}
.toggle{width:44px;height:24px;background:var(--border-2);border-radius:12px;position:relative;transition:background .2s;flex-shrink:0}
.toggle.active{background:var(--accent)}
.toggle::after{content:'';width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform .2s}
.toggle.active::after{transform:translateX(20px)}
.btn{padding:.55rem 1.15rem;border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:.4rem}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover:not(:disabled){background:var(--accent-hover)}
.btn-outline{background:transparent;border:1px solid var(--border-2);color:var(--text)}
.btn-outline:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.btn-success{background:var(--success);color:#fff}
.btn-sm{padding:.4rem .75rem;font-size:.78rem}
.btn-group{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}
.footer{position:sticky;bottom:0;padding:1rem;background:linear-gradient(180deg,transparent,#0a1024 30%);display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap;margin-top:1.5rem}
.status{font-size:.82rem;padding:.5rem .75rem;border-radius:8px;display:flex;align-items:flex-start;gap:.5rem;margin-top:.5rem;line-height:1.35}
.status.ok{background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.3)}
.status.fail{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
.status.loading{background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.3)}
.status.warn{background:rgba(245,158,11,.12);color:#fcd34d;border:1px solid rgba(245,158,11,.3)}
.status .ic{flex-shrink:0;font-size:1rem;line-height:1}
.hidden{display:none}
.toast{position:fixed;bottom:5.5rem;right:2rem;padding:1rem 1.5rem;border-radius:10px;font-size:.9rem;font-weight:500;z-index:999;animation:slide-in .3s ease;box-shadow:0 10px 25px rgba(0,0,0,.3);max-width:380px}
.toast.success{background:var(--success);color:#fff}
.toast.error{background:var(--error);color:#fff}
@keyframes slide-in{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.dynamic-fields{margin-top:.75rem}
.badge{font-size:.7rem;padding:.15rem .5rem;border-radius:4px;background:rgba(59,130,246,.2);color:#93c5fd;font-weight:600}
.help{font-size:.75rem;color:var(--muted);margin-top:.35rem;line-height:1.4}
.help a{color:var(--accent);text-decoration:none}
.help a:hover{text-decoration:underline}
.device-list{margin-top:.5rem;border:1px dashed var(--border-2);border-radius:8px;padding:.5rem;max-height:160px;overflow-y:auto}
.device-row{display:flex;justify-content:space-between;align-items:center;padding:.4rem .5rem;font-size:.8rem;border-radius:6px;cursor:pointer;transition:background .15s}
.device-row:hover{background:rgba(59,130,246,.08)}
.device-row .name{color:var(--text);font-weight:500}
.device-row .meta{color:var(--muted);font-family:'Consolas',monospace;font-size:.72rem}
.kbd{font-family:'Consolas',monospace;font-size:.78rem;background:var(--input-bg);padding:.1rem .35rem;border-radius:4px;border:1px solid var(--border-2)}
.diag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem;margin-top:.5rem}
.status .cause{display:block;margin-top:.4rem;color:#cbd5e1;font-size:.78rem;font-weight:400}
.status .fix{display:block;margin-top:.25rem;color:#fde68a;font-size:.78rem;font-weight:500}
.status .fix::before{content:'➜ ';color:var(--warn)}
.log-toolbar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:.5rem}
.log-toolbar input,.log-toolbar select{padding:.4rem .6rem;font-size:.8rem;height:auto}
.log-view{background:#020617;border:1px solid var(--border-2);border-radius:8px;padding:.6rem;max-height:380px;overflow:auto;font-family:'Consolas','Courier New',monospace;font-size:.74rem;line-height:1.45}
.log-line{padding:.15rem 0;white-space:pre-wrap;word-break:break-word;border-bottom:1px dashed rgba(148,163,184,.08)}
.log-line:last-child{border-bottom:0}
.log-line .lts{color:#64748b;margin-right:.5rem}
.log-line.lvl-info  .llv{color:#93c5fd}
.log-line.lvl-warn  .llv{color:#fcd34d}
.log-line.lvl-error .llv{color:#fca5a5}
.log-line.lvl-debug .llv{color:#94a3b8}
.log-line .llv{display:inline-block;min-width:48px;font-weight:700}
.log-empty{color:var(--muted);font-size:.8rem;padding:1rem;text-align:center}
.tabs{display:flex;gap:.25rem;border-bottom:1px solid var(--border);margin-bottom:.75rem}
.tab-btn{padding:.5rem .9rem;background:transparent;border:none;color:var(--muted);font-size:.85rem;cursor:pointer;border-bottom:2px solid transparent;font-weight:500}
.tab-btn.active{color:var(--text);border-bottom-color:var(--accent)}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>⚙️ Assistente DízimoSC</h1>
    <span class="badge">v2.2 • Diagnóstico avançado</span>
  </div>
  <p class="subtitle">Configure o Client Local em 4 passos. Cada seção tem testes individuais — valide tudo antes de salvar.</p>

  <!-- Step bar -->
  <div class="stepbar">
    <div class="step active" id="step1" onclick="scrollToSec('sec-server')"><span class="dot"></span>1. Servidor</div>
    <div class="step" id="step2" onclick="scrollToSec('sec-printer')"><span class="dot"></span>2. Impressora</div>
    <div class="step" id="step3" onclick="scrollToSec('sec-tef')"><span class="dot"></span>3. PINPad / TEF</div>
    <div class="step" id="step4" onclick="scrollToSec('sec-logs')"><span class="dot"></span>4. Logs & Diagnóstico</div>
  </div>



  <!-- ───────────────────────── 1. SERVIDOR ───────────────────────── -->
  <div class="section" id="sec-server">
    <div class="section-title">🖥️ 1. Servidor & Sistema</div>
    <p class="section-desc">A porta local onde este serviço escuta, a URL do sistema online e o Token de autenticação.</p>

    <div class="row">
      <div class="field" style="max-width:140px">
        <label>Porta local</label>
        <input id="port" type="number" value="${c.port}">
      </div>
      <div class="field">
        <label>URL do sistema (CORS Origin)</label>
        <input id="corsOrigin" value="${c.security.corsOrigin}">
        <div class="help">Ex.: <span class="kbd">https://dizimosc.acathosec.workers.dev</span></div>
      </div>
    </div>

    <div class="field">
      <label>Token API <span class="badge">Painel admin → Diagnóstico → Tokens</span></label>
      <div class="row" style="gap:.5rem">
        <input id="apiToken" type="password" value="${c.security.apiToken}" placeholder="Cole o token gerado no painel admin" style="flex:1">
        <button class="btn btn-outline btn-sm" type="button" onclick="toggleTokenVis()">👁️</button>
      </div>
    </div>

    <div class="btn-group">
      <button class="btn btn-outline btn-sm" type="button" onclick="testCors()">🌐 Testar acesso ao sistema</button>
      <button class="btn btn-outline btn-sm" type="button" onclick="checkToken()">🔑 Validar token</button>
    </div>
    <div id="serverStatus"></div>
  </div>

  <!-- ───────────────────────── 2. IMPRESSORA ───────────────────────── -->
  <div class="section" id="sec-printer">
    <div class="section-title">🖨️ 2. Impressora térmica</div>
    <p class="section-desc">Detecte automaticamente impressoras conectadas, escolha o modelo, e imprima um cupom de teste.</p>

    <div class="btn-group" style="margin-bottom:.75rem">
      <button class="btn btn-outline btn-sm" type="button" onclick="discoverDevices()">🔍 Detectar impressoras conectadas</button>
    </div>
    <div id="deviceList"></div>

    <div class="field" style="margin-top:1rem">
      <label>Tipo de conexão</label>
      <select id="printerType" onchange="updatePrinterFields()">
        <option value="usb" ${c.printer.type==='usb'?'selected':''}>USB (recomendado para Epson TM-T20)</option>
        <option value="serial" ${c.printer.type==='serial'?'selected':''}>Serial (COM)</option>
        <option value="network" ${c.printer.type==='network'?'selected':''}>Rede / Ethernet (IP)</option>
      </select>
    </div>
    <div id="printerFields" class="dynamic-fields"></div>

    <div class="btn-group">
      <button class="btn btn-primary btn-sm" type="button" onclick="testPrinter()">🖨️ Imprimir cupom de teste</button>
    </div>
    <div id="printerStatus"></div>
  </div>

  <!-- ───────────────────────── 3. TEF / PINPad ───────────────────────── -->
  <div class="section" id="sec-tef">
    <div class="section-title">💳 3. PINPad / TEF</div>
    <p class="section-desc">Configure o provedor da maquininha. Em modo <strong>sandbox</strong> nenhuma maquininha física é necessária.</p>

    <div class="field">
      <div class="toggle-row" onclick="toggleTef()">
        <div class="toggle ${c.tef.enabled?'active':''}" id="tefToggle"></div>
        <span>TEF habilitado (necessário para cobrar com cartão presencial)</span>
      </div>
    </div>

    <div id="tefFields" class="${c.tef.enabled?'':'hidden'}">
      <div class="row">
        <div class="field">
          <label>Provedor TEF</label>
          <select id="tefProvider" onchange="updateTefProviderFields()">
            <option value="connect_tef" ${c.tef.provider==='connect_tef'?'selected':''}>Connect TEF / SiTef (Rede)</option>
            <option value="sipag" ${c.tef.provider==='sipag'?'selected':''}>Sipag Integrado (Sicredi)</option>
            <option value="pagarme_stone" ${c.tef.provider==='pagarme_stone'?'selected':''}>Pagar.me Stone Connect</option>
            <option value="paygo" ${c.tef.provider==='paygo'?'selected':''}>PayGo PGWebLib</option>
          </select>
        </div>
        <div class="field">
          <label>Modo de operação</label>
          <select id="tefMode">
            <option value="sandbox"  ${c.tef.mode==='sandbox'?'selected':''}>Sandbox (sem hardware)</option>
            <option value="producao" ${c.tef.mode==='producao'?'selected':''}>Produção (maquininha real)</option>
            <option value="simulacao" ${c.tef.mode==='simulacao'?'selected':''}>Simulação (interno)</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label id="tefUrlLabel">URL do Middleware</label>
        <input id="tefMiddlewareUrl" value="${c.tef.middlewareUrl}">
        <div class="help">Endereço HTTP do daemon do provedor. Veja <span class="kbd">bridges/&lt;provedor&gt;-bridge</span>.</div>
        <input type="hidden" id="tefSipagUrl" value="${c.tef.sipagUrl}">
        <input type="hidden" id="tefPagarmeStoneUrl" value="${c.tef.pagarmeStoneUrl}">
        <input type="hidden" id="tefPaygoUrl" value="${c.tef.paygoUrl}">
      </div>

      <div class="row">
        <div class="field">
          <label>Terminal ID</label>
          <input id="tefTerminalId" value="${c.tef.terminalId}">
        </div>
        <div class="field" style="max-width:160px">
          <label>Timeout (segundos)</label>
          <input id="tefTimeout" type="number" value="${c.tef.timeoutSeconds}">
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-outline btn-sm" type="button" onclick="testTef()">📡 Pingar middleware</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="testPinpadStatus()">💳 Consultar PINPad (status)</button>
      </div>
      <div id="tefStatus"></div>
    </div>
  </div>

  <!-- ───────────────────────── 4. LOGS ───────────────────────── -->
  <div class="section" id="sec-logs">
    <div class="section-title">📋 4. Logs & Diagnóstico</div>
    <div class="tabs">
      <button class="tab-btn active" type="button" onclick="switchLogTab('cfg')" id="tab-cfg">⚙️ Configuração</button>
      <button class="tab-btn" type="button" onclick="switchLogTab('wiz')" id="tab-wiz">🧭 Eventos do Assistente</button>
      <button class="tab-btn" type="button" onclick="switchLogTab('srv')" id="tab-srv">🛰️ Logs do Serviço</button>
    </div>

    <div id="tab-pane-cfg">
      <p class="section-desc">Verbosidade e retenção dos arquivos em <span class="kbd">./logs/dizimo-client-AAAA-MM-DD.log</span>.</p>
      <div class="row">
        <div class="field">
          <label>Nível</label>
          <select id="logLevel">
            <option value="debug" ${c.logging.level==='debug'?'selected':''}>debug (verboso)</option>
            <option value="info"  ${c.logging.level==='info'?'selected':''}>info (padrão)</option>
            <option value="warn"  ${c.logging.level==='warn'?'selected':''}>warn</option>
            <option value="error" ${c.logging.level==='error'?'selected':''}>error</option>
          </select>
        </div>
        <div class="field">
          <label>Diretório</label>
          <input id="logDir" value="${c.logging.dir}">
        </div>
        <div class="field" style="max-width:160px">
          <label>Retenção (dias)</label>
          <input id="logMaxFiles" type="number" value="${c.logging.maxFiles}">
        </div>
      </div>
    </div>

    <div id="tab-pane-wiz" class="hidden">
      <p class="section-desc">Histórico de tudo que você fez neste assistente (testes, falhas, alterações), com timestamps em horário de Brasília.</p>
      <div class="log-toolbar">
        <input id="wizFilter" placeholder="Filtrar…" oninput="renderWizardLogs()" style="flex:1;min-width:160px">
        <button class="btn btn-outline btn-sm" type="button" onclick="copyWizardLogs()">📋 Copiar</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="downloadWizardLogs()">⬇️ Baixar .txt</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="clearWizardLogs()">🗑️ Limpar</button>
      </div>
      <div id="wizLogs" class="log-view"></div>
    </div>

    <div id="tab-pane-srv" class="hidden">
      <p class="section-desc">Últimas entradas do logger interno do serviço (impressora, PINPad, requests, erros nativos). Útil para diagnosticar falhas de comunicação.</p>
      <div class="log-toolbar">
        <select id="srvLevel" onchange="loadServerLogs()" style="max-width:130px">
          <option value="debug">Todos</option>
          <option value="info" selected>info+</option>
          <option value="warn">warn+</option>
          <option value="error">apenas erros</option>
        </select>
        <input id="srvSearch" placeholder="Buscar texto…" oninput="loadServerLogs()" style="flex:1;min-width:160px">
        <label class="toggle-row" style="font-size:.78rem;color:var(--muted)">
          <input type="checkbox" id="srvAuto" onchange="toggleAutoRefresh()" style="width:auto"> auto-refresh 5s
        </label>
        <button class="btn btn-outline btn-sm" type="button" onclick="loadServerLogs()">🔄 Recarregar</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="copyServerLogs()">📋 Copiar</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="downloadServerLogs()">⬇️ Baixar .txt</button>
      </div>
      <div id="srvLogs" class="log-view"><div class="log-empty">Clique em "Recarregar" para buscar logs.</div></div>
    </div>
  </div>


  <!-- ───────────────────────── DIAGNÓSTICO COMPLETO ───────────────────────── -->
  <div class="section">
    <div class="section-title">🩺 Diagnóstico completo</div>
    <p class="section-desc">Roda todos os testes em sequência (rede, token, impressora, PINPad). Use antes de salvar.</p>
    <button class="btn btn-outline" type="button" onclick="testAll()">🔍 Executar diagnóstico</button>
    <div id="testAllResults" class="diag-grid"></div>
  </div>

  <div class="footer">
    <button class="btn btn-outline" type="button" onclick="window.location.reload()">↻ Recarregar</button>
    <button class="btn btn-primary" type="button" onclick="saveConfig()">💾 Salvar configuração</button>
  </div>
</div>

<script>
// ── Estado inicial ─────────────────────────────────────────
const printerDefaults = ${JSON.stringify({
  usb: { vid: c.printer.usb.vid.toString(16).padStart(4,'0'), pid: c.printer.usb.pid.toString(16).padStart(4,'0') },
  serial: { port: c.printer.serial.port, baud: c.printer.serial.baud },
  network: { ip: c.printer.network.ip, port: c.printer.network.port },
})};
let tefEnabled = ${c.tef.enabled};
const tefUrlByProvider = {
  connect_tef:  ${JSON.stringify(c.tef.middlewareUrl)},
  sipag:        ${JSON.stringify(c.tef.sipagUrl)},
  pagarme_stone:${JSON.stringify(c.tef.pagarmeStoneUrl)},
  paygo:        ${JSON.stringify(c.tef.paygoUrl)},
};
const tefUrlLabel = {
  connect_tef:  'URL do Connect TEF',
  sipag:        'URL do Sipag Integrado',
  pagarme_stone:'URL do Stone Connect',
  paygo:        'URL do PGWebLib',
};

// ── Helpers UI ─────────────────────────────────────────────
function $(id){return document.getElementById(id)}
function v(id){return ($(id)||{}).value || ''}
function scrollToSec(id){const el=$(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}
function markStep(idx,kind){const el=$('step'+idx);if(!el)return;el.classList.remove('ok','fail');if(kind)el.classList.add(kind)}
function showStatus(containerId, ok, payload){
  // payload pode ser string ou {message, cause, fix, raw}
  const msg   = typeof payload === 'string' ? payload : (payload && payload.message) || '';
  const cause = typeof payload === 'object' && payload ? payload.cause : null;
  const fix   = typeof payload === 'object' && payload ? payload.fix   : null;
  let html = '<div class="status '+(ok?'ok':'fail')+'">';
  html += '<span class="ic">'+(ok?'✅':'❌')+'</span><div style="flex:1"><span>'+escape(msg)+'</span>';
  if(!ok && cause) html += '<span class="cause"><strong>Causa provável:</strong> '+escape(cause)+'</span>';
  if(!ok && fix)   html += '<span class="fix">'+escape(fix)+'</span>';
  html += '</div></div>';
  $(containerId).innerHTML = html;
  // Registra no histórico
  wizardLog(ok?'info':'error', msg + (cause?(' | causa: '+cause):'') + (fix?(' | corrigir: '+fix):''));
}
function showLoading(containerId, msg){
  $(containerId).innerHTML = '<div class="status loading"><span class="ic">⏳</span><span>'+(msg||'Testando...')+'</span></div>';
}
function escape(s){return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c])}
function showToast(ok, msg){
  const t = document.createElement('div');
  t.className = 'toast '+(ok?'success':'error');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 4500);
  wizardLog(ok?'info':'warn', msg);
}

// ── Tabs de Logs ────────────────────────────────────────────
function switchLogTab(which){
  ['cfg','wiz','srv'].forEach(k=>{
    $('tab-'+k).classList.toggle('active', k===which);
    $('tab-pane-'+k).classList.toggle('hidden', k!==which);
  });
  if(which==='wiz') renderWizardLogs();
  if(which==='srv') loadServerLogs();
}

// ── Histórico de eventos do wizard (lado cliente) ───────────
const wizardEvents = [];
function wizardLog(level, message){
  wizardEvents.push({ ts: new Date().toISOString(), level, message: String(message) });
  if(wizardEvents.length>500) wizardEvents.splice(0, wizardEvents.length-500);
  if($('tab-pane-wiz') && !$('tab-pane-wiz').classList.contains('hidden')) renderWizardLogs();
}
function fmtTs(iso){
  try{ return new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hour12:false}); }catch{ return iso; }
}
function renderWizardLogs(){
  const q = (v('wizFilter')||'').toLowerCase();
  const list = wizardEvents.filter(e => !q || e.message.toLowerCase().includes(q));
  const c = $('wizLogs'); if(!c) return;
  if(!list.length){ c.innerHTML = '<div class="log-empty">Nenhum evento ainda. Execute testes acima para gerar histórico.</div>'; return; }
  c.innerHTML = list.map(e =>
    '<div class="log-line lvl-'+escape(e.level)+'"><span class="lts">'+escape(fmtTs(e.ts))+'</span><span class="llv">'+escape(e.level.toUpperCase())+'</span> '+escape(e.message)+'</div>'
  ).join('');
  c.scrollTop = c.scrollHeight;
}
function wizardLogsAsText(){
  return wizardEvents.map(e => '['+fmtTs(e.ts)+'] '+e.level.toUpperCase()+': '+e.message).join('\\n');
}
async function copyWizardLogs(){
  try{ await navigator.clipboard.writeText(wizardLogsAsText()); showToast(true,'Histórico copiado para a área de transferência'); }
  catch{ showToast(false,'Falha ao copiar — selecione o texto manualmente'); }
}
function downloadWizardLogs(){
  const blob = new Blob([wizardLogsAsText()], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wizard-events-'+Date.now()+'.txt';
  a.click();
}
function clearWizardLogs(){ wizardEvents.length = 0; renderWizardLogs(); }

// ── Logs do serviço (via /api/setup/logs) ───────────────────
let srvAutoTimer = null;
async function loadServerLogs(){
  const c = $('srvLogs'); if(!c) return;
  const level  = v('srvLevel') || 'info';
  const search = v('srvSearch') || '';
  const qs = new URLSearchParams({ limit:'300', level, search }).toString();
  try{
    const r = await fetch('/api/setup/logs?'+qs);
    const d = await r.json();
    if(!d.entries || !d.entries.length){
      c.innerHTML = '<div class="log-empty">Sem logs ainda. Execute algum teste para gerar entradas.</div>';
      return;
    }
    c.innerHTML = d.entries.map(e =>
      '<div class="log-line lvl-'+escape(e.level)+'"><span class="lts">'+escape(fmtTs(e.ts))+'</span><span class="llv">'+escape(e.level.toUpperCase())+'</span> '+escape(e.message)+(e.meta?' '+escape(JSON.stringify(e.meta)):'')+'</div>'
    ).join('');
    c.scrollTop = c.scrollHeight;
  }catch(e){
    c.innerHTML = '<div class="log-empty" style="color:#fca5a5">Falha ao carregar logs: '+escape(e.message)+'</div>';
  }
}
function toggleAutoRefresh(){
  const on = $('srvAuto').checked;
  if(srvAutoTimer){ clearInterval(srvAutoTimer); srvAutoTimer=null; }
  if(on){ srvAutoTimer = setInterval(loadServerLogs, 5000); loadServerLogs(); }
}
async function copyServerLogs(){
  const text = $('srvLogs').innerText;
  try{ await navigator.clipboard.writeText(text); showToast(true,'Logs do serviço copiados'); }
  catch{ showToast(false,'Falha ao copiar'); }
}
function downloadServerLogs(){
  const level  = v('srvLevel') || 'info';
  const search = v('srvSearch') || '';
  const qs = new URLSearchParams({ limit:'500', level, search, format:'txt' }).toString();
  window.open('/api/setup/logs?'+qs,'_blank');
}



// ── Campos dinâmicos da impressora ─────────────────────────
function updatePrinterFields(){
  const type = v('printerType');
  const c = $('printerFields');
  if(type==='usb'){
    c.innerHTML = '<div class="row"><div class="field"><label>Vendor ID (hex)</label><input id="printerVid" value="0x'+printerDefaults.usb.vid+'" placeholder="0x04b8"></div><div class="field"><label>Product ID (hex)</label><input id="printerPid" value="0x'+printerDefaults.usb.pid+'" placeholder="0x0202"></div></div><div class="help">Para Epson TM-T20 use <span class="kbd">0x04b8 / 0x0202</span>. Use o botão "Detectar" para preencher automaticamente.</div>';
  } else if(type==='serial'){
    c.innerHTML = '<div class="row"><div class="field"><label>Porta COM</label><input id="printerSerialPort" value="'+printerDefaults.serial.port+'"></div><div class="field"><label>Baud Rate</label><input id="printerSerialBaud" type="number" value="'+printerDefaults.serial.baud+'"></div></div>';
  } else {
    c.innerHTML = '<div class="row"><div class="field"><label>IP da impressora</label><input id="printerNetworkIp" value="'+printerDefaults.network.ip+'"></div><div class="field"><label>Porta TCP</label><input id="printerNetworkPort" type="number" value="'+printerDefaults.network.port+'"></div></div>';
  }
}
updatePrinterFields();

function toggleTef(){
  tefEnabled = !tefEnabled;
  $('tefToggle').classList.toggle('active', tefEnabled);
  $('tefFields').classList.toggle('hidden', !tefEnabled);
}

function updateTefProviderFields(){
  const p = v('tefProvider');
  $('tefMiddlewareUrl').value = tefUrlByProvider[p] || '';
  $('tefUrlLabel').textContent = tefUrlLabel[p] || 'URL do Middleware';
}
updateTefProviderFields();

function toggleTokenVis(){
  const el = $('apiToken');
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ── Discovery de impressoras ───────────────────────────────
async function discoverDevices(){
  $('deviceList').innerHTML = '<div class="status loading"><span class="ic">⏳</span>Lendo dispositivos USB e portas COM…</div>';
  try{
    const r = await fetch('/api/setup/discover');
    const d = await r.json();
    let html = '';
    // USB
    const usbKnown = (d.usb||[]).filter(u=>u.family!=='desconhecida');
    html += '<div style="margin-bottom:.5rem;font-size:.8rem;color:var(--muted)">Impressoras térmicas detectadas via USB:</div>';
    if(usbKnown.length===0){
      html += '<div class="status warn"><span class="ic">⚠️</span>Nenhuma impressora térmica conhecida foi encontrada via USB.</div>';
    } else {
      html += '<div class="device-list">' + usbKnown.map(u =>
        '<div class="device-row" onclick="applyUsb(\\''+u.vid+'\\',\\''+u.pid+'\\')">' +
          '<div><div class="name">'+escape(u.name)+'</div><div class="meta">VID '+u.vid+' · PID '+u.pid+'</div></div>' +
          '<button class="btn btn-outline btn-sm" type="button">Usar</button>' +
        '</div>'
      ).join('') + '</div>';
    }
    // Serial
    if(d.serial && d.serial.length){
      html += '<div style="margin:.75rem 0 .5rem;font-size:.8rem;color:var(--muted)">Portas seriais (COM):</div>';
      html += '<div class="device-list">' + d.serial.map(s =>
        '<div class="device-row" onclick="applySerial(\\''+s.path+'\\')">' +
          '<div><div class="name">'+escape(s.path)+'</div><div class="meta">'+escape(s.manufacturer||'—')+'</div></div>' +
          '<button class="btn btn-outline btn-sm" type="button">Usar</button>' +
        '</div>'
      ).join('') + '</div>';
    }
    $('deviceList').innerHTML = html;
  }catch(e){
    $('deviceList').innerHTML = '<div class="status fail"><span class="ic">❌</span>Falha ao detectar: '+escape(e.message)+'</div>';
  }
}

function applyUsb(vid, pid){
  $('printerType').value = 'usb';
  updatePrinterFields();
  setTimeout(()=>{ $('printerVid').value = vid; $('printerPid').value = pid; }, 50);
  showToast(true, 'USB '+vid+'/'+pid+' aplicado. Clique em "Imprimir cupom de teste".');
}
function applySerial(p){
  $('printerType').value = 'serial';
  updatePrinterFields();
  setTimeout(()=>{ $('printerSerialPort').value = p; }, 50);
  showToast(true, 'Porta '+p+' aplicada.');
}

// ── Testes individuais ─────────────────────────────────────
async function testCors(){
  showLoading('serverStatus', 'Verificando acesso ao sistema…');
  try{
    const r = await fetch('/api/setup/test-cors', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({corsOrigin: v('corsOrigin')})});
    const d = await r.json();
    showStatus('serverStatus', d.success, d);
    markStep(1, d.success?'ok':'fail');
  }catch(e){ showStatus('serverStatus', false, {message:e.message,cause:'Falha de rede no fetch ao próprio serviço.',fix:'Verifique se o serviço client-local está rodando.'}); markStep(1,'fail'); }
}

async function checkToken(){
  showLoading('serverStatus', 'Validando token…');
  try{
    const r = await fetch('/api/setup/check-token', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({apiToken: v('apiToken')})});
    const d = await r.json();
    showStatus('serverStatus', d.success, d);
  }catch(e){ showStatus('serverStatus', false, {message:e.message}); }
}

async function testPrinter(){
  showLoading('printerStatus', 'Abrindo impressora e enviando cupom de teste…');
  const type = v('printerType');
  const payload = { type };
  if(type==='usb'){ payload.vid = v('printerVid'); payload.pid = v('printerPid'); }
  else if(type==='serial'){ payload.serialPort = v('printerSerialPort'); payload.baud = v('printerSerialBaud'); }
  else { payload.ip = v('printerNetworkIp'); payload.port = v('printerNetworkPort'); }
  try{
    const r = await fetch('/api/setup/test-printer', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const d = await r.json();
    showStatus('printerStatus', d.success, d);
    markStep(2, d.success?'ok':'fail');
  }catch(e){ showStatus('printerStatus', false, {message:e.message}); markStep(2,'fail'); }
}

async function testTef(){
  showLoading('tefStatus', 'Pingando middleware do provedor…');
  try{
    const r = await fetch('/api/setup/test-pinpad', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({provider: v('tefProvider'), url: v('tefMiddlewareUrl')})});
    const d = await r.json();
    showStatus('tefStatus', d.success, d);
    markStep(3, d.success?'ok':'fail');
  }catch(e){ showStatus('tefStatus', false, {message:e.message}); markStep(3,'fail'); }
}


async function testPinpadStatus(){
  showLoading('tefStatus', 'Consultando PINPad…');
  try{
    const r = await fetch('/api/health');
    const d = await r.json();
    const ok = d.devices?.pinpad?.connected;
    const detail = ok
      ? 'PINPad conectado · Modelo: '+(d.devices.pinpad.model||'—')+(d.devices.pinpad.firmware?' · FW '+d.devices.pinpad.firmware:'')
      : 'PINPad não responde — verifique cabo USB, fonte, e se o middleware está rodando.';
    showStatus('tefStatus', ok, detail);
  }catch(e){ showStatus('tefStatus', false, e.message); }
}

// ── Salvar / Diagnóstico ───────────────────────────────────
function getFormData(){
  return {
    port: v('port'), corsOrigin: v('corsOrigin'), apiToken: v('apiToken'),
    printerType: v('printerType'),
    printerVid: v('printerVid'), printerPid: v('printerPid'),
    printerSerialPort: v('printerSerialPort'), printerSerialBaud: v('printerSerialBaud'),
    printerNetworkIp: v('printerNetworkIp'), printerNetworkPort: v('printerNetworkPort'),
    tefEnabled,
    tefProvider: v('tefProvider'),
    tefMode: v('tefMode'),
    tefMiddlewareUrl: v('tefMiddlewareUrl'),
    tefSipagUrl: v('tefSipagUrl'),
    tefPagarmeStoneUrl: v('tefPagarmeStoneUrl'),
    tefPaygoUrl: v('tefPaygoUrl'),
    tefTerminalId: v('tefTerminalId'), tefTimeout: v('tefTimeout'),
    logLevel: v('logLevel'), logDir: v('logDir'), logMaxFiles: v('logMaxFiles'),
  };
}

async function saveConfig(){
  try{
    const r = await fetch('/api/setup/save', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(getFormData())});
    const d = await r.json();
    showToast(d.success, d.message);
  }catch{ showToast(false, 'Erro ao salvar'); }
}

async function testAll(){
  const c = $('testAllResults');
  c.innerHTML = '<div class="status loading" style="grid-column:1/-1"><span class="ic">⏳</span>Rodando bateria completa de testes…</div>';
  try{
    const r = await fetch('/api/setup/test-all', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(getFormData())});
    const d = await r.json();
    const labels = { remote:'🌐 Sistema online', token:'🔑 Token', printer:'🖨️ Impressora', pinpad:'💳 PINPad' };
    const stepMap = { remote:1, token:1, printer:2, pinpad:3 };
    c.innerHTML = '';
    for(const [k,val] of Object.entries(d.results)){
      const div = document.createElement('div');
      div.className = 'status '+(val.ok?'ok':'fail');
      let inner = '<span class="ic">'+(val.ok?'✅':'❌')+'</span><div style="flex:1"><strong>'+(labels[k]||k)+'</strong><br>'+escape(val.message||'');
      if(!val.ok && val.cause) inner += '<span class="cause"><strong>Causa:</strong> '+escape(val.cause)+'</span>';
      if(!val.ok && val.fix)   inner += '<span class="fix">'+escape(val.fix)+'</span>';
      inner += '</div>';
      div.innerHTML = inner;
      c.appendChild(div);
      if(stepMap[k]) markStep(stepMap[k], val.ok?'ok':'fail');
      wizardLog(val.ok?'info':'error', (labels[k]||k)+': '+(val.message||''));
    }
  }catch(e){ c.innerHTML = '<div class="status fail"><span class="ic">❌</span>Erro ao testar: '+escape(e.message)+'</div>'; }
}


// Auto-discover ao abrir
window.addEventListener('DOMContentLoaded', () => { discoverDevices(); });
</script>
</body>
</html>`;
}

export default router;
