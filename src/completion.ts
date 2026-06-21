import * as vscode from 'vscode';
import { LILKA_API, LILKA_LIFECYCLE, TRIGGER_NAMESPACES, ApiEntry } from './lilka-api';

export class LilkaCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const linePrefix = document.lineAt(position).text.slice(0, position.character);

    // Detect which namespace is being typed after '.'
    for (const ns of TRIGGER_NAMESPACES) {
      if (linePrefix.endsWith(ns + '.')) {
        if (ns === 'lilka') {
          return this.toItems(LILKA_LIFECYCLE);
        }
        return this.toItems(LILKA_API.filter(e => e.namespace === ns));
      }
    }

    // Top-level: suggest namespace identifiers
    if (/(?:^|[^.\w])(\w*)$/.test(linePrefix)) {
      const topLevel: vscode.CompletionItem[] = TRIGGER_NAMESPACES.map(ns => {
        const item = new vscode.CompletionItem(ns, vscode.CompletionItemKind.Module);
        item.detail = `Lilka ${ns} module`;
        return item;
      });

      // Also suggest function lilka.xxx skeleton
      const skeleton = new vscode.CompletionItem('lilka-skeleton', vscode.CompletionItemKind.Snippet);
      skeleton.detail = 'Lilka app skeleton';
      skeleton.insertText = new vscode.SnippetString(
        'function lilka.init()\n    display.set_text_size(2)\nend\n\n' +
        'function lilka.update(delta)\n    local s = controller.get_state()\n    if s.up.justPressed then util.exit() end\n    ${1:-- update logic}\nend\n\n' +
        'function lilka.draw()\n    display.fill_screen(display.colors.black)\n    ${2:-- draw}\n    display.queue_draw()\nend\n'
      );
      skeleton.documentation = new vscode.MarkdownString('Повний скелет Lilka програми (init + update + draw).');
      topLevel.push(skeleton);

      return topLevel;
    }

    return [];
  }

  private toItems(entries: ApiEntry[]): vscode.CompletionItem[] {
    return entries.map(e => {
      const item = new vscode.CompletionItem(e.name, e.kind);
      item.detail = e.detail;
      item.documentation = new vscode.MarkdownString(e.doc);
      if (e.snippet) {
        item.insertText = new vscode.SnippetString(e.snippet);
      }
      return item;
    });
  }
}
