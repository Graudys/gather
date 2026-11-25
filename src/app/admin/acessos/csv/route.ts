import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/_lib/auth/dal";
import { getAccessLogFor, maskIp } from "@/_data/admin-log";
import { toCsv } from "@/_lib/server/csv";
import { dataHora } from "@/lib/format";

// IP completo só quando o motivo registrado é ordem judicial; nos outros casos vai cortado.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || !user.ready) return new NextResponse(null, { status: 404 });
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("pessoa"));
  if (!id.success) return new NextResponse(null, { status: 400 });
  const log = await getAccessLogFor(id.data);
  if (!log) return new NextResponse(null, { status: 403 });
  const body = toCsv(
    ["Quando", "Evento", "Como", "IP", "Aparelho"],
    log.rows.map((r) => [dataHora(r.createdAt.toISOString()), r.event, r.method, log.judicial ? r.ip : maskIp(r.ip), r.userAgent]),
  );
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gather-acessos-${log.person.name.replace(/[^\w]+/g, "-")}.csv"`, "Cache-Control": "no-store" },
  });
}
