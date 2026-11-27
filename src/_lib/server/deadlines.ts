import "server-only";
import { db } from "@/_lib/db/prisma";
import { notify } from "@/_lib/server/notify";
import { dueState, shortDay } from "@/lib/projects";

/**
 * Avisos de prazo das tarefas (sino + aparelho):
 * - "Vence hoje" / "Vence amanhã" (task_due_soon), uma vez por tarefa e prazo;
 * - "Passou do prazo" (task_overdue), uma vez por tarefa e prazo.
 * Vai para quem está responsável; sem responsável, para quem criou.
 * Roda na rotina diária (todos) e quando a pessoa usa o app (só ela).
 * Mudar o prazo cria avisos novos (a chave leva o dia do prazo).
 */
export async function runDeadlineNotices(opts: { userId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const tasks = await db.task.findMany({
    where: {
      completedAt: null,
      status: { isCompleted: false },
      dueAt: { gte: new Date(now.getTime() - 30 * 86_400_000), lt: new Date(now.getTime() + 2 * 86_400_000) },
      project: { status: { in: ["ACTIVE", "PAUSED"] } },
      ...(opts.userId ? { OR: [{ assignees: { some: { userId: opts.userId } } }, { assignees: { none: {} }, createdById: opts.userId }] } : {}),
    },
    select: {
      id: true, title: true, dueAt: true, createdById: true, projectId: true,
      project: { select: { team: { select: { workspaceId: true } } } },
      assignees: { select: { userId: true } },
    },
    take: 500,
  });

  let created = 0;
  for (const t of tasks) {
    const st = dueState(t.dueAt!.toISOString(), false, now);
    if (st !== "late" && st !== "today" && st !== "tomorrow") continue;
    let to = t.assignees.length ? t.assignees.map((a) => a.userId) : t.createdById ? [t.createdById] : [];
    if (opts.userId) to = to.filter((u) => u === opts.userId);
    if (!to.length) continue;

    const type = st === "late" ? "task_overdue" : "task_due_soon";
    const key = `${type}:${t.id}:${t.dueAt!.toISOString().slice(0, 10)}`;
    const already = await db.notification.findMany({ where: { userId: { in: to }, type, payload: { path: ["key"], equals: key } }, select: { userId: true } });
    to = to.filter((u) => !already.some((a) => a.userId === u));
    if (!to.length) continue;

    const ws = t.project.team.workspaceId;
    await notify(to, {
      workspaceId: ws,
      type,
      title: st === "late" ? `Passou do prazo: ${t.title}` : `${st === "today" ? "Vence hoje" : "Vence amanhã"}: ${t.title}`,
      body: st === "late" ? `O prazo era ${shortDay(t.dueAt!.toISOString())}.` : null,
      href: `/app/w/${ws}/p/${t.projectId}?tarefa=${t.id}`,
      key,
    });
    created += to.length;
  }
  return created;
}
