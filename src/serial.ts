import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

function cfg() {
  return {
    port:   vscode.workspace.getConfiguration('lilka').get<string>('serialPort', 'COM3'),
    baud:   vscode.workspace.getConfiguration('lilka').get<number>('baudRate', 115200),
    python: vscode.workspace.getConfiguration('lilka').get<string>('pythonPath', 'python'),
  };
}

function scriptPath(name: string): string {
  return path.join(__dirname, '..', 'scripts', name);
}

export async function listPortsQuickPick(): Promise<string | undefined> {
  const { python } = cfg();
  return new Promise(resolve => {
    cp.execFile(python, [scriptPath('list_ports.py')], { shell: true }, (err, stdout) => {
      let ports: { port: string; desc: string }[] = [];
      try { ports = JSON.parse(stdout.trim() || '[]'); } catch { /* ignore */ }

      if (!ports.length) {
        vscode.window.showWarningMessage('Lilka: COM порти не знайдено. Підключи Лілку та перевір драйвер.');
        resolve(undefined);
        return;
      }

      const items = ports.map(p => ({ label: p.port, description: p.desc }));
      vscode.window.showQuickPick(items, { placeHolder: 'Оберіть COM порт Лілки' })
        .then(sel => resolve(sel?.label));
    });
  });
}

function runPython(args: string[], output: vscode.OutputChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const { python } = cfg();
    const proc = cp.spawn(python, args, { shell: true });
    proc.stdout.on('data', (d: Buffer) => output.append(d.toString()));
    proc.stderr.on('data', (d: Buffer) => output.append(d.toString()));
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
    proc.on('error', err => reject(new Error(
      `Не вдалося запустити Python: ${err.message}\nВстанови pyserial: pip install pyserial`
    )));
  });
}

async function resolvePort(output: vscode.OutputChannel): Promise<string | undefined> {
  let { port } = cfg();

  // Try to detect port; if it looks like default COM3 or user wants to pick
  const { python } = cfg();
  const portsRaw: string = await new Promise(res =>
    cp.execFile(python, [scriptPath('list_ports.py')], { shell: true }, (_, out) => res(out || '[]'))
  );
  let ports: { port: string; desc: string }[] = [];
  try { ports = JSON.parse(portsRaw.trim()); } catch { /* ignore */ }

  const available = ports.map(p => p.port);

  if (!available.length) {
    vscode.window.showErrorMessage(
      'Lilka: COM порти не знайдено. Підключи Лілку до USB.',
      'OK'
    );
    return undefined;
  }

  if (!available.includes(port)) {
    if (available.length === 1) {
      // Auto-select the only available port
      port = available[0];
      output.appendLine(`Порт ${port} не знайдено → автовибір ${available[0]}`);
      await vscode.workspace.getConfiguration('lilka').update('serialPort', port, true);
    } else {
      // Show quickpick
      output.appendLine(`Порт ${port} не знайдено. Доступні: ${available.join(', ')}`);
      const picked = await listPortsQuickPick();
      if (!picked) { return undefined; }
      port = picked;
      await vscode.workspace.getConfiguration('lilka').update('serialPort', port, true);
    }
  }

  return port;
}

export async function pushUartFile(output: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Відкрий Lua файл для відправки.');
    return;
  }
  if (!editor.document.fileName.endsWith('.lua')) {
    vscode.window.showWarningMessage('Активний файл не є .lua');
    return;
  }

  const filePath = editor.document.fileName;
  output.show(true);

  const port = await resolvePort(output);
  if (!port) { return; }

  const { baud } = cfg();
  output.appendLine(`\n─── UART push: ${require('path').basename(filePath)} -> ${port} ───`);
  await runPython([scriptPath('push_uart.py'), port, String(baud), filePath], output);
  output.appendLine('─── Done ───');
  vscode.window.showInformationMessage(`Lilka: файл відправлено через ${port}`);
}

export async function pushUartLine(output: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { return; }

  const line = editor.document.lineAt(editor.selection.active.line).text.trim();
  if (!line || line.startsWith('--')) {
    vscode.window.showInformationMessage('Lilka: рядок порожній або коментар.');
    return;
  }

  output.show(true);
  const port = await resolvePort(output);
  if (!port) { return; }

  const { baud } = cfg();
  output.appendLine(`\n─── UART line -> ${port}: ${line} ───`);
  await runPython([scriptPath('send_line.py'), port, String(baud), line], output);
}
