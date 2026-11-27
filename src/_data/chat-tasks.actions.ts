"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireChannel, requireMessage } from "@/_data/chat.access";
import { requireProject, requireTask, teamVisibleTo } from "@/_data/projects.access";
import { getWorkspaceShell } from "@/_data/chat";
import { hit } from "@/_lib/server/rate-limit";
import { positionBetween } from "@/lib/position";
import { id as Id } from "@/lib/validation";

/**
 * Tarefa no chat:
 * - criar uma tarefa a partir de uma mensagem (o cartão aparece logo depois, na mesma conversa);
 * - mandar uma tarefa para um canal.
 * O cartão mostra o estado atual da tarefa; quem não vê o projeto vê só "tarefa de um projeto privado".
 */
const refresh = (ws: string) => revalidatePath(`/app/w/${ws}`, "layout");

export type TaskTarget = { id: string; name: string; suggested: boolean };

/** Projetos onde a pessoa pode criar a tarefa. O projeto do canal vem primeiro. */
export async function listTaskTargets(input: { workspaceId: unknown; messageId: unknown }): Promise<TaskTarget[]> {
  const p = z.object({ workspaceId: Id, messageId: Id }).safeParse(input);
  if (!p.success) return [];
  const ctx = await requireMessage(p.data.workspaceId, p.data.messageId);
  const channelProject = ctx.message.channelId
    ? (await db.channel.findUnique({ where: { id: ctx.message.channelId }, select: { projectId: true } }))?.projectId ?? null
    : null;
  const projects = await db.project.findMany({
    where: { team: { workspaceId: p.data.workspaceId, ...teamVisibleTo(ctx.user.id) }, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: [{ isFixed: "asc" }, { name: "asc" }],
    take: 100,
    select: { id: true, name: true },
  });
  return projects
    .map((x) => ({ ...x, suggested: x.id === channelProject }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
}

const FromMessage = z.object({
  workspaceId: Id,
  messageId: Id,
  projectId: Id,
  title: z.string().trim().min(1).max(200),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  // Dia escolhido no calendário ("aaaa-mm-dd"); vazio = sem prazo
  dueAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
});

export async function createTaskFromMessage(input: unknown): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const p = FromMessage.safeParse(input);
  if (!p.success) return { ok: false, error: "dados" };
  const { workspaceId, messageId, projectId, title, priority, dueAt } = p.data;
  const ctx = await requireMessage(workspaceId, messageId);
  if (ctx.message.deletedAt) return { ok: false, error: "apagada" };
  const proj = await requireProject(workspaceId, projectId);
  if (!(await hit("tasks", ctx.user.id))) return { ok: false, error: "muitas" };
  const status = await db.taskStatus.findFirst({ where: { projectId: proj.project.id }, orderBy: { position: "asc" }, select: { id: true, isCompleted: true } });
  if (!status) return { ok: false, error: "dados" };
  const src = await db.message.findUniqueOrThrow({
    where: { id: messageId },
    select: { content: true, sender: { select: { name: true } }, channel: { select: { name: true } } },
  });
  const last = await db.task.findMany({ where: { statusId: status.id }, select: { position: true } });
  const where = src.channel ? `no canal ${src.channel.name}` : "numa conversa";
  const description = `Da mensagem de ${src.sender?.name ?? "alguém"} ${where}:\n\n${src.content}`.slice(0, 5000);
  const now = new Date();
  const task = await db.task.create({
    data: {
      projectId: proj.project.id, statusId: status.id, title, description, priority,
      // Meio-dia em SP, igual às outras datas de prazo: não vira o dia anterior em nenhum fuso do Brasil
      dueAt: dueAt ? new Date(`${dueAt}T15:00:00Z`) : null, position: positionBetween(last.map((t) => t.position).sort().at(-1) ?? null, null),
      createdById: ctx.user.id, completedAt: status.isCompleted ? now : null, statusChangedAt: now,
    },
    select: { id: true },
  });
  await db.activityEvent.create({ data: { workspaceId, actorId: ctx.user.id, projectId: proj.project.id, eventType: "task_created", entityType: "task", entityId: task.id, metadata: { from: "message" } } });
  // O cartão entra na mesma conversa (e na mesma thread, se a mensagem era resposta).
  await db.message.create({
    data: {
      workspaceId, channelId: ctx.message.channelId, conversationId: ctx.message.conversationId, parentMessageId: ctx.message.parentMessageId,
      senderId: ctx.user.id, taskId: task.id, content: "Criei uma tarefa a partir desta mensagem.",
    },
  });
  refresh(workspaceId);
  return { ok: true, href: `/app/w/${workspaceId}/p/${proj.project.id}?tarefa=${task.id}` };
}

const ToChannel = z.object({ workspaceId: Id, taskId: Id, channelId: Id, text: z.string().trim().max(500).optional() });

export async function sendTaskToChannel(input: unknown): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const p = ToChannel.safeParse(input);
  if (!p.success) return { ok: false, error: "dados" };
  const { workspaceId, taskId, channelId, text } = p.data;
  const ctx = await requireTask(workspaceId, taskId);
  const ch = await requireChannel(workspaceId, channelId);
  if (!(await hit("chatMessage", ctx.user.id))) return { ok: false, error: "muitas" };
  await db.message.create({ data: { workspaceId, channelId: ch.channel.id, senderId: ctx.user.id, taskId, content: text || "Compartilhei uma tarefa." } });
  refresh(workspaceId);
  return { ok: true, href: `/app/w/${workspaceId}/c/${ch.channel.id}` };
}

/** Canais onde a pessoa pode mandar a tarefa: os mesmos da barra lateral dela. */
export async function listChannelsForTask(input: { workspaceId: unknown }) {
  const p = Id.safeParse(input.workspaceId);
  if (!p.success) return [];
  const shell = await getWorkspaceShell(p.data);
  return shell.channels.map((c) => ({ id: c.id, name: c.name, icon: c.icon, visibility: c.visibility }));
}
