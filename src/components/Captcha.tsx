import Script from "next/script";
import { publicEnv } from "@/lib/env";
import { getNonce } from "@/lib/server/nonce";

/** Cloudflare Turnstile. Coloca o campo cf-turnstile-response no formulário. */
export async function Captcha() {
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  const nonce = await getNonce();
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-language="pt-BR" />
    </>
  );
}
