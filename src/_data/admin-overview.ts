import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import { livekitConfig } from "@/_lib/server/livekit";
import { addDays, localDay, monthStart } from "@/lib/time";

/** Visão geral do admin: só contagens. Nenhum texto de mensagem sai daqui. */
export async function getOverview() {
  await requireAdmin();
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const month = new Date(`${monthStart()}T00:00:00Z`);

  const [people, pending, active7, workspaces, msgs7, msgsPrev7, meetings30, usage, cfg, dbSize, lastCleanup, errors, activeDays, topWs] = await Promise.all([
    db.user.count({ where: { banned: false } }),
    db.user.count({ where: { banned: false, mustChangePassword: true } }),
    db.accessLog.findMany({ where: { event: "LOGIN", createdAt: { gte: d7 }, userId: { not: null } }, distinct: ["userId"], select: { userId: true } }),
    db.workspace.count({ where: { kind: "TEAM" } }),
    db.message.count({ where: { createdAt: { gte: d7 } } }),
    db.message.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
    db.meeting.count({ where: { status: "ENDED", endedAt: { gte: d30 } } }),
    db.workspaceMeetingUsage.aggregate({ where: { month }, _sum: { minutesUsed: true } }),
    db.platformConfig.findUnique({ where: { id: 1 }, select: { livekitMonthlyMinutes: true, maintenanceMode: true, callsForAllWorkspaces: true } }),
    db.$queryRaw<{ size: bigint }[]>`select pg_database_size(current_database()) as size`,
    db.adminAction.findFirst({ where: { action: "cron_cleanup" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, metadata: true } }),
    db.errorEvent.count({ where: { status: { in: ["NEW", "REGRESSED"] } } }),
    // Pessoas ativas por dia (quem mandou mensagem ou entrou), últimos 30 dias, no fuso de SP.
    db.$queryRaw<{ day: string; n: bigint }[]>`
      select to_char(d, 'YYYY-MM-DD') as day, count(distinct u) as n from (
        select (created_at at time zone 'America/Sao_Paulo')::date as d, sender_id as u from messages where created_at >= ${d30} and sender_id is not null
        union all
        select (created_at at time zone 'America/Sao_Paulo')::date, user_id from access_logs where created_at >= ${d30} and user_id is not null and event = 'LOGIN'
      ) x group by d order by d`,
    db.$queryRaw<{ id: string; name: string; people: bigint; msgs: bigint }[]>`
      select w.id, w.name,
             (select count(*) from workspace_members m where m.workspace_id = w.id) as people,
             count(msg.id) as msgs
      from workspaces w
      left join messages msg on msg.workspace_id = w.id and msg.created_at >= ${d30}
      where w.kind = 'TEAM'
      group by w.id, w.name
      order by msgs desc
      limit 5`,
  ]);

  const series = new Map(activeDays.map((r) => [r.day, Number(r.n)]));
  const today = localDay(now);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((day) => ({ day, n: series.get(day) ?? 0 }));
  const cleanupMeta = (lastCleanup?.metadata ?? {}) as Record<string, number>;
  return {
    people, pending, active7: active7.length, workspaces,
    msgs7, msgsTrend: msgsPrev7 ? Math.round(((msgs7 - msgsPrev7) / msgsPrev7) * 100) : null,
    meetings30, livekit: { used: usage._sum.minutesUsed ?? 0, cap: cfg?.livekitMonthlyMinutes ?? 5000, configured: Boolean(livekitConfig()) },
    dbBytes: Number(dbSize[0]?.size ?? 0),
    lastCleanup: lastCleanup ? { at: lastCleanup.createdAt.toISOString(), messages: cleanupMeta.messages ?? 0 } : null,
    errors,
    maintenance: Boolean(cfg?.maintenanceMode),
    days,
    topWorkspaces: topWs.map((w) => ({ id: w.id, name: w.name, people: Number(w.people), msgs: Number(w.msgs) })),
  };
}
