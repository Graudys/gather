import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { assignablePeople, requireProject, requireTask, teamVisibleTo } from "@/_data/projects.access";
import { byPosition } from "@/lib/position";
import type { BoardView, MyTask, ProjectCard, TaskCard, TaskDetail, TeamRow } from "@/types/domain";

const iso = (d: Date | null) => (d ? d.toISOString() : null);
/** Colunas DATE (início/prazo do projeto) vêm à meia-noite UTC: vira meio-dia em SP para não mostrar o dia anterior. */
const isoDate = (d: Date | null) => (d ? `${d.toISOString().slice(0, 10)}T15:00:00.000Z` : null);

export async function listTeams(workspaceId: string): Promise<TeamRow[]> {
  const { user } = await requireMember(workspaceId);
  const teams = await db.team.findMany({
    where: { workspaceId, ...teamVisibleTo(user.id) },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, description: true, visibility: true,
      members: { select: { user: { select: { id: true, name: true } } }, take: 50 },
      _count: { select: { projects: true } },
    },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    visibility: t.visibility,
    members: t.members.map((m) => m.user),
    projects: t._count.projects,
    isMember: t.members.some((m) => m.user.id === user.id),
  }));
}

export async function listProjects(workspaceId: string, filter: { status?: string; teamId?: string; q?: string } = {}): Promise<ProjectCard[]> {
  const { user } = await requireMember(workspaceId);
  const status = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].includes(filter.status ?? "") ? (filter.status as ProjectCard["status"]) : undefined;
  const rows = await db.project.findMany({
    where: {
      team: { workspaceId, ...teamVisibleTo(user.id), ...(filter.teamId ? { id: filter.teamId } : {}) },
      ...(status ? { status } : { status: { not: "ARCHIVED" } }),
      ...(filter.q?.trim() ? { name: { contains: filter.q.trim().slice(0, 80), mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true, name: true, description: true, status: true, dueDate: true,
      team: { select: { id: true, name: true } },
      members: { select: { user: { select: { id: true, name: true } } }, take: 6 },
      tasks: { select: { completedAt: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    team: p.team,
    dueDate: isoDate(p.dueDate),
    members: p.members.map((m) => m.user),
    openTasks: p.tasks.filter((t) => !t.completedAt).length,
    doneTasks: p.tasks.filter((t) => t.completedAt).length,
  }));
}

const cardSelect = {
  id: true, title: true, description: true, statusId: true, position: true, priority: true, dueAt: true, completedAt: true,
  assignees: { select: { user: { select: { id: true, name: true } } } },
  labelLinks: { select: { label: { select: { id: true, name: true, color: true } } } },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} as const;

type CardRow = {
  id: string; title: string; description: string | null; statusId: string; position: string; priority: TaskCard["priority"];
  dueAt: Date | null; completedAt: Date | null;
  assignees: { user: { id: string; name: string } }[];
  labelLinks: { label: { id: string; name: string; color: string } }[];
  _count: { comments: number };
};

const toCard = (t: CardRow): TaskCard => ({
  id: t.id,
  title: t.title,
  description: t.description,
  statusId: t.statusId,
  position: t.position,
  priority: t.priority,
  dueAt: iso(t.dueAt),
  completed: Boolean(t.completedAt),
  assignees: t.assignees.map((a) => a.user),
  labels: t.labelLinks.map((l) => l.label),
  comments: t._count.comments,
});

export async function getBoard(workspaceId: string, projectId: string): Promise<BoardView> {
  const ctx = await requireProject(workspaceId, projectId);
  const [statuses, tasks, labels, people, channel] = await Promise.all([
    db.taskStatus.findMany({ where: { projectId }, orderBy: { position: "asc" }, select: { id: true, name: true, isCompleted: true } }),
    db.task.findMany({ where: { projectId }, select: cardSelect }),
    db.taskLabel.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    assignablePeople(workspaceId, ctx.project.team),
    db.channel.findFirst({ where: { projectId }, select: { id: true } }),
  ]);
  const p = ctx.project;
  return {
    project: {
      id: p.id, name: p.name, description: p.description, status: p.status,
      startDate: isoDate(p.startDate), dueDate: isoDate(p.dueDate), team: { id: p.team.id, name: p.team.name }, channelId: channel?.id ?? null,
    },
    canManage: ctx.canManage,
    statuses,
    // Ordenado no JavaScript (texto simples), igual à regra de positionBetween.
    tasks: tasks.map(toCard).sort(byPosition),
    people,
    labels,
  };
}

export async function getTaskDetail(workspaceId: string, taskId: string): Promise<TaskDetail> {
  const ctx = await requireTask(workspaceId, taskId);
  const t = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      ...cardSelect,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true } } },
      },
    },
  });
  const activity = await db.activityEvent.findMany({
    where: { entityType: "task", entityId: taskId },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { eventType: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
  });
  return {
    ...toCard(t),
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    canDelete: ctx.canDeleteTask,
    commentList: t.comments.map((c) => ({ id: c.id, author: c.author, content: c.content, createdAt: c.createdAt.toISOString(), mine: c.author?.id === ctx.user.id })),
    activity: activity.map((a) => ({ text: activityText(a.actor?.name ?? "Alguém", a.eventType, a.metadata as Record<string, string>), at: a.createdAt.toISOString() })),
  };
}

function activityText(who: string, type: string, m: Record<string, string>) {
  switch (type) {
    case "task_created": return `${who} criou a tarefa`;
    case "task_moved": return `${who} mudou para ${m.to ?? "outra coluna"}`;
    case "task_assigned": return `${who} mudou os responsáveis`;
    case "task_commented": return `${who} comentou`;
    case "task_edited": return `${who} editou ${m.field ?? "a tarefa"}`;
    default: return `${who} mexeu na tarefa`;
  }
}

/** Minhas tarefas: atribuídas a mim, em projetos que eu ainda vejo, ainda abertas. */
export async function listMyTasks(workspaceId: string): Promise<MyTask[]> {
  const { user } = await requireMember(workspaceId);
  const rows = await db.task.findMany({
    where: {
      completedAt: null,
      assignees: { some: { userId: user.id } },
      project: { status: { in: ["ACTIVE", "PAUSED"] }, team: { workspaceId, ...teamVisibleTo(user.id) } },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
    take: 300,
    select: { id: true, title: true, priority: true, dueAt: true, project: { select: { id: true, name: true } }, status: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, priority: r.priority, dueAt: iso(r.dueAt), project: r.project, status: r.status.name }));
}

/** Para o formulário de novo projeto: equipes que posso usar e pessoas do workspace. */
export async function getNewProjectOptions(workspaceId: string) {
  const { user, workspace } = await requireMember(workspaceId);
  const [teams, people] = await Promise.all([
    db.team.findMany({ where: { workspaceId, ...teamVisibleTo(user.id) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.workspaceMember.findMany({ where: { workspaceId }, orderBy: { user: { name: "asc" } }, select: { user: { select: { id: true, name: true } } } }),
  ]);
  return { personal: workspace.kind === "PERSONAL", teams, people: people.map((p) => p.user), me: user.id };
}

/** Página da equipe (mockup "Equipe"): membros, projetos e canais. */
export async function getTeamView(workspaceId: string, teamId: string) {
  const { user, role } = await requireMember(workspaceId);
  const t = await db.team.findFirst({
    where: { id: teamId, workspaceId, ...teamVisibleTo(user.id) },
    select: {
      id: true, name: true, description: true, visibility: true, slug: true,
      members: { orderBy: [{ role: "asc" }, { joinedAt: "asc" }], select: { role: true, user: { select: { id: true, name: true } } } },
      projects: { where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, status: true } },
      channels: { where: { OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: user.id } } }] }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true, visibility: true } },
    },
  });
  if (!t || t.slug === "geral") return null;
  const mine = t.members.find((m) => m.user.id === user.id);
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    visibility: t.visibility,
    members: t.members.map((m) => ({ ...m.user, admin: m.role === "TEAM_ADMIN" })),
    projects: t.projects,
    channels: t.channels,
    isMember: Boolean(mine),
    canManage: role === "OWNER" || role === "ADMIN" || mine?.role === "TEAM_ADMIN",
  };
}
