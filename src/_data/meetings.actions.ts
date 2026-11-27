"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireChannel } from "@/_data/chat.access";
import { requireProject, teamVisibleTo } from "@/_data/projects.access";
import { closeParticipant, endMeetingNow, enforceMeetingLimits, meetingUsage, requireMeeting } from "@/_data/meetings.server";
import { countInRoom, ensureRoom, joinToken, livekitConfig } from "@/_lib/server/livekit";
import { positionBetween } from "@/lib/position";
import { id as Id } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { notify } from "@/_lib/server/notify";

const refresh = (ws: string) => revalidatePath(`/app/w/${ws}`, "layout");

/** "Iniciar reunião agora": cria a sala e (se pedido) avisa num canal. */
export async function startMeetingNow(form: FormData) {
  const p = z.object({
    workspaceId: Id,
    title: z.string().trim().min(1).max(120),
    projectId: z.union([Id, z.literal("")]).optional(),
    channelId: z.union([Id, z.literal("")]).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, title, projectId, channelId } = p.data;
  const { user } = await requireMember(workspaceId);
  const usage = await meetingUsage(workspaceId);
  if (!usage.enabled || usage.left <= 0) redirect(`/app/w/${workspaceId}/reunioes?erro=${usage.enabled ? "cota" : "desligado"}`);
  const project = projectId ? (await requireProject(workspaceId, projectId)).project : null;
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { callMaxParticipants: true, callMaxDurationMin: true } });
  const m = await db.meeting.create({
    data: {
      workspaceId, projectId: project?.id ?? null, createdById: user.id, title, startsAt: new Date(),
      roomKey: crypto.randomUUID(), maxParticipants: cfg?.callMaxParticipants ?? 5, maxDurationMin: cfg?.callMaxDurationMin ?? 60,
    },
    select: { id: true },
  });
  if (channelId) {
    const ch = await requireChannel(workspaceId, channelId); // precisa poder escrever no canal
    await db.message.create({
      data: { workspaceId, channelId: ch.channel.id, senderId: user.id, meetingId: m.id, content: "Abri uma reunião." },
    });
  }
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/reuniao/${m.id}`);
}

export type JoinResult = { ok: true; token: string; url: string; participantId: string; hardEndAt: string } | { ok: false; error: string };

/** Entrar na sala: confere acesso, saldo, vagas e tempo; devolve o token do LiveKit. */
export async function joinMeeting(workspaceId: string, meetingId: string): Promise<JoinResult> {
  if (!Id.safeParse(workspaceId).success || !Id.safeParse(meetingId).success) return { ok: false, error: "dados" };
  await enforceMeetingLimits(meetingId);
  const ctx = await requireMeeting(workspaceId, meetingId);
  const cfg = livekitConfig();
  if (!cfg) return { ok: false, error: "desligado" };
  if (!(await hit("meetingToken", ctx.user.id))) return { ok: false, error: "muitas" };
  const m = ctx.meeting;
  if (m.status === "ENDED" || m.status === "CANCELLED") return { ok: false, error: "encerrada" };
  const usage = await meetingUsage(workspaceId);
  if (!usage.enabled) return { ok: false, error: "desligado" };
  if (usage.left <= 0) return { ok: false, error: "cota" };

  // Vagas: nosso registro e, se der, o próprio LiveKit.
  const open = await db.meetingParticipant.findMany({ where: { meetingId, leftAt: null, joinedAt: { not: null } }, select: { id: true, userId: true } });
  const others = open.filter((o) => o.userId !== ctx.user.id).length;
  const live = await countInRoom(m.roomKey);
  if (Math.max(others, (live ?? 0) - (open.some((o) => o.userId === ctx.user.id) ? 1 : 0)) >= m.maxParticipants) return { ok: false, error: "cheia" };

  const now = new Date();
  let hardEndAt = m.hardEndAt;
  if (m.status === "SCHEDULED") {
    hardEndAt = new Date(now.getTime() + m.maxDurationMin * 60_000);
    await db.meeting.update({ where: { id: m.id }, data: { status: "LIVE", startedAt: now, hardEndAt } });
    await notifyMeetingStarted(workspaceId, m, ctx.user);
  }
  // Uma presença aberta por pessoa: reabrir (outra aba, recarregar) fecha a anterior.
  for (const o of open.filter((x) => x.userId === ctx.user.id)) await closeParticipant(o.id, now);
  const part = await db.meetingParticipant.create({
    data: { meetingId, userId: ctx.user.id, role: m.createdById === ctx.user.id ? "HOST" : "PARTICIPANT", joinedAt: now },
    select: { id: true },
  });
  await ensureRoom(m.roomKey, m.maxParticipants);
  const ttl = Math.ceil(((hardEndAt ?? new Date(now.getTime() + 3600_000)).getTime() - now.getTime()) / 1000);
  const token = await joinToken(m.roomKey, { id: ctx.user.id, name: ctx.user.name }, ttl);
  refresh(workspaceId);
  return { ok: true, token, url: cfg.url, participantId: part.id, hardEndAt: (hardEndAt ?? now).toISOString() };
}

/** Sair: fecha só a presença da própria pessoa. */
export async function leaveMeeting(workspaceId: string, participantId: string) {
  if (!Id.safeParse(workspaceId).success || !Id.safeParse(participantId).success) return;
  const { user } = await requireMember(workspaceId);
  const p = await db.meetingParticipant.findFirst({ where: { id: participantId, userId: user.id, meeting: { workspaceId } }, select: { id: true } });
  if (p) await closeParticipant(p.id);
  refresh(workspaceId);
}

export async function endMeeting(form: FormData) {
  const p = z.object({ workspaceId: Id, meetingId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMeeting(p.data.workspaceId, p.data.meetingId);
  if (!ctx.canEnd) return;
  await endMeetingNow(ctx.meeting.id, "HOST_ENDED");
  refresh(p.data.workspaceId);
  redirect(`/app/w/${p.data.workspaceId}/reuniao/${ctx.meeting.id}`);
}

// ── Notas, decisões e tarefas da reunião

export async function saveNotes(form: FormData) {
  const p = z.object({ workspaceId: Id, meetingId: Id, content: z.string().max(20_000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMeeting(p.data.workspaceId, p.data.meetingId);
  await db.meetingNote.upsert({
    where: { meetingId: ctx.meeting.id },
    create: { meetingId: ctx.meeting.id, content: p.data.content, updatedById: ctx.user.id },
    update: { content: p.data.content, updatedById: ctx.user.id },
  });
  refresh(p.data.workspaceId);
}

export async function addDecision(form: FormData) {
  const p = z.object({ workspaceId: Id, meetingId: Id, text: z.string().trim().min(1).max(300) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMeeting(p.data.workspaceId, p.data.meetingId);
  await db.$transaction(async (tx) => {
    // Trava a linha da nota para duas pessoas não sobrescreverem a lista.
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`notes:${ctx.meeting.id}`}))`;
    const cur = await tx.meetingNote.findUnique({ where: { meetingId: ctx.meeting.id }, select: { decisions: true } });
    const list = Array.isArray(cur?.decisions) ? (cur!.decisions as { text: string; by: string }[]) : [];
    if (list.length >= 50) return;
    const decisions = [...list, { text: p.data.text, by: ctx.user.name }];
    await tx.meetingNote.upsert({
      where: { meetingId: ctx.meeting.id },
      create: { meetingId: ctx.meeting.id, decisions, updatedById: ctx.user.id },
      update: { decisions, updatedById: ctx.user.id },
    });
  });
  refresh(p.data.workspaceId);
}

export async function removeDecision(form: FormData) {
  const p = z.object({ workspaceId: Id, meetingId: Id, index: z.coerce.number().int().min(0).max(49) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMeeting(p.data.workspaceId, p.data.meetingId);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`notes:${ctx.meeting.id}`}))`;
    const cur = await tx.meetingNote.findUnique({ where: { meetingId: ctx.meeting.id }, select: { decisions: true } });
    const list = Array.isArray(cur?.decisions) ? (cur!.decisions as { text: string; by: string }[]) : [];
    list.splice(p.data.index, 1);
    await tx.meetingNote.update({ where: { meetingId: ctx.meeting.id }, data: { decisions: list, updatedById: ctx.user.id } });
  });
  refresh(p.data.workspaceId);
}

export async function createTaskFromMeeting(form: FormData) {
  const p = z.object({ workspaceId: Id, meetingId: Id, projectId: Id, title: z.string().trim().min(1).max(200) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMeeting(p.data.workspaceId, p.data.meetingId);
  const proj = await db.project.findFirst({
    where: { id: p.data.projectId, team: { workspaceId: p.data.workspaceId, ...teamVisibleTo(ctx.user.id) } },
    select: { id: true, taskStatuses: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
  });
  const status = proj?.taskStatuses[0];
  if (!proj || !status) return;
  const last = await db.task.findMany({ where: { statusId: status.id }, select: { position: true } });
  const max = last.map((t) => t.position).sort().at(-1) ?? null;
  const task = await db.task.create({
    data: { projectId: proj.id, statusId: status.id, title: p.data.title, position: positionBetween(max, null), createdById: ctx.user.id, sourceMeetingId: ctx.meeting.id, statusChangedAt: new Date() },
    select: { id: true },
  });
  await db.activityEvent.create({
    data: { workspaceId: p.data.workspaceId, actorId: ctx.user.id, projectId: proj.id, eventType: "task_created", entityType: "task", entityId: task.id, metadata: { from: "meeting" } },
  });
  refresh(p.data.workspaceId);
}

/**
 * "Reunião começou": quando a primeira pessoa entra na sala.
 * Vai para os convidados do evento (menos quem recusou); sem evento, para a
 * equipe ou o projeto da reunião; sem nada disso, para o workspace.
 */
async function notifyMeetingStarted(
  workspaceId: string,
  m: { id: string; title: string; calendarEventId: string | null; teamId: string | null; projectId: string | null },
  by: { id: string; name: string },
) {
  let to: string[];
  if (m.calendarEventId) {
    to = (await db.eventParticipant.findMany({ where: { eventId: m.calendarEventId, response: { not: "DECLINED" } }, select: { userId: true } })).map((p) => p.userId);
  } else if (m.projectId) {
    to = (await db.projectMember.findMany({ where: { projectId: m.projectId }, select: { userId: true } })).map((p) => p.userId);
  } else if (m.teamId) {
    to = (await db.teamMember.findMany({ where: { teamId: m.teamId }, select: { userId: true } })).map((p) => p.userId);
  } else {
    to = (await db.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true }, take: 200 })).map((p) => p.userId);
  }
  await notify(to.filter((u) => u !== by.id), {
    workspaceId, type: "meeting_started", key: `meeting:${m.id}`,
    title: `Começou: ${m.title}`, body: `${by.name} entrou na sala.`, href: `/app/w/${workspaceId}/reuniao/${m.id}`,
  });
}
