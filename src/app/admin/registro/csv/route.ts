import { NextResponse } from "next/server";
import { getSessionUser } from "@/_lib/auth/dal";
import { listAdminActions } from "@/_data/admin-log";
import { toCsv } from "@/_lib/server/csv";
import { dataHora } from "@/lib/format";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || !user.ready) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const rows = await listAdminActions(url.searchParams.get("tipo") ?? undefined, url.searchParams.get("periodo") ?? undefined, 5000);
  const body = toCsv(["Quando", "Ação", "Alvo", "Motivo", "Quem"], rows.map((r) => [dataHora(r.at), r.action, r.target, r.reason, r.who]));
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="gather-registro-de-acoes.csv"', "Cache-Control": "no-store" },
  });
}
