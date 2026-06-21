export interface DocSection {
  title: string;
  keywords: string[];
  body: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    title: 'Структура програми (init / update / draw)',
    keywords: ['init', 'update', 'draw', 'структура', 'скелет', 'loop', 'delta', 'старт'],
    body: `Кожна Lilka-програма має три функції:

\`\`\`lua
function lilka.init()
    -- Викликається один раз при старті
    display.set_text_size(2)
end

function lilka.update(delta)
    -- ~30 FPS. delta = час кадру в секундах
    local s = controller.get_state()
    if s.up.justPressed then util.exit() end
end

function lilka.draw()
    display.fill_screen(display.colors.black)
    -- малюємо...
    display.queue_draw()  -- ОБОВ'ЯЗКОВО!
end
\`\`\``,
  },
  {
    title: 'display — дисплей (240×280)',
    keywords: ['display', 'екран', 'дисплей', 'fill', 'rect', 'circle', 'pixel', 'text', 'print', 'cursor', 'color', 'колір', 'малюй', 'намалюй'],
    body: `Дисплей 240×280 (ST7789). Завжди закінчуй \`display.queue_draw()\`.

\`\`\`lua
display.width   -- 240
display.height  -- 280

-- Очищення
display.fill_screen(display.colors.black)

-- Примітиви
display.fill_rect(x, y, w, h, color)
display.draw_rect(x, y, w, h, color)
display.fill_circle(x, y, r, color)
display.draw_circle(x, y, r, color)
display.draw_pixel(x, y, color)
-- ⚠ draw_line НЕ приймає колір: display.draw_line(x1,y1,x2,y2)

-- Текст
display.set_cursor(x, y)
display.set_text_size(2)
display.set_text_color(color)
display.print("Hello!")

-- ОБОВ'ЯЗКОВО в кінці draw():
display.queue_draw()
\`\`\``,
  },
  {
    title: 'display.color565 — кольори',
    keywords: ['color565', 'колір', 'white', 'білий', 'rgb', 'colors', 'color'],
    body: `⚠ \`display.colors.white\` НЕ існує — використовуй \`color565()\`:

\`\`\`lua
-- Правильно:
display.color565(255, 255, 255)  -- білий
display.color565(255, 0, 0)      -- червоний
display.color565(0, 255, 0)      -- зелений
display.color565(0, 0, 255)      -- синій
display.color565(0, 0, 0)        -- чорний

-- Готові константи (працюють):
display.colors.black
display.colors.red
display.colors.green
display.colors.blue
display.colors.cyan
display.colors.magenta
display.colors.yellow
-- display.colors.white ← НЕ ІСНУЄ!
\`\`\``,
  },
  {
    title: 'controller — кнопки',
    keywords: ['controller', 'кнопки', 'button', 'pressed', 'justpressed', 'up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'],
    body: `\`\`\`lua
local s = controller.get_state()

-- Кожна кнопка має три поля:
s.a.pressed        -- утримується зараз
s.a.justPressed    -- натиснута цього кадру
s.a.justReleased   -- відпущена цього кадру

-- Доступні кнопки:
-- s.up  s.down  s.left  s.right
-- s.a   s.b     s.c     s.d
-- s.select  s.start  s.any

-- Приклад:
if s.a.justPressed then
    buzzer.play(440, 100)
end
if s.up.justPressed then util.exit() end
\`\`\``,
  },
  {
    title: 'gpio — GPIO / ADC',
    keywords: ['gpio', 'пін', 'pin', 'adc', 'analog', 'аналог', 'digital', 'цифровий', 'p6', 'p7', 'p8', 'p3', 'p4', 'вхід', 'вихід'],
    body: `GPIO розширювача: P3=48, P4=47(OUT), P5=21, P6=14(ADC), P7=13(ADC), P8=12(ADC)

\`\`\`lua
-- Конфігурація
gpio.set_mode(pin, gpio.INPUT)
gpio.set_mode(pin, gpio.OUTPUT)
gpio.set_mode(pin, gpio.INPUT_PULLUP)

-- Цифровий I/O
gpio.write(pin, gpio.HIGH)
gpio.write(pin, gpio.LOW)
local val = gpio.read(pin)      -- 0 або 1

-- ADC (тільки P6=14, P7=13, P8=12)
local raw = gpio.analog_read(14)          -- 0..4095
local volts = raw * 3.3 / 4095
\`\`\``,
  },
  {
    title: 'buzzer — звук / мелодії',
    keywords: ['buzzer', 'звук', 'тон', 'tone', 'melody', 'мелодія', 'notes', 'нота', 'play', 'stop'],
    body: `\`\`\`lua
-- Простий тон
buzzer.play(440)          -- грає 440 Гц безперервно
buzzer.play(440, 200)     -- 440 Гц, 200 мс
buzzer.stop()

-- Мелодія
local song = {
    {notes.C4, 300},
    {notes.E4, 300},
    {notes.G4, 500},
    {notes.REST, 200},
}
buzzer.play_melody(song, 120)

-- Доступні ноти: notes.C3..B5, notes.REST
\`\`\``,
  },
  {
    title: 'wifi — WiFi',
    keywords: ['wifi', 'wi-fi', 'мережа', 'network', 'ip', 'connect', 'підключ'],
    body: `\`\`\`lua
wifi.connect("MySSID", "password")
local ip = wifi.get_local_ip()    -- "192.168.x.x"
wifi.get_status()
wifi.disconnect()
wifi.scan()                        -- таблиця мереж
wifi.get_mac()

-- Статична IP:
wifi.set_config("192.168.1.100", "192.168.1.1",
                "255.255.255.0", "8.8.8.8", "8.8.4.4")
\`\`\``,
  },
  {
    title: 'net — TCP мережа',
    keywords: ['net', 'tcp', 'socket', 'connect', 'send', 'receive', 'listen', 'accept', 'сервер', 'клієнт', 'мережа'],
    body: `⚠ Тільки TCP — UDP не підтримується!

\`\`\`lua
-- Клієнт
local fd, err = net.connect("192.168.1.100", 9000, 2000)
net.send(fd, "hello\\n")
local data, err = net.receive(fd, 256, 500)
net.close(fd)

-- Сервер
local srv = net.listen(9988, 1)
local cli = net.accept(srv, 30000)  -- чекаємо 30с
-- або non-blocking:
local cli = net.accept(srv, 10)     -- 10мс timeout
net.send(cli, "OK\\n")
net.close(cli)
\`\`\``,
  },
  {
    title: 'util — утиліти',
    keywords: ['util', 'exit', 'sleep', 'пауза', 'вихід'],
    body: `\`\`\`lua
util.exit()          -- вийти в меню KeiraOS
util.sleep(500)      -- пауза 500 мс
\`\`\``,
  },
  {
    title: 'Часті помилки KeiraOS',
    keywords: ['помилка', 'error', 'bug', 'баг', 'не працює', 'проблема', 'часті', 'math', 'max', 'min', 'draw_line', 'queue_draw'],
    body: `1. **\`display.colors.white\` не існує** → \`display.color565(255,255,255)\`
2. **\`display.set_text_bg_color()\` не існує** → малюй \`fill_rect\` поверх тексту
3. **\`display.draw_line()\` не приймає колір** → для горизонтальних: \`fill_rect(x,y,w,1,color)\`; для пікселів: \`draw_pixel\`
4. **\`math.max(a,b)\` не працює з 2 аргументами** → \`if a > b then a else b end\`
5. **\`display.queue_draw()\` обов'язковий** наприкінці \`lilka.draw()\`
6. **UDP не підтримується** — тільки TCP через \`net.connect()\`
7. **ADC тільки на P6(14), P7(13), P8(12)**`,
  },
  {
    title: 'Апаратура Лілки v2',
    keywords: ['апаратура', 'hardware', 'gpio', 'пін', 'кнопки', 'buzzer', 'gpio11', 'esp32', 'дисплей', 'expansion'],
    body: `MCU: ESP32-S3-WROOM-1-N16R8
Дисплей: 1.69" IPS 240×280 (ST7789)
Звук: I2S DAC (MAX98357A) + buzzer GPIO 11

**Кнопки:**
UP=38, DOWN=41, LEFT=39, RIGHT=40
A=5, B=6, C=10, D=9, SELECT=0, START=4

**Expansion:**
P3=GPIO48, P4=GPIO47(OUT), P5=GPIO21
P6=GPIO14(ADC), P7=GPIO13(ADC), P8=GPIO12(ADC)`,
  },
];

export function searchDocs(query: string): DocSection[] {
  const words = query.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/).filter(w => w.length > 1);
  if (!words.length) { return []; }

  const scored = DOC_SECTIONS.map(section => {
    const haystack = (section.title + ' ' + section.keywords.join(' ') + ' ' + section.body).toLowerCase();
    const score = words.reduce((acc, w) => {
      if (section.keywords.some(k => k.includes(w))) { return acc + 3; }
      if (section.title.toLowerCase().includes(w)) { return acc + 2; }
      if (haystack.includes(w)) { return acc + 1; }
      return acc;
    }, 0);
    return { section, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(x => x.section);
}
