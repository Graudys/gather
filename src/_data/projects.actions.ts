"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { assignablePeople, requireProject, requireTask, teamVisibleTo } from "@/_data/projects.access";
import { makeSlug } from "@/_data/workspaces.server";
import { positionBetween } from "@/lib/position";
import { LABEL_COLORS } from "@/lib/projects";
import { id as Id } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { notify, snippet } from "@/_lib/server/notify";

/**
 * Ações de equipes, projetos e tarefas. Cada uma confere o acesso
 * (projects.access.ts) antes de escrever. Ids do formulário nunca são usados
 * sem essa conferência, e tudo que liga duas coisas (coluna ↔ projeto,
 * etiqueta ↔ projeto, pessoa ↔ workspace) é conferido no banco.
 */

const refresh = (ws: string) => revalidatePath(`/app/w/${ws}`, "layout");
const optId = z.union([Id, z.literal("")]).optional();
const dateStr = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional();
/** Data sem hora → meio-dia em São Paulo (15:00 UTC): não "pula" de dia por fuso. */
const toDate = (d?: string) => (d ? new Date(`${d}T15:00:00Z`) : null);

async function logTask(workspaceId: string, actorId: string, projectId: string, taskId: string, eventType: string, metadata: Record<string, string> = {}) {
  await db.activityEvent.create({ data: { workspaceId, actorId, projectId, eventType, entityType: "task", entityId: taskId, metadata } });
}

// ── Equipes

export async function createTeam(form: FormData) {
  const p = z.object({
    workspaceId: Id,
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).optional(),
    visibility: z.enum(["WORKSPACE", "PRIVATE"]),
    memberIds: z.array(Id).max(100),
    channel: z.literal("on").optional(),
  }).safeParse({ ...Object.fromEntries(form), memberIds: form.getAll("memberIds") });
  if (!p.success) redirect(`/app/w/${String(form.get("workspaceId") ?? "")}/equipes?nova=1&erro=dados`);
  const { workspaceId, name, description, visibility, channel } = p.data!;
  const { user, workspace } = await requireMember(workspaceId);
  if (workspace.kind === "PERSONAL") redirect(`/app/w/${workspaceId}/equipes`);
  const valid = await db.workspaceMember.findMany({ where: { workspaceId, userId: { in: p.data!.memberIds } }, select: { userId: true } });
  const others = valid.map((v) => v.userId).filter((u) => u !== user.id);
  const team = await db.team.create({
    data: {
      workspaceId, name, description: description || null, visibility, slug: makeSlug(name), createdById: user.id,
      members: { create: [{ userId: user.id, role: "TEAM_ADMIN" }, ...others.map((userId) => ({ userId }))] },
    },
    select: { id: true },
  });
  if (channel) {
    let cname = channelSlug(name);
    if (await db.channel.findFirst({ where: { workspaceId, name: cname }, select: { id: true } })) cname = `${cname}-${makeSlug("").slice(-4)}`;
    const isPrivate = visibility === "PRIVATE";
    await db.channel.create({
      data: {
        workspaceId, teamId: team.id, name: cname, kind: "TEAM", visibility: isPrivate ? "PRIVATE" : "PUBLIC", createdById: user.id,
        description: `Canal da equipe ${name}`,
        members: { create: [{ userId: user.id, role: "CHANNEL_MODERATOR" as const }, ...(isPrivate ? others.map((userId) => ({ userId })) : [])] },
      },
    });
  }
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/equipes/${team.id}`);
}

/** Quem pode mexer nos membros da equipe: admin da equipe ou dono/admin do workspace. */
async function requireTeamManager(workspaceId: string, teamId: string) {
  const ctx = await requireMember(workspaceId);
  const team = await db.team.findFirst({
    where: { id: teamId, workspaceId, slug: { not: "geral" }, ...teamVisibleTo(ctx.user.id) },
    select: { id: true, visibility: true, members: { where: { userId: ctx.user.id }, select: { role: true } } },
  });
  const ok = team && (ctx.role !== "MEMBER" || team.members[0]?.role === "TEAM_ADMIN");
  if (!ok) redirect(`/app/w/${workspaceId}/equipes`);
  return { ...ctx, team: team! };
}

export async function addTeamMembers(form: FormData) {
  const p = z.object({ workspaceId: Id, teamId: Id, memberIds: z.array(Id).min(1).max(100) })
    .safeParse({ ...Object.fromEntries(form), memberIds: form.getAll("memberIds") });
  if (!p.success) redirect(`/app/w/${String(form.get("workspaceId") ?? "")}/equipes/${String(form.get("teamId") ?? "")}`);
  const { workspaceId, teamId, memberIds } = p.data!;
  await requireTeamManager(workspaceId, teamId);
  const valid = await db.workspaceMember.findMany({ where: { workspaceId, userId: { in: memberIds } }, select: { userId: true } });
  await db.teamMember.createMany({ data: valid.map((v) => ({ teamId, userId: v.userId })), skipDuplicates: true });
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/equipes/${teamId}`);
}

export async function removeTeamMember(form: FormData) {
  const p = z.object({ workspaceId: Id, teamId: Id, userId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, teamId, userId } = p.data;
  await requireTeamManager(workspaceId, teamId);
  // A equipe não fica sem nenhum admin.
  const admins = await db.teamMember.count({ where: { teamId, role: "TEAM_ADMIN", NOT: { userId } } });
  const target = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
  if (target?.role === "TEAM_ADMIN" && admins === 0) return;
  await db.teamMember.deleteMany({ where: { teamId, userId } });
  refresh(workspaceId);
}

export async function setTeamAdmin(form: FormData) {
  const p = z.object({ workspaceId: Id, teamId: Id, userId: Id, admin: z.enum(["0", "1"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, teamId, userId, admin } = p.data;
  await requireTeamManager(workspaceId, teamId);
  if (admin === "0" && (await db.teamMember.count({ where: { teamId, role: "TEAM_ADMIN", NOT: { userId } } })) === 0) return;
  await db.teamMember.updateMany({ where: { teamId, userId }, data: { role: admin === "1" ? "TEAM_ADMIN" : "TEAM_MEMBER" } });
  refresh(workspaceId);
}

/** Equipe "Geral" escondida, usada quando o projeto não escolhe equipe (e no espaço pessoal). */
async function defaultTeam(workspaceId: string, userId: string) {
  const found = await db.team.findFirst({ where: { workspaceId, slug: "geral" }, select: { id: true, visibility: true } });
  if (found) return found;
  return db.team.create({ data: { workspaceId, name: "Geral", slug: "geral", visibility: "WORKSPACE", createdById: userId }, select: { id: true, visibility: true } });
}

// ── Projetos

function channelSlug(raw: string) {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "projeto";
}

const NewProject = z.object({
  workspaceId: Id,
  name: z.string().trim().min(1).max(80),
  teamId: optId,
  description: z.string().trim().max(500).optional(),
  startDate: dateStr,
  dueDate: dateStr,
  memberIds: z.array(Id).max(100),
  columns: z.array(z.string().trim().max(40)).max(8),
  channel: z.literal("on").optional(),
});

export async function createProject(form: FormData) {
  const p = NewProject.safeParse({ ...Object.fromEntries(form), memberIds: form.getAll("memberIds"), columns: form.getAll("columns") });
  const wsRaw = String(form.get("workspaceId") ?? "");
  if (!p.success) redirect(`/app/w/${wsRaw}/projetos?novo=1&erro=dados`);
  const { workspaceId, name, description, startDate, dueDate, channel } = p.data!;
  const { user } = await requireMember(workspaceId);
  if (startDate && dueDate && startDate > dueDate) redirect(`/app/w/${workspaceId}/projetos?novo=1&erro=datas`);

  // Equipe escolhida precisa ser deste workspace e visível para a pessoa.
  const team = p.data!.teamId
    ? await db.team.findFirst({ where: { id: p.data!.teamId, workspaceId, ...teamVisibleTo(user.id) }, select: { id: true, visibility: true } })
    : await defaultTeam(workspaceId, user.id);
  if (!team) redirect(`/app/w/${workspaceId}/projetos?novo=1&erro=equipe`);

  const allowed = new Set((await assignablePeople(workspaceId, team!)).map((x) => x.id));
  const others = [...new Set(p.data!.memberIds)].filter((u) => u !== user.id && allowed.has(u));
  const columns = p.data!.columns.filter(Boolean);
  const cols = columns.length ? columns : ["A fazer", "Em andamento", "Em revisão", "Concluído"];

  const project = await db.project.create({
    data: {
      teamId: team!.id, name, slug: makeSlug(name), description: description || null,
      startDate: toDate(startDate), dueDate: toDate(dueDate), createdById: user.id,
      members: { create: [{ userId: user.id, role: "PROJECT_ADMIN" }, ...others.map((userId) => ({ userId }))] },
      // A última coluna conta como "concluída".
      taskStatuses: { create: cols.map((n, i) => ({ name: n, position: i, isCompleted: i === cols.length - 1 })) },
    },
    select: { id: true },
  });

  if (channel) {
    let cname = channelSlug(name);
    if (await db.channel.findFirst({ where: { workspaceId, name: cname }, select: { id: true } })) cname = `${cname}-${makeSlug("").slice(-4)}`;
    const isPrivate = team!.visibility === "PRIVATE";
    await db.channel.create({
      data: {
        workspaceId, teamId: team!.id, projectId: project.id, name: cname, kind: "PROJECT",
        visibility: isPrivate ? "PRIVATE" : "PUBLIC", createdById: user.id,
        description: `Canal do projeto ${name}`,
        members: { create: [{ userId: user.id, role: "CHANNEL_MODERATOR" as const }, ...(isPrivate ? others.map((userId) => ({ userId })) : [])] },
      },
    });
  }
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/p/${project.id}`);
}

const ProjectRef = z.object({ workspaceId: Id, projectId: Id });

export async function updateProject(form: FormData) {
  const p = ProjectRef.extend({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
    startDate: dateStr,
    dueDate: dateStr,
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  if (!ctx.canManage) return;
  if (p.data.startDate && p.data.dueDate && p.data.startDate > p.data.dueDate) return;
  await db.project.update({
    where: { id: ctx.project.id },
    data: { name: p.data.name, description: p.data.description || null, status: p.data.status, startDate: toDate(p.data.startDate), dueDate: toDate(p.data.dueDate) },
  });
  refresh(p.data.workspaceId);
}

export async function addColumn(form: FormData) {
  const p = ProjectRef.extend({ name: z.string().trim().min(1).max(40) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  if (!ctx.canManage) return;
  await db.$transaction(async (tx) => {
    const cols = await tx.taskStatus.findMany({ where: { projectId: ctx.project.id }, orderBy: { position: "asc" } });
    if (cols.length >= 12) return;
    // Entra antes da coluna "concluída" (a última), para ela continuar no fim.
    const done = cols.at(-1);
    if (done) await tx.taskStatus.update({ where: { id: done.id }, data: { position: done.position + 1 } });
    await tx.taskStatus.create({ data: { projectId: ctx.project.id, name: p.data.name, position: done ? done.position : 0 } });
  });
  refresh(p.data.workspaceId);
}

export async function renameColumn(form: FormData) {
  const p = ProjectRef.extend({ statusId: Id, name: z.string().trim().min(1).max(40) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  if (!ctx.canManage) return;
  await db.taskStatus.updateMany({ where: { id: p.data.statusId, projectId: ctx.project.id }, data: { name: p.data.name } });
  refresh(p.data.workspaceId);
}

export async function deleteColumn(form: FormData) {
  const p = ProjectRef.extend({ statusId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  if (!ctx.canManage) return;
  const cols = await db.taskStatus.findMany({ where: { projectId: ctx.project.id }, select: { id: true, isCompleted: true, _count: { select: { tasks: true } } } });
  const col = cols.find((c) => c.id === p.data.statusId);
  // Só apaga coluna vazia, nunca a "concluída", e sempre sobra pelo menos duas.
  if (!col || col.isCompleted || col._count.tasks > 0 || cols.length <= 2) return;
  await db.taskStatus.delete({ where: { id: col.id } });
  refresh(p.data.workspaceId);
}

export async function deleteProject(form: FormData) {
  const p = ProjectRef.extend({ confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  if (!ctx.canManage || p.data.confirm.trim() !== ctx.project.name) return;
  await db.project.delete({ where: { id: ctx.project.id } }); // tarefas, colunas e canal vão junto
  refresh(p.data.workspaceId);
  redirect(`/app/w/${p.data.workspaceId}/projetos`);
}

// ── Tarefas

const NewTask = ProjectRef.extend({
  statusId: optId,
  title: z.string().trim().min(1).max(200),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueAt: dateStr,
  description: z.string().trim().max(5000).optional(),
  assigneeIds: z.array(Id).max(20),
  labelIds: z.array(Id).max(20),
});

/** Cria a tarefa (coluna escolhida ou a primeira). Devolve o id, ou null se não deu. */
async function insertTask(form: FormData) {
  const p = NewTask.safeParse({ ...Object.fromEntries(form), assigneeIds: form.getAll("assigneeIds").filter(Boolean), labelIds: form.getAll("labelIds").filter(Boolean) });
  if (!p.success) return null;
  const d = p.data;
  const ctx = await requireProject(d.workspaceId, d.projectId);
  if (!(await hit("tasks", ctx.user.id))) return null;
  const status = d.statusId
    ? await db.taskStatus.findFirst({ where: { id: d.statusId, projectId: ctx.project.id }, select: { id: true, isCompleted: true } })
    : await db.taskStatus.findFirst({ where: { projectId: ctx.project.id }, orderBy: { position: "asc" }, select: { id: true, isCompleted: true } });
  if (!status) return null;
  const last = await db.task.findMany({ where: { statusId: status.id }, select: { position: true } });
  const max = last.map((t) => t.position).sort().at(-1) ?? null;
  const allowed = d.assigneeIds.length ? new Set((await assignablePeople(d.workspaceId, ctx.project.team)).map((x) => x.id)) : new Set<string>();
  const assignees = [...new Set(d.assigneeIds)].filter((u) => allowed.has(u));
  const labels = d.labelIds.length ? await db.taskLabel.findMany({ where: { id: { in: d.labelIds }, projectId: ctx.project.id }, select: { id: true } }) : [];
  const task = await db.task.create({
    data: {
      projectId: ctx.project.id, statusId: status.id, title: d.title, position: positionBetween(max, null),
      priority: d.priority ?? "MEDIUM", dueAt: toDate(d.dueAt), description: d.description || null,
      createdById: ctx.user.id, completedAt: status.isCompleted ? new Date() : null,
      assignees: { create: assignees.map((userId) => ({ userId })) },
      labelLinks: { create: labels.map((l) => ({ labelId: l.id })) },
    },
    select: { id: true },
  });
  await logTask(d.workspaceId, ctx.user.id, ctx.project.id, task.id, "task_created");
  await notify(assignees.filter((u) => u !== ctx.user.id), {
    workspaceId: d.workspaceId, type: "task_assigned",
    title: `${ctx.user.name} te colocou numa tarefa`, body: `${d.title} · ${ctx.project.name}`,
    href: `/app/w/${d.workspaceId}/p/${ctx.project.id}?tarefa=${task.id}`,
  });
  refresh(d.workspaceId);
  return task.id;
}

/** "+ Adicionar tarefa" na coluna do quadro (fica na mesma tela). */
export async function createTask(form: FormData) {
  await insertTask(form);
}

/** Janela "Nova tarefa": volta para onde estava, ou reabre a janela com "Criar outra". */
export async function createTaskFromModal(form: FormData) {
  const back = String(form.get("back") ?? "");
  const safe = back.startsWith("/app/w/") && !back.startsWith("//") ? back : `/app/w/${String(form.get("workspaceId") ?? "")}/tarefas`;
  const id = await insertTask(form);
  const join = safe.includes("?") ? "&" : "?";
  if (!id) redirect(`${safe}${join}nova=1&erro=dados`);
  redirect(form.get("outra") === "on" ? `${safe}${join}nova=1&ok=1` : safe);
}

/** Caixinha de concluir (Minhas tarefas): vai para a coluna "concluída" do projeto, ou volta para a primeira. */
export async function toggleTaskDone(form: FormData) {
  const p = TaskRef.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const done = Boolean(ctx.task.completedAt);
  const target = await db.taskStatus.findFirst({
    where: { projectId: ctx.project.id, isCompleted: !done },
    orderBy: { position: done ? "asc" : "desc" },
    select: { id: true, name: true },
  });
  if (!target) return;
  const last = await db.task.findMany({ where: { statusId: target.id }, select: { position: true } });
  await db.task.update({
    where: { id: ctx.task.id },
    data: { statusId: target.id, position: positionBetween(last.map((t) => t.position).sort().at(-1) ?? null, null), completedAt: done ? null : new Date() },
  });
  await logTask(p.data.workspaceId, ctx.user.id, ctx.project.id, ctx.task.id, "task_moved", { to: target.name });
  refresh(p.data.workspaceId);
}

const TaskRef = z.object({ workspaceId: Id, taskId: Id });

export async function updateTask(form: FormData) {
  const p = TaskRef.extend({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    dueAt: dateStr,
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const { title, description, priority, dueAt } = p.data;
  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (priority !== undefined) data.priority = priority;
  if (form.has("dueAt")) data.dueAt = toDate(dueAt);
  if (!Object.keys(data).length) return;
  await db.task.update({ where: { id: ctx.task.id }, data });
  const field = title !== undefined ? "o título" : description !== undefined ? "a descrição" : priority !== undefined ? "a prioridade" : "o prazo";
  await logTask(p.data.workspaceId, ctx.user.id, ctx.project.id, ctx.task.id, "task_edited", { field });
  refresh(p.data.workspaceId);
}

export async function moveTask(form: FormData) {
  const p = TaskRef.extend({ statusId: Id, beforeId: optId, afterId: optId }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const status = await db.taskStatus.findFirst({ where: { id: p.data.statusId, projectId: ctx.project.id }, select: { id: true, name: true, isCompleted: true } });
  if (!status) return;
  // Vizinhas: precisam ser da mesma coluna. Se não forem, o cartão vai para o fim.
  const neighbors = await db.task.findMany({
    where: { id: { in: [p.data.beforeId, p.data.afterId].filter(Boolean) as string[] }, statusId: status.id },
    select: { id: true, position: true },
  });
  let before = neighbors.find((n) => n.id === p.data.beforeId)?.position ?? null;
  const after = neighbors.find((n) => n.id === p.data.afterId)?.position ?? null;
  if (!before && !after) {
    const rest = await db.task.findMany({ where: { statusId: status.id, id: { not: ctx.task.id } }, select: { position: true } });
    before = rest.map((t) => t.position).sort().at(-1) ?? null;
  }
  const moved = status.id !== ctx.task.statusId;
  await db.task.update({
    where: { id: ctx.task.id },
    data: { statusId: status.id, position: positionBetween(before, after), ...(moved ? { completedAt: status.isCompleted ? new Date() : null } : {}) },
  });
  if (moved) await logTask(p.data.workspaceId, ctx.user.id, ctx.project.id, ctx.task.id, "task_moved", { to: status.name });
  refresh(p.data.workspaceId);
}

export async function setAssignees(form: FormData) {
  const p = TaskRef.extend({ userIds: z.array(Id).max(20) }).safeParse({ ...Object.fromEntries(form), userIds: form.getAll("userIds") });
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const allowed = new Set((await assignablePeople(p.data.workspaceId, ctx.project.team)).map((x) => x.id));
  const ids = [...new Set(p.data.userIds)].filter((u) => allowed.has(u));
  const before = new Set((await db.taskAssignee.findMany({ where: { taskId: ctx.task.id }, select: { userId: true } })).map((a) => a.userId));
  await db.$transaction([
    db.taskAssignee.deleteMany({ where: { taskId: ctx.task.id } }),
    db.taskAssignee.createMany({ data: ids.map((userId) => ({ taskId: ctx.task.id, userId })) }),
  ]);
  await logTask(p.data.workspaceId, ctx.user.id, ctx.project.id, ctx.task.id, "task_assigned");
  await notify(ids.filter((u) => !before.has(u) && u !== ctx.user.id), {
    workspaceId: p.data.workspaceId, type: "task_assigned",
    title: `${ctx.user.name} te colocou numa tarefa`, body: `${ctx.task.title} · ${ctx.project.name}`,
    href: `/app/w/${p.data.workspaceId}/p/${ctx.project.id}?tarefa=${ctx.task.id}`,
  });
  refresh(p.data.workspaceId);
}

export async function setLabels(form: FormData) {
  const p = TaskRef.extend({ labelIds: z.array(Id).max(20) }).safeParse({ ...Object.fromEntries(form), labelIds: form.getAll("labelIds") });
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const valid = await db.taskLabel.findMany({ where: { id: { in: p.data.labelIds }, projectId: ctx.project.id }, select: { id: true } });
  await db.$transaction([
    db.taskLabelLink.deleteMany({ where: { taskId: ctx.task.id } }),
    db.taskLabelLink.createMany({ data: valid.map((l) => ({ taskId: ctx.task.id, labelId: l.id })) }),
  ]);
  refresh(p.data.workspaceId);
}

export async function createLabel(form: FormData) {
  const p = ProjectRef.extend({ name: z.string().trim().min(1).max(30), color: z.enum(LABEL_COLORS), taskId: optId }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireProject(p.data.workspaceId, p.data.projectId);
  const label = await db.taskLabel.upsert({
    where: { projectId_name: { projectId: ctx.project.id, name: p.data.name } },
    create: { projectId: ctx.project.id, name: p.data.name, color: p.data.color },
    update: {},
    select: { id: true },
  });
  // Já marca a etiqueta na tarefa aberta, se for do mesmo projeto.
  if (p.data.taskId) {
    const t = await db.task.findFirst({ where: { id: p.data.taskId, projectId: ctx.project.id }, select: { id: true } });
    if (t) await db.taskLabelLink.upsert({ where: { taskId_labelId: { taskId: t.id, labelId: label.id } }, create: { taskId: t.id, labelId: label.id }, update: {} });
  }
  refresh(p.data.workspaceId);
}

export async function deleteTask(form: FormData) {
  const p = TaskRef.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  if (!ctx.canDeleteTask) return;
  await db.task.delete({ where: { id: ctx.task.id } });
  await db.activityEvent.deleteMany({ where: { entityType: "task", entityId: ctx.task.id } });
  refresh(p.data.workspaceId);
  redirect(`/app/w/${p.data.workspaceId}/p/${ctx.project.id}`);
}

export async function addComment(form: FormData) {
  const p = TaskRef.extend({ content: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  if (!(await hit("chatMessage", ctx.user.id))) return;
  await db.taskComment.create({ data: { taskId: ctx.task.id, authorId: ctx.user.id, content: p.data.content } });
  await logTask(p.data.workspaceId, ctx.user.id, ctx.project.id, ctx.task.id, "task_commented");
  const people = await db.taskAssignee.findMany({ where: { taskId: ctx.task.id }, select: { userId: true } });
  await notify([...people.map((x) => x.userId), ...(ctx.task.createdById ? [ctx.task.createdById] : [])].filter((u) => u !== ctx.user.id), {
    workspaceId: p.data.workspaceId, type: "task_comment", key: `comment:${ctx.task.id}`,
    title: `${ctx.user.name} comentou em “${snippet(ctx.task.title, 50)}”`, body: snippet(p.data.content),
    href: `/app/w/${p.data.workspaceId}/p/${ctx.project.id}?tarefa=${ctx.task.id}`,
  });
  refresh(p.data.workspaceId);
}

export async function deleteComment(form: FormData) {
  const p = TaskRef.extend({ commentId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const c = await db.taskComment.findFirst({ where: { id: p.data.commentId, taskId: ctx.task.id, deletedAt: null }, select: { id: true, authorId: true } });
  if (!c || (c.authorId !== ctx.user.id && !ctx.canManage)) return;
  await db.taskComment.update({ where: { id: c.id }, data: { content: "", deletedAt: new Date() } });
  refresh(p.data.workspaceId);
}
