import "./helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { NotFound, setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { createProject, moveTask } from "@/_data/projects.actions";
import { csvCell, getProjectInsights, getProjectInsightsCsv } from "@/_data/insights";
import { computeInsights, weekStart, type InsightTask } from "@/lib/insights";

const now = new Date("2026-11-26T15:00:00Z"); // quinta
const d = (s: string) => new Date(`${s}T12:00:00Z`);
const t = (o: Partial<InsightTask> & { id: string }): InsightTask => ({
  title: o.id, statusId: "a", createdAt: d("2026-11-02"), completedAt: null, dueAt: null, statusChangedAt: null, updatedAt: d("2026-11-02"), assignees: [], ...o,
});
const cols = [{ id: "a", name: "A fazer", isCompleted: false }, { id: "z", name: "Concluído", isCompleted: true }];

describe("contas do painel", () => {
  it("semana começa na segunda", () => {
    expect(weekStart(now).toISOString().slice(0, 10)).toBe("2026-11-23");
  });

  it("números, prazo, ritmo, previsão e atenção", () => {
    const ana = { id: "u1", name: "Ana" };
    const tasks = [
      t({ id: "1", statusId: "z", createdAt: d("2026-11-02"), completedAt: d("2026-11-04"), dueAt: d("2026-11-05"), assignees: [ana] }), // no prazo, 2 dias
      t({ id: "2", statusId: "z", createdAt: d("2026-11-02"), completedAt: d("2026-11-12"), dueAt: d("2026-11-10"), assignees: [ana] }), // atrasou, 10 dias
      t({ id: "3", statusId: "z", createdAt: d("2026-11-09"), completedAt: d("2026-11-18") }),
      t({ id: "4", dueAt: d("2026-11-20"), assignees: [ana] }), // atrasada agora (6 dias)
      t({ id: "5", statusChangedAt: d("2026-11-10") }), // parada 16 dias
      t({ id: "6", createdAt: d("2026-11-25"), statusChangedAt: d("2026-11-25") }),
    ];
    const r = computeInsights(tasks, cols, { now, startDate: null, dueDate: d("2026-12-01") });
    expect([r.total, r.done, r.pct]).toEqual([6, 3, 50]);
    expect(r.onTime).toEqual({ ok: 1, of: 2, pct: 50 });
    expect(r.overdue).toEqual({ count: 1, oldestDays: 6 });
    expect(r.avgDays).toBeCloseTo((2 + 10 + 9) / 3, 1);
    expect(r.weeks.map((w) => w.start)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(r.weeks.at(-1)).toMatchObject({ scope: 6, done: 3, created: 1, completed: 0 });
    expect(r.pace).toBe(1); // 3 concluídas nas 3 semanas completas
    expect(r.eta).toBe("2026-12-17"); // 3 restantes a 1/semana
    expect(r.lateBy).toBeGreaterThan(14);
    expect(r.people).toEqual([{ id: "u1", name: "Ana", open: 1, done: 2, overdue: 1, onTimePct: 50 }]);
    expect(r.columns.map((c) => c.count)).toEqual([3, 3]);
    expect(r.attention.map((a) => [a.id, a.kind])).toEqual([["4", "atrasada"], ["5", "parada"]]);
  });

  it("sem tarefas e sem ritmo não quebra", () => {
    const r = computeInsights([], cols, { now, startDate: null, dueDate: null });
    expect([r.total, r.pct, r.avgDays, r.eta, r.onTime.pct]).toEqual([0, 0, null, now.toISOString().slice(0, 10), null]);
    const s = computeInsights([t({ id: "x" })], cols, { now, startDate: null, dueDate: d("2026-12-01") });
    expect([s.pace, s.eta, s.lateBy]).toEqual([0, null, null]);
  });

  it("limita o gráfico a 26 semanas", () => {
    const r = computeInsights([t({ id: "x", createdAt: d("2025-01-01") })], cols, { now, startDate: null, dueDate: null });
    expect(r.weeks).toHaveLength(26);
    expect(r.weeks[0].scope).toBe(1);
  });

  it("CSV neutraliza fórmulas e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('diz "oi"; tchau')).toBe('"diz ""oi""; tchau"');
    expect(csvCell(null)).toBe("");
  });
});

describe("acesso ao painel", () => {
  const dono = randomUUID();
  const membro = randomUUID();
  let ws = "";
  let projectId = "";
  beforeAll(async () => {
    for (const id of [dono, membro]) await db.user.create({ data: { id, name: `D ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
    const r = await createTeamWorkspaceFor(dono, "Painel");
    if (!r.ok) throw new Error("setup");
    ws = r.id;
    await db.workspaceMember.create({ data: { workspaceId: ws, userId: membro, role: "MEMBER" } });
    setSessionUser({ id: dono });
    const f = new FormData();
    f.set("workspaceId", ws);
    f.set("name", "Painel");
    f.set("teamId", "");
    try { await createProject(f); } catch (e) { projectId = (e as { to: string }).to.split("/p/")[1]!.split("?")[0]!; }
  });
  afterAll(async () => {
    await db.workspace.deleteMany({ where: { createdById: dono } });
    await db.user.deleteMany({ where: { id: { in: [dono, membro] } } });
  });

  it("dono vê; membro comum recebe 404 no painel e no CSV; mover grava a coluna", async () => {
    const [first, last] = await db.taskStatus.findMany({ where: { projectId }, orderBy: { position: "asc" }, select: { id: true } }).then((x) => [x[0]!, x.at(-1)!]);
    const task = await db.task.create({ data: { projectId, statusId: first.id, title: "=cmd", position: "a0", createdById: dono } });
    setSessionUser({ id: dono });
    const f = new FormData();
    f.set("workspaceId", ws);
    f.set("taskId", task.id);
    f.set("statusId", last.id);
    await moveTask(f);
    const moved = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(moved.statusChangedAt).not.toBeNull();
    expect(moved.completedAt).not.toBeNull();
    const v = await getProjectInsights(ws, projectId);
    expect([v.data.total, v.data.done]).toEqual([1, 1]);
    const { csv } = await getProjectInsightsCsv(ws, projectId);
    expect(csv).toContain("'=cmd");
    setSessionUser({ id: membro });
    await expect(getProjectInsights(ws, projectId)).rejects.toBeInstanceOf(NotFound);
    await expect(getProjectInsightsCsv(ws, projectId)).rejects.toBeInstanceOf(NotFound);
  });
});
