# Lilka Lua Tools

VS Code extension для розробки Lua-програм під [Лілку](https://github.com/lilka-dev) (ESP32-S3, KeiraOS).

## Можливості

| Функція | Гарячі клавіші |
|---------|----------------|
| Push файлу через UART | `Ctrl+Shift+U` |
| Push файлу через TCP (nc_receiver) | `Ctrl+Shift+T` |
| Відправити поточний рядок через UART | `Ctrl+Enter` |
| Автодоповнення всіх Lilka API | `.` trigger |
| Лінтер: підсвітка помилок KeiraOS | автоматично |

## Швидкий старт

### 1. Встановити розширення

**З VSIX (рекомендовано):**
```
code --install-extension lilka-lua-tools-0.1.0.vsix
```

**Або через Dev режим** (якщо клонував репо):
```bash
npm install
npm run compile
# F5 в VS Code — відкриє Extension Development Host
```

### 2. Налаштувати порт і IP

Натисни `$(plug) COM3` або `$(radio-tower) IP` в правому нижньому куті статус-бару.

Або через `Ctrl+,` → пошук "Lilka":
- `lilka.serialPort` — COM порт (за замовч. `COM3`)
- `lilka.tcpHost` — IP Лілки (за замовч. `192.168.50.168`)
- `lilka.pythonPath` — шлях до Python (за замовч. `python`)

### 3. Push через UART

1. Відкрий `.lua` файл
2. `Ctrl+Shift+U` — відправить файл на Лілку через UART

**Потрібно:** Python + pyserial (`pip install pyserial`)

### 4. Push через TCP

1. На Лілці запусти `apps/nc_receiver.lua`
2. У VS Code відкрий `.lua` файл
3. `Ctrl+Shift+T` — відправить по WiFi

### 5. Відправити рядок (REPL)

Постав курсор на рядок із Lua виразом → `Ctrl+Enter` → виконується на Лілці через UART.

## Автодоповнення

Після крапки (`display.`, `gpio.`, `net.`, `buzzer.` тощо) з'являються підказки з документацією прямо з KeiraOS API.

## Лінтер

Автоматично підсвічує відомі помилки KeiraOS:

| Помилка | Рівень |
|---------|--------|
| `display.colors.white` — не існує | Error |
| `display.set_text_bg_color` — не існує | Error |
| `display.draw_line(…, color)` — колір не підтримується | Error |
| `math.max(a, b)` з 2 аргументами | Error |
| Можливо відсутній `display.queue_draw()` | Warning |

## Вимоги

- VS Code 1.85+
- Python 3 + `pip install pyserial` (тільки для UART)
- WiFi + запущений `nc_receiver.lua` (тільки для TCP)
