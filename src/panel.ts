import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { searchDocs } from './docs-content';

function cfg() {
  return vscode.workspace.getConfiguration('lilka');
}

function scriptPath(name: string): string {
  return path.join(__dirname, '..', 'scripts', name);
}

function runPython(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = cfg().get<string>('pythonPath', 'python');
    cp.execFile(python, args, { shell: true }, (err, stdout, stderr) => {
      if (err) { reject(err); return; }
      resolve(stdout.trim());
    });
  });
}

async function queryAi(question: string, context: string): Promise<string> {
  const apiUrl   = cfg().get<string>('aiApiUrl', '');
  const apiKey   = cfg().get<string>('aiApiKey', '');
  const model    = cfg().get<string>('aiModel', 'llama3');

  if (!apiUrl) { return ''; }

  const systemPrompt =
    'Ти асистент для розробки на Lilka (ESP32-S3 KeiraOS Lua консоль). ' +
    'Відповідай українською, коротко і по справі. ' +
    'Ось документація:\n\n' + context;

  // Detect Ollama vs OpenAI-compatible
  const isOllama = apiUrl.includes(':11434');

  const body = isOllama
    ? JSON.stringify({ model, prompt: `${systemPrompt}\n\nПитання: ${question}`, stream: false })
    : JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      });

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
            const text = isOllama
              ? parsed.response
              : parsed.choices?.[0]?.message?.content;
            resolve(text || '');
          } catch { reject(new Error('Bad JSON from AI')); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export class LilkaPanel {
  private static instance: LilkaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static show(context: vscode.ExtensionContext): void {
    if (LilkaPanel.instance) {
      LilkaPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    LilkaPanel.instance = new LilkaPanel(context);
  }

  private constructor(context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      'lilkaPanel', 'Lilka',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.html = getHtml(this.panel.webview);
    this.sendCurrentSettings();

    this.panel.webview.onDidReceiveMessage(msg => this.handle(msg), undefined, context.subscriptions);
    this.panel.onDidDispose(() => { LilkaPanel.instance = undefined; }, undefined, context.subscriptions);
  }

  private sendCurrentSettings(): void {
    const c = cfg();
    this.panel.webview.postMessage({
      type: 'settings',
      port:     c.get<string>('serialPort', 'COM3'),
      baud:     c.get<number>('baudRate', 115200),
      tcpHost:  c.get<string>('tcpHost', '192.168.50.168'),
      tcpPort:  c.get<number>('tcpPort', 9988),
      aiApiUrl: c.get<string>('aiApiUrl', ''),
      aiModel:  c.get<string>('aiModel', 'llama3'),
    });
  }

  private async handle(msg: { type: string; [k: string]: unknown }): Promise<void> {
    switch (msg.type) {

      case 'listPorts': {
        try {
          const raw = await runPython([scriptPath('list_ports.py')]);
          const ports: { port: string; desc: string }[] = JSON.parse(raw || '[]');
          this.panel.webview.postMessage({ type: 'ports', ports });
        } catch {
          this.panel.webview.postMessage({ type: 'ports', ports: [] });
        }
        break;
      }

      case 'saveSettings': {
        const s = msg as unknown as { port: string; baud: number; tcpHost: string; tcpPort: number; aiApiUrl: string; aiModel: string };
        const c = vscode.workspace.getConfiguration('lilka');
        await c.update('serialPort', s.port,    true);
        await c.update('baudRate',   s.baud,    true);
        await c.update('tcpHost',    s.tcpHost, true);
        await c.update('tcpPort',    s.tcpPort, true);
        await c.update('aiApiUrl',   s.aiApiUrl,true);
        await c.update('aiModel',    s.aiModel, true);
        this.panel.webview.postMessage({ type: 'saved' });
        break;
      }

      case 'chat': {
        const question = String(msg.text ?? '');
        const sections = searchDocs(question);
        const docContext = sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n---\n\n');

        if (!sections.length) {
          this.panel.webview.postMessage({ type: 'chatReply', text: 'Нічого не знайдено в документації. Спробуй інше питання.' });
          return;
        }

        // Try AI first if configured
        const apiUrl = cfg().get<string>('aiApiUrl', '');
        if (apiUrl) {
          try {
            const aiReply = await queryAi(question, docContext);
            if (aiReply) {
              this.panel.webview.postMessage({ type: 'chatReply', text: aiReply });
              return;
            }
          } catch {
            // fall through to docs search reply
          }
        }

        // Docs search reply
        const reply = sections.map(s => `**${s.title}**\n\n${s.body}`).join('\n\n---\n\n');
        this.panel.webview.postMessage({ type: 'chatReply', text: reply });
        break;
      }
    }
  }
}

function getHtml(webview: vscode.Webview): string {
  return /* html */`<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
    gap: 0;
  }

  /* ── Connection panel ─────────────────────────────── */
  #conn {
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 10px 12px;
  }
  #conn h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
  }
  .row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
  label { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
  select, input[type=text], input[type=number] {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 2px;
    padding: 3px 6px;
    font-size: 12px;
    font-family: var(--vscode-font-family);
  }
  select { cursor: pointer; }
  input[type=number] { width: 70px; }
  .btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .btn.sec {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .btn.sec:hover { background: var(--vscode-button-secondaryHoverBackground); }
  #save-msg { font-size: 11px; color: var(--vscode-charts-green); display: none; }

  /* ── Chat ─────────────────────────────────────────── */
  #chat { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  #chat h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--vscode-descriptionForeground);
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .msg {
    max-width: 100%;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    background: var(--vscode-inputOption-activeBackground);
    align-self: flex-end;
    color: var(--vscode-foreground);
  }
  .msg.bot {
    background: var(--vscode-editor-inactiveSelectionBackground);
    align-self: flex-start;
  }
  .msg.bot code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textCodeBlock-background);
    padding: 0 3px;
    border-radius: 2px;
    font-size: 11px;
  }
  .msg.bot pre {
    background: var(--vscode-textCodeBlock-background);
    border-radius: 3px;
    padding: 8px;
    overflow-x: auto;
    margin: 6px 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .msg.thinking { color: var(--vscode-descriptionForeground); font-style: italic; }

  #input-row {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
  }
  #q {
    flex: 1;
    padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 2px;
    font-size: 12px;
    font-family: var(--vscode-font-family);
  }
  #q::placeholder { color: var(--vscode-input-placeholderForeground); }
</style>
</head>
<body>

<!-- Connection panel -->
<div id="conn">
  <h2>🔌 З'єднання</h2>
  <div class="row">
    <label>COM порт</label>
    <select id="port-sel"></select>
    <button class="btn sec" onclick="listPorts()">↻</button>
    <label>Baud</label>
    <input type="number" id="baud" value="115200">
  </div>
  <div class="row">
    <label>TCP host</label>
    <input type="text" id="tcp-host" style="width:140px">
    <label>Port</label>
    <input type="number" id="tcp-port" style="width:60px">
  </div>
  <div class="row">
    <label>AI URL</label>
    <input type="text" id="ai-url" style="width:180px" placeholder="http://localhost:11434 (Ollama)">
    <label>Model</label>
    <input type="text" id="ai-model" style="width:80px">
  </div>
  <div class="row">
    <button class="btn" onclick="saveSettings()">Зберегти</button>
    <span id="save-msg">✓ Збережено</span>
  </div>
</div>

<!-- Chat -->
<div id="chat">
  <h2>💬 Docs / AI асистент</h2>
  <div id="messages">
    <div class="msg bot">Привіт! Питай про Lilka API — знайду в документації.<br>Якщо налаштований Ollama (AI URL), відповість модель.</div>
  </div>
  <div id="input-row">
    <input id="q" type="text" placeholder="Як малювати текст? / display.colors.white / gpio adc…" onkeydown="if(event.key==='Enter')send()">
    <button class="btn" onclick="send()">▶</button>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();

// ── Settings ──────────────────────────────────────────
window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type === 'settings') {
    document.getElementById('baud').value    = msg.baud;
    document.getElementById('tcp-host').value = msg.tcpHost;
    document.getElementById('tcp-port').value = msg.tcpPort;
    document.getElementById('ai-url').value   = msg.aiApiUrl;
    document.getElementById('ai-model').value = msg.aiModel;
    setPort(msg.port);
  }
  if (msg.type === 'ports') {
    const sel = document.getElementById('port-sel');
    const cur = sel.value;
    sel.innerHTML = msg.ports.length
      ? msg.ports.map(p => \`<option value="\${p.port}">\${p.port} — \${p.desc}</option>\`).join('')
      : '<option value="">— немає портів —</option>';
    if (cur) setPort(cur);
  }
  if (msg.type === 'saved') {
    const el = document.getElementById('save-msg');
    el.style.display = 'inline';
    setTimeout(() => { el.style.display = 'none'; }, 2000);
  }
  if (msg.type === 'chatReply') {
    removeThinking();
    appendMsg('bot', msg.text);
  }
});

function setPort(p) {
  const sel = document.getElementById('port-sel');
  for (const opt of sel.options) { if (opt.value === p) { opt.selected = true; return; } }
  const opt = new Option(p, p, true, true);
  sel.insertBefore(opt, sel.firstChild);
  sel.value = p;
}

function listPorts() { vscode.postMessage({ type: 'listPorts' }); }

function saveSettings() {
  vscode.postMessage({
    type:    'saveSettings',
    port:    document.getElementById('port-sel').value,
    baud:    Number(document.getElementById('baud').value),
    tcpHost: document.getElementById('tcp-host').value.trim(),
    tcpPort: Number(document.getElementById('tcp-port').value),
    aiApiUrl: document.getElementById('ai-url').value.trim(),
    aiModel:  document.getElementById('ai-model').value.trim(),
  });
}

// ── Chat ─────────────────────────────────────────────
function appendMsg(role, text) {
  const msgs = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = role === 'bot' ? formatMd(text) : escHtml(text);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeThinking() {
  document.querySelector('.msg.thinking')?.remove();
}

function send() {
  const inp = document.getElementById('q');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  appendMsg('user', text);
  const th = document.createElement('div');
  th.className = 'msg thinking';
  th.textContent = 'шукаю…';
  document.getElementById('messages').appendChild(th);
  vscode.postMessage({ type: 'chat', text });
}

function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatMd(text) {
  // code blocks
  text = text.replace(/\`\`\`[\\w]*\\n?([\\s\\S]*?)\`\`\`/g, (_,c) => \`<pre>\${escHtml(c.trim())}</pre>\`);
  // inline code
  text = text.replace(/\`([^\`]+)\`/g, (_,c) => \`<code>\${escHtml(c)}</code>\`);
  // bold
  text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  // separator
  text = text.replace(/^---$/gm, '<hr style="border-color:var(--vscode-panel-border);margin:8px 0">');
  // line breaks
  text = text.replace(/\\n/g, '<br>');
  return text;
}

// Init: load ports on open
listPorts();
</script>
</body>
</html>`;
}
