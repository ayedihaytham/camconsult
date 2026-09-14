export interface PrintColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ouvre une fenêtre d'impression avec un tableau mis en page proprement
 * (en-tête cabinet, date, sous-titre) puis lance l'impression / export PDF.
 */
export function printTable<T>(opts: {
  title: string;
  subtitle?: string;
  columns: PrintColumn<T>[];
  rows: T[];
}): void {
  const { title, subtitle, columns, rows } = opts;
  const now = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const thead = columns
    .map(
      (c) =>
        `<th style="text-align:${c.align ?? "left"}">${esc(c.header)}</th>`,
    )
    .join("");
  const tbody = rows
    .map(
      (row) =>
        "<tr>" +
        columns
          .map(
            (c) =>
              `<td style="text-align:${c.align ?? "left"}">${esc(
                c.value(row),
              )}</td>`,
          )
          .join("") +
        "</tr>",
    )
    .join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f2c4c; margin: 32px; }
  header { border-bottom: 2px solid #0f2c4c; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: #0e9f6e; }
  h1 { font-size: 20px; margin: 6px 0 2px; }
  .meta { color: #64748b; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { text-transform: uppercase; font-size: 10px; letter-spacing: .04em; color: #64748b; border-bottom: 1px solid #cbd5e1; }
  tr:nth-child(even) td { background: #f8fafc; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: right; }
  @page { margin: 16mm; }
  @media print { body { margin: 0; } }
</style></head><body>
<header>
  <div class="brand">Cabinet Comptable</div>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="meta">${esc(subtitle)}</div>` : ""}
  <div class="meta">Édité le ${esc(now)} — ${rows.length} ligne${
    rows.length > 1 ? "s" : ""
  }</div>
</header>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<footer>Document généré automatiquement.</footer>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) {
    // Popup bloqué : repli sur l'impression de la page courante
    window.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
