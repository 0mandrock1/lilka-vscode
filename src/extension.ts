import * as vscode from 'vscode';
import { LilkaCompletionProvider } from './completion';
import { LilkaDiagnosticProvider } from './diagnostics';
import { pushUartFile, pushUartLine, listPortsQuickPick } from './serial';
import { pushTcpFile } from './tcp';
import { LilkaStatusBar } from './statusbar';
import { LilkaPanel } from './panel';
import { LilkaSidebarProvider } from './sidebar';

export function activate(context: vscode.ExtensionContext): void {
  const output      = vscode.window.createOutputChannel('Lilka');
  const diagnostics = new LilkaDiagnosticProvider();
  const statusBar   = new LilkaStatusBar(context);

  // ── Sidebar ─────────────────────────────────────────────────────────────
  const sidebar = new LilkaSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(LilkaSidebarProvider.viewId, sidebar)
  );

  // ── Completion ───────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'lua' },
      new LilkaCompletionProvider(),
      '.',
    )
  );

  // ── Diagnostics ──────────────────────────────────────────────────────────
  if (vscode.window.activeTextEditor) {
    diagnostics.update(vscode.window.activeTextEditor.document);
  }
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => diagnostics.update(doc)),
    vscode.workspace.onDidChangeTextDocument(e  => diagnostics.update(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => diagnostics.clear(doc)),
    { dispose: () => diagnostics.dispose() },
  );

  // ── Commands ─────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('lilka.pushUartFile', () =>
      pushUartFile(output).catch(err =>
        vscode.window.showErrorMessage(`Lilka UART: ${err.message}`)
      )
    ),
    vscode.commands.registerCommand('lilka.pushUartLine', () =>
      pushUartLine(output).catch(err =>
        vscode.window.showErrorMessage(`Lilka UART: ${err.message}`)
      )
    ),
    vscode.commands.registerCommand('lilka.pushTcpFile', () =>
      pushTcpFile(output).catch(() => {})
    ),
    vscode.commands.registerCommand('lilka.openPanel', () =>
      LilkaPanel.show(context)
    ),
    vscode.commands.registerCommand('lilka.selectPort', async () => {
      const picked = await listPortsQuickPick();
      if (picked) {
        await vscode.workspace.getConfiguration('lilka').update('serialPort', picked, true);
        statusBar.refresh();
        sidebar.refreshSettings();
      }
    }),
    vscode.commands.registerCommand('lilka.setTcpHost', async () => {
      const c = vscode.workspace.getConfiguration('lilka');
      const host = await vscode.window.showInputBox({
        prompt: 'IP-адреса Лілки',
        value:  c.get<string>('tcpHost', '192.168.50.168'),
      });
      if (host !== undefined) {
        await c.update('tcpHost', host, true);
        statusBar.refresh();
        sidebar.refreshSettings();
      }
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('lilka')) {
        statusBar.refresh();
        sidebar.refreshSettings();
      }
    }),
    output,
  );
}

export function deactivate(): void {}
