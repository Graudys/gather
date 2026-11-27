import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";

/**
 * Regras de acesso de equipes, projetos e tarefas.
 * - Equipe "do workspace": todo mundo do workspace vê os projetos dela.
 * - Equipe privada: só quem é da equipe vê.
 * - Quem vê o projeto pode criar, mover, editar e comentar tarefas.
 * - Ajustes do projeto (nome, colunas, apagar): admin do projeto, admin da
 *   equipe, quem criou, ou dono/admin do workspace.
 */

export const teamVisibleTo = (userId: string) => ({ OR: [{ visibility: "WORKSPACE" as const }, { members: { some: { userId } } }] });

export async function requireTeam(workspaceId: string, teamId: string) {
  const ctx = await requireMember(workspaceId);
  const team = await db.team.findFirst({
    where: { id: teamId, workspaceId, ...teamVisibleTo(ctx.user.id) },
    select: { id: true, name: true, visibility: true, members: { where: { userId: ctx.user.id }, select: { role: true } } },
  });
  if (!team) notFound();
  return { ...ctx, team };
}

export async function requireProject(workspaceId: string, projectId: string) {
  const ctx = await requireMember(workspaceId);
  const project = await db.project.findFirst({
    where: { id: projectId, team: { workspaceId, ...teamVisibleTo(ctx.user.id) } },
    select: {
      id: true, name: true, description: true, status: true, isFixed: true, startDate: true, dueDate: true, createdById: true,
      team: { select: { id: true, name: true, visibility: true, members: { where: { userId: ctx.user.id }, select: { role: true } } } },
      members: { where: { userId: ctx.user.id }, select: { role: true } },
    },
  });
  if (!project) notFound();
  const wsAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const canManage =
    wsAdmin ||
    project.createdById === ctx.user.id ||
    project.members[0]?.role === "PROJECT_ADMIN" ||
    project.team.members[0]?.role === "TEAM_ADMIN";
  return { ...ctx, project, canManage, wsAdmin };
}

export async function requireTask(workspaceId: string, taskId: string) {
  // Busca só o projeto da tarefa; o acesso é conferido pelo projeto.
  const t = await db.task.findFirst({
    where: { id: taskId, project: { team: { workspaceId } } },
    select: { id: true, projectId: true, createdById: true, statusId: true, title: true, completedAt: true },
  });
  if (!t) notFound();
  const ctx = await requireProject(workspaceId, t.projectId);
  return { ...ctx, task: t, canDeleteTask: ctx.canManage || t.createdById === ctx.user.id };
}

/** Pessoas que podem ser responsáveis: quem vê o projeto (equipe privada = membros da equipe). */
export async function assignablePeople(workspaceId: string, team: { id: string; visibility: "WORKSPACE" | "PRIVATE" }) {
  if (team.visibility === "PRIVATE") {
    const rows = await db.teamMember.findMany({ where: { teamId: team.id }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } });
    return rows.map((r) => r.user);
  }
  const rows = await db.workspaceMember.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } });
  return rows.map((r) => r.user);
}
