"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { listNotifications } from "@/_data/notifications";

const safe = (href: unknown) => (typeof href === "string" && href.startsWith("/") && !href.startsWith("//") ? href : "/app");

/** Abre o aviso: marca como lido e vai para o lugar dele (só caminhos internos). */
export async function openNotification(form: FormData) {
  const user = await requireReadyUser();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/app/notificacoes");
  const n = await db.notification.findFirst({ where: { id: id.data, userId: user.id }, select: { id: true, payload: true } });
  if (!n) redirect("/app/notificacoes");
  await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  // Sem isto a lista guardada no navegador mostrava o aviso como não lido até o F5.
  revalidatePath("/app", "layout");
  redirect(safe((n.payload as { href?: string }).href));
}

/** Card do sino: os 8 avisos mais recentes (não lidos primeiro) e o total de não lidos. */
export async function recentNotifications() {
  const user = await requireReadyUser();
  const [items, unread] = await Promise.all([listNotifications(8), db.notification.count({ where: { userId: user.id, readAt: null } })]);
  return { items, unread };
}

/** Clique num aviso do card: marca como lido e devolve para onde ir. */
export async function readNotification(id: unknown): Promise<{ href: string }> {
  const user = await requireReadyUser();
  const p = z.uuid().safeParse(id);
  if (!p.success) return { href: "/app/notificacoes" };
  const n = await db.notification.findFirst({ where: { id: p.data, userId: user.id }, select: { id: true, payload: true, readAt: true } });
  if (!n) return { href: "/app/notificacoes" };
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
  return { href: safe((n.payload as { href?: string }).href) };
}

export async function markAllRead() {
  const user = await requireReadyUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
}

export async function clearRead() {
  const user = await requireReadyUser();
  await db.notification.deleteMany({ where: { userId: user.id, readAt: { not: null } } });
  revalidatePath("/app", "layout");
}
