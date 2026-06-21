"""list_ports.py — prints available serial ports as JSON"""
import json, sys
try:
    import serial.tools.list_ports
    ports = [{'port': p.device, 'desc': p.description}
             for p in sorted(serial.tools.list_ports.comports())]
    print(json.dumps(ports))
except ImportError:
    print('[]')
