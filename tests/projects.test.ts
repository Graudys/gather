import "./helpers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser, NotFound, Redirect } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { getBoard, getTaskDetail, listMyTasks, listProjects } from "@/_data/projects";
import {
  addComment, createLabel, createProject, createTask, createTeam, deleteColumn, deleteComment, deleteTask, moveTask, setAssignees, setLabels, updateTask,
} from "@/_data/projects.actions";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const dona = randomUUID();
const membro = randomUUID();
const fora = randomUUID(); // tem Gather, não é do workspace
let ws = "";
let outroWs = "";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const as = (id: string) => setSessionUser({ id });
async function to(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  return null;
}

beforeAll(async () => {
  await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  for (const id of [dona, membro, fora]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(dona, "Proj teste");
  const r2 = await createTeamWorkspaceFor(fora, "Outro");
  if (!r.ok || !r2.ok) throw new Error("setup");
  ws = r.id;
  outroWs = r2.id;
  await db.workspaceMember.create({ data: { workspaceId: ws, userId: membro, role: "MEMBER" } });
});

afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, membro, fora] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, membro, fora] } } });
  await db.$disconnect();
});

describe("projetos", () => {
  let projectId = "";
  let col: { id: string; name: string; isCompleted: boolean }[] = [];

  it("cria projeto com colunas, membros e canal", async () => {
    as(dona);
    const url = await to(createProject(form({
      workspaceId: ws, name: "Lançamento v1", teamId: "", description: "MVP", startDate: "2026-12-01", dueDate: "2026-12-20",
      memberIds: [membro, fora], columns: ["A fazer", "Fazendo", "", "Feito"], channel: "on",
    })));
    projectId = url!.split("/p/")[1]!;
    const b = await getBoard(ws, projectId);
    col = b.statuses;
    expect(col.map((c) => c.name)).toEqual(["A fazer", "Fazendo", "Feito"]);
    expect(col.at(-1)?.isCompleted).toBe(true);
    expect(b.project.channelId).not.toBeNull();
    // Quem é de fora do workspace não vira membro do projeto.
    expect(await db.projectMember.count({ where: { projectId, userId: fora } })).toBe(0);
  });

  it("datas invertidas são recusadas", async () => {
    as(dona);
    expect(await to(createProject(form({ workspaceId: ws, name: "X", startDate: "2026-12-10", dueDate: "2026-12-01", memberIds: [], columns: [] })))).toContain("erro=datas");
  });

  it("quem não é do workspace não vê nem mexe", async () => {
    as(fora);
    await expect(getBoard(ws, projectId)).rejects.toBeInstanceOf(NotFound);
    await expect(createTask(form({ workspaceId: ws, projectId, statusId: col[0]!.id, title: "intrusa" }))).rejects.toBeInstanceOf(NotFound);
    // Nem usando o próprio workspace com o projeto dos outros.
    await expect(createTask(form({ workspaceId: outroWs, projectId, statusId: col[0]!.id, title: "intrusa" }))).rejects.toBeInstanceOf(NotFound);
  });

  it("tarefa: criar, mover (conclui), voltar, responsáveis, etiquetas, comentários", async () => {
    as(membro);
    for (const title of ["A", "B", "C"]) await createTask(form({ workspaceId: ws, projectId, statusId: col[0]!.id, title }));
    let b = await getBoard(ws, projectId);
    expect(b.tasks.map((t) => t.title)).toEqual(["A", "B", "C"]);
    const [a, , c] = b.tasks;

    // C vai para o topo (antes de A).
    await moveTask(form({ workspaceId: ws, taskId: c!.id, statusId: col[0]!.id, beforeId: "", afterId: a!.id }));
    b = await getBoard(ws, projectId);
    expect(b.tasks.map((t) => t.title)).toEqual(["C", "A", "B"]);

    // A para "Feito": conta como concluída.
    await moveTask(form({ workspaceId: ws, taskId: a!.id, statusId: col[2]!.id }));
    expect((await db.task.findUniqueOrThrow({ where: { id: a!.id } })).completedAt).not.toBeNull();
    await moveTask(form({ workspaceId: ws, taskId: a!.id, statusId: col[1]!.id }));
    expect((await db.task.findUniqueOrThrow({ where: { id: a!.id } })).completedAt).toBeNull();

    // Coluna de outro projeto não vale.
    const other = await db.taskStatus.create({ data: { projectId: (await db.project.create({ data: { teamId: (await db.project.findUniqueOrThrow({ where: { id: projectId } })).teamId, name: "Outro", slug: `o-${Date.now()}`, createdById: dona } })).id, name: "x", position: 0 } });
    await moveTask(form({ workspaceId: ws, taskId: a!.id, statusId: other.id }));
    expect((await db.task.findUniqueOrThrow({ where: { id: a!.id } })).statusId).toBe(col[1]!.id);

    // Responsáveis: só gente do workspace.
    await setAssignees(form({ workspaceId: ws, taskId: a!.id, userIds: [membro, fora] }));
    expect((await db.taskAssignee.findMany({ where: { taskId: a!.id } })).map((x) => x.userId)).toEqual([membro]);

    await createLabel(form({ workspaceId: ws, projectId, name: "Chat", color: "#5b8cff", taskId: a!.id }));
    expect((await getTaskDetail(ws, a!.id)).labels.map((l) => l.name)).toEqual(["Chat"]);
    await setLabels(form({ workspaceId: ws, taskId: a!.id, labelIds: [] }));
    expect((await getTaskDetail(ws, a!.id)).labels).toHaveLength(0);

    await updateTask(form({ workspaceId: ws, taskId: a!.id, priority: "HIGH", dueAt: "2026-12-05" }));
    await addComment(form({ workspaceId: ws, taskId: a!.id, content: "feito?" }));
    const d = await getTaskDetail(ws, a!.id);
    expect(d.priority).toBe("HIGH");
    expect(d.commentList[0]?.content).toBe("feito?");
    expect(d.activity.length).toBeGreaterThan(2);

    // Minhas tarefas do membro mostra A (aberta, atribuída a ele).
    expect((await listMyTasks(ws)).map((t) => t.title)).toEqual(["A"]);

    // Dona não apaga comentário? Pode (gerencia o projeto). Membro não apaga tarefa da dona.
    as(dona);
    await createTask(form({ workspaceId: ws, projectId, statusId: col[0]!.id, title: "Da dona" }));
    const daDona = await db.task.findFirstOrThrow({ where: { title: "Da dona" } });
    as(membro);
    await deleteTask(form({ workspaceId: ws, taskId: daDona.id }));
    expect(await db.task.count({ where: { id: daDona.id } })).toBe(1);
    as(dona);
    await deleteComment(form({ workspaceId: ws, taskId: a!.id, commentId: d.commentList[0]!.id }));
    expect((await getTaskDetail(ws, a!.id)).commentList).toHaveLength(0);
  });

  it("coluna com tarefa não é apagada", async () => {
    as(dona);
    await deleteColumn(form({ workspaceId: ws, projectId, statusId: col[0]!.id }));
    expect(await db.taskStatus.count({ where: { id: col[0]!.id } })).toBe(1);
  });
});

describe("equipe privada", () => {
  it("projeto de equipe privada some para quem não é da equipe", async () => {
    as(dona);
    await to(createTeam(form({ workspaceId: ws, name: "Jurídico", visibility: "PRIVATE", memberIds: [] })));
    const team = await db.team.findFirstOrThrow({ where: { workspaceId: ws, name: "Jurídico" } });
    const url = await to(createProject(form({ workspaceId: ws, name: "Contratos", teamId: team.id, memberIds: [membro], columns: [], channel: "on" })));
    const pid = url!.split("/p/")[1]!;
    // Membro foi marcado, mas não é da equipe privada: não entra.
    expect(await db.projectMember.count({ where: { projectId: pid, userId: membro } })).toBe(0);
    // O canal do projeto nasce privado.
    expect((await db.channel.findFirstOrThrow({ where: { projectId: pid } })).visibility).toBe("PRIVATE");
    as(membro);
    await expect(getBoard(ws, pid)).rejects.toBeInstanceOf(NotFound);
    expect((await listProjects(ws)).map((p) => p.name)).not.toContain("Contratos");
  });
});
