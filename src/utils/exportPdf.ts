function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
}

/**
 * Génère un PDF à partir de données tabulaires via la fenêtre d'impression
 * du navigateur (option « Enregistrer au format PDF »). Cette approche
 * gère nativement les accents et caractères spéciaux du français.
 */
export function exportTableToPdf({ title, subtitle, columns, rows }: PdfTableOptions): void {
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const headerCells = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
  .header { border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #555; margin: 0; }
  .meta { font-size: 12px; color: #777; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f2f2f2; font-weight: 600; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print {
    body { padding: 0; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    <p class="meta">Généré le ${escapeHtml(dateStr)}</p>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 300); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  // Repli si la fenêtre pop-up est bloquée : impression via une iframe masquée.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}