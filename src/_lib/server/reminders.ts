import "server-only";
import { db } from "@/_lib/db/prisma";
import { notify } from "@/_lib/server/notify";
import { localTime } from "@/lib/time";

/**
 * Lembretes de evento ("15 min antes" etc.). Rodam:
 * - a cada minuto pela rotina /api/cron/minuto (pg_cron do Supabase), para todos;
 * - quando a pessoa usa o app, só para ela (garante mesmo sem a rotina).
 * Cada lembrete sai uma vez por pessoa, evento e horário (a chave guarda isso).
 * Preferência "Reuniões e eventos" desligada: o notify não manda.
 */
export async function runEventReminders(opts: { userId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const events = await db.calendarEvent.findMany({
    where: {
      reminderMin: { not: null },
      startsAt: { gt: now, lt: new Date(now.getTime() + 24 * 3600_000 + 60_000) },
      participants: { some: { response: { not: "DECLINED" }, ...(opts.userId ? { userId: opts.userId } : {}) } },
    },
    select: {
      id: true, title: true, startsAt: true, reminderMin: true, workspaceId: true,
      meeting: { select: { id: true } },
      participants: { where: { response: { not: "DECLINED" }, ...(opts.userId ? { userId: opts.userId } : {}) }, select: { userId: true } },
    },
    take: 500,
  });
  let sent = 0;
  for (const e of events) {
    if (e.startsAt.getTime() - e.reminderMin! * 60_000 > now.getTime()) continue; // ainda não é hora
    const key = `reminder:${e.id}:${e.startsAt.toISOString()}`;
    const done = await db.notification.findMany({ where: { type: "event_reminder", userId: { in: e.participants.map((p) => p.userId) }, payload: { path: ["key"], equals: key } }, select: { userId: true } });
    const to = e.participants.map((p) => p.userId).filter((u) => !done.some((d) => d.userId === u));
    if (!to.length) continue;
    const href = e.meeting ? `/app/w/${e.workspaceId}/reuniao/${e.meeting.id}` : `/app/w/${e.workspaceId}/agenda?evento=${e.id}`;
    await notify(to, { workspaceId: e.workspaceId, type: "event_reminder", title: `Às ${localTime(e.startsAt)}: ${e.title}`, body: e.meeting ? "Tem sala de reunião." : null, href, key });
    sent += to.length;
  }
  return sent;
}
