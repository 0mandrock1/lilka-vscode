"""
push_uart.py <port> <baud> <file.lua>
Sends a Lua file to Lilka via UART REPL (Keira Live Lua protocol).
Called by the VS Code extension — do not rename arguments.
"""
import serial, sys, time, os

if len(sys.argv) < 4:
    print("Usage: push_uart.py <port> <baud> <file.lua>")
    sys.exit(1)

PORT = sys.argv[1]
BAUD = int(sys.argv[2])
FILE = sys.argv[3]

if not os.path.exists(FILE):
    print(f"File not found: {FILE}")
    sys.exit(1)

with open(FILE, 'r', encoding='utf-8') as f:
    code = f.read()

print(f"Sending {os.path.basename(FILE)} ({len(code)} bytes) -> {PORT} @ {BAUD}...")

s = serial.Serial(PORT, BAUD, timeout=2)
time.sleep(0.3)

s.write(code.encode('utf-8'))
s.write(b'\x04')   # Ctrl+D — Keira Live Lua EOF
s.flush()

time.sleep(0.5)
resp = s.read(500)
if resp:
    print("Response:", repr(resp.decode('utf-8', errors='replace')))
else:
    print("(no response — program started)")

s.close()
print("Done!")
