import * as vscode from 'vscode';
import { LilkaCompletionProvider } from './completion';
import { LilkaDiagnosticProvider } from './diagnostics';
import { pushUartFile, pushUartLine } from './serial';
import { pushTcpFile } from './tcp';
import { LilkaStatusBar } from './statusbar';

export function activate(context: vscode.ExtensionContext): void {
  const output      = vscode.window.createOutputChannel('Lilka');
  const diagnostics = new LilkaDiagnosticProvider();
  const statusBar   = new LilkaStatusBar(context);

  // ── Completion ─────────────────────────────────────────────────────────────
  const completion = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', language: 'lua' },
    new LilkaCompletionProvider(),
    '.',  // trigger on '.'
  );

  // ── Diagnostics ────────────────────────────────────────────────────────────
  if (vscode.window.activeTextEditor) {
    diagnostics.update(vscode.window.activeTextEditor.document);
  }

  const onOpen = vscode.workspace.onDidOpenTextDocument(doc => diagnostics.update(doc));
  const onChange = vscode.workspace.onDidChangeTextDocument(e => diagnostics.update(e.document));
  const onClose = vscode.workspace.onDidCloseTextDocument(doc => diagnostics.clear(doc));

  // ── Commands ───────────────────────────────────────────────────────────────
  const cmdPushUartFile = vscode.commands.registerCommand('lilka.pushUartFile', () =>
    pushUartFile(output).catch(err =>
      vscode.window.showErrorMessage(`Lilka UART: ${err.message}`)
    )
  );

  const cmdPushUartLine = vscode.commands.registerCommand('lilka.pushUartLine', () =>
    pushUartLine(output).catch(err =>
      vscode.window.showErrorMessage(`Lilka UART: ${err.message}`)
    )
  );

  const cmdPushTcp = vscode.commands.registerCommand('lilka.pushTcpFile', () =>
    pushTcpFile(output).catch(() => { /* error shown inside */ })
  );

  const cmdSelectPort = vscode.commands.registerCommand('lilka.selectPort', async () => {
    const current = vscode.workspace.getConfiguration('lilka').get<string>('serialPort', 'COM3');
    const val = await vscode.window.showInputBox({
      prompt: 'Порт UART (напр. COM3 або /dev/ttyUSB0)',
      value: current,
    });
    if (val !== undefined) {
      await vscode.workspace.getConfiguration('lilka').update('serialPort', val, true);
      statusBar.refresh();
    }
  });

  const cmdSetTcpHost = vscode.commands.registerCommand('lilka.setTcpHost', async () => {
    const c = vscode.workspace.getConfiguration('lilka');
    const host = await vscode.window.showInputBox({
      prompt: 'IP-адреса Лілки',
      value: c.get<string>('tcpHost', '192.168.50.168'),
    });
    if (host !== undefined) {
      await c.update('tcpHost', host, true);
      statusBar.refresh();
    }
  });

  // ── Config watcher ─────────────────────────────────────────────────────────
  const onConfig = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('lilka')) { statusBar.refresh(); }
  });

  context.subscriptions.push(
    output,
    completion,
    onOpen, onChange, onClose,
    cmdPushUartFile, cmdPushUartLine, cmdPushTcp,
    cmdSelectPort, cmdSetTcpHost,
    onConfig,
    { dispose: () => diagnostics.dispose() },
  );

  output.appendLine('Lilka Lua Tools активовано.');
}

export function deactivate(): void {}
