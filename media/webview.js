/* Lilka webview UI — connection, docs chat, emulator glue */
(function() {
'use strict';

var vscode = acquireVsCodeApi();

// ── tabs ──────────────────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.toggle('active', c.id === 'tab-' + tabName);
  });
}

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
});

// ── connection panel ───────────────────────────────────────────────────────
function listPorts() { vscode.postMessage({ type: 'listPorts' }); }

function setPort(p) {
  var sel = document.getElementById('port-sel');
  for (var i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === p) { sel.selectedIndex = i; return; }
  }
  var o = new Option(p, p, true, true);
  sel.insertBefore(o, sel.firstChild);
  sel.value = p;
}

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

document.getElementById('btn-refresh-ports').addEventListener('click', listPorts);
document.getElementById('btn-save').addEventListener('click', saveSettings);

// ── docs / ai chat ─────────────────────────────────────────────────────────
function esc(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmt(text) {
  // triple backtick blocks → <pre>
  text = text.replace(/```[\s\S]*?```/g, function(m) {
    var code = m.replace(/^```\w*\n?/, '').replace(/```$/, '');
    return '<pre>' + esc(code.trim()) + '</pre>';
  });
  // single backtick → <code>
  text = text.replace(/`([^`]+)`/g, function(_, c) { return '<code>' + esc(c) + '</code>'; });
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/^---$/gm, '<hr>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

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
  th.className = 'msg thinking';
  th.textContent = 'шукаю...';
  document.getElementById('messages').appendChild(th);
  document.getElementById('messages').scrollTop = 99999;
  vscode.postMessage({ type: 'chat', text: text });
}

document.getElementById('btn-send').addEventListener('click', send);
document.getElementById('q').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') send();
});

// ── emulator ────────────────────────────────────────────────────────────────
document.getElementById('btn-run').addEventListener('click', function() {
  vscode.postMessage({ type: 'getFile' });
});
document.getElementById('btn-stop').addEventListener('click', function() {
  if (window.EMU) EMU.stop();
});
document.getElementById('btn-clearlog').addEventListener('click', function() {
  var l = document.getElementById('emu-log');
  if (l) l.innerHTML = '';
});

// ── messages from extension ─────────────────────────────────────────────────
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
      ? msg.ports.map(function(p) {
          return '<option value="' + p.port + '">' + p.port + ' — ' + p.desc + '</option>';
        }).join('')
      : '<option value="">— немає —</option>';
    if (cur) setPort(cur);
  }
  if (msg.type === 'saved') {
    var el = document.getElementById('save-msg');
    el.style.display = 'inline';
    setTimeout(function() { el.style.display = 'none'; }, 2000);
  }
  if (msg.type === 'chatReply') {
    var th = document.querySelector('.msg.thinking');
    if (th) th.remove();
    appendMsg('bot', msg.text);
  }
});

listPorts();
})();
