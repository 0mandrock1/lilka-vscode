import * as vscode from 'vscode';

export interface ApiEntry {
  namespace: string;
  name: string;
  detail: string;
  doc: string;
  snippet?: string;
  kind: vscode.CompletionItemKind;
}

export const LILKA_API: ApiEntry[] = [
  // ── display constants ─────────────────────────────────────────────────────
  { namespace: 'display', name: 'width',          detail: '240',    doc: 'Ширина екрану (240px)',  kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'height',         detail: '280',    doc: 'Висота екрану (280px)', kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.black',   detail: 'uint16', doc: 'RGB565 чорний',         kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.red',     detail: 'uint16', doc: 'RGB565 червоний',       kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.green',   detail: 'uint16', doc: 'RGB565 зелений',        kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.blue',    detail: 'uint16', doc: 'RGB565 синій',          kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.cyan',    detail: 'uint16', doc: 'RGB565 cyan',           kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.magenta', detail: 'uint16', doc: 'RGB565 magenta',        kind: vscode.CompletionItemKind.Constant },
  { namespace: 'display', name: 'colors.yellow',  detail: 'uint16', doc: 'RGB565 жовтий',         kind: vscode.CompletionItemKind.Constant },

  // ── display functions ─────────────────────────────────────────────────────
  {
    namespace: 'display', name: 'color565', kind: vscode.CompletionItemKind.Function,
    detail: 'color565(r, g, b) → uint16',
    doc: 'Конвертує RGB (0-255) в RGB565. Використовуй замість colors.white.',
    snippet: 'color565(${1:255}, ${2:255}, ${3:255})',
  },
  {
    namespace: 'display', name: 'fill_screen', kind: vscode.CompletionItemKind.Function,
    detail: 'fill_screen(color)',
    doc: 'Заповнити весь екран кольором. Викликай першим в lilka.draw().',
    snippet: 'fill_screen(${1:display.colors.black})',
  },
  {
    namespace: 'display', name: 'fill_rect', kind: vscode.CompletionItemKind.Function,
    detail: 'fill_rect(x, y, width, height, color)',
    doc: 'Заповнений прямокутник.',
    snippet: 'fill_rect(${1:x}, ${2:y}, ${3:w}, ${4:h}, ${5:color})',
  },
  {
    namespace: 'display', name: 'draw_rect', kind: vscode.CompletionItemKind.Function,
    detail: 'draw_rect(x, y, width, height, color)',
    doc: 'Контур прямокутника.',
    snippet: 'draw_rect(${1:x}, ${2:y}, ${3:w}, ${4:h}, ${5:color})',
  },
  {
    namespace: 'display', name: 'draw_line', kind: vscode.CompletionItemKind.Function,
    detail: 'draw_line(x1, y1, x2, y2)  ⚠ без кольору!',
    doc: '⚠ draw_line НЕ приймає аргумент кольору! Для горизонтальних ліній використовуй fill_rect(x, y, w, 1, color). Для пікселів — draw_pixel.',
    snippet: 'draw_line(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})',
  },
  {
    namespace: 'display', name: 'draw_circle', kind: vscode.CompletionItemKind.Function,
    detail: 'draw_circle(x, y, radius, color)',
    doc: 'Контур кола.',
    snippet: 'draw_circle(${1:x}, ${2:y}, ${3:r}, ${4:color})',
  },
  {
    namespace: 'display', name: 'fill_circle', kind: vscode.CompletionItemKind.Function,
    detail: 'fill_circle(x, y, radius, color)',
    doc: 'Заповнене коло.',
    snippet: 'fill_circle(${1:x}, ${2:y}, ${3:r}, ${4:color})',
  },
  {
    namespace: 'display', name: 'draw_pixel', kind: vscode.CompletionItemKind.Function,
    detail: 'draw_pixel(x, y, color)',
    doc: 'Один піксель.',
    snippet: 'draw_pixel(${1:x}, ${2:y}, ${3:color})',
  },
  {
    namespace: 'display', name: 'set_cursor', kind: vscode.CompletionItemKind.Function,
    detail: 'set_cursor(x, y)',
    doc: 'Позиція для наступного display.print().',
    snippet: 'set_cursor(${1:x}, ${2:y})',
  },
  {
    namespace: 'display', name: 'set_text_size', kind: vscode.CompletionItemKind.Function,
    detail: 'set_text_size(n)',
    doc: 'Розмір шрифту (1 = 6×8px, 2 = 12×16px, ...).',
    snippet: 'set_text_size(${1:2})',
  },
  {
    namespace: 'display', name: 'set_text_color', kind: vscode.CompletionItemKind.Function,
    detail: 'set_text_color(color)',
    doc: 'Колір тексту. Використовуй color565(), НЕ colors.white.',
    snippet: 'set_text_color(${1:display.color565(255, 255, 255)})',
  },
  {
    namespace: 'display', name: 'print', kind: vscode.CompletionItemKind.Function,
    detail: 'print(value)',
    doc: 'Вивести текст або число в поточній позиції курсора.',
    snippet: 'print(${1:"text"})',
  },
  {
    namespace: 'display', name: 'queue_draw', kind: vscode.CompletionItemKind.Function,
    detail: 'queue_draw()',
    doc: '⚠ ОБОВ\'ЯЗКОВО наприкінці lilka.draw()! Пред\'являє backbuffer на екран.',
    snippet: 'queue_draw()',
  },

  // ── controller ────────────────────────────────────────────────────────────
  {
    namespace: 'controller', name: 'get_state', kind: vscode.CompletionItemKind.Function,
    detail: 'get_state() → State',
    doc: 'Повертає стан всіх кнопок. Кожна кнопка має: .pressed, .justPressed, .justReleased\n\nКнопки: up, down, left, right, a, b, c, d, select, start, any',
    snippet: 'get_state()',
  },

  // ── gpio ──────────────────────────────────────────────────────────────────
  {
    namespace: 'gpio', name: 'set_mode', kind: vscode.CompletionItemKind.Function,
    detail: 'set_mode(pin, mode)',
    doc: 'mode: gpio.INPUT / gpio.OUTPUT / gpio.INPUT_PULLUP / gpio.INPUT_PULLDOWN',
    snippet: 'set_mode(${1:pin}, ${2:gpio.OUTPUT})',
  },
  {
    namespace: 'gpio', name: 'write', kind: vscode.CompletionItemKind.Function,
    detail: 'write(pin, value)',
    doc: 'value: gpio.HIGH або gpio.LOW',
    snippet: 'write(${1:pin}, ${2:gpio.HIGH})',
  },
  {
    namespace: 'gpio', name: 'read', kind: vscode.CompletionItemKind.Function,
    detail: 'read(pin) → 0|1',
    doc: 'Читає цифровий стан піна.',
    snippet: 'read(${1:pin})',
  },
  {
    namespace: 'gpio', name: 'analog_read', kind: vscode.CompletionItemKind.Function,
    detail: 'analog_read(pin) → 0..4095',
    doc: '12-бітний ADC. ADC-пини: P6=14, P7=13, P8=12.',
    snippet: 'analog_read(${1:14})',
  },
  { namespace: 'gpio', name: 'INPUT',         detail: 'mode', doc: 'Цифровий вхід',             kind: vscode.CompletionItemKind.Constant },
  { namespace: 'gpio', name: 'OUTPUT',        detail: 'mode', doc: 'Цифровий вихід',            kind: vscode.CompletionItemKind.Constant },
  { namespace: 'gpio', name: 'INPUT_PULLUP',  detail: 'mode', doc: 'Вхід з підтяжкою до VCC',  kind: vscode.CompletionItemKind.Constant },
  { namespace: 'gpio', name: 'INPUT_PULLDOWN',detail: 'mode', doc: 'Вхід з підтяжкою до GND',  kind: vscode.CompletionItemKind.Constant },
  { namespace: 'gpio', name: 'HIGH',          detail: '1',    doc: 'Логічна 1',                 kind: vscode.CompletionItemKind.Constant },
  { namespace: 'gpio', name: 'LOW',           detail: '0',    doc: 'Логічний 0',                kind: vscode.CompletionItemKind.Constant },

  // ── buzzer ────────────────────────────────────────────────────────────────
  {
    namespace: 'buzzer', name: 'play', kind: vscode.CompletionItemKind.Function,
    detail: 'play(frequency [, duration_ms])',
    doc: 'Грає тон заданої частоти (Гц). З duration_ms зупиняється автоматично.',
    snippet: 'play(${1:440}, ${2:200})',
  },
  {
    namespace: 'buzzer', name: 'stop', kind: vscode.CompletionItemKind.Function,
    detail: 'stop()',
    doc: 'Зупинити звук.',
    snippet: 'stop()',
  },
  {
    namespace: 'buzzer', name: 'play_melody', kind: vscode.CompletionItemKind.Function,
    detail: 'play_melody(tones, tempo)',
    doc: 'Програє масив нот: {{notes.C4, 500}, {notes.D4, 500}, ...}',
    snippet: 'play_melody(${1:tones}, ${2:120})',
  },

  // ── wifi ──────────────────────────────────────────────────────────────────
  {
    namespace: 'wifi', name: 'connect', kind: vscode.CompletionItemKind.Function,
    detail: 'connect(ssid, password)',
    doc: 'Підключитися до WiFi мережі.',
    snippet: 'connect("${1:SSID}", "${2:password}")',
  },
  {
    namespace: 'wifi', name: 'disconnect', kind: vscode.CompletionItemKind.Function,
    detail: 'disconnect()',
    doc: 'Відключитися від WiFi.',
    snippet: 'disconnect()',
  },
  {
    namespace: 'wifi', name: 'get_local_ip', kind: vscode.CompletionItemKind.Function,
    detail: 'get_local_ip() → string',
    doc: 'Отримати локальну IP-адресу ("x.x.x.x").',
    snippet: 'get_local_ip()',
  },
  {
    namespace: 'wifi', name: 'get_status', kind: vscode.CompletionItemKind.Function,
    detail: 'get_status() → string',
    doc: 'Стан підключення.',
    snippet: 'get_status()',
  },
  {
    namespace: 'wifi', name: 'scan', kind: vscode.CompletionItemKind.Function,
    detail: 'scan() → table',
    doc: 'Сканує доступні мережі.',
    snippet: 'scan()',
  },
  {
    namespace: 'wifi', name: 'get_mac', kind: vscode.CompletionItemKind.Function,
    detail: 'get_mac() → string',
    doc: 'MAC-адреса у форматі "XX:XX:XX:XX:XX:XX".',
    snippet: 'get_mac()',
  },
  {
    namespace: 'wifi', name: 'set_config', kind: vscode.CompletionItemKind.Function,
    detail: 'set_config(ip, gateway, subnet, dns1, dns2)',
    doc: 'Статична IP конфігурація.',
    snippet: 'set_config("${1:192.168.1.100}", "${2:192.168.1.1}", "${3:255.255.255.0}", "${4:8.8.8.8}", "${5:8.8.4.4}")',
  },

  // ── net (TCP only!) ───────────────────────────────────────────────────────
  {
    namespace: 'net', name: 'connect', kind: vscode.CompletionItemKind.Function,
    detail: 'connect(host, port [, timeout_ms]) → fd, err',
    doc: 'TCP з\'єднання. Тільки TCP — UDP не підтримується!\nhost: IP рядок, timeout_ms за замовчуванням 5000.',
    snippet: 'connect("${1:192.168.1.100}", ${2:9000}, ${3:2000})',
  },
  {
    namespace: 'net', name: 'send', kind: vscode.CompletionItemKind.Function,
    detail: 'send(fd, data)',
    doc: 'Відправити дані по TCP.',
    snippet: 'send(${1:fd}, ${2:"data"})',
  },
  {
    namespace: 'net', name: 'receive', kind: vscode.CompletionItemKind.Function,
    detail: 'receive(fd [, max_bytes [, timeout_ms]]) → data, err',
    doc: 'Отримати дані по TCP.',
    snippet: 'receive(${1:fd}, ${2:256}, ${3:500})',
  },
  {
    namespace: 'net', name: 'close', kind: vscode.CompletionItemKind.Function,
    detail: 'close(fd)',
    doc: 'Закрити TCP з\'єднання.',
    snippet: 'close(${1:fd})',
  },
  {
    namespace: 'net', name: 'settimeout', kind: vscode.CompletionItemKind.Function,
    detail: 'settimeout(fd, timeout_ms)',
    doc: 'Змінити таймаут існуючого з\'єднання.',
    snippet: 'settimeout(${1:fd}, ${2:1000})',
  },
  {
    namespace: 'net', name: 'listen', kind: vscode.CompletionItemKind.Function,
    detail: 'listen(port [, backlog]) → srv',
    doc: 'Створити TCP сервер.',
    snippet: 'listen(${1:9988}, ${2:1})',
  },
  {
    namespace: 'net', name: 'accept', kind: vscode.CompletionItemKind.Function,
    detail: 'accept(srv [, timeout_ms]) → fd',
    doc: 'Прийняти TCP клієнта. timeout_ms=0 — non-blocking.',
    snippet: 'accept(${1:srv}, ${2:10})',
  },

  // ── util ──────────────────────────────────────────────────────────────────
  {
    namespace: 'util', name: 'exit', kind: vscode.CompletionItemKind.Function,
    detail: 'exit()',
    doc: 'Вийти з програми назад в меню KeiraOS.',
    snippet: 'exit()',
  },
  {
    namespace: 'util', name: 'sleep', kind: vscode.CompletionItemKind.Function,
    detail: 'sleep(milliseconds)',
    doc: 'Пауза в мілісекундах.',
    snippet: 'sleep(${1:100})',
  },

  // ── notes ─────────────────────────────────────────────────────────────────
  ...['C3','D3','E3','F3','G3','A3','B3',
      'C4','D4','E4','F4','G4','A4','B4',
      'C5','D5','E5','F5','G5','A5','B5',
      'REST'].map(n => ({
    namespace: 'notes', name: n, kind: vscode.CompletionItemKind.Constant,
    detail: 'Hz', doc: `Нота ${n} для buzzer.play_melody()`,
  })),
];

// Namespaces that trigger completion after '.'
export const TRIGGER_NAMESPACES = [
  'display', 'controller', 'gpio', 'buzzer', 'wifi', 'net', 'util', 'notes', 'lilka',
];

// Lilka skeleton completions (for 'lilka.' prefix)
export const LILKA_LIFECYCLE: ApiEntry[] = [
  {
    namespace: 'lilka', name: 'init', kind: vscode.CompletionItemKind.Function,
    detail: 'function lilka.init()',
    doc: 'Викликається один раз при старті. Ініціалізація GPIO, дисплею, стану.',
    snippet: 'init()\n    ${1:-- init}\nend',
  },
  {
    namespace: 'lilka', name: 'update', kind: vscode.CompletionItemKind.Function,
    detail: 'function lilka.update(delta)',
    doc: 'Викликається ~30 FPS. delta = час кадру в секундах. Обробка вводу, логіка.',
    snippet: 'update(delta)\n    local s = controller.get_state()\n    ${1:-- update}\nend',
  },
  {
    namespace: 'lilka', name: 'draw', kind: vscode.CompletionItemKind.Function,
    detail: 'function lilka.draw()',
    doc: 'Викликається після update(). Малювання. ОБОВ\'ЯЗКОВО: display.queue_draw() наприкінці.',
    snippet: 'draw()\n    display.fill_screen(display.colors.black)\n    ${1:-- draw}\n    display.queue_draw()\nend',
  },
];
