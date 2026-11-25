import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { eventVisibleTo } from "@/_data/agenda.access";
import { teamVisibleTo } from "@/_data/projects.access";
import { closeRoom, livekitConfig } from "@/_lib/server/livekit";
import { monthStart } from "@/lib/time";
import type { MeetingUsage } from "@/types/domain";

/**
 * Regras das reuniões (não são Server Actions: só código do servidor chama).
 * - Quem vê: membro do workspace; se a reunião vem de um evento "só convidados",
 *   só quem vê o evento; se está ligada a um projeto, só quem vê o projeto.
 * - Minutos: cada pessoa conta (4 pessoas × 30 min = 120 min), por mês.
 */

export async function requireMeeting(workspaceId: string, meetingId: string) {
  const ctx = await requireMember(workspaceId);
  const uid = ctx.user.id;
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId,
      AND: [
        { OR: [{ calendarEventId: null }, { calendarEvent: eventVisibleTo(uid) }] },
        { OR: [{ projectId: null }, { project: { team: teamVisibleTo(uid) } }] },
      ],
    },
  });
  if (!meeting) notFound();
  const canEnd = meeting.createdById === uid || ctx.role === "OWNER" || ctx.role === "ADMIN";
  return { ...ctx, meeting, canEnd };
}

/** Saldo de minutos do mês e se reuniões estão ligadas neste workspace. */
export async function meetingUsage(workspaceId: string): Promise<MeetingUsage> {
  const month = new Date(`${monthStart()}T00:00:00Z`);
  const [cfg, settings, usage, global] = await Promise.all([
    db.platformConfig.findUnique({ where: { id: 1 }, select: { callMinutesPerWorkspace: true, callsForAllWorkspaces: true, livekitMonthlyMinutes: true } }),
    db.workspaceSettings.findUnique({ where: { workspaceId }, select: { callsEnabled: true, callMinutesQuota: true } }),
    db.workspaceMeetingUsage.findUnique({ where: { workspaceId_month: { workspaceId, month } }, select: { minutesUsed: true } }),
    db.workspaceMeetingUsage.aggregate({ where: { month }, _sum: { minutesUsed: true } }),
  ]);
  // Teto geral do LiveKit (todos os workspaces juntos): passou, ninguém começa reunião nova.
  const globalLeft = Math.max(0, (cfg?.livekitMonthlyMinutes ?? 5000) - (global._sum.minutesUsed ?? 0));
  const quota = settings?.callMinutesQuota ?? cfg?.callMinutesPerWorkspace ?? 600;
  const used = usage?.minutesUsed ?? 0;
  const next = new Date(month);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return {
    used,
    quota,
    left: Math.min(Math.max(0, quota - used), globalLeft),
    renewsOn: next.toISOString(),
    enabled: Boolean(livekitConfig()) && Boolean(settings?.callsEnabled || cfg?.callsForAllWorkspaces),
  };
}

/** Fecha a presença de alguém e soma os minutos no saldo do mês. */
export async function closeParticipant(participantId: string, at = new Date()) {
  const p = await db.meetingParticipant.findUnique({ where: { id: participantId }, select: { id: true, joinedAt: true, leftAt: true, meeting: { select: { workspaceId: true } } } });
  if (!p || p.leftAt || !p.joinedAt) return;
  // Só fecha se ainda estava aberto (evita contar duas vezes com o webhook).
  const res = await db.meetingParticipant.updateMany({ where: { id: p.id, leftAt: null }, data: { leftAt: at } });
  if (!res.count) return;
  const minutes = Math.max(1, Math.ceil((at.getTime() - p.joinedAt.getTime()) / 60_000));
  const month = new Date(`${monthStart(p.joinedAt)}T00:00:00Z`);
  await db.workspaceMeetingUsage.upsert({
    where: { workspaceId_month: { workspaceId: p.meeting.workspaceId, month } },
    create: { workspaceId: p.meeting.workspaceId, month, minutesUsed: minutes },
    update: { minutesUsed: { increment: minutes } },
  });
}

/** Encerra para todos: fecha presenças, marca ENDED e derruba a sala no LiveKit. */
export async function endMeetingNow(meetingId: string, reason: "HOST_ENDED" | "EMPTY" | "MAX_DURATION" | "QUOTA_EXHAUSTED" | "ADMIN") {
  const m = await db.meeting.findUnique({ where: { id: meetingId }, select: { id: true, status: true, roomKey: true } });
  if (!m || m.status === "ENDED" || m.status === "CANCELLED") return;
  const now = new Date();
  const open = await db.meetingParticipant.findMany({ where: { meetingId, leftAt: null, joinedAt: { not: null } }, select: { id: true } });
  for (const p of open) await closeParticipant(p.id, now);
  const wasLive = m.status === "LIVE";
  await db.meeting.update({
    where: { id: meetingId },
    data: wasLive ? { status: "ENDED", endedAt: now, endReason: reason } : { status: "CANCELLED", endReason: reason },
  });
  await closeRoom(m.roomKey);
}

/**
 * Regras de tempo, conferidas sempre que alguém abre a reunião ou a lista:
 * passou do limite → encerra; ficou vazia por 10 min → encerra.
 */
export async function enforceMeetingLimits(meetingId: string) {
  const m = await db.meeting.findUnique({ where: { id: meetingId }, select: { id: true, status: true, hardEndAt: true, startedAt: true } });
  if (!m || m.status !== "LIVE") return;
  const now = Date.now();
  if (m.hardEndAt && m.hardEndAt.getTime() <= now) return endMeetingNow(m.id, "MAX_DURATION");
  const open = await db.meetingParticipant.count({ where: { meetingId: m.id, leftAt: null } });
  const lastLeft = await db.meetingParticipant.findFirst({ where: { meetingId: m.id }, orderBy: { leftAt: "desc" }, select: { leftAt: true } });
  const idleSince = lastLeft?.leftAt?.getTime() ?? m.startedAt?.getTime() ?? now;
  if (open === 0 && now - idleSince > 10 * 60_000) return endMeetingNow(m.id, "EMPTY");
}
