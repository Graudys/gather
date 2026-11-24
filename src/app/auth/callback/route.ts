import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/_lib/supabase/server";
import { safeNext } from "@/_lib/server/security";
import { logAccess } from "@/_lib/server/observability";
import { clientIp, shortUserAgent } from "@/_lib/server/request";

// Volta do Google (OAuth com PKCE): troca o código pela sessão.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  if (!code) return NextResponse.redirect(`${base}/entrar?erro=${encodeURIComponent("Login cancelado.")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${base}/entrar?erro=${encodeURIComponent("Não foi possível entrar com o Google.")}`);
  // Google sem e-mail verificado não entra.
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${base}/entrar?erro=${encodeURIComponent("Seu e-mail do Google não está verificado.")}`);
  }
  await logAccess(data.user.id, "LOGIN", "google", await clientIp(), shortUserAgent(req.headers.get("user-agent")));
  return NextResponse.redirect(`${base}${next}`);
}
