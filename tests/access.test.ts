import "./helpers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser, NotFound, Redirect } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { listMyWorkspaces } from "@/_data/workspaces";
import { getChatView } from "@/_data/chat";
import { sendMessage } from "@/_data/chat.actions";
import { listPeople } from "@/_data/people";
import { getAdminKpis } from "@/_data/admin";
import { createTeamWorkspaceFor, ensurePersonalWorkspace } from "@/_data/workspaces.server";

// Duas pessoas, um workspace da Ana com um canal público e um privado.
const ana = randomUUID();
const beto = randomUUID();
const admin = randomUUID();
let ws = "";
let publico = "";
let privado = "";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  for (const [id, role] of [[ana, "user"], [beto, "user"], [admin, "admin"]] as const) {
    await db.user.create({ data: { id, name: id.slice(0, 4), email: `${id}@t.test`, role, mustChangePassword: false } });
  }
  const r = await createTeamWorkspaceFor(ana, "Time da Ana");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  publico = (await db.channel.findFirstOrThrow({ where: { workspaceId: ws } })).id;
  privado = (await db.channel.create({ data: { workspaceId: ws, name: "segredo", visibility: "PRIVATE", createdById: ana, members: { create: { userId: ana } } } })).id;
});

afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [ana, beto, admin] } } });
  await db.user.deleteMany({ where: { id: { in: [ana, beto, admin] } } });
  await db.$disconnect();
});

describe("isolamento entre workspaces", () => {
  it("quem não é membro recebe 404 (sem revelar que existe)", async () => {
    setSessionUser({ id: beto });
    await expect(getChatView(ws, { kind: "channel", id: publico })).rejects.toBeInstanceOf(NotFound);
  });

  it("listMyWorkspaces só traz os da própria pessoa", async () => {
    setSessionUser({ id: beto });
    expect((await listMyWorkspaces()).map((w) => w.id)).not.toContain(ws);
    setSessionUser({ id: ana });
    expect((await listMyWorkspaces()).map((w) => w.id)).toContain(ws);
  });

  it("não-membro não consegue mandar mensagem", async () => {
    setSessionUser({ id: beto });
    await expect(sendMessage(form({ workspaceId: ws, channelId: publico, content: "invasão" }))).rejects.toBeInstanceOf(NotFound);
    expect(await db.message.count({ where: { channelId: publico, senderId: beto } })).toBe(0);
  });

  it("canal privado: membro do workspace fora do canal não vê nem escreve", async () => {
    await db.workspaceMember.create({ data: { workspaceId: ws, userId: beto, role: "MEMBER" } });
    setSessionUser({ id: beto });
    await expect(getChatView(ws, { kind: "channel", id: privado })).rejects.toBeInstanceOf(NotFound);
    await expect(sendMessage(form({ workspaceId: ws, channelId: privado, content: "oi" }))).rejects.toBeInstanceOf(NotFound);
    expect(await db.message.count({ where: { channelId: privado } })).toBe(0);
  });

  it("canal de outro workspace não aceita mensagem, mesmo com workspaceId válido", async () => {
    setSessionUser({ id: beto });
    const outro = await ensurePersonalWorkspace(beto, "Beto");
    await expect(sendMessage(form({ workspaceId: outro, channelId: publico, content: "cruzado" }))).rejects.toBeInstanceOf(NotFound);
    expect(await db.message.count({ where: { channelId: publico, content: "cruzado" } })).toBe(0);
  });

  it("mensagem apagada não manda o texto", async () => {
    setSessionUser({ id: ana });
    await db.message.create({ data: { workspaceId: ws, channelId: publico, senderId: ana, content: "segredo", deletedAt: new Date() } });
    const view = await getChatView(ws, { kind: "channel", id: publico });
    expect(view.messages.find((m) => m.deleted)?.content).toBe("");
  });
});

describe("primeiro acesso e admin", () => {
  it("quem não fez o primeiro acesso é mandado para /primeiro-acesso", async () => {
    setSessionUser({ id: ana, mustChangePassword: true } as never);
    await expect(listMyWorkspaces()).rejects.toEqual(new Redirect("/primeiro-acesso"));
  });

  it("sem sessão vai para /entrar", async () => {
    setSessionUser(null);
    await expect(listMyWorkspaces()).rejects.toBeInstanceOf(Redirect);
  });

  it("pessoa comum não lê nada do admin", async () => {
    setSessionUser({ id: ana });
    await expect(listPeople()).rejects.toBeInstanceOf(NotFound);
    await expect(getAdminKpis()).rejects.toBeInstanceOf(NotFound);
  });

  it("admin lê a lista de pessoas", async () => {
    setSessionUser({ id: admin, role: "admin" });
    const rows = await listPeople();
    expect(rows.find((r) => r.id === admin)?.isMe).toBe(true);
  });

  it("acesso desativado não passa", async () => {
    setSessionUser({ id: ana, banned: true } as never);
    await expect(listMyWorkspaces()).rejects.toBeInstanceOf(Redirect);
  });
});

describe("limite de workspaces de equipe", () => {
  it("não passa do máximo, nem com pedidos ao mesmo tempo", async () => {
    await db.platformConfig.update({ where: { id: 1 }, data: { maxOwnedTeamWorkspaces: 2 } });
    const res = await Promise.all([1, 2, 3, 4].map((i) => createTeamWorkspaceFor(beto, `Beto ${i}`)));
    expect(res.filter((r) => r.ok)).toHaveLength(2);
    await db.platformConfig.update({ where: { id: 1 }, data: { maxOwnedTeamWorkspaces: 3 } });
  });
});
