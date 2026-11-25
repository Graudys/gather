import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { eventVisibleTo, requireEvent } from "@/_data/agenda.access";
import { teamVisibleTo } from "@/_data/projects.access";
import { addDays } from "@/lib/time";
import type { CalendarItem, EventDetail } from "@/types/domain";

/** Eventos que a pessoa vê entre `fromDay` e `toDay` (aaaa-mm-dd, inclusive) + prazos das tarefas dela. */
export async function listCalendar(workspaceId: string, fromDay: string, toDay: string): Promise<CalendarItem[]> {
  const { user } = await requireMember(workspaceId);
  const from = new Date(`${fromDay}T00:00:00-03:00`);
  const to = new Date(`${addDays(toDay, 1)}T00:00:00-03:00`);
  const [events, tasks] = await Promise.all([
    db.calendarEvent.findMany({
      where: { workspaceId, startsAt: { lt: to }, endsAt: { gt: from }, ...eventVisibleTo(user.id) },
      orderBy: { startsAt: "asc" },
      take: 500,
      select: {
        id: true, title: true, startsAt: true, endsAt: true,
        meeting: { select: { id: true, status: true } },
        participants: { where: { userId: user.id }, select: { response: true } },
      },
    }),
    db.task.findMany({
      where: {
        dueAt: { gte: from, lt: to },
        completedAt: null,
        assignees: { some: { userId: user.id } },
        project: { team: { workspaceId, ...teamVisibleTo(user.id) } },
      },
      take: 300,
      select: { id: true, title: true, dueAt: true, project: { select: { id: true, name: true } } },
    }),
  ]);
  return [
    ...events.map((e) => ({
      kind: "event" as const,
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      hasMeeting: Boolean(e.meeting && e.meeting.status !== "CANCELLED"),
      meetingId: e.meeting?.id ?? null,
      myResponse: e.participants[0]?.response ?? null,
    })),
    ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, dueAt: t.dueAt!.toISOString(), projectId: t.project.id, projectName: t.project.name })),
  ];
}

export async function getEvent(workspaceId: string, eventId: string): Promise<EventDetail> {
  const ctx = await requireEvent(workspaceId, eventId);
  const e = await db.calendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true, title: true, description: true, startsAt: true, endsAt: true, visibility: true, reminderMin: true,
      createdBy: { select: { id: true, name: true } },
      participants: { select: { response: true, user: { select: { id: true, name: true } } } },
      meeting: { select: { id: true, status: true } },
      project: { select: { id: true, name: true } },
    },
  });
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    visibility: e.visibility,
    reminderMin: e.reminderMin,
    createdBy: e.createdBy,
    participants: e.participants.map((p) => ({ ...p.user, response: p.response })),
    meetingId: e.meeting && e.meeting.status !== "CANCELLED" ? e.meeting.id : null,
    project: e.project,
    canEdit: ctx.canEdit,
    myResponse: e.participants.find((p) => p.user.id === ctx.user.id)?.response ?? null,
  };
}

/** Opções do formulário de evento: pessoas e projetos que posso ligar. */
export async function getEventFormOptions(workspaceId: string) {
  const { user, workspace } = await requireMember(workspaceId);
  const [people, projects] = await Promise.all([
    db.workspaceMember.findMany({ where: { workspaceId }, orderBy: { user: { name: "asc" } }, select: { user: { select: { id: true, name: true } } } }),
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] }, team: { workspaceId, ...teamVisibleTo(user.id) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { me: user.id, personal: workspace.kind === "PERSONAL", people: people.map((p) => p.user), projects };
}
