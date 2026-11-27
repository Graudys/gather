"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember, requireReadyUser } from "@/_lib/auth/dal";
import { hit } from "@/_lib/server/rate-limit";
import { removeObjects, storageConfigured, uploadObject } from "@/_lib/server/storage";
import { MAX_PHOTO_BYTES, sniffImage } from "@/lib/images";
import { isChatIcon } from "@/lib/chat-icons";
import { id as Id } from "@/lib/validation";

/**
 * Fotos de perfil e de workspace. A imagem chega já recortada pelo navegador
 * (256×256). Aqui: tamanho máximo, tipo real pelos bytes (WebP/JPEG/PNG; nunca
 * SVG), nome de arquivo aleatório e pasta fixa por pessoa/workspace.
 */
type Result = { ok: true } | { ok: false; error: "tamanho" | "tipo" | "storage" | "muitas" | "dados" };

async function readPhoto(form: FormData): Promise<{ bytes: Uint8Array; type: string } | Result> {
  const f = form.get("photo");
  if (!(f instanceof Blob) || f.size === 0) return { ok: false, error: "dados" };
  if (f.size > MAX_PHOTO_BYTES) return { ok: false, error: "tamanho" };
  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, error: "tipo" };
  return { bytes, type };
}
const ext = (t: string) => (t === "image/webp" ? "webp" : t === "image/png" ? "png" : "jpg");

export async function setMyPhoto(form: FormData): Promise<Result> {
  const user = await requireReadyUser();
  if (!storageConfigured()) return { ok: false, error: "storage" };
  if (!(await hit("photo", user.id))) return { ok: false, error: "muitas" };
  const r = await readPhoto(form);
  if ("ok" in r) return r;
  const path = `perfil/u/${user.id}/${randomUUID()}.${ext(r.type)}`;
  await uploadObject(path, r.bytes, r.type);
  const before = await db.user.findUnique({ where: { id: user.id }, select: { image: true } });
  await db.user.update({ where: { id: user.id }, data: { image: path } });
  if (before?.image?.startsWith(`perfil/u/${user.id}/`)) await removeObjects([before.image]);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function removeMyPhoto(): Promise<Result> {
  const user = await requireReadyUser();
  const before = await db.user.findUnique({ where: { id: user.id }, select: { image: true } });
  await db.user.update({ where: { id: user.id }, data: { image: null } });
  if (before?.image?.startsWith(`perfil/u/${user.id}/`)) await removeObjects([before.image]);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Foto do workspace: dono e admins. */
export async function setWorkspacePhoto(form: FormData): Promise<Result> {
  const ws = Id.safeParse(form.get("workspaceId"));
  if (!ws.success) return { ok: false, error: "dados" };
  const { user } = await requireMember(ws.data, ["OWNER", "ADMIN"]);
  if (!storageConfigured()) return { ok: false, error: "storage" };
  if (!(await hit("photo", user.id))) return { ok: false, error: "muitas" };
  const r = await readPhoto(form);
  if ("ok" in r) return r;
  const path = `perfil/w/${ws.data}/${randomUUID()}.${ext(r.type)}`;
  await uploadObject(path, r.bytes, r.type);
  const before = await db.workspace.findUnique({ where: { id: ws.data }, select: { imagePath: true } });
  await db.workspace.update({ where: { id: ws.data }, data: { imagePath: path } });
  if (before?.imagePath?.startsWith(`perfil/w/${ws.data}/`)) await removeObjects([before.imagePath]);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Ícone do workspace: emoji da lista, ou nada (volta para a letra). Tira a foto, se tiver. */
export async function setWorkspaceIcon(input: { workspaceId: unknown; icon: unknown }): Promise<Result> {
  const p = z.object({ workspaceId: Id }).safeParse(input);
  if (!p.success) return { ok: false, error: "dados" };
  const icon = input.icon === null || input.icon === "" ? null : isChatIcon(input.icon) ? input.icon : undefined;
  if (icon === undefined) return { ok: false, error: "dados" };
  await requireMember(p.data.workspaceId, ["OWNER", "ADMIN"]);
  const before = await db.workspace.findUnique({ where: { id: p.data.workspaceId }, select: { imagePath: true } });
  await db.workspace.update({ where: { id: p.data.workspaceId }, data: { icon, imagePath: null } });
  if (before?.imagePath?.startsWith(`perfil/w/${p.data.workspaceId}/`)) await removeObjects([before.imagePath]);
  revalidatePath("/app", "layout");
  return { ok: true };
}
