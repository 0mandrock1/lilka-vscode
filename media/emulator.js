/* Lilka ESP32-S3 Emulator — runs in VS Code webview via fengari */
(function() {
'use strict';

var EMU = {
  L:       null,
  canvas:  null,
  ctx:     null,
  running: false,
  animId:  null,
  lastTime: 0,
  curX: 0, curY: 0,
  textSize: 1,
  textColor: 'white',
  keys:     {},
  prevKeys: {},
  _shouldExit: function() { return false; },
};

// ── helpers ────────────────────────────────────────────────────────────────
function rgb565(c) {
  c = c >>> 0;
  var r = Math.round(((c >> 11) & 0x1F) * 255 / 31);
  var g = Math.round(((c >>  5) & 0x3F) * 255 / 63);
  var b = Math.round(( c        & 0x1F) * 255 / 31);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function make565(r, g, b) {
  return (((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)) >>> 0;
}

function emuLog(msg) {
  var log = document.getElementById('emu-log');
  if (!log) return;
  var line = document.createElement('div');
  line.textContent = msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 60) log.removeChild(log.firstChild);
}

// ── fengari helpers ─────────────────────────────────────────────────────────
function lstr(s)     { return fengari.lua.to_luastring(s); }
function jsstr(ls)   { return ls ? fengari.lua.to_jsstring(ls) : ''; }
function numArg(L,i) { return fengari.lua.lua_tonumber(L,i) || 0; }
function intArg(L,i) { return fengari.lua.lua_tointeger(L,i) || 0; }

function strArg(L, i) {
  var lua = fengari.lua;
  var t = lua.lua_type(L, i);
  if (t === 3 /*LUA_TNUMBER*/)  return String(lua.lua_tonumber(L, i));
  if (t === 1 /*LUA_TBOOLEAN*/) return lua.lua_toboolean(L, i) ? 'true' : 'false';
  var raw = lua.lua_tostring(L, i);
  return raw ? jsstr(raw) : '(nil)';
}

function regFn(L, name, fn) {
  fengari.lua.lua_pushcfunction(L, fn);
  fengari.lua.lua_setfield(L, -2, lstr(name));
}

function mkTable(L, funcs) {
  fengari.lua.lua_newtable(L);
  for (var k in funcs) regFn(L, k, funcs[k]);
}

function setInt(L, tidx, name, val) {
  fengari.lua.lua_pushinteger(L, val);
  fengari.lua.lua_setfield(L, tidx > 0 ? tidx : tidx - 1, lstr(name));
}

// ── register KeiraOS API ─────────────────────────────────────────────────────
function registerAPI(L) {
  var lua = fengari.lua;

  // ── display ──────────────────────────────────────────────────────────────
  mkTable(L, {
    color565: function(L) {
      lua.lua_pushinteger(L, make565(intArg(L,1), intArg(L,2), intArg(L,3)));
      return 1;
    },
    fill_screen: function(L) {
      EMU.ctx.fillStyle = rgb565(intArg(L,1));
      EMU.ctx.fillRect(0, 0, 240, 280);
      return 0;
    },
    fill_rect: function(L) {
      EMU.ctx.fillStyle = rgb565(intArg(L,5));
      EMU.ctx.fillRect(numArg(L,1), numArg(L,2), numArg(L,3), numArg(L,4));
      return 0;
    },
    draw_rect: function(L) {
      EMU.ctx.strokeStyle = rgb565(intArg(L,5));
      EMU.ctx.lineWidth = 1;
      EMU.ctx.strokeRect(numArg(L,1)+.5, numArg(L,2)+.5, numArg(L,3)-1, numArg(L,4)-1);
      return 0;
    },
    fill_circle: function(L) {
      EMU.ctx.fillStyle = rgb565(intArg(L,4));
      EMU.ctx.beginPath();
      EMU.ctx.arc(numArg(L,1), numArg(L,2), numArg(L,3), 0, Math.PI*2);
      EMU.ctx.fill();
      return 0;
    },
    draw_circle: function(L) {
      EMU.ctx.strokeStyle = rgb565(intArg(L,4));
      EMU.ctx.lineWidth = 1;
      EMU.ctx.beginPath();
      EMU.ctx.arc(numArg(L,1), numArg(L,2), numArg(L,3), 0, Math.PI*2);
      EMU.ctx.stroke();
      return 0;
    },
    draw_pixel: function(L) {
      EMU.ctx.fillStyle = rgb565(intArg(L,3));
      EMU.ctx.fillRect(intArg(L,1), intArg(L,2), 1, 1);
      return 0;
    },
    draw_line: function(L) {
      EMU.ctx.strokeStyle = EMU.textColor;
      EMU.ctx.lineWidth = 1;
      EMU.ctx.beginPath();
      EMU.ctx.moveTo(numArg(L,1), numArg(L,2));
      EMU.ctx.lineTo(numArg(L,3), numArg(L,4));
      EMU.ctx.stroke();
      return 0;
    },
    draw_triangle: function(L) {
      EMU.ctx.strokeStyle = rgb565(intArg(L,7));
      EMU.ctx.lineWidth = 1;
      EMU.ctx.beginPath();
      EMU.ctx.moveTo(numArg(L,1), numArg(L,2));
      EMU.ctx.lineTo(numArg(L,3), numArg(L,4));
      EMU.ctx.lineTo(numArg(L,5), numArg(L,6));
      EMU.ctx.closePath();
      EMU.ctx.stroke();
      return 0;
    },
    fill_triangle: function(L) {
      EMU.ctx.fillStyle = rgb565(intArg(L,7));
      EMU.ctx.beginPath();
      EMU.ctx.moveTo(numArg(L,1), numArg(L,2));
      EMU.ctx.lineTo(numArg(L,3), numArg(L,4));
      EMU.ctx.lineTo(numArg(L,5), numArg(L,6));
      EMU.ctx.closePath();
      EMU.ctx.fill();
      return 0;
    },
    set_cursor:     function(L) { EMU.curX = numArg(L,1); EMU.curY = numArg(L,2); return 0; },
    set_text_size:  function(L) { EMU.textSize = Math.max(1, intArg(L,1) || 1); return 0; },
    set_text_color: function(L) { EMU.textColor = rgb565(intArg(L,1)); return 0; },
    set_text_bg_color: function(L) { return 0; },
    print: function(L) {
      var text = strArg(L, 1);
      var sz   = EMU.textSize * 8;
      EMU.ctx.font = 'bold ' + sz + 'px "Courier New", monospace';
      EMU.ctx.fillStyle = EMU.textColor;
      EMU.ctx.fillText(text, EMU.curX, EMU.curY + sz);
      EMU.curX += text.length * EMU.textSize * 6;
      return 0;
    },
    queue_draw: function(L) { return 0; },
  });
  // add width, height, colors to display table
  setInt(L, -1, 'width',  240);
  setInt(L, -1, 'height', 280);
  lua.lua_newtable(L);
  var COLS = { black:0, red:make565(255,0,0), green:make565(0,255,0),
    blue:make565(0,0,255), cyan:make565(0,255,255),
    magenta:make565(255,0,255), yellow:make565(255,255,0) };
  for (var cn in COLS) setInt(L, -1, cn, COLS[cn]);
  lua.lua_setfield(L, -2, lstr('colors'));
  lua.lua_setglobal(L, lstr('display'));

  // ── controller ───────────────────────────────────────────────────────────
  mkTable(L, {
    get_state: function(L) {
      lua.lua_newtable(L);
      var BTNS = ['up','down','left','right','a','b','c','d','select','start','any'];
      for (var bi = 0; bi < BTNS.length; bi++) {
        var btn = BTNS[bi];
        var isAny   = btn === 'any';
        var pressed = isAny
          ? Object.keys(EMU.keys).some(function(k) { return EMU.keys[k]; })
          : !!EMU.keys[btn];
        var prev    = isAny
          ? Object.keys(EMU.prevKeys).some(function(k) { return EMU.prevKeys[k]; })
          : !!EMU.prevKeys[btn];
        lua.lua_newtable(L);
        lua.lua_pushboolean(L, pressed ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('pressed'));
        lua.lua_pushboolean(L, (pressed && !prev) ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('justPressed'));
        lua.lua_pushboolean(L, (!pressed && prev) ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('justReleased'));
        lua.lua_setfield(L, -2, lstr(btn));
      }
      return 1;
    }
  });
  lua.lua_setglobal(L, lstr('controller'));

  // ── gpio ─────────────────────────────────────────────────────────────────
  mkTable(L, {
    set_mode:    function(L) { return 0; },
    write:       function(L) { return 0; },
    read:        function(L) { lua.lua_pushinteger(L,0); return 1; },
    analog_read: function(L) { lua.lua_pushinteger(L,0); return 1; },
  });
  setInt(L,-1,'INPUT',0); setInt(L,-1,'OUTPUT',1);
  setInt(L,-1,'INPUT_PULLUP',2); setInt(L,-1,'INPUT_PULLDOWN',3);
  setInt(L,-1,'HIGH',1); setInt(L,-1,'LOW',0);
  lua.lua_setglobal(L, lstr('gpio'));

  // ── buzzer ───────────────────────────────────────────────────────────────
  var audioCtx = null, oscNode = null;
  mkTable(L, {
    play: function(L) {
      var freq = numArg(L,1)|0, dur = numArg(L,2)|0;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.resume();
        if (oscNode) { try { oscNode.stop(); } catch(e){} oscNode = null; }
        var osc = audioCtx.createOscillator();
        osc.type = 'square'; osc.frequency.value = freq || 440;
        osc.connect(audioCtx.destination); osc.start();
        oscNode = osc;
        if (dur > 0) setTimeout(function() { try { osc.stop(); } catch(e){} }, dur);
      } catch(e) { emuLog('buzz err: ' + e.message); }
      return 0;
    },
    stop:        function(L) { try { if(oscNode){oscNode.stop();oscNode=null;} } catch(e){} return 0; },
    play_melody: function(L) { return 0; },
  });
  lua.lua_setglobal(L, lstr('buzzer'));

  // ── notes ─────────────────────────────────────────────────────────────────
  lua.lua_newtable(L);
  var NOTES = {C3:131,D3:147,E3:165,F3:175,G3:196,A3:220,B3:247,
    C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,B4:494,
    C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,REST:0};
  for (var nk in NOTES) setInt(L,-1,nk,NOTES[nk]);
  lua.lua_setglobal(L, lstr('notes'));

  // ── util ──────────────────────────────────────────────────────────────────
  var _exit = false;
  mkTable(L, {
    exit:  function(L) { _exit = true; return 0; },
    sleep: function(L) { return 0; },
  });
  lua.lua_setglobal(L, lstr('util'));
  EMU._shouldExit = function() { return _exit; };

  // ── wifi stubs ────────────────────────────────────────────────────────────
  mkTable(L, {
    connect:      function(L) { return 0; },
    disconnect:   function(L) { return 0; },
    get_local_ip: function(L) { lua.lua_pushstring(L,lstr('127.0.0.1')); return 1; },
    get_status:   function(L) { lua.lua_pushstring(L,lstr('emulated'));  return 1; },
    get_mac:      function(L) { lua.lua_pushstring(L,lstr('00:00:00:00:00:00')); return 1; },
    scan:         function(L) { lua.lua_newtable(L); return 1; },
    set_config:   function(L) { return 0; },
  });
  lua.lua_setglobal(L, lstr('wifi'));

  // ── net stubs ─────────────────────────────────────────────────────────────
  mkTable(L, {
    connect:    function(L) { lua.lua_pushnil(L); lua.lua_pushstring(L,lstr('no net')); return 2; },
    send:       function(L) { return 0; },
    receive:    function(L) { lua.lua_pushnil(L); return 1; },
    close:      function(L) { return 0; },
    listen:     function(L) { lua.lua_pushnil(L); return 1; },
    accept:     function(L) { lua.lua_pushnil(L); return 1; },
    settimeout: function(L) { return 0; },
  });
  lua.lua_setglobal(L, lstr('net'));

  // ── patch existing io table (preserve print/write stubs) ─────────────────
  lua.lua_getglobal(L, lstr('io'));
  if (lua.lua_type(L, -1) === 5 /*LUA_TTABLE*/) {
    var ioStub = function(L) { lua.lua_pushnil(L); lua.lua_pushstring(L,lstr('no IO')); return 2; };
    lua.lua_pushcfunction(L, ioStub); lua.lua_setfield(L, -2, lstr('open'));
    lua.lua_pushcfunction(L, function(L) { return 0; }); lua.lua_setfield(L, -2, lstr('write'));
    lua.lua_pushcfunction(L, function(L) { lua.lua_pushnil(L); return 1; }); lua.lua_setfield(L, -2, lstr('read'));
    lua.lua_pushcfunction(L, function(L) { return 0; }); lua.lua_setfield(L, -2, lstr('lines'));
  }
  lua.lua_pop(L, 1);

  // ── patch os.exit ─────────────────────────────────────────────────────────
  lua.lua_getglobal(L, lstr('os'));
  if (lua.lua_type(L, -1) === 5 /*LUA_TTABLE*/) {
    lua.lua_pushcfunction(L, function(L) { _exit = true; return 0; });
    lua.lua_setfield(L, -2, lstr('exit'));
  }
  lua.lua_pop(L, 1);

  // ── empty lilka table (filled by the program) ─────────────────────────────
  lua.lua_newtable(L);
  lua.lua_setglobal(L, lstr('lilka'));

  // ── override print ────────────────────────────────────────────────────────
  lua.lua_pushcfunction(L, function(L) {
    var n = lua.lua_gettop(L), parts = [];
    for (var i = 1; i <= n; i++) parts.push(strArg(L, i));
    emuLog('> ' + parts.join('\t'));
    return 0;
  });
  lua.lua_setglobal(L, lstr('print'));
}

// ── call Lua lifecycle function ───────────────────────────────────────────────
function callLua(name, args) {
  var lua = fengari.lua, L = EMU.L;
  lua.lua_getglobal(L, lstr('lilka'));
  if (lua.lua_type(L, -1) !== 5 /*LUA_TTABLE*/) { lua.lua_pop(L,1); return true; }
  lua.lua_getfield(L, -1, lstr(name));
  lua.lua_remove(L, -2);
  if (lua.lua_type(L, -1) !== 6 /*LUA_TFUNCTION*/) { lua.lua_pop(L,1); return true; }
  if (args) for (var i = 0; i < args.length; i++) lua.lua_pushnumber(L, args[i]);
  var ok = lua.lua_pcall(L, args ? args.length : 0, 0, 0);
  if (ok !== 0) {
    var e = lua.lua_tostring(L, -1);
    emuLog('[ERR] ' + name + ': ' + (e ? jsstr(e) : '(unknown)'));
    lua.lua_pop(L, 1);
    EMU.stop();
    return false;
  }
  return true;
}

// ── start / stop ─────────────────────────────────────────────────────────────
EMU.start = function(code) {
  if (typeof fengari === 'undefined') { emuLog('[ERR] fengari not loaded — перевір CSP або медіа-файли'); return; }
  EMU.stop();

  var lua = fengari.lua, lauxlib = fengari.lauxlib, lualib = fengari.lualib;
  EMU.L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(EMU.L);
  registerAPI(EMU.L);

  var cb = lua.to_luastring(code);
  var st = lauxlib.luaL_loadbuffer(EMU.L, cb, cb.length, lstr('=prog'));
  if (st !== 0) {
    var e = lua.lua_tostring(EMU.L, -1);
    emuLog('[SYN] ' + (e ? jsstr(e) : '?'));
    lua.lua_pop(EMU.L, 1);
    return;
  }
  var rt = lua.lua_pcall(EMU.L, 0, 0, 0);
  if (rt !== 0) {
    var e2 = lua.lua_tostring(EMU.L, -1);
    emuLog('[RUN] ' + (e2 ? jsstr(e2) : '?'));
    lua.lua_pop(EMU.L, 1);
    return;
  }

  emuLog('--- start ---');
  EMU.running = true;
  EMU.keys = {}; EMU.prevKeys = {};

  if (!callLua('init', [])) return;
  EMU.lastTime = performance.now();

  (function loop(ts) {
    if (!EMU.running) return;
    var dt = Math.min((ts - EMU.lastTime) / 1000, 0.1);
    EMU.lastTime = ts;
    EMU.prevKeys = Object.assign({}, EMU.keys);
    if (!callLua('update', [dt])) return;
    if (EMU._shouldExit()) { EMU.stop(); emuLog('--- exited ---'); return; }
    if (!callLua('draw',   [])) return;
    EMU.animId = requestAnimationFrame(loop);
  })(performance.now());
};

EMU.stop = function() {
  EMU.running = false;
  if (EMU.animId) { cancelAnimationFrame(EMU.animId); EMU.animId = null; }
  if (EMU.ctx) {
    EMU.ctx.fillStyle = '#080c14';
    EMU.ctx.fillRect(0, 0, 240, 280);
    EMU.ctx.fillStyle = '#334455';
    EMU.ctx.font = '9px monospace';
    EMU.ctx.fillText('LILKA v2  240\xd7280', 6, 138);
    EMU.ctx.fillText('Натисни ► Run', 6, 152);
  }
};

// ── canvas init + keyboard ────────────────────────────────────────────────────
function initCanvas() {
  var canvas = document.getElementById('screen');
  if (!canvas) return;
  EMU.canvas = canvas;
  EMU.ctx    = canvas.getContext('2d');
  EMU.ctx.imageSmoothingEnabled = false;
  EMU.stop();

  var KEY_MAP = {
    ArrowUp:'up', w:'up', W:'up',
    ArrowDown:'down', s:'down', S:'down',
    ArrowLeft:'left', a:'left', A:'left',
    ArrowRight:'right', d:'right', D:'right',
    z:'a', Z:'a', x:'b', X:'b', c:'c', C:'c', v:'d', V:'d',
    Enter:'start', Backspace:'select', ' ':'a',
  };

  document.querySelectorAll('[data-btn]').forEach(function(el) {
    el.addEventListener('pointerdown',  function(e) { EMU.keys[el.dataset.btn] = true;  e.preventDefault(); });
    el.addEventListener('pointerup',    function()  { EMU.keys[el.dataset.btn] = false; });
    el.addEventListener('pointerleave', function()  { EMU.keys[el.dataset.btn] = false; });
  });

  canvas.addEventListener('keydown', function(e) {
    var btn = KEY_MAP[e.key];
    if (btn) { EMU.keys[btn] = true; e.preventDefault(); }
  });
  canvas.addEventListener('keyup', function(e) {
    var btn = KEY_MAP[e.key];
    if (btn) EMU.keys[btn] = false;
  });

  canvas.addEventListener('click', function() { canvas.focus(); });
}

// Scripts are in <body> before DOMContentLoaded fires
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanvas);
} else {
  initCanvas();
}

// ── message from extension ─────────────────────────────────────────────────────
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'runFile')  {
    var screen = document.getElementById('screen');
    if (screen) screen.focus();
    EMU.start(msg.code);
  }
  if (msg.type === 'emuError') { emuLog('[ERR] ' + msg.message); }
});

window.EMU = EMU;
})();
