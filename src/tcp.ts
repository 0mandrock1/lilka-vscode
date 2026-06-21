import * as vscode from 'vscode';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';

function cfg(): { host: string; port: number } {
  const c = vscode.workspace.getConfiguration('lilka');
  return {
    host: c.get<string>('tcpHost', '192.168.50.168'),
    port: c.get<number>('tcpPort', 9988),
  };
}

export async function pushTcpFile(output: vscode.OutputChannel): Promise<void> {
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

  const { host, port } = cfg();
  const filename = path.basename(filePath);
  const content  = fs.readFileSync(filePath, 'utf-8');
  const payload  = Buffer.from(`${filename}\n${content}`, 'utf-8');

  output.show(true);
  output.appendLine(`\n─── TCP push: ${filename} → ${host}:${port} ───`);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let response = '';

    socket.setTimeout(10_000);

    socket.connect(port, host, () => {
      socket.write(payload);
      socket.end();
    });

    socket.on('data', (d: Buffer) => { response += d.toString(); });

    socket.on('close', () => {
      const ok = response.startsWith('OK');
      output.appendLine(`Lilka: ${response.trim()}`);
      output.appendLine('─── Done ───');
      if (ok) {
        vscode.window.showInformationMessage(`Lilka: ${filename} відправлено по TCP`);
        resolve();
      } else {
        vscode.window.showErrorMessage(`Lilka TCP помилка: ${response.trim()}`);
        reject(new Error(response));
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      const msg = `Таймаут з'єднання ${host}:${port} — чи запущено nc_receiver.lua?`;
      output.appendLine(msg);
      vscode.window.showErrorMessage(`Lilka: ${msg}`);
      reject(new Error(msg));
    });

    socket.on('error', (err: Error) => {
      const hint = err.message.includes('ECONNREFUSED')
        ? `\nЗапусти на Лілці: apps/nc_receiver.lua (${host}:${port})`
        : '';
      const msg = `TCP: ${err.message}${hint}`;
      output.appendLine(msg);
      vscode.window.showErrorMessage(`Lilka: ${msg}`, 'OK');
      reject(err);
    });
  });
}
