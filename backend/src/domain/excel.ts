function escapeCell(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** HTML table that Excel opens as a spreadsheet. No extra dependency. */
export function excelTable(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = `<tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr>`;
  const body = rows.map((row) => `<tr>${row.map((value) => `<td>${escapeCell(value)}</td>`).join('')}</tr>`).join('');
  return `<html><head><meta charset="utf-8"></head><body><table>${head}${body}</table></body></html>`;
}
