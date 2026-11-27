import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireProject } from "@/_data/projects.access";
import { computeInsights, type Insights } from "@/lib/insights";

export type ProjectInsightsView = {
  project: { id: string; name: string; status: string; startDate: string | null; dueDate: string | null; teamName: string };
  data: Insights;
};

/** Painel de desempenho: só dono e admin do workspace. Para os outros, a página não existe. */
export async function getProjectInsights(workspaceId: string, projectId: string): Promise<ProjectInsightsView> {
  const ctx = await requireProject(workspaceId, projectId);
  if (!ctx.wsAdmin) notFound();
  const [columns, tasks] = await Promise.all([
    db.taskStatus.findMany({ where: { projectId }, orderBy: { position: "asc" }, select: { id: true, name: true, isCompleted: true } }),
    db.task.findMany({
      where: { projectId },
      select: {
        id: true, title: true, statusId: true, createdAt: true, completedAt: true, dueAt: true, statusChangedAt: true, updatedAt: true,
        assignees: { select: { user: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  const p = ctx.project;
  const data = computeInsights(
    tasks.map((t) => ({ ...t, assignees: t.assignees.map((a) => a.user) })),
    columns,
    { now: new Date(), startDate: p.startDate, dueDate: p.dueDate },
  );
  return {
    project: {
      id: p.id, name: p.name, status: p.status, teamName: p.team.name,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
    },
    data,
  };
}

/** Linha de CSV segura: aspas escapadas e fórmulas neutralizadas (=, +, -, @ no começo). */
export function csvCell(v: string | number | null) {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com uma linha por tarefa (mesma regra de acesso do painel). */
export async function getProjectInsightsCsv(workspaceId: string, projectId: string) {
  const ctx = await requireProject(workspaceId, projectId);
  if (!ctx.wsAdmin) notFound();
  const tasks = await db.task.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      title: true, priority: true, createdAt: true, completedAt: true, dueAt: true,
      status: { select: { name: true } },
      assignees: { select: { user: { select: { name: true } } } },
    },
  });
  const day = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");
  const now = Date.now();
  const sit = (t: (typeof tasks)[number]) => {
    const due = t.dueAt ? t.dueAt.getTime() : null;
    if (t.completedAt) return due === null ? "Concluída" : t.completedAt.getTime() <= due + 86_399_999 ? "Concluída no prazo" : "Concluída com atraso";
    return due !== null && due + 86_399_999 < now ? "Atrasada" : "Aberta";
  };
  const head = ["Tarefa", "Coluna", "Responsáveis", "Prioridade", "Criada", "Prazo", "Concluída", "Situação"];
  const prio = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" } as const;
  const rows = tasks.map((t) => [t.title, t.status.name, t.assignees.map((a) => a.user.name).join(", "), prio[t.priority], day(t.createdAt), day(t.dueAt), day(t.completedAt), sit(t)]);
  const body = [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return { name: ctx.project.name, csv: `﻿${body}\r\n` };
}
