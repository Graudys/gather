import "./helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { NotFound, setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { getChatView } from "@/_data/chat";
import { createTaskFromMessage, listTaskTargets, sendTaskToChannel } from "@/_data/chat-tasks.actions";

const ana = randomUUID(); // dono, está na equipe privada
const bia = randomUUID(); // membro, fora da equipe privada
let ws = "";
let geral = ""; // canal público
let projPub = "";
let projPriv = "";
const as = (id: string) => setSessionUser({ id });

async function project(teamId: string, name: string) {
  const p = await db.project.create({ data: { teamId, name, slug: name.toLowerCase(), createdById: ana } });
  await db.taskStatus.createMany({ data: [{ projectId: p.id, name: "A fazer", position: 0 }, { projectId: p.id, name: "Feito", position: 1, isCompleted: true }] });
  return p.id;
}

beforeAll(async () => {
  for (const id of [ana, bia]) await db.user.create({ data: { id, name: `C ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(ana, "Cartões");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.create({ data: { workspaceId: ws, userId: bia, role: "MEMBER" } });
  const teamPub = await db.team.create({ data: { workspaceId: ws, name: "Aberta", slug: "aberta", createdById: ana } });
  const teamPriv = await db.team.create({ data: { workspaceId: ws, name: "Fechada", slug: "fechada", visibility: "PRIVATE", createdById: ana, members: { create: { userId: ana, role: "TEAM_ADMIN" } } } });
  projPub = await project(teamPub.id, "Publico");
  projPriv = await project(teamPriv.id, "Segredo");
  geral = (await db.channel.create({ data: { workspaceId: ws, name: "geral-cartoes", createdById: ana } })).id;
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: ana } });
  await db.user.deleteMany({ where: { id: { in: [ana, bia] } } });
});

describe("cartões no chat", () => {
  it("cria tarefa a partir da mensagem; o cartão aparece na conversa com o estado atual", async () => {
    as(bia);
    const msg = await db.message.create({ data: { workspaceId: ws, channelId: geral, senderId: bia, content: "Precisamos revisar o protótipo do chat" } });
    const targets = await listTaskTargets({ workspaceId: ws, messageId: msg.id });
    expect(targets.map((t) => t.id)).toContain(projPub);
    expect(targets.map((t) => t.id)).not.toContain(projPriv); // Bia não vê o projeto privado
    // Bia não consegue criar no projeto privado
    await expect(createTaskFromMessage({ workspaceId: ws, messageId: msg.id, projectId: projPriv, title: "x" })).rejects.toBeInstanceOf(NotFound);
    const r = await createTaskFromMessage({ workspaceId: ws, messageId: msg.id, projectId: projPub, title: "Revisar protótipo do chat" });
    expect(r.ok).toBe(true);
    const task = await db.task.findFirstOrThrow({ where: { projectId: projPub } });
    expect(task.description).toContain("Precisamos revisar o protótipo");
    expect(task.statusChangedAt).not.toBeNull();
    const view = await getChatView(ws, { kind: "channel", id: geral });
    const card = view.messages.find((m) => m.task)!;
    expect(card.task).toMatchObject({ hidden: false, id: task.id, title: "Revisar protótipo do chat", done: false, column: "A fazer", projectName: "Publico" });
    // estado atual: concluir muda o cartão
    const feito = await db.taskStatus.findFirstOrThrow({ where: { projectId: projPub, isCompleted: true } });
    await db.task.update({ where: { id: task.id }, data: { statusId: feito.id, completedAt: new Date() } });
    const again = await getChatView(ws, { kind: "channel", id: geral });
    expect(again.messages.find((m) => m.task)!.task).toMatchObject({ done: true, column: "Feito" });
  });

  it("tarefa de projeto privado enviada ao canal: quem não vê o projeto vê só o aviso", async () => {
    as(ana);
    const st = await db.taskStatus.findFirstOrThrow({ where: { projectId: projPriv, position: 0 } });
    const t = await db.task.create({ data: { projectId: projPriv, statusId: st.id, title: "Plano secreto", position: "a0", createdById: ana } });
    const r = await sendTaskToChannel({ workspaceId: ws, taskId: t.id, channelId: geral, text: "Olhem isso" });
    expect(r.ok).toBe(true);
    const mine = await getChatView(ws, { kind: "channel", id: geral });
    expect(mine.messages.find((m) => m.content === "Olhem isso")!.task).toMatchObject({ hidden: false, title: "Plano secreto" });
    as(bia);
    const hers = await getChatView(ws, { kind: "channel", id: geral });
    const c = hers.messages.find((m) => m.content === "Olhem isso")!;
    expect(c.task).toEqual({ hidden: true });
    expect(JSON.stringify(c)).not.toContain("Plano secreto");
    // e Bia não consegue mandar tarefa de projeto que não vê
    await expect(sendTaskToChannel({ workspaceId: ws, taskId: t.id, channelId: geral })).rejects.toBeInstanceOf(NotFound);
  });

  it("cartão de reunião: Entrar enquanto aberta; encerrada mostra a duração", async () => {
    as(ana);
    const start = new Date(Date.now() - 47 * 60_000);
    const m = await db.meeting.create({ data: { workspaceId: ws, title: "Planejamento", roomKey: randomUUID(), status: "LIVE", startedAt: start, startsAt: start } });
    await db.message.create({ data: { workspaceId: ws, channelId: geral, senderId: ana, meetingId: m.id, content: "Abri uma reunião." } });
    let v = await getChatView(ws, { kind: "channel", id: geral });
    expect(v.messages.find((x) => x.meeting)!.meeting).toEqual({ id: m.id, title: "Planejamento", open: true, cancelled: false, minutes: null });
    await db.meeting.update({ where: { id: m.id }, data: { status: "ENDED", endedAt: new Date() } });
    v = await getChatView(ws, { kind: "channel", id: geral });
    expect(v.messages.find((x) => x.meeting)!.meeting).toMatchObject({ open: false, minutes: 47 });
  });
});

describe("criar tarefa da mensagem com prioridade e prazo", () => {
  it("grava prioridade e prazo escolhidos", async () => {
    as(bia);
    const msg = await db.message.create({ data: { workspaceId: ws, channelId: geral, senderId: bia, content: "Mandar proposta pro cliente" } });
    const r = await createTaskFromMessage({ workspaceId: ws, messageId: msg.id, projectId: projPub, title: "Mandar proposta", priority: "HIGH", dueAt: "2026-12-05" });
    expect(r.ok).toBe(true);
    const t = await db.task.findFirstOrThrow({ where: { projectId: projPub, title: "Mandar proposta" } });
    expect(t.priority).toBe("HIGH");
    expect(t.dueAt?.toISOString()).toBe("2026-12-05T15:00:00.000Z");
    const bad = await createTaskFromMessage({ workspaceId: ws, messageId: msg.id, projectId: projPub, title: "x", dueAt: "05/12/2026" });
    expect(bad).toEqual({ ok: false, error: "dados" });
  });
});

describe("tarefa urgente no canal", () => {
  it("marca os responsáveis com @, avisa no sino e sobe a prioridade", async () => {
    as(ana);
    await db.user.update({ where: { id: bia }, data: { username: `bia${bia.slice(0, 4)}` } });
    const st = await db.taskStatus.findFirstOrThrow({ where: { projectId: projPub, position: 0 } });
    const t = await db.task.create({ data: { projectId: projPub, statusId: st.id, title: "Corrigir login", position: "b0", createdById: ana, priority: "LOW", assignees: { create: [{ userId: bia }, { userId: ana }] } } });
    const r = await sendTaskToChannel({ workspaceId: ws, taskId: t.id, channelId: geral, callAssignees: true, urgent: true });
    expect(r).toMatchObject({ ok: true, called: 1 }); // quem envia não se avisa
    expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).priority).toBe("HIGH");
    const msg = await db.message.findFirstOrThrow({ where: { taskId: t.id } });
    expect(msg.content).toBe(`@bia${bia.slice(0, 4)} Tarefa urgente, preciso de ajuda aqui.`);
    const n = await db.notification.findFirstOrThrow({ where: { userId: bia, type: "mention" }, orderBy: { createdAt: "desc" } });
    expect(n.title).toContain("tarefa urgente");
    expect(n.body).toBe("Corrigir login");
  });

  it("canal privado: só avisa responsável que é do canal", async () => {
    as(ana);
    const priv = await db.channel.create({ data: { workspaceId: ws, name: "so-ana", visibility: "PRIVATE", createdById: ana, members: { create: { userId: ana } } } });
    const st = await db.taskStatus.findFirstOrThrow({ where: { projectId: projPub, position: 0 } });
    const t = await db.task.create({ data: { projectId: projPub, statusId: st.id, title: "Só pra Ana", position: "c0", createdById: ana, assignees: { create: [{ userId: bia }] } } });
    const r = await sendTaskToChannel({ workspaceId: ws, taskId: t.id, channelId: priv.id, callAssignees: true });
    expect(r).toMatchObject({ ok: true, called: 0 });
    expect((await db.message.findFirstOrThrow({ where: { taskId: t.id } })).content).toBe("Compartilhei uma tarefa.");
  });
});

describe("@ digitado no Enviar pro canal", () => {
  it("lista quem vê o canal, avisa quem foi marcado e não repete o @ do responsável", async () => {
    as(ana);
    const handle = `bia${bia.slice(0, 4)}`;
    const people = await (await import("@/_data/chat-tasks.actions")).listChannelPeople({ workspaceId: ws, channelId: geral });
    expect(people.map((p) => p.handle)).toContain(handle);
    const st = await db.taskStatus.findFirstOrThrow({ where: { projectId: projPub, position: 0 } });
    const t = await db.task.create({ data: { projectId: projPub, statusId: st.id, title: "Ajustar menu", position: "d0", createdById: ana, assignees: { create: [{ userId: bia }] } } });
    const before = await db.notification.count({ where: { userId: bia } });
    const r = await sendTaskToChannel({ workspaceId: ws, taskId: t.id, channelId: geral, text: `@${handle} consegue pegar essa?`, callAssignees: true });
    expect(r).toMatchObject({ ok: true, called: 1 });
    expect((await db.message.findFirstOrThrow({ where: { taskId: t.id } })).content).toBe(`@${handle} consegue pegar essa?`);
    expect(await db.notification.count({ where: { userId: bia } })).toBeGreaterThanOrEqual(before); // aviso agrupado ou novo
    const n = await db.notification.findFirstOrThrow({ where: { userId: bia, type: "mention" }, orderBy: { createdAt: "desc" } });
    expect(n.body).toBe("Ajustar menu");
  });
});
