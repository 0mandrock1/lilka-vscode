import * as vscode from 'vscode';
import { getWebviewHtml, handleWebviewMessage, currentSettings } from './webview-shared';

export class LilkaSidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'lilka.sidebar';
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(msg =>
      handleWebviewMessage(msg, m => webviewView.webview.postMessage(m))
    );

    webviewView.webview.postMessage(currentSettings());
  }

  refreshSettings(): void {
    this.view?.webview.postMessage(currentSettings());
  }
}
