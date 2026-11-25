import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDailyCleanup } from "@/_lib/server/cleanup";
import { reportError } from "@/_lib/server/observability";
import { db } from "@/_lib/db/prisma";

// A Vercel chama esta rota no horário do vercel.json, com
// "Authorization: Bearer <CRON_SECRET>". Sem o segredo certo: 401.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const ok = Boolean(secret) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return new NextResponse(null, { status: 401 });

  try {
    const result = await runDailyCleanup();
    // Fica no registro de ações (sem admin): aparece em Admin › Visão geral › Rotinas.
    await db.adminAction.create({ data: { action: "cron_cleanup", reason: "Limpeza diária", metadata: result } });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await reportError({ source: "CRON", message: e instanceof Error ? e.message : String(e), location: "cron diario", stack: e instanceof Error ? e.stack : null });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
