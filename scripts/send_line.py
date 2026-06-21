"""
send_line.py <port> <baud> <lua_code>
Sends a single Lua expression to Lilka REPL via UART.
Called by the VS Code extension — do not rename arguments.
"""
import serial, sys, time

if len(sys.argv) < 4:
    print("Usage: send_line.py <port> <baud> <lua_code>")
    sys.exit(1)

PORT = sys.argv[1]
BAUD = int(sys.argv[2])
LINE = sys.argv[3]

s = serial.Serial(PORT, BAUD, timeout=2)
time.sleep(0.1)

s.write((LINE + '\n').encode('utf-8'))
s.flush()

time.sleep(0.3)
resp = s.read(500)
if resp:
    print(resp.decode('utf-8', errors='replace'), end='')

s.close()
