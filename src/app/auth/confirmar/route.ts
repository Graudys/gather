import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/server/security";
import { logAccess } from "@/lib/server/observability";
import { clientIp, shortUserAgent } from "@/lib/server/request";

const TYPES: EmailOtpType[] = ["signup", "recovery", "email_change", "invite", "magiclink", "email"];

// Links dos e-mails de confirmação e de nova senha (modelo com token_hash).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const next = type === "recovery" ? "/redefinir-senha" : safeNext(url.searchParams.get("next"));

  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(`${base}/entrar?erro=${encodeURIComponent("Link inválido.")}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(`${base}/entrar?erro=${encodeURIComponent("O link venceu ou já foi usado. Peça um novo.")}`);
  }
  await logAccess(data.user.id, "LOGIN", `email_${type}`, await clientIp(), shortUserAgent(req.headers.get("user-agent")));
  return NextResponse.redirect(`${base}${next}`);
}
