/**
 * Posição dos cartões no quadro (índice fracionário).
 * Arrastar um cartão gera uma chave "entre" as vizinhas: só ele muda no banco.
 * Só dígitos e letras minúsculas, comparados como texto simples (a < b).
 * Nenhuma chave termina em "0", então sempre existe espaço entre duas.
 */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`posição inválida: ${a} >= ${b}`);
  if (b) {
    // Tira o prefixo comum.
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0]!) : 0;
  const db = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)]!;
  if (b && b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), null);
}

/** Chave entre `before` e `after` (qualquer um pode faltar). */
export function positionBetween(before?: string | null, after?: string | null): string {
  const a = before ?? "";
  const b = after ?? null;
  if (b !== null && a >= b) return midpoint(a, null); // vizinhas fora de ordem: vai para depois de `a`
  return midpoint(a, b);
}

export const byPosition = <T extends { position: string }>(x: T, y: T) => (x.position < y.position ? -1 : x.position > y.position ? 1 : 0);
