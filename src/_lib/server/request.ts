import "server-only";
import { headers } from "next/headers";

/** IP de quem fez a requisição (a Vercel preenche x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || h.get("x-real-ip") || "0.0.0.0";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "0.0.0.0";
}

/** Navegador e sistema resumidos, sem a string inteira (menos dado pessoal). */
export function shortUserAgent(ua: string | null): string {
  if (!ua) return "desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Outro";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Outro";
  return `${browser} · ${os}`;
}

export async function requestUserAgent() {
  return shortUserAgent((await headers()).get("user-agent"));
}

/** Confere se a requisição veio do próprio site (defesa extra contra CSRF em rotas POST). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !app) return false;
  try {
    return new URL(origin).host === new URL(app).host;
  } catch {
    return false;
  }
}
