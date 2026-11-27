import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { notify } from "@/_lib/server/notify";
import { runDeadlineNotices } from "@/_lib/server/deadlines";
import { runNoteExpiryNotices } from "@/_lib/server/notes-expiry";
import { runEventReminders } from "@/_lib/server/reminders";

/**
 * Lembretes de evento são criados "na hora" quando a pessoa usa o app
 * (sem rotina a cada minuto): eventos dela que começam dentro do prazo do
 * lembrete e ainda não avisaram.
 */
// No máximo uma conferência por minuto por pessoa (o sino aparece em toda página).
const lastCheck = new Map<string, number>();

async function createDueReminders(userId: string, force = false) {
  const now = new Date();
  if (!force && now.getTime() - (lastCheck.get(userId) ?? 0) < 60_000) return;
  lastCheck.set(userId, now.getTime());
  if (lastCheck.size > 5000) lastCheck.clear();
  // Prazos de tarefas da pessoa (a rotina diária faz o mesmo para todos).
  await runDeadlineNotices({ userId }).catch((e) => console.error("[prazos] falhou", e));
  // Notas do espaço pessoal perto de vencer (a rotina diária faz o mesmo para todos).
  const personal = await db.workspace.findFirst({ where: { kind: "PERSONAL", createdById: userId }, select: { id: true } });
  if (personal) await runNoteExpiryNotices({ workspaceId: personal.id }).catch((e) => console.error("[notas] falhou", e));
  // Lembretes de evento da pessoa (a rotina de cada minuto faz o mesmo para todos).
  await runEventReminders({ userId }).catch((e) => console.error("[lembretes] falhou", e));
}

export async function unreadCount() {
  const user = await requireReadyUser();
  await createDueReminders(user.id);
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}

export type NotificationItem = Awaited<ReturnType<typeof listNotifications>>[number];

export async function listNotifications(take = 100) {
  const user = await requireReadyUser("/app/notificacoes");
  await createDueReminders(user.id, true);
  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ readAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    take,
    select: { id: true, type: true, title: true, body: true, payload: true, readAt: true, createdAt: true, workspace: { select: { name: true } } },
  });
  return rows.map((n) => {
    const p = n.payload as { href?: string; count?: number };
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: typeof p.href === "string" && p.href.startsWith("/") && !p.href.startsWith("//") ? p.href : "/app",
      count: p.count ?? 1,
      read: Boolean(n.readAt),
      at: n.createdAt.toISOString(),
      workspace: n.workspace?.name ?? null,
    };
  });
}

export { notify };
