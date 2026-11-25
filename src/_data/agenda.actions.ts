"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireEvent } from "@/_data/agenda.access";
import { teamVisibleTo } from "@/_data/projects.access";
import { endMeetingNow } from "@/_data/meetings.server";
import { fromLocal, localDay } from "@/lib/time";
import { id as Id } from "@/lib/validation";
import { notify } from "@/_lib/server/notify";
import { weekdayShort, localTime } from "@/lib/time";

/**
 * Agenda. Horários digitados são de São Paulo e viram UTC no banco.
 * Convidados precisam ser do workspace; projeto ligado precisa ser visível.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const EventForm = z.object({
  workspaceId: Id,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  date: day,
  start: hhmm,
  end: hhmm,
  visibility: z.enum(["WORKSPACE", "PRIVATE"]),
  reminder: z.enum(["", "10", "60", "1440"]).optional(),
  projectId: z.union([Id, z.literal("")]).optional(),
  participantIds: z.array(Id).max(50),
  meeting: z.literal("on").optional(),
});

function parseEvent(form: FormData) {
  return EventForm.safeParse({ ...Object.fromEntries(form), participantIds: form.getAll("participantIds") });
}

async function checkRefs(workspaceId: string, userId: string, projectId: string | undefined, ids: string[]) {
  const project = projectId
    ? await db.project.findFirst({ where: { id: projectId, team: { workspaceId, ...teamVisibleTo(userId) } }, select: { id: true } })
    : null;
  const valid = await db.workspaceMember.findMany({ where: { workspaceId, userId: { in: ids } }, select: { userId: true } });
  return { projectId: project?.id ?? null, people: valid.map((v) => v.userId).filter((u) => u !== userId) };
}

export async function createEvent(form: FormData) {
  const p = parseEvent(form);
  const ws = String(form.get("workspaceId") ?? "");
  if (!p.success) redirect(`/app/w/${ws}/agenda/novo?erro=dados`);
  const d = p.data!;
  const { user } = await requireMember(d.workspaceId);
  const startsAt = fromLocal(d.date, d.start);
  const endsAt = fromLocal(d.date, d.end);
  if (endsAt <= startsAt) redirect(`/app/w/${d.workspaceId}/agenda/novo?erro=horario`);
  const refs = await checkRefs(d.workspaceId, user.id, d.projectId || undefined, d.participantIds);
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { callMaxParticipants: true, callMaxDurationMin: true } });

  const ev = await db.calendarEvent.create({
    data: {
      workspaceId: d.workspaceId, projectId: refs.projectId, createdById: user.id,
      title: d.title, description: d.description || null, startsAt, endsAt, timezone: "America/Sao_Paulo",
      visibility: d.visibility, reminderMin: d.reminder ? Number(d.reminder) : null,
      participants: { create: [{ userId: user.id, response: "ACCEPTED" }, ...refs.people.map((userId) => ({ userId }))] },
      ...(d.meeting
        ? {
            meeting: {
              create: {
                workspaceId: d.workspaceId, projectId: refs.projectId, createdById: user.id, title: d.title, startsAt,
                roomKey: crypto.randomUUID(), maxParticipants: cfg?.callMaxParticipants ?? 5, maxDurationMin: cfg?.callMaxDurationMin ?? 60,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  await notify(refs.people, {
    workspaceId: d.workspaceId, type: "event_invite",
    title: `${user.name} te convidou: ${d.title}`, body: `${weekdayShort(startsAt)} · ${localTime(startsAt)}`,
    href: `/app/w/${d.workspaceId}/agenda?dia=${d.date}&evento=${ev.id}`,
  });
  revalidatePath(`/app/w/${d.workspaceId}`, "layout");
  redirect(`/app/w/${d.workspaceId}/agenda?dia=${d.date}&evento=${ev.id}`);
}

export async function updateEvent(form: FormData) {
  const p = parseEvent(form);
  const eventId = Id.safeParse(form.get("eventId"));
  if (!p.success || !eventId.success) return;
  const d = p.data;
  const ctx = await requireEvent(d.workspaceId, eventId.data);
  if (!ctx.canEdit) return;
  const startsAt = fromLocal(d.date, d.start);
  const endsAt = fromLocal(d.date, d.end);
  if (endsAt <= startsAt) redirect(`/app/w/${d.workspaceId}/agenda/${eventId.data}/editar?erro=horario`);
  const refs = await checkRefs(d.workspaceId, ctx.user.id, d.projectId || undefined, d.participantIds);
  const creator = (await db.calendarEvent.findUniqueOrThrow({ where: { id: eventId.data }, select: { createdById: true } })).createdById;
  const already = new Set((await db.eventParticipant.findMany({ where: { eventId: eventId.data }, select: { userId: true } })).map((x) => x.userId));

  await db.$transaction(async (tx) => {
    await tx.calendarEvent.update({
      where: { id: eventId.data },
      data: { title: d.title, description: d.description || null, startsAt, endsAt, visibility: d.visibility, reminderMin: d.reminder ? Number(d.reminder) : null, reminderSentAt: null, projectId: refs.projectId },
    });
    // Mantém a resposta de quem continua convidado; tira quem saiu; inclui quem entrou.
    const keep = new Set([...refs.people, ...(creator ? [creator] : [])]);
    await tx.eventParticipant.deleteMany({ where: { eventId: eventId.data, userId: { notIn: [...keep] } } });
    await tx.eventParticipant.createMany({ data: [...keep].map((userId) => ({ eventId: eventId.data, userId })), skipDuplicates: true });
    // A sala acompanha o horário enquanto não começou.
    await tx.meeting.updateMany({ where: { calendarEventId: eventId.data, status: "SCHEDULED" }, data: { title: d.title, startsAt, projectId: refs.projectId } });
  });
  await notify(refs.people.filter((u) => !already.has(u)), {
    workspaceId: d.workspaceId, type: "event_invite",
    title: `${ctx.user.name} te convidou: ${d.title}`, body: `${weekdayShort(startsAt)} · ${localTime(startsAt)}`,
    href: `/app/w/${d.workspaceId}/agenda?dia=${d.date}&evento=${eventId.data}`,
  });
  revalidatePath(`/app/w/${d.workspaceId}`, "layout");
  redirect(`/app/w/${d.workspaceId}/agenda?dia=${d.date}&evento=${eventId.data}`);
}

export async function deleteEvent(form: FormData) {
  const p = z.object({ workspaceId: Id, eventId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireEvent(p.data.workspaceId, p.data.eventId);
  if (!ctx.canEdit) return;
  const date = localDay((await db.calendarEvent.findUniqueOrThrow({ where: { id: p.data.eventId }, select: { startsAt: true } })).startsAt);
  // Sala ainda não usada é cancelada junto; reunião que já aconteceu fica (com as notas).
  if (ctx.event.meeting && ctx.event.meeting.status !== "ENDED") await endMeetingNow(ctx.event.meeting.id, "HOST_ENDED");
  await db.calendarEvent.delete({ where: { id: p.data.eventId } });
  revalidatePath(`/app/w/${p.data.workspaceId}`, "layout");
  redirect(`/app/w/${p.data.workspaceId}/agenda?dia=${date}`);
}

export async function respondEvent(form: FormData) {
  const p = z.object({ workspaceId: Id, eventId: Id, response: z.enum(["ACCEPTED", "DECLINED", "TENTATIVE"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireEvent(p.data.workspaceId, p.data.eventId);
  // Só quem foi convidado responde (em evento do workspace, responder também te inclui).
  await db.eventParticipant.upsert({
    where: { eventId_userId: { eventId: ctx.event.id, userId: ctx.user.id } },
    create: { eventId: ctx.event.id, userId: ctx.user.id, response: p.data.response },
    update: { response: p.data.response },
  });
  revalidatePath(`/app/w/${p.data.workspaceId}`, "layout");
}
