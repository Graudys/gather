import { NextResponse, type NextRequest } from "next/server";
import { getProjectInsightsCsv } from "@/_data/insights";
import { id as Id } from "@/lib/validation";

/** CSV do painel de desempenho: uma linha por tarefa. Só dono e admin do workspace. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/projetos/[id]/desempenho">) {
  const { id } = await params;
  const ws = req.nextUrl.searchParams.get("w");
  if (!Id.safeParse(id).success || !Id.safeParse(ws).success) return new NextResponse("Não encontrado.", { status: 404 });
  const { name, csv } = await getProjectInsightsCsv(ws!, id);
  const file = `${name.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "projeto"}-desempenho.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
