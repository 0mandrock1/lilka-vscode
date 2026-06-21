import * as vscode from 'vscode';
import { LilkaCompletionProvider } from './completion';
import { LilkaDiagnosticProvider } from './diagnostics';
import { pushUartFile, pushUartLine, listPortsQuickPick } from './serial';
import { pushTcpFile } from './tcp';
import { LilkaStatusBar } from './statusbar';
import { LilkaPanel } from './panel';

export function activate(context: vscode.ExtensionContext): void {
  const output      = vscode.window.createOutputChannel('Lilka');
  const diagnostics = new LilkaDiagnosticProvider();
  const statusBar   = new LilkaStatusBar(context);

  // ── Completion ─────────────────────────────────────────────────────────────
  const completion = vscode.languages.registerCompletionItemProvider(
    { scheme: 'file', language: 'lua' },
    new LilkaCompletionProvider(),
    '.',
  );

  // ── Diagnostics ────────────────────────────────────────────────────────────
  if (vscode.window.activeTextEditor) {
    diagnostics.update(vscode.window.activeTextEditor.document);
  }
  const onOpen   = vscode.workspace.onDidOpenTextDocument(doc => diagnostics.update(doc));
  const onChange = vscode.workspace.onDidChangeTextDocument(e => diagnostics.update(e.document));
  const onClose  = vscode.workspace.onDidCloseTextDocument(doc => diagnostics.clear(doc));

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

  const cmdOpenPanel = vscode.commands.registerCommand('lilka.openPanel', () =>
    LilkaPanel.show(context)
  );

  const cmdSelectPort = vscode.commands.registerCommand('lilka.selectPort', async () => {
    const picked = await listPortsQuickPick();
    if (picked) {
      await vscode.workspace.getConfiguration('lilka').update('serialPort', picked, true);
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
    cmdOpenPanel, cmdSelectPort, cmdSetTcpHost,
    onConfig,
    { dispose: () => diagnostics.dispose() },
  );
}

export function deactivate(): void {}
