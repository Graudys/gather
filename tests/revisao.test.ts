import "./helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Redirect, setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { addTeamMembers, createProject, createTaskFromModal, createTeam, removeTeamMember, setTeamAdmin, toggleTaskDone } from "@/_data/projects.actions";
import { getTeamView, listMyTasks, listProjects } from "@/_data/projects";
import { updateWorkspace } from "@/_data/members.actions";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const dona = randomUUID();
const lia = randomUUID();
const caio = randomUUID();
let ws = "";
const as = (id: string) => setSessionUser({ id });
const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
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
  for (const id of [dona, lia, caio]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(dona, "Revisão");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.createMany({ data: [{ workspaceId: ws, userId: lia }, { workspaceId: ws, userId: caio }] });
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, lia, caio] } } });
  await db.notification.deleteMany({ where: { userId: { in: [dona, lia, caio] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, lia, caio] } } });
  await db.$disconnect();
});

describe("equipes", () => {
  let team = "";
  it("cria equipe com canal e abre a página dela", async () => {
    as(dona);
    const url = await to(createTeam(form({ workspaceId: ws, name: "Design", visibility: "PRIVATE", memberIds: [lia], channel: "on" })));
    team = url!.split("/equipes/")[1]!;
    expect(url).toBe(`/app/w/${ws}/equipes/${team}`);
    const v = await getTeamView(ws, team);
    expect(v?.members.map((m) => m.id).sort()).toEqual([dona, lia].sort());
    expect(v?.channels).toHaveLength(1);
    expect(v?.canManage).toBe(true);
  });

  it("equipe privada: quem não é membro não vê", async () => {
    as(caio);
    expect(await getTeamView(ws, team)).toBeNull();
  });

  it("membro comum não mexe; admin da equipe adiciona, promove e remove", async () => {
    as(lia);
    expect(await to(addTeamMembers(form({ workspaceId: ws, teamId: team, memberIds: [caio] })))).toBe(`/app/w/${ws}/equipes`);
    as(dona);
    await to(addTeamMembers(form({ workspaceId: ws, teamId: team, memberIds: [caio] })));
    await setTeamAdmin(form({ workspaceId: ws, teamId: team, userId: lia, admin: "1" }));
    await removeTeamMember(form({ workspaceId: ws, teamId: team, userId: caio }));
    const rows = await db.teamMember.findMany({ where: { teamId: team } });
    expect(rows.map((r) => r.userId).sort()).toEqual([dona, lia].sort());
    expect(rows.find((r) => r.userId === lia)?.role).toBe("TEAM_ADMIN");
  });

  it("não deixa a equipe sem admin", async () => {
    as(dona);
    await setTeamAdmin(form({ workspaceId: ws, teamId: team, userId: lia, admin: "0" }));
    await setTeamAdmin(form({ workspaceId: ws, teamId: team, userId: dona, admin: "0" }));
    const admins = await db.teamMember.count({ where: { teamId: team, role: "TEAM_ADMIN" } });
    expect(admins).toBe(1);
  });
});

describe("projetos e tarefas pela janela", () => {
  let project = "";
  it("busca projeto pelo nome", async () => {
    as(dona);
    const url = await to(createProject(form({ workspaceId: ws, name: "Site novo", teamId: "", memberIds: [lia], columns: [] })));
    project = url!.split("/p/")[1]!;
    expect((await listProjects(ws, { q: "site" })).map((p) => p.id)).toEqual([project]);
    expect(await listProjects(ws, { q: "nada disso" })).toHaveLength(0);
  });

  it("nova tarefa com prioridade, prazo e responsável; 'criar outra' reabre", async () => {
    as(dona);
    const back = `/app/w/${ws}/tarefas`;
    const url = await to(createTaskFromModal(form({ workspaceId: ws, back, projectId: project, title: "Revisar textos", priority: "HIGH", dueAt: "2026-12-02", assigneeIds: [dona, lia], outra: "on" })));
    expect(url).toBe(`${back}?nova=1&ok=1`);
    const t = await db.task.findFirstOrThrow({ where: { projectId: project, title: "Revisar textos" }, include: { assignees: true } });
    expect(t.priority).toBe("HIGH");
    expect(t.assignees.map((a) => a.userId).sort()).toEqual([dona, lia].sort());
    expect(await db.notification.count({ where: { userId: lia, type: "task_assigned" } })).toBe(1);
    expect((await listMyTasks(ws)).map((x) => x.title)).toContain("Revisar textos");
  });

  it("sem título volta com erro; 'back' de fora vira a página de tarefas", async () => {
    as(dona);
    expect(await to(createTaskFromModal(form({ workspaceId: ws, back: "https://mal.com", projectId: project, title: "" })))).toBe(`/app/w/${ws}/tarefas?nova=1&erro=dados`);
  });

  it("caixinha conclui e desfaz", async () => {
    as(dona);
    const t = await db.task.findFirstOrThrow({ where: { projectId: project, title: "Revisar textos" } });
    await toggleTaskDone(form({ workspaceId: ws, taskId: t.id }));
    let now = await db.task.findUniqueOrThrow({ where: { id: t.id }, include: { status: true } });
    expect(now.completedAt).not.toBeNull();
    expect(now.status.isCompleted).toBe(true);
    expect((await listMyTasks(ws)).map((x) => x.id)).not.toContain(t.id);
    await toggleTaskDone(form({ workspaceId: ws, taskId: t.id }));
    now = await db.task.findUniqueOrThrow({ where: { id: t.id }, include: { status: true } });
    expect(now.completedAt).toBeNull();
    expect(now.status.isCompleted).toBe(false);
  });
});

describe("configurações por aba", () => {
  it("geral salva nome, descrição e visibilidade sem mexer nos prazos", async () => {
    as(dona);
    await db.workspaceSettings.update({ where: { workspaceId: ws }, data: { messageRetentionMonths: 6 } });
    expect(await to(updateWorkspace(form({ workspaceId: ws, aba: "geral", name: "Revisão 2", description: "Teste", channelVisibility: "PRIVATE" })))).toContain("aba=geral&ok=salvo");
    const w = await db.workspace.findUniqueOrThrow({ where: { id: ws }, include: { settings: true } });
    expect(w.name).toBe("Revisão 2");
    expect(w.description).toBe("Teste");
    expect(w.settings?.defaultChannelVisibility).toBe("PRIVATE");
    expect(w.settings?.messageRetentionMonths).toBe(6);
  });

  it("retenção salva só os prazos", async () => {
    as(dona);
    expect(await to(updateWorkspace(form({ workspaceId: ws, aba: "retencao", months: "1", hours: "168" })))).toContain("aba=retencao&ok=salvo");
    const w = await db.workspace.findUniqueOrThrow({ where: { id: ws }, include: { settings: true } });
    expect(w.name).toBe("Revisão 2");
    expect(w.settings?.messageRetentionMonths).toBe(1);
    expect(w.settings?.fileRetentionHours).toBe(168);
  });

  it("membro comum não entra nas configurações", async () => {
    as(lia);
    await expect(updateWorkspace(form({ workspaceId: ws, aba: "geral", name: "Hack" }))).rejects.toThrow();
  });
});
