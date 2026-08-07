function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function rowsToCsv(
  columns: Array<{ key: string; header: string }>,
  rows: Array<Record<string, unknown>>,
): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportTableCsv(
  filename: string,
  columns: Array<{ key: string; header: string }>,
  rows: Array<Record<string, unknown>>,
) {
  downloadCsv(filename, rowsToCsv(columns, rows));
}
