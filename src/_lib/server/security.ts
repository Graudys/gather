import "server-only";

/**
 * Senha vazada? Consulta o Have I Been Pwned por k-anonymity:
 * só os 5 primeiros caracteres do SHA-1 saem do servidor, nunca a senha.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hex.slice(0, 5);
  const suffix = hex.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false; // serviço fora do ar não impede a troca de senha
  }
}

/** Evita redirecionamento aberto: só caminhos internos. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Senha temporária: 16 caracteres sem os que confundem (0/O, 1/l/I), em grupos de 4. */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // 256 % 55 != 0: rejeita valores altos para não enviesar.
  let out = "";
  let i = 0;
  while (out.length < 16) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    const b = bytes[i++];
    if (b < 220) out += alphabet[b % 55];
  }
  return out.match(/.{4}/g)!.join("-");
}
