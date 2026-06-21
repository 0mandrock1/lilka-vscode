import * as vscode from 'vscode';

export class LilkaStatusBar {
  private uartItem: vscode.StatusBarItem;
  private tcpItem:  vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.uartItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    this.tcpItem  = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    this.uartItem.command = 'lilka.selectPort';
    this.tcpItem.command  = 'lilka.setTcpHost';

    context.subscriptions.push(this.uartItem, this.tcpItem);
    this.refresh();
  }

  refresh(): void {
    const c    = vscode.workspace.getConfiguration('lilka');
    const port = c.get<string>('serialPort', 'COM3');
    const host = c.get<string>('tcpHost', '?');

    this.uartItem.text    = `$(plug) ${port}`;
    this.uartItem.tooltip = 'Lilka UART порт (натисни щоб змінити)';
    this.uartItem.show();

    this.tcpItem.text    = `$(radio-tower) ${host}`;
    this.tcpItem.tooltip = 'Lilka TCP host (натисни щоб змінити)';
    this.tcpItem.show();
  }

  dispose(): void {
    this.uartItem.dispose();
    this.tcpItem.dispose();
  }
}
