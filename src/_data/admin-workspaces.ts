import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import { monthStart } from "@/lib/time";

/** Workspaces de equipe, só com números. Espaços pessoais não aparecem. */
export async function listWorkspacesAdmin(filter: string | undefined) {
  await requireAdmin();
  const month = new Date(`${monthStart()}T00:00:00Z`);
  const rows = await db.$queryRaw<{ id: string; name: string; owner: string | null; people: bigint; last: Date | null; calls: boolean; quota: number | null; used: number | null; suspended: Date | null }[]>`
    select w.id, w.name,
           (select u.name from workspace_members m join users u on u.id = m.user_id where m.workspace_id = w.id and m.role = 'OWNER' limit 1) as owner,
           (select count(*) from workspace_members m where m.workspace_id = w.id) as people,
           (select max(created_at) from messages msg where msg.workspace_id = w.id) as last,
           coalesce(s.calls_enabled, false) as calls, s.call_minutes_quota as quota,
           (select minutes_used from workspace_meeting_usage u where u.workspace_id = w.id and u.month = ${month}::date) as used,
           w.suspended_at as suspended
    from workspaces w left join workspace_settings s on s.workspace_id = w.id
    where w.kind = 'TEAM'
    order by last desc nulls last, w.created_at desc`;
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { callMinutesPerWorkspace: true, callsForAllWorkspaces: true } });
  const d30 = Date.now() - 30 * 86_400_000;
  const all = rows.map((r) => ({
    id: r.id, name: r.name, owner: r.owner ?? "—", people: Number(r.people), last: r.last?.toISOString() ?? null,
    calls: r.calls || Boolean(cfg?.callsForAllWorkspaces), quota: r.quota ?? cfg?.callMinutesPerWorkspace ?? 600, used: r.used ?? 0, suspended: Boolean(r.suspended),
  }));
  if (filter === "reunioes") return all.filter((w) => w.used > 0);
  if (filter === "inativos") return all.filter((w) => !w.last || Date.parse(w.last) < d30);
  if (filter === "suspensos") return all.filter((w) => w.suspended);
  return all;
}

export async function getWorkspaceAdmin(id: string) {
  await requireAdmin();
  const ws = await db.workspace.findFirst({
    where: { id, kind: "TEAM" },
    select: {
      id: true, name: true, createdAt: true, suspendedAt: true,
      settings: { select: { callsEnabled: true, callMinutesQuota: true, messageRetentionMonths: true, fileRetentionHours: true } },
      members: { orderBy: [{ role: "asc" }, { joinedAt: "asc" }], select: { role: true, user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!ws) notFound();
  const d7 = new Date(Date.now() - 7 * 86_400_000);
  const month = new Date(`${monthStart()}T00:00:00Z`);
  const [msgs7, tasks7, usage, cfg, history] = await Promise.all([
    db.message.count({ where: { workspaceId: id, createdAt: { gte: d7 } } }),
    db.task.count({ where: { project: { team: { workspaceId: id } }, createdAt: { gte: d7 } } }),
    db.workspaceMeetingUsage.findUnique({ where: { workspaceId_month: { workspaceId: id, month } }, select: { minutesUsed: true } }),
    db.platformConfig.findUnique({ where: { id: 1 }, select: { callMinutesPerWorkspace: true, callsForAllWorkspaces: true, messageRetentionOptions: true, fileRetentionOptions: true } }),
    db.adminAction.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, reason: true, createdAt: true, admin: { select: { name: true } }, targetUser: { select: { name: true } } },
    }),
  ]);
  return {
    ...ws,
    owner: ws.members.find((m) => m.role === "OWNER")?.user ?? null,
    stats: { people: ws.members.length, msgs7, tasks7, minutes: usage?.minutesUsed ?? 0 },
    defaults: { quota: cfg?.callMinutesPerWorkspace ?? 600, callsForAll: Boolean(cfg?.callsForAllWorkspaces), months: cfg?.messageRetentionOptions ?? [1, 2, 3, 6, 12], hours: cfg?.fileRetentionOptions ?? [24, 168] },
    history: history.map((h) => ({ action: h.action, reason: h.reason, at: h.createdAt.toISOString(), admin: h.admin?.name ?? "Rotina", target: h.targetUser?.name ?? null })),
  };
}
