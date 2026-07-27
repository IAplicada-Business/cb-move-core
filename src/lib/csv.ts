// Separador ";" (não ",") porque o Excel em português (Brasil) usa vírgula
// como separador decimal — ao abrir um CSV com "," como delimitador, o
// Excel PT-BR não reconhece as colunas e derrama tudo numa única célula.
const DELIMITER = ";";

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return new RegExp(`["${DELIMITER}\\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(DELIMITER),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(DELIMITER)),
  ].join("\n");
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === DELIMITER) {
        out.push(cur);
        cur = "";
      } else if (c === '"') inQuote = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  // BOM \uFEFF garante que o Excel abra os acentos corretamente como UTF-8.
  const blob = new Blob(["\uFEFF", toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
