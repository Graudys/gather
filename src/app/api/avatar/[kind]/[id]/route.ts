import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { getSessionUser } from "@/_lib/auth/dal";
import { downloadObject, storageConfigured } from "@/_lib/server/storage";
import { sniffImage } from "@/lib/images";

// Sem foto: um pixel transparente (a bolinha com as iniciais fica visível por baixo).
const EMPTY = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const headers = (type: string, maxAge: number) => ({
  "Content-Type": type,
  "Cache-Control": `private, max-age=${maxAge}`,
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
});
const empty = () => new NextResponse(EMPTY, { headers: headers("image/gif", 300) });

/**
 * Foto de perfil (u) ou de workspace (w).
 * - Pessoa: só quem divide algum workspace com ela (ou ela mesma).
 * - Workspace: só membros.
 * Quem não pode ver recebe o mesmo pixel vazio (não revela se a foto existe).
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const me = await getSessionUser();
  if (!me) return new NextResponse(null, { status: 401 });
  const { kind, id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || (kind !== "u" && kind !== "w")) return empty();

  let path: string | null = null;
  if (kind === "u") {
    const allowed = id === me.id || (await db.workspaceMember.findFirst({ where: { userId: id, workspace: { members: { some: { userId: me.id } } } }, select: { userId: true } }));
    if (allowed) path = (await db.user.findUnique({ where: { id }, select: { image: true } }))?.image ?? null;
    if (path && !path.startsWith(`perfil/u/${id}/`)) path = null; // só fotos enviadas pelo app
  } else {
    const ws = await db.workspace.findFirst({ where: { id, members: { some: { userId: me.id } } }, select: { imagePath: true } });
    path = ws?.imagePath?.startsWith(`perfil/w/${id}/`) ? ws.imagePath : null;
  }
  if (!path || !storageConfigured()) return empty();
  const bytes = await downloadObject(path).catch(() => null);
  const type = bytes ? sniffImage(bytes) : null;
  if (!bytes || !type) return empty();
  // Com ?v=<arquivo> a URL muda quando a foto muda: pode guardar por um dia. Sem ele, 5 minutos.
  const versioned = new URL(req.url).searchParams.has("v");
  return new NextResponse(bytes as unknown as BodyInit, { headers: headers(type, versioned ? 86_400 : 300) });
}
