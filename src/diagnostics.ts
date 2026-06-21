import * as vscode from 'vscode';

interface LintRule {
  pattern: RegExp;
  message: string;
  severity: vscode.DiagnosticSeverity;
  fix?: string;
}

const RULES: LintRule[] = [
  {
    pattern: /display\.colors\.white/g,
    message: 'display.colors.white не існує в KeiraOS',
    severity: vscode.DiagnosticSeverity.Error,
    fix: 'display.color565(255, 255, 255)',
  },
  {
    pattern: /display\.set_text_bg_color\s*\(/g,
    message: 'display.set_text_bg_color не існує. Щоб затерти текст — малюй fill_rect поверх.',
    severity: vscode.DiagnosticSeverity.Error,
  },
  {
    // draw_line called with 5 args (i.e. has a color arg)
    pattern: /display\.draw_line\s*\([^)]+,[^)]+,[^)]+,[^)]+,[^)]+\)/g,
    message: 'display.draw_line() не приймає аргумент кольору. Для горизонтальних ліній: fill_rect(x, y, w, 1, color). Для пікселів: draw_pixel.',
    severity: vscode.DiagnosticSeverity.Error,
    fix: 'display.fill_rect(x, y, w, 1, color)',
  },
  {
    // math.max or math.min with 2+ args
    pattern: /math\.(max|min)\s*\([^,)]+,[^)]+\)/g,
    message: 'math.max/min не підтримує 2 аргументи в KeiraOS. Використовуй: if a > b then a else b end',
    severity: vscode.DiagnosticSeverity.Error,
  },
  {
    // lilka.draw() without queue_draw — heuristic: function ends without queue_draw
    pattern: /display\.fill_screen\s*\([^)]+\)(?:(?!display\.queue_draw)[^])*?^end/gm,
    message: 'Можливо відсутній display.queue_draw() в lilka.draw().',
    severity: vscode.DiagnosticSeverity.Warning,
  },
  {
    // using .pressed == true instead of .justPressed
    pattern: /\.pressed\s*==\s*true/g,
    message: 'Використовуй .justPressed (натиснута цього кадру) або .pressed (утримується). == true зайве.',
    severity: vscode.DiagnosticSeverity.Information,
  },
];

export class LilkaDiagnosticProvider {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('lilka');
  }

  update(document: vscode.TextDocument): void {
    if (document.languageId !== 'lua') {
      return;
    }

    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos   = document.positionAt(match.index + match[0].length);
        const range    = new vscode.Range(startPos, endPos);

        const diag = new vscode.Diagnostic(range, rule.message, rule.severity);
        diag.source = 'Lilka';
        if (rule.fix) {
          diag.message += `\n→ Замінити на: ${rule.fix}`;
        }
        diagnostics.push(diag);
      }
    }

    this.collection.set(document.uri, diagnostics);
  }

  clear(document: vscode.TextDocument): void {
    this.collection.delete(document.uri);
  }

  dispose(): void {
    this.collection.dispose();
  }
}
