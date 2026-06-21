/* Lilka ESP32-S3 Emulator — runs in VS Code webview via fengari */
(function() {
'use strict';

var EMU = {
  L:        null,
  canvas:   null,
  ctx:      null,
  running:  false,
  animId:   null,
  lastTime: 0,

  // display state
  curX: 0, curY: 0,
  textSize: 1,
  textColor: 'white',
  strokeColor: 'white',

  // controller
  keys:     {},
  prevKeys: {},
};

// ── helpers ────────────────────────────────────────────────────────────────
function rgb565(c) {
  var r = Math.round(((c >> 11) & 0x1F) * 255 / 31);
  var g = Math.round(((c >>  5) & 0x3F) * 255 / 63);
  var b = Math.round((c         & 0x1F) * 255 / 31);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function make565(r, g, b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

function emuLog(msg) {
  var log = document.getElementById('emu-log');
  if (!log) return;
  var line = document.createElement('div');
  line.textContent = msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  if (log.children.length > 40) log.removeChild(log.firstChild);
}

// ── fengari API helpers ────────────────────────────────────────────────────
function numArg(L, idx) {
  return fengari.lua.lua_tonumber(L, idx) || 0;
}

function strArg(L, idx) {
  var lua = fengari.lua, lauxlib = fengari.lauxlib;
  var t = lua.lua_type(L, idx);
  if (t === lua.LUA_TNUMBER) return String(lua.lua_tonumber(L, idx));
  var raw = lauxlib.luaL_tolstring(L, idx, null);
  lua.lua_pop(L, 1);
  return raw ? lua.to_jsstring(raw) : '';
}

function lstr(s) { return fengari.lua.to_luastring(s); }

function regFunc(L, name, fn) {
  fengari.lua.lua_pushcfunction(L, fn);
  fengari.lua.lua_setfield(L, -2, lstr(name));
}

function regTable(L, name, funcs) {
  var lua = fengari.lua;
  lua.lua_newtable(L);
  for (var k in funcs) {
    lua.lua_pushcfunction(L, funcs[k]);
    lua.lua_setfield(L, -2, lstr(k));
  }
  lua.lua_setglobal(L, lstr(name));
}

function setIntField(L, idx, name, val) {
  fengari.lua.lua_pushinteger(L, val);
  fengari.lua.lua_setfield(L, idx > 0 ? idx : idx - 1, lstr(name));
}

// ── register KeiraOS API ───────────────────────────────────────────────────
function registerAPI(L) {
  var lua = fengari.lua;

  // display
  regTable(L, 'display', {
    color565: function(L) {
      lua.lua_pushinteger(L, make565(numArg(L,1)|0, numArg(L,2)|0, numArg(L,3)|0));
      return 1;
    },
    fill_screen: function(L) {
      EMU.ctx.fillStyle = rgb565(numArg(L,1)|0);
      EMU.ctx.fillRect(0, 0, 240, 280);
      return 0;
    },
    fill_rect: function(L) {
      EMU.ctx.fillStyle = rgb565(numArg(L,5)|0);
      EMU.ctx.fillRect(numArg(L,1), numArg(L,2), numArg(L,3), numArg(L,4));
      return 0;
    },
    draw_rect: function(L) {
      EMU.ctx.strokeStyle = rgb565(numArg(L,5)|0);
      EMU.ctx.lineWidth = 1;
      EMU.ctx.strokeRect(numArg(L,1)+.5, numArg(L,2)+.5, numArg(L,3)-1, numArg(L,4)-1);
      return 0;
    },
    fill_circle: function(L) {
      EMU.ctx.fillStyle = rgb565(numArg(L,4)|0);
      EMU.ctx.beginPath();
      EMU.ctx.arc(numArg(L,1), numArg(L,2), numArg(L,3), 0, Math.PI*2);
      EMU.ctx.fill();
      return 0;
    },
    draw_circle: function(L) {
      EMU.ctx.strokeStyle = rgb565(numArg(L,4)|0);
      EMU.ctx.lineWidth = 1;
      EMU.ctx.beginPath();
      EMU.ctx.arc(numArg(L,1), numArg(L,2), numArg(L,3), 0, Math.PI*2);
      EMU.ctx.stroke();
      return 0;
    },
    draw_pixel: function(L) {
      EMU.ctx.fillStyle = rgb565(numArg(L,3)|0);
      EMU.ctx.fillRect(numArg(L,1)|0, numArg(L,2)|0, 1, 1);
      return 0;
    },
    draw_line: function(L) {
      // no color arg on real Lilka — we'll use current strokeColor
      EMU.ctx.strokeStyle = EMU.strokeColor;
      EMU.ctx.lineWidth = 1;
      EMU.ctx.beginPath();
      EMU.ctx.moveTo(numArg(L,1), numArg(L,2));
      EMU.ctx.lineTo(numArg(L,3), numArg(L,4));
      EMU.ctx.stroke();
      return 0;
    },
    set_cursor:     function(L) { EMU.curX = numArg(L,1); EMU.curY = numArg(L,2); return 0; },
    set_text_size:  function(L) { EMU.textSize = numArg(L,1)|0; return 0; },
    set_text_color: function(L) {
      EMU.textColor = rgb565(numArg(L,1)|0);
      EMU.strokeColor = EMU.textColor;
      return 0;
    },
    set_text_bg_color: function(L) { return 0; }, // stub
    print: function(L) {
      var text = strArg(L, 1);
      var sz   = (EMU.textSize || 1) * 8;
      EMU.ctx.font = sz + 'px monospace';
      EMU.ctx.fillStyle = EMU.textColor;
      EMU.ctx.fillText(text, EMU.curX, EMU.curY + sz - 2);
      EMU.curX += text.length * (EMU.textSize || 1) * 6;
      return 0;
    },
    queue_draw: function(L) { return 0; }, // no-op: we draw directly
  });

  // display.width, display.height, display.colors
  lua.lua_getglobal(L, lstr('display'));
  setIntField(L, -1, 'width',  240);
  setIntField(L, -1, 'height', 280);
  lua.lua_newtable(L);
  var COLORS = { black:0, red:make565(255,0,0), green:make565(0,255,0),
    blue:make565(0,0,255), cyan:make565(0,255,255),
    magenta:make565(255,0,255), yellow:make565(255,255,0) };
  for (var cn in COLORS) { setIntField(L, -1, cn, COLORS[cn]); }
  lua.lua_setfield(L, -2, lstr('colors'));
  lua.lua_pop(L, 1);

  // controller
  regTable(L, 'controller', {
    get_state: function(L) {
      lua.lua_newtable(L);
      var BTNS = ['up','down','left','right','a','b','c','d','select','start','any'];
      BTNS.forEach(function(btn) {
        var pressed = btn === 'any'
          ? Object.keys(EMU.keys).some(function(k) { return EMU.keys[k]; })
          : !!EMU.keys[btn];
        var wasPrev = btn === 'any'
          ? Object.keys(EMU.prevKeys).some(function(k) { return EMU.prevKeys[k]; })
          : !!EMU.prevKeys[btn];
        lua.lua_newtable(L);
        lua.lua_pushboolean(L, pressed ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('pressed'));
        lua.lua_pushboolean(L, (pressed && !wasPrev) ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('justPressed'));
        lua.lua_pushboolean(L, (!pressed && wasPrev) ? 1 : 0);
        lua.lua_setfield(L, -2, lstr('justReleased'));
        lua.lua_setfield(L, -2, lstr(btn));
      });
      return 1;
    }
  });

  // gpio
  regTable(L, 'gpio', {
    set_mode:    function(L) { return 0; },
    write:       function(L) { return 0; },
    read:        function(L) { lua.lua_pushinteger(L, 0); return 1; },
    analog_read: function(L) { lua.lua_pushinteger(L, 0); return 1; },
  });
  lua.lua_getglobal(L, lstr('gpio'));
  ['INPUT','OUTPUT','INPUT_PULLUP','INPUT_PULLDOWN'].forEach(function(m, i) { setIntField(L,-1,m,i); });
  setIntField(L,-1,'HIGH',1); setIntField(L,-1,'LOW',0);
  lua.lua_pop(L, 1);

  // buzzer (Web Audio)
  var audioCtx = null, oscNode = null;
  regTable(L, 'buzzer', {
    play: function(L) {
      var freq = numArg(L,1), dur = numArg(L,2);
      try {
        if (!audioCtx) audioCtx = new AudioContext();
        audioCtx.resume();
        if (oscNode) { try { oscNode.stop(); } catch(e){} oscNode = null; }
        var osc = audioCtx.createOscillator();
        osc.type = 'square'; osc.frequency.value = freq;
        osc.connect(audioCtx.destination); osc.start();
        oscNode = osc;
        if (dur) setTimeout(function() { try { osc.stop(); } catch(e){} }, dur);
      } catch(e) {}
      return 0;
    },
    stop: function(L) {
      try { if (oscNode) { oscNode.stop(); oscNode = null; } } catch(e) {}
      return 0;
    },
    play_melody: function(L) { return 0; },
  });

  // notes
  lua.lua_newtable(L);
  var NOTE_HZ = {C3:131,D3:147,E3:165,F3:175,G3:196,A3:220,B3:247,
    C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,B4:494,
    C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,REST:0};
  for (var n in NOTE_HZ) { setIntField(L,-1,n,NOTE_HZ[n]); }
  lua.lua_setglobal(L, lstr('notes'));

  // util
  var shouldExit = false;
  regTable(L, 'util', {
    exit:  function(L) { shouldExit = true; return 0; },
    sleep: function(L) { return 0; },
  });
  EMU._shouldExit = function() { return shouldExit; };

  // wifi stubs
  regTable(L, 'wifi', {
    connect:      function(L) { return 0; },
    disconnect:   function(L) { return 0; },
    get_local_ip: function(L) { lua.lua_pushstring(L, lstr('127.0.0.1')); return 1; },
    get_status:   function(L) { lua.lua_pushstring(L, lstr('emulated')); return 1; },
    get_mac:      function(L) { lua.lua_pushstring(L, lstr('00:00:00:00:00:00')); return 1; },
    scan:         function(L) { lua.lua_newtable(L); return 1; },
    set_config:   function(L) { return 0; },
  });

  // net stubs
  regTable(L, 'net', {
    connect:  function(L) { lua.lua_pushnil(L); lua.lua_pushstring(L, lstr('no net in emulator')); return 2; },
    send:     function(L) { return 0; },
    receive:  function(L) { lua.lua_pushnil(L); return 1; },
    close:    function(L) { return 0; },
    listen:   function(L) { lua.lua_pushnil(L); return 1; },
    accept:   function(L) { lua.lua_pushnil(L); return 1; },
    settimeout: function(L) { return 0; },
  });

  // io stubs
  regTable(L, 'io', {
    open: function(L) { lua.lua_pushnil(L); lua.lua_pushstring(L, lstr('io not available')); return 2; },
  });

  // lilka global table
  lua.lua_newtable(L);
  lua.lua_setglobal(L, lstr('lilka'));

  // override print → log
  lua.lua_pushcfunction(L, function(L) {
    var n = lua.lua_gettop(L), parts = [];
    for (var i = 1; i <= n; i++) parts.push(strArg(L, i));
    emuLog('lua: ' + parts.join('\t'));
    return 0;
  });
  lua.lua_setglobal(L, lstr('print'));
}

// ── call Lua function ──────────────────────────────────────────────────────
function callLua(name, args) {
  var lua = fengari.lua, L = EMU.L;
  lua.lua_getglobal(L, lstr('lilka'));
  if (lua.lua_type(L, -1) !== lua.LUA_TTABLE) { lua.lua_pop(L,1); return true; }
  lua.lua_getfield(L, -1, lstr(name));
  lua.lua_remove(L, -2);
  if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) { lua.lua_pop(L,1); return true; }
  (args || []).forEach(function(a) { lua.lua_pushnumber(L, a); });
  var ok = lua.lua_pcall(L, (args||[]).length, 0, 0);
  if (ok !== lua.LUA_OK) {
    var err = lua.lua_tostring(L, -1);
    emuLog('ERR ' + name + ': ' + (err ? fengari.lua.to_jsstring(err) : '?'));
    lua.lua_pop(L, 1);
    EMU.stop();
    return false;
  }
  return true;
}

// ── start / stop ───────────────────────────────────────────────────────────
EMU.start = function(code) {
  if (typeof fengari === 'undefined') { emuLog('fengari not loaded'); return; }
  EMU.stop();

  var lua = fengari.lua, lauxlib = fengari.lauxlib, lualib = fengari.lualib;
  EMU.L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(EMU.L);
  registerAPI(EMU.L);

  var cb = lua.to_luastring(code);
  var st = lauxlib.luaL_loadbuffer(EMU.L, cb, cb.length, lstr('=program'));
  if (st !== lua.LUA_OK) {
    var e = lua.lua_tostring(EMU.L,-1);
    emuLog('Syntax: ' + (e ? lua.to_jsstring(e) : '?'));
    return;
  }
  if (lua.lua_pcall(EMU.L, 0, 0, 0) !== lua.LUA_OK) {
    var e2 = lua.lua_tostring(EMU.L,-1);
    emuLog('Load err: ' + (e2 ? lua.to_jsstring(e2) : '?'));
    return;
  }

  emuLog('--- start ---');
  EMU.running = true;
  EMU.keys = {}; EMU.prevKeys = {};
  EMU._shouldExit = function() { return false; };

  callLua('init', []);
  EMU.lastTime = performance.now();

  function loop(ts) {
    if (!EMU.running) return;
    var delta = Math.min((ts - EMU.lastTime) / 1000, 0.1);
    EMU.lastTime = ts;
    EMU.prevKeys = Object.assign({}, EMU.keys);
    callLua('update', [delta]);
    if (EMU._shouldExit()) { EMU.stop(); emuLog('--- exited ---'); return; }
    callLua('draw', []);
    EMU.animId = requestAnimationFrame(loop);
  }
  EMU.animId = requestAnimationFrame(loop);
};

EMU.stop = function() {
  EMU.running = false;
  if (EMU.animId) { cancelAnimationFrame(EMU.animId); EMU.animId = null; }
  if (EMU.ctx) {
    EMU.ctx.fillStyle = '#080c14';
    EMU.ctx.fillRect(0, 0, 240, 280);
    EMU.ctx.fillStyle = '#3c5070';
    EMU.ctx.font = '10px monospace';
    EMU.ctx.fillText('240x280  Lilka v2', 6, 140);
  }
};

// ── init canvas + keys ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('screen');
  if (!canvas) return;
  EMU.canvas = canvas;
  EMU.ctx    = canvas.getContext('2d');
  EMU.ctx.imageSmoothingEnabled = false;
  EMU.stop(); // draw idle screen

  var KEY_MAP = {
    ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
    z:'a',x:'b',c:'c',v:'d', Z:'a',X:'b',C:'c',V:'d',
    Enter:'start', Backspace:'select',
  };

  // On-screen button helpers
  document.querySelectorAll('[data-btn]').forEach(function(el) {
    el.addEventListener('pointerdown', function(e) {
      EMU.keys[el.dataset.btn] = true; e.preventDefault();
    });
    ['pointerup','pointerleave'].forEach(function(ev) {
      el.addEventListener(ev, function() { EMU.keys[el.dataset.btn] = false; });
    });
  });

  canvas.addEventListener('keydown', function(e) {
    if (KEY_MAP[e.key]) { EMU.keys[KEY_MAP[e.key]] = true; e.preventDefault(); }
  });
  canvas.addEventListener('keyup', function(e) {
    if (KEY_MAP[e.key]) EMU.keys[KEY_MAP[e.key]] = false;
  });

  // Global keys only when canvas focused
  canvas.setAttribute('tabindex', '0');
});

// ── message from VS Code extension ────────────────────────────────────────
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'runFile')  { document.getElementById('screen').focus(); EMU.start(msg.code); }
  if (msg.type === 'emuError') { emuLog('Error: ' + msg.message); }
});

window.EMU = EMU;
})();
