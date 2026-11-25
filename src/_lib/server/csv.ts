import "server-only";

/** CSV com ; (abre direto no Excel em pt-BR). Protege contra fórmula injetada (=, +, -, @). */
export function toCsv(header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let t = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
