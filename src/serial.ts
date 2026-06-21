import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function cfg(): { port: string; baud: number; python: string } {
  const c = vscode.workspace.getConfiguration('lilka');
  return {
    port:   c.get<string>('serialPort', 'COM3'),
    baud:   c.get<number>('baudRate', 115200),
    python: c.get<string>('pythonPath', 'python'),
  };
}

function scriptPath(name: string): string {
  return path.join(__dirname, '..', 'scripts', name);
}

function runPython(args: string[], output: vscode.OutputChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const { python } = cfg();
    const proc = cp.spawn(python, args, { shell: true });

    proc.stdout.on('data', (d: Buffer) => output.append(d.toString()));
    proc.stderr.on('data', (d: Buffer) => output.append(d.toString()));

    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python exited with code ${code}`));
      }
    });

    proc.on('error', err => {
      reject(new Error(`Cannot run Python: ${err.message}\nПереконайся що Python і pyserial встановлені, або вкажи lilka.pythonPath у налаштуваннях.`));
    });
  });
}

export async function pushUartFile(output: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Відкрий Lua файл для відправки.');
    return;
  }

  const filePath = editor.document.fileName;
  if (!filePath.endsWith('.lua')) {
    vscode.window.showWarningMessage('Активний файл не є .lua');
    return;
  }

  const { port, baud } = cfg();
  output.show(true);
  output.appendLine(`\n─── UART push: ${path.basename(filePath)} → ${port} ───`);

  await runPython([scriptPath('push_uart.py'), port, String(baud), filePath], output);
  output.appendLine('─── Done ───');
  vscode.window.showInformationMessage(`Lilka: файл відправлено через ${port}`);
}

export async function pushUartLine(output: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { return; }

  const line = editor.document.lineAt(editor.selection.active.line).text.trim();
  if (!line || line.startsWith('--')) {
    vscode.window.showInformationMessage('Lilka: рядок порожній або коментар, пропускаємо.');
    return;
  }

  const { port, baud } = cfg();
  output.show(true);
  output.appendLine(`\n─── UART line: ${line} ───`);

  await runPython([scriptPath('send_line.py'), port, String(baud), line], output);
}
