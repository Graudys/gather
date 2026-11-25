import type { NextConfig } from "next";

// Cabeçalhos fixos de segurança. A CSP com nonce é montada em src/proxy.ts,
// porque precisa de um valor novo a cada requisição.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Raiz do projeto fixa: evita o Turbopack pegar um package-lock.json de fora da pasta.
  turbopack: { root: process.cwd() },
  // O app lê a sessão (cookies) em quase toda página; sem Cache Components
  // cada página autenticada é dinâmica e não precisa de <Suspense> em volta.
  cacheComponents: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Service worker: sempre a versão nova (sem cache do navegador), só scripts do próprio site.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
