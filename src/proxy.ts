import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Roda antes de cada página:
 * 1. Monta a CSP com um nonce novo por requisição.
 * 2. Sem cookie de sessão em /app, /admin ou /primeiro-acesso → /entrar.
 *    É só um atalho (o cookie nem é conferido aqui): cada página e Server
 *    Action confere a sessão de verdade no banco (src/_lib/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const livekitUrl = process.env.LIVEKIT_URL ?? "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React usa atributo style=; sem nonce para atributos, por isso 'unsafe-inline' só em estilo.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${livekitUrl} ${livekitUrl.replace(/^wss:/, "https:")}`.trim(),
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const path = request.nextUrl.pathname;
  const needsSession = path.startsWith("/app") || path.startsWith("/admin") || path.startsWith("/primeiro-acesso");
  if (needsSession && !getSessionCookie(request, { cookiePrefix: "gather" })) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icons/|api/cron|api/livekit/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
