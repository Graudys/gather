import "server-only";
import { serverEnv } from "@/_lib/server/env";

/**
 * Senha vazada? Consulta o Have I Been Pwned por k-anonymity:
 * só os 5 primeiros caracteres do SHA-1 saem do servidor, nunca a senha.
 * (A proteção do próprio Supabase só existe no plano pago.)
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
    return false; // serviço fora do ar não impede o cadastro
  }
}

/** Confere o CAPTCHA (Cloudflare Turnstile). Sem chave configurada, passa (dev). */
export async function verifyCaptcha(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = serverEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

/** Evita redirecionamento aberto: só caminhos internos. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
