import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { getSessionUser } from "@/_lib/auth/dal";
import { downloadObject, storageConfigured } from "@/_lib/server/storage";
import { sniffImage } from "@/lib/images";

/**
 * Foto de dentro de uma nota. Só a dona/o dono do espaço pessoal vê.
 * O id não muda (foto nova = id novo), então pode guardar por um dia.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !storageConfigured()) return new NextResponse(null, { status: 404 });
  const img = await db.noteImage.findFirst({
    where: { id, note: { workspace: { kind: "PERSONAL", members: { some: { userId: me.id, role: "OWNER" } } } } },
    select: { storagePath: true },
  });
  if (!img) return new NextResponse(null, { status: 404 });
  const bytes = await downloadObject(img.storagePath).catch(() => null);
  const type = bytes ? sniffImage(bytes) : null;
  if (!bytes || !type) return new NextResponse(null, { status: 404 });
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
