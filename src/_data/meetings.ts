import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { eventVisibleTo } from "@/_data/agenda.access";
import { teamVisibleTo } from "@/_data/projects.access";
import { enforceMeetingLimits, meetingUsage, requireMeeting } from "@/_data/meetings.server";
import { livekitConfig } from "@/_lib/server/livekit";
import type { MeetingRow, MeetingView } from "@/types/domain";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function listMeetings(workspaceId: string) {
  const { user } = await requireMember(workspaceId);
  const visible = {
    workspaceId,
    AND: [
      { OR: [{ calendarEventId: null }, { calendarEvent: eventVisibleTo(user.id) }] },
      { OR: [{ projectId: null }, { project: { team: teamVisibleTo(user.id) } }] },
    ],
  };
  // Confere tempo das que estão ao vivo antes de listar.
  const live = await db.meeting.findMany({ where: { ...visible, status: "LIVE" }, select: { id: true } });
  for (const m of live) await enforceMeetingLimits(m.id);

  const select = {
    id: true, title: true, status: true, startsAt: true, startedAt: true, endedAt: true,
    project: { select: { id: true, name: true } },
    participants: { select: { user: { select: { id: true, name: true } } }, take: 20 },
    calendarEvent: { select: { participants: { select: { user: { select: { id: true, name: true } } }, take: 8 } } },
    notes: { select: { content: true } },
  } as const;
  const now = new Date();
  const [current, upcoming, past, usage] = await Promise.all([
    db.meeting.findMany({ where: { ...visible, status: "LIVE" }, orderBy: { startedAt: "desc" }, select }),
    db.meeting.findMany({ where: { ...visible, status: "SCHEDULED", startsAt: { gte: new Date(now.getTime() - 2 * 3600_000) } }, orderBy: { startsAt: "asc" }, take: 20, select }),
    db.meeting.findMany({ where: { ...visible, status: "ENDED" }, orderBy: { endedAt: "desc" }, take: 20, select }),
    meetingUsage(workspaceId),
  ]);
  const toRow = (m: (typeof current)[number]): MeetingRow => {
    const people = new Map<string, { id: string; name: string }>();
    for (const p of [...m.participants, ...(m.calendarEvent?.participants ?? [])]) if (p.user) people.set(p.user.id, p.user);
    return {
      id: m.id, title: m.title, status: m.status, startsAt: iso(m.startsAt), startedAt: iso(m.startedAt), endedAt: iso(m.endedAt),
      project: m.project, people: [...people.values()].slice(0, 6), hasNotes: Boolean(m.notes?.content),
    };
  };
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { callMaxParticipants: true, callMaxDurationMin: true } });
  return {
    current: current.map(toRow),
    upcoming: upcoming.map(toRow),
    past: past.map(toRow),
    usage,
    configured: Boolean(livekitConfig()),
    limits: { people: cfg?.callMaxParticipants ?? 5, minutes: cfg?.callMaxDurationMin ?? 60 },
  };
}

export async function getMeetingView(workspaceId: string, meetingId: string): Promise<MeetingView> {
  await enforceMeetingLimits(meetingId);
  const ctx = await requireMeeting(workspaceId, meetingId);
  const m = ctx.meeting;
  const [participants, notes, tasks, project, usage] = await Promise.all([
    db.meetingParticipant.findMany({ where: { meetingId }, select: { joinedAt: true, leftAt: true, user: { select: { id: true, name: true } } } }),
    db.meetingNote.findUnique({ where: { meetingId }, select: { content: true, decisions: true, updatedAt: true } }),
    db.task.findMany({
      where: { sourceMeetingId: meetingId, project: { team: teamVisibleTo(ctx.user.id) } },
      select: { id: true, title: true, projectId: true, priority: true, assignees: { select: { user: { select: { id: true, name: true } } } } },
    }),
    m.projectId ? db.project.findUnique({ where: { id: m.projectId }, select: { id: true, name: true } }) : null,
    meetingUsage(workspaceId),
  ]);
  const now = Date.now();
  const inRoom = new Map<string, { id: string; name: string }>();
  const minutes = new Map<string, { id: string; name: string; minutes: number }>();
  for (const p of participants) {
    if (!p.user || !p.joinedAt) continue;
    if (!p.leftAt) inRoom.set(p.user.id, p.user);
    const end = p.leftAt?.getTime() ?? (m.endedAt?.getTime() ?? now);
    const cur = minutes.get(p.user.id) ?? { ...p.user, minutes: 0 };
    cur.minutes += Math.max(0, Math.round((end - p.joinedAt.getTime()) / 60_000));
    minutes.set(p.user.id, cur);
  }
  return {
    id: m.id,
    title: m.title,
    status: m.status,
    startsAt: iso(m.startsAt),
    startedAt: iso(m.startedAt),
    hardEndAt: iso(m.hardEndAt),
    endedAt: iso(m.endedAt),
    maxParticipants: m.maxParticipants,
    maxDurationMin: m.maxDurationMin,
    project,
    canEnd: ctx.canEnd,
    inRoom: [...inRoom.values()],
    attendance: [...minutes.values()].sort((a, b) => b.minutes - a.minutes),
    notes: {
      content: notes?.content ?? "",
      decisions: Array.isArray(notes?.decisions) ? (notes!.decisions as { text: string; by: string }[]) : [],
      updatedAt: iso(notes?.updatedAt ?? null),
    },
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, projectId: t.projectId, priority: t.priority, assignees: t.assignees.map((a) => a.user) })),
    usage,
    configured: Boolean(livekitConfig()),
  };
}
