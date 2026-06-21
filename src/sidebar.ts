import * as vscode from 'vscode';
import { getWebviewHtml, handleWebviewMessage, currentSettings } from './webview-shared';

export class LilkaSidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'lilka.sidebar';
  private view?: vscode.WebviewView;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html    = getWebviewHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(msg =>
      handleWebviewMessage(msg, m => webviewView.webview.postMessage(m))
    );

    // Push current settings once the view is ready
    webviewView.webview.postMessage(currentSettings());
  }

  refreshSettings(): void {
    this.view?.webview.postMessage(currentSettings());
  }
}
