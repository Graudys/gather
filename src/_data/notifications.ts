import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { notify } from "@/_lib/server/notify";
import { localTime } from "@/lib/time";

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
  const me = await db.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
  if ((me?.notifyPrefs as { reunioes?: boolean } | null)?.reunioes === false) return; // desligou lembretes
  const soon = await db.calendarEvent.findMany({
    where: {
      reminderMin: { not: null },
      startsAt: { gt: now, lt: new Date(now.getTime() + 24 * 3600_000 + 60_000) },
      participants: { some: { userId, response: { not: "DECLINED" } } },
    },
    select: { id: true, title: true, startsAt: true, reminderMin: true, workspaceId: true, meeting: { select: { id: true } } },
    take: 50,
  });
  for (const e of soon) {
    if (e.startsAt.getTime() - e.reminderMin! * 60_000 > now.getTime()) continue;
    const key = `reminder:${e.id}:${e.startsAt.toISOString()}`;
    const exists = await db.notification.findFirst({ where: { userId, type: "event_reminder", payload: { path: ["key"], equals: key } }, select: { id: true } });
    if (exists) continue;
    const href = e.meeting ? `/app/w/${e.workspaceId}/reuniao/${e.meeting.id}` : `/app/w/${e.workspaceId}/agenda?evento=${e.id}`;
    // key única por evento+horário: não repete, mesmo depois de lida.
    await db.notification.create({
      data: { userId, workspaceId: e.workspaceId, type: "event_reminder", title: `Às ${localTime(e.startsAt)}: ${e.title}`, body: e.meeting ? "Tem sala de reunião." : null, payload: { href, key } },
    });
  }
}

export async function unreadCount() {
  const user = await requireReadyUser();
  await createDueReminders(user.id);
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}

export async function listNotifications() {
  const user = await requireReadyUser("/app/notificacoes");
  await createDueReminders(user.id, true);
  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
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
