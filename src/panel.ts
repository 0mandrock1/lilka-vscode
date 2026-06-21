import * as vscode from 'vscode';
import { getWebviewHtml, handleWebviewMessage, currentSettings } from './webview-shared';

export class LilkaPanel {
  private static instance: LilkaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static show(context: vscode.ExtensionContext): void {
    if (LilkaPanel.instance) {
      LilkaPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    LilkaPanel.instance = new LilkaPanel(context);
  }

  private constructor(context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      'lilkaPanel', 'Lilka',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, context.extensionUri);
    this.panel.webview.postMessage(currentSettings());

    this.panel.webview.onDidReceiveMessage(
      msg => handleWebviewMessage(msg, m => this.panel.webview.postMessage(m)),
      undefined, context.subscriptions
    );
    this.panel.onDidDispose(() => { LilkaPanel.instance = undefined; }, undefined, context.subscriptions);
  }
}
