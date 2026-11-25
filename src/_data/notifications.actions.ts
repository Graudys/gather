"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";

/** Abre o aviso: marca como lido e vai para o lugar dele (só caminhos internos). */
export async function openNotification(form: FormData) {
  const user = await requireReadyUser();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/app/notificacoes");
  const n = await db.notification.findFirst({ where: { id: id.data, userId: user.id }, select: { id: true, payload: true } });
  if (!n) redirect("/app/notificacoes");
  await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  const href = (n.payload as { href?: string }).href;
  redirect(typeof href === "string" && href.startsWith("/") && !href.startsWith("//") ? href : "/app");
}

export async function markAllRead() {
  const user = await requireReadyUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
}

export async function clearRead() {
  const user = await requireReadyUser();
  await db.notification.deleteMany({ where: { userId: user.id, readAt: { not: null } } });
  revalidatePath("/app/notificacoes");
}
