import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { searchDocs } from './docs-content';

function cfg() { return vscode.workspace.getConfiguration('lilka'); }

function scriptPath(name: string): string {
  return path.join(__dirname, '..', 'scripts', name);
}

function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = cfg().get<string>('pythonPath', 'python');
    cp.execFile(python, args, { shell: true }, (err, stdout) => {
      if (err) { reject(err); return; }
      resolve(stdout.trim());
    });
  });
}

async function queryAi(question: string, context: string): Promise<string> {
  const apiUrl = cfg().get<string>('aiApiUrl', '');
  const apiKey = cfg().get<string>('aiApiKey', '');
  const model  = cfg().get<string>('aiModel', 'llama3');
  if (!apiUrl) { return ''; }

  const systemPrompt =
    'Ти асистент для розробки на Lilka (ESP32-S3 KeiraOS Lua консоль). ' +
    'Відповідай українською, коротко і по справі. Документація:\n\n' + context;

  const isOllama = apiUrl.includes(':11434');
  const body = isOllama
    ? JSON.stringify({ model, prompt: `${systemPrompt}\n\nПитання: ${question}`, stream: false })
    : JSON.stringify({ model, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question },
      ]});

  const url = new URL(isOllama ? `${apiUrl}/api/generate` : `${apiUrl}/chat/completions`);
  const lib  = url.protocol === 'https:' ? https : http;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers },
      res => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(isOllama ? parsed.response : parsed.choices?.[0]?.message?.content ?? '');
          } catch { reject(new Error('Bad JSON from AI')); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export type PostFn = (msg: unknown) => Thenable<boolean>;

export async function handleWebviewMessage(
  msg: { type: string; [k: string]: unknown },
  post: PostFn,
): Promise<void> {
  switch (msg.type) {

    case 'listPorts': {
      try {
        const raw   = await runPython([scriptPath('list_ports.py')]);
        const ports = JSON.parse(raw || '[]') as { port: string; desc: string }[];
        post({ type: 'ports', ports });
      } catch { post({ type: 'ports', ports: [] }); }
      break;
    }

    case 'saveSettings': {
      const s = msg as unknown as {
        port: string; baud: number; tcpHost: string; tcpPort: number;
        aiApiUrl: string; aiModel: string;
      };
      const c = vscode.workspace.getConfiguration('lilka');
      await c.update('serialPort', s.port,     true);
      await c.update('baudRate',   s.baud,     true);
      await c.update('tcpHost',    s.tcpHost,  true);
      await c.update('tcpPort',    s.tcpPort,  true);
      await c.update('aiApiUrl',   s.aiApiUrl, true);
      await c.update('aiModel',    s.aiModel,  true);
      post({ type: 'saved' });
      break;
    }

    case 'chat': {
      const question = String(msg.text ?? '');
      const sections = searchDocs(question);
      const docCtx   = sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n---\n\n');

      if (!sections.length) {
        post({ type: 'chatReply', text: 'Нічого не знайдено. Спробуй інше питання.' });
        return;
      }
      const apiUrl = cfg().get<string>('aiApiUrl', '');
      if (apiUrl) {
        try {
          const reply = await queryAi(question, docCtx);
          if (reply) { post({ type: 'chatReply', text: reply }); return; }
        } catch { /* fall through */ }
      }
      post({ type: 'chatReply', text: sections.map(s => `**${s.title}**\n\n${s.body}`).join('\n\n---\n\n') });
      break;
    }

    case 'getFile': {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.lua')) {
        post({ type: 'emuError', message: 'Відкрий .lua файл в редакторі' });
      } else {
        post({ type: 'runFile', code: editor.document.getText() });
      }
      break;
    }
  }
}

export function currentSettings() {
  const c = cfg();
  return {
    type:     'settings',
    port:     c.get<string>('serialPort', 'COM3'),
    baud:     c.get<number>('baudRate', 115200),
    tcpHost:  c.get<string>('tcpHost', '192.168.50.168'),
    tcpPort:  c.get<number>('tcpPort', 9988),
    aiApiUrl: c.get<string>('aiApiUrl', ''),
    aiModel:  c.get<string>('aiModel', 'llama3'),
  };
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const cspSrc    = webview.cspSource;
  const fengariUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'fengari-web.js'));
  const emuUri     = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'emulator.js'));

  return /* html */`<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline' ${cspSrc}; style-src 'unsafe-inline';">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:var(--vscode-font-family);
  font-size:var(--vscode-font-size);
  color:var(--vscode-foreground);
  background:var(--vscode-editor-background);
  display:flex;flex-direction:column;height:100vh;
}
/* ── Tabs ── */
.tabs{
  display:flex;border-bottom:1px solid var(--vscode-panel-border);
  background:var(--vscode-sideBar-background);flex-shrink:0;
}
.tab-btn{
  flex:1;padding:5px 2px;font-size:10px;font-family:inherit;
  background:none;border:none;color:var(--vscode-descriptionForeground);
  cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;
}
.tab-btn.active{color:var(--vscode-foreground);border-bottom-color:var(--vscode-focusBorder)}
.tab-btn:hover{color:var(--vscode-foreground)}
.tab-content{display:none;flex:1;overflow:hidden;flex-direction:column}
.tab-content.active{display:flex}
/* ── Connection tab ── */
#tab-conn{flex-direction:column;overflow-y:auto;padding:8px 10px;gap:6px}
.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
label{font-size:11px;color:var(--vscode-descriptionForeground);white-space:nowrap;min-width:52px}
select,input{
  background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);
  border:1px solid var(--vscode-input-border,#555);
  border-radius:2px;padding:2px 5px;font-size:11px;
  font-family:var(--vscode-font-family);
}
input[type=number]{width:64px}
input.wide{flex:1;min-width:80px}
.btn{
  background:var(--vscode-button-background);
  color:var(--vscode-button-foreground);
  border:none;border-radius:2px;padding:3px 8px;
  font-size:11px;cursor:pointer;white-space:nowrap;
}
.btn:hover{background:var(--vscode-button-hoverBackground)}
.btn.sec{
  background:var(--vscode-button-secondaryBackground);
  color:var(--vscode-button-secondaryForeground);
}
.btn.sec:hover{background:var(--vscode-button-secondaryHoverBackground)}
#save-msg{font-size:10px;color:var(--vscode-charts-green);display:none}
/* ── Docs tab ── */
#tab-docs{flex-direction:column}
#messages{
  flex:1;overflow-y:auto;padding:8px 10px;
  display:flex;flex-direction:column;gap:8px;
}
.msg{
  padding:6px 8px;border-radius:3px;font-size:11px;
  line-height:1.55;word-break:break-word;
}
.msg.user{
  background:var(--vscode-inputOption-activeBackground);
  align-self:flex-end;max-width:90%;
}
.msg.bot{
  background:var(--vscode-editor-inactiveSelectionBackground);
  align-self:flex-start;max-width:100%;
}
.msg.thinking{color:var(--vscode-descriptionForeground);font-style:italic}
.msg.bot code{
  font-family:var(--vscode-editor-font-family,monospace);
  background:var(--vscode-textCodeBlock-background);
  padding:0 3px;border-radius:2px;font-size:10px;
}
.msg.bot pre{
  background:var(--vscode-textCodeBlock-background);
  border-radius:3px;padding:6px;overflow-x:auto;
  margin:4px 0;font-family:var(--vscode-editor-font-family,monospace);font-size:10px;
  white-space:pre;
}
#input-row{
  display:flex;gap:5px;padding:6px 10px;
  border-top:1px solid var(--vscode-panel-border);flex-shrink:0;
}
#q{
  flex:1;padding:4px 7px;
  background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);
  border:1px solid var(--vscode-input-border,#555);
  border-radius:2px;font-size:11px;font-family:var(--vscode-font-family);
}
#q::placeholder{color:var(--vscode-input-placeholderForeground)}
/* ── Emulator tab ── */
#tab-emu{flex-direction:column;overflow-y:auto;align-items:center;padding:4px 0}
#screen{
  display:block;border:1px solid var(--vscode-panel-border);
  image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer;
  max-width:100%;outline:none;
}
.emu-controls{display:flex;gap:8px;padding:4px 8px;align-items:center;flex-wrap:wrap;justify-content:center}
.dpad{display:grid;grid-template-rows:auto auto}
.dpad-row{display:flex;justify-content:center}
.emu-btn{
  width:28px;height:28px;
  background:var(--vscode-button-secondaryBackground);
  color:var(--vscode-button-secondaryForeground);
  border:1px solid var(--vscode-panel-border);border-radius:3px;
  font-size:11px;cursor:pointer;user-select:none;touch-action:none;
  display:flex;align-items:center;justify-content:center;padding:0;
}
.emu-btn:active,.emu-btn.held{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.abcd-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.sys-btns{display:flex;gap:4px}
.sys-btns .emu-btn{width:40px}
.emu-toolbar{display:flex;gap:5px;padding:4px 8px;flex-wrap:wrap;justify-content:center}
#emu-log{
  width:100%;max-height:120px;overflow-y:auto;
  font-family:var(--vscode-editor-font-family,monospace);font-size:10px;
  background:var(--vscode-editor-background);
  border-top:1px solid var(--vscode-panel-border);
  padding:4px 8px;color:var(--vscode-descriptionForeground);
}
#emu-log div{line-height:1.4}
.hint{font-size:10px;color:var(--vscode-descriptionForeground);text-align:center;padding:2px 0}
</style>
</head>
<body>

<div class="tabs">
  <button class="tab-btn active" data-tab="conn" onclick="switchTab(this)">З'єднання</button>
  <button class="tab-btn"        data-tab="docs" onclick="switchTab(this)">Docs</button>
  <button class="tab-btn"        data-tab="emu"  onclick="switchTab(this)">Емулятор</button>
</div>

<!-- ══ Connection ═════════════════════════════════════════════════════════ -->
<div id="tab-conn" class="tab-content active">
  <div class="row">
    <label>Порт</label>
    <select id="port-sel" style="flex:1"></select>
    <button class="btn sec" onclick="listPorts()" title="Оновити список портів">↻</button>
  </div>
  <div class="row">
    <label>Baud</label>
    <input type="number" id="baud" value="115200">
  </div>
  <div class="row">
    <label>TCP host</label>
    <input type="text" id="tcp-host" class="wide">
    <input type="number" id="tcp-port" value="9988">
  </div>
  <div class="row">
    <label>AI URL</label>
    <input type="text" id="ai-url" class="wide" placeholder="http://localhost:11434">
  </div>
  <div class="row">
    <label>Model</label>
    <input type="text" id="ai-model" class="wide" placeholder="llama3">
  </div>
  <div class="row" style="margin-top:2px">
    <button class="btn" onclick="saveSettings()">Зберегти</button>
    <span id="save-msg">&#10003;</span>
  </div>
</div>

<!-- ══ Docs / AI ═══════════════════════════════════════════════════════════ -->
<div id="tab-docs" class="tab-content">
  <div id="messages">
    <div class="msg bot">Привіт! Питай про Lilka API.<br>
    Приклади: <em>draw_line колір</em>, <em>colors.white</em>, <em>adc gpio</em>, <em>tcp сервер</em></div>
  </div>
  <div id="input-row">
    <input id="q" type="text" placeholder="display.color565 / buzzer / tcp…"
      onkeydown="if(event.key==='Enter')send()">
    <button class="btn" onclick="send()">&#9654;</button>
  </div>
</div>

<!-- ══ Emulator ════════════════════════════════════════════════════════════ -->
<div id="tab-emu" class="tab-content">
  <canvas id="screen" width="240" height="280" tabindex="0"></canvas>
  <p class="hint">Натисни канвас щоб ввімкнути клавіатуру (WASD/стрілки, Z=A X=B C D, Enter=Start)</p>
  <div class="emu-controls">
    <div class="dpad">
      <div class="dpad-row"><button class="emu-btn" data-btn="up">&#9650;</button></div>
      <div class="dpad-row" style="gap:2px">
        <button class="emu-btn" data-btn="left">&#9668;</button>
        <button class="emu-btn" data-btn="down">&#9660;</button>
        <button class="emu-btn" data-btn="right">&#9658;</button>
      </div>
    </div>
    <div class="abcd-grid">
      <button class="emu-btn" data-btn="a">A</button>
      <button class="emu-btn" data-btn="b">B</button>
      <button class="emu-btn" data-btn="c">C</button>
      <button class="emu-btn" data-btn="d">D</button>
    </div>
  </div>
  <div class="sys-btns">
    <button class="emu-btn" data-btn="select">SEL</button>
    <button class="emu-btn" data-btn="start">STA</button>
  </div>
  <div class="emu-toolbar">
    <button class="btn" onclick="runEmu()">&#9654; Run</button>
    <button class="btn sec" onclick="stopEmu()">&#9632; Stop</button>
    <button class="btn sec" onclick="clearLog()">&#10005; Log</button>
  </div>
  <div id="emu-log"></div>
</div>

<script src="${fengariUri}"></script>
<script src="${emuUri}"></script>
<script>
const vscode = acquireVsCodeApi();

function switchTab(btn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  btn.classList.add('active');
  var id = 'tab-' + btn.dataset.tab;
  document.getElementById(id).classList.add('active');
}

/* ── connection ─────────────────────────────────────────────────── */
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'settings') {
    document.getElementById('baud').value     = msg.baud;
    document.getElementById('tcp-host').value = msg.tcpHost;
    document.getElementById('tcp-port').value = msg.tcpPort;
    document.getElementById('ai-url').value   = msg.aiApiUrl;
    document.getElementById('ai-model').value = msg.aiModel;
    setPort(msg.port);
  }
  if (msg.type === 'ports') {
    var sel = document.getElementById('port-sel');
    var cur = sel.value;
    sel.innerHTML = msg.ports.length
      ? msg.ports.map(function(p) { return '<option value="'+p.port+'">'+p.port+' - '+p.desc+'</option>'; }).join('')
      : '<option value="">- немає -</option>';
    if (cur) setPort(cur);
  }
  if (msg.type === 'saved') {
    var el = document.getElementById('save-msg');
    el.style.display = 'inline';
    setTimeout(function() { el.style.display = 'none'; }, 2000);
  }
  if (msg.type === 'chatReply') {
    document.querySelector('.msg.thinking') && document.querySelector('.msg.thinking').remove();
    appendMsg('bot', msg.text);
  }
  /* emulator messages (runFile / emuError) handled by emulator.js */
});

function setPort(p) {
  var sel = document.getElementById('port-sel');
  for (var i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === p) { sel.selectedIndex = i; return; }
  }
  var o = new Option(p, p, true, true);
  sel.insertBefore(o, sel.firstChild);
  sel.value = p;
}

function listPorts() { vscode.postMessage({ type: 'listPorts' }); }

function saveSettings() {
  vscode.postMessage({
    type:    'saveSettings',
    port:    document.getElementById('port-sel').value,
    baud:    +document.getElementById('baud').value,
    tcpHost: document.getElementById('tcp-host').value.trim(),
    tcpPort: +document.getElementById('tcp-port').value,
    aiApiUrl: document.getElementById('ai-url').value.trim(),
    aiModel:  document.getElementById('ai-model').value.trim(),
  });
}

/* ── docs chat ────────────────────────────────────────────────────── */
function appendMsg(role, text) {
  var msgs = document.getElementById('messages');
  var div  = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = role === 'bot' ? fmt(text) : esc(text);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function send() {
  var inp  = document.getElementById('q');
  var text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  appendMsg('user', text);
  var th = document.createElement('div');
  th.className = 'msg thinking'; th.textContent = 'шукаю...';
  document.getElementById('messages').appendChild(th);
  document.getElementById('messages').scrollTop = 99999;
  vscode.postMessage({ type: 'chat', text: text });
}

function esc(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmt(text) {
  text = text.replace(/\`\`\`[\w]*\n?/g,'<pre>').replace(/\`\`\`/g,'</pre>');
  text = text.replace(/\`([^\`]+)\`/g, function(_,c){return '<code>'+esc(c)+'</code>';});
  text = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  text = text.replace(/^---$/gm,'<hr style="border-color:var(--vscode-panel-border);margin:6px 0">');
  text = text.replace(/\n/g,'<br>');
  return text;
}

/* ── emulator controls ─────────────────────────────────────────────── */
function runEmu()  { vscode.postMessage({ type: 'getFile' }); }
function stopEmu() { if (window.EMU) EMU.stop(); }
function clearLog(){ var l = document.getElementById('emu-log'); if (l) l.innerHTML = ''; }

listPorts();
</script>
</body>
</html>`;
}
