import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runEventReminders } from "@/_lib/server/reminders";
import { reportError } from "@/_lib/server/observability";

/**
 * Rotina de cada minuto: lembretes de evento na hora certa.
 * A Vercel grátis só agenda uma vez por dia, então quem chama é o pg_cron
 * do Supabase (ver README), com "Authorization: Bearer <CRON_SECRET>".
 * Sem o segredo certo: 401. Só lê e cria avisos; não apaga nada.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const ok = Boolean(secret) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return new NextResponse(null, { status: 401 });
  try {
    const reminders = await runEventReminders();
    return NextResponse.json({ ok: true, reminders }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await reportError({ source: "CRON", message: e instanceof Error ? e.message : String(e), location: "cron minuto", stack: e instanceof Error ? e.stack : null });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
