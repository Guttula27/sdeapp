// Cheap CSV exporter — no dependency, escapes commas / newlines / quotes
// by wrapping the cell in quotes and doubling any internal quotes. Used
// from the Reports page so every grid can be saved for an accountant.

export type CsvRow = Record<string, string | number | null | undefined>;

function escape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function rowsToCsv(rows: CsvRow[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      for (const k of Object.keys(r)) acc.add(k);
      return acc;
    }, new Set()),
  );
  const header = cols.map(escape).join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  return header + '\n' + body;
}

/**
 * Trigger a browser download for the given CSV content. Filename is
 * suffixed with `.csv` if the caller forgot to.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
