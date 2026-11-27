import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { getSessionUser } from "@/_lib/auth/dal";
import { notesInWarning, noteMonths } from "@/_data/notes";
import { dataHora } from "@/lib/format";

/**
 * Baixar as notas em Markdown (.md): todas, um caderno (?c=) ou só as que
 * estão vencendo (?f=vencendo). Só a dona/o dono do espaço pessoal.
 * Resposta sempre como anexo, sem cache.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const q = new URL(req.url).searchParams;
  const ws = z.uuid().safeParse(q.get("w"));
  const nb = q.get("c") ? z.uuid().safeParse(q.get("c")) : null;
  if (!ws.success || (nb && !nb.success)) return new NextResponse(null, { status: 400 });

  const space = await db.workspace.findFirst({
    where: { id: ws.data, kind: "PERSONAL", members: { some: { userId: user.id, role: "OWNER" } } },
    select: { id: true },
  });
  if (!space) return new NextResponse(null, { status: 404 });

  const only = q.get("f") === "vencendo" ? (await notesInWarning(space.id, await noteMonths(space.id))).map((n) => n.id) : null;
  const books = await db.notebook.findMany({
    where: { workspaceId: space.id, ...(nb?.success ? { id: nb.data } : {}) },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      name: true,
      notes: { where: only ? { id: { in: only } } : {}, orderBy: { updatedAt: "desc" }, select: { title: true, content: true, updatedAt: true, createdAt: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const parts = [`# Notas do Gather\n\nExportado em ${dataHora(new Date().toISOString())}.\n`];
  for (const b of books) {
    if (!b.notes.length) continue;
    parts.push(`\n# ${b.name}\n`);
    for (const n of b.notes) {
      parts.push(`\n## ${n.title || "Sem título"}\n\n_Criada em ${dataHora(n.createdAt.toISOString())} · editada em ${dataHora(n.updatedAt.toISOString())}_\n\n${n.content}\n`);
    }
  }
  const name = `gather-notas-${only ? "vencendo-" : ""}${today}.md`;
  return new NextResponse(parts.join(""), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
