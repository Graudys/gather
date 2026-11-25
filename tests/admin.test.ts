import "./helpers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser, NotFound, Redirect } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { getOverview } from "@/_data/admin-overview";
import { getWorkspaceAdmin, listWorkspacesAdmin } from "@/_data/admin-workspaces";
import { adminAddPerson, adminSetMember, adminSuspend, adminTransferOwner, adminUpdateWorkspace } from "@/_data/admin-workspaces.actions";
import { saveConfig } from "@/_data/admin-config.actions";
import { getAccessLogFor, listAdminActions, maskIp } from "@/_data/admin-log";
import { consultAccess } from "@/_data/admin-log.actions";
import { listMyWorkspaces } from "@/_data/workspaces";
import { getChatView } from "@/_data/chat";
import { meetingUsage } from "@/_data/meetings.server";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { toCsv } from "@/_lib/server/csv";

const chefe = randomUUID();
const dona = randomUUID();
const lia = randomUUID();
const novo = randomUUID();
let ws = "";
let cfgBefore: Record<string, unknown> | null = null;

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const as = (id: string, role = "user") => setSessionUser({ id, role });
async function to(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  return null;
}
const baseConfig = {
  callsForAllWorkspaces: "on", botEnabled: "on", months: ["1", "3", "6"], hours: ["24", "168"], defaultMessageMonths: "3", defaultFileHours: "24",
  callMinutesPerWorkspace: "600", callMaxParticipants: "5", callMaxDurationMin: "60", livekitMonthlyMinutes: "5000",
  maxOwnedTeamWorkspaces: "3", tempPasswordHours: "168", reason: "teste",
};

beforeAll(async () => {
  cfgBefore = (await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })) as unknown as Record<string, unknown>;
  for (const [id, role] of [[chefe, "admin"], [dona, "user"], [lia, "user"], [novo, "user"]] as const) {
    await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, role, mustChangePassword: false } });
  }
  const r = await createTeamWorkspaceFor(dona, "Admin teste");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.create({ data: { workspaceId: ws, userId: lia } });
  await db.workspaceSettings.update({ where: { workspaceId: ws }, data: { messageRetentionMonths: 12 } });
  await db.accessLog.create({ data: { userId: lia, event: "LOGIN", method: "password", ip: "189.40.12.34", userAgent: "Chrome · Windows" } });
});

afterAll(async () => {
  const { id: _id, updatedAt: _u, ...rest } = cfgBefore as { id: number; updatedAt: Date } & Record<string, never>;
  void _id; void _u;
  await db.platformConfig.update({ where: { id: 1 }, data: rest });
  await db.workspace.deleteMany({ where: { createdById: { in: [chefe, dona, lia, novo] } } });
  await db.adminAction.deleteMany({ where: { OR: [{ adminId: chefe }, { targetUserId: { in: [dona, lia, novo] } }] } });
  await db.accessLog.deleteMany({ where: { userId: lia } });
  await db.notification.deleteMany({ where: { userId: { in: [chefe, dona, lia, novo] } } });
  await db.user.deleteMany({ where: { id: { in: [chefe, dona, lia, novo] } } });
  await db.$disconnect();
});

describe("só o admin", () => {
  it("pessoa comum recebe 404 em tudo do admin", async () => {
    as(dona);
    await expect(getOverview()).rejects.toBeInstanceOf(NotFound);
    await expect(listWorkspacesAdmin(undefined)).rejects.toBeInstanceOf(NotFound);
    await expect(adminSuspend(form({ workspaceId: ws, op: "suspend", reason: "tentativa" }))).rejects.toBeInstanceOf(NotFound);
    await expect(saveConfig(form(baseConfig))).rejects.toBeInstanceOf(NotFound);
    await expect(consultAccess(form({ personId: lia, reason: "Investigar erro" }))).rejects.toBeInstanceOf(NotFound);
  });
});

describe("workspaces", () => {
  it("visão do workspace só com números; ação sem motivo é recusada", async () => {
    as(chefe, "admin");
    const w = await getWorkspaceAdmin(ws);
    expect(w.stats.people).toBe(2);
    expect(JSON.stringify(w)).not.toContain("content");
    expect(await to(adminSuspend(form({ workspaceId: ws, op: "suspend", reason: "" })))).toContain("erro=");
  });

  it("adicionar, mudar papel e transferir propriedade (com registro)", async () => {
    as(chefe, "admin");
    expect(await to(adminAddPerson(form({ workspaceId: ws, email: `${novo}@t.test`, role: "MEMBER", reason: "pedido do dono" })))).toContain("ok=adicionado");
    expect(await to(adminSetMember(form({ workspaceId: ws, userId: dona, op: "REMOVE", reason: "não pode" })))).toContain("erro=dono");
    expect(await to(adminTransferOwner(form({ workspaceId: ws, newOwnerId: lia, oldBecomes: "ADMIN", reason: "dono saiu", notifyBoth: "on" })))).toContain("ok=transferido");
    const roles = await db.workspaceMember.findMany({ where: { workspaceId: ws }, select: { userId: true, role: true } });
    expect(roles.find((r) => r.userId === lia)?.role).toBe("OWNER");
    expect(roles.find((r) => r.userId === dona)?.role).toBe("ADMIN");
    expect(roles.filter((r) => r.role === "OWNER")).toHaveLength(1);
    const log = await listAdminActions("workspaces");
    expect(log.some((l) => l.action === "Propriedade transferida" && l.reason === "dono saiu")).toBe(true);
  });

  it("suspenso: membros não abrem; reativar devolve", async () => {
    as(chefe, "admin");
    await to(adminSuspend(form({ workspaceId: ws, op: "suspend", reason: "uso indevido" })));
    const geral = (await db.channel.findFirstOrThrow({ where: { workspaceId: ws } })).id;
    as(dona);
    await expect(getChatView(ws, { kind: "channel", id: geral })).rejects.toEqual(new Redirect("/app/novo-workspace?aviso=workspace-suspenso"));
    as(chefe, "admin");
    await to(adminSuspend(form({ workspaceId: ws, op: "resume", reason: "resolvido" })));
    as(dona);
    expect((await getChatView(ws, { kind: "channel", id: geral })).title).toBe("geral");
  });

  it("minutos do workspace e reuniões ligadas por workspace", async () => {
    as(chefe, "admin");
    await to(adminUpdateWorkspace(form({ workspaceId: ws, calls: "on", quota: "120", months: "3", hours: "24", reason: "teste" })));
    expect((await meetingUsage(ws)).quota).toBe(120);
  });
});

describe("configurações", () => {
  it("desligar uma opção de prazo move quem usava para a maior ligada", async () => {
    as(chefe, "admin");
    await db.workspaceSettings.update({ where: { workspaceId: ws }, data: { messageRetentionMonths: 12, fileRetentionHours: 720 } });
    const url = await to(saveConfig(form(baseConfig)));
    expect(url).toContain("ok=1");
    const st = await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(st.messageRetentionMonths).toBe(6);
    expect(st.fileRetentionHours).toBe(168);
    expect(await to(saveConfig(form({ ...baseConfig, defaultMessageMonths: "12" })))).toContain("erro=padrao");
  });

  it("teto geral do LiveKit bloqueia reunião nova", async () => {
    as(chefe, "admin");
    await to(saveConfig(form({ ...baseConfig, livekitMonthlyMinutes: "0" })));
    expect((await meetingUsage(ws)).left).toBe(0);
    await to(saveConfig(form(baseConfig)));
  });

  it("modo manutenção: só admin entra", async () => {
    as(chefe, "admin");
    await to(saveConfig(form({ ...baseConfig, maintenanceMode: "on" })));
    as(dona);
    await expect(listMyWorkspaces()).rejects.toEqual(new Redirect("/manutencao"));
    as(chefe, "admin");
    await to(saveConfig(form(baseConfig)));
    as(dona);
    expect(Array.isArray(await listMyWorkspaces())).toBe(true);
  });
});

describe("registros de acesso", () => {
  it("só abre com motivo registrado, e o IP sai cortado", async () => {
    as(chefe, "admin");
    expect(await getAccessLogFor(lia)).toBeNull();
    expect(await to(consultAccess(form({ personId: lia, reason: "Pedido da própria pessoa" })))).toContain(`pessoa=${lia}`);
    const log = await getAccessLogFor(lia);
    expect(log?.rows).toHaveLength(1);
    expect(log?.judicial).toBe(false);
    expect(maskIp(log!.rows[0]!.ip)).toBe("189.40.xx.xx");
    expect((await listAdminActions("pessoas")).some((a) => a.action === "Registro de acesso consultado")).toBe(true);
  });

  it("CSV não deixa fórmula passar", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"]])).toContain(`"'=HYPERLINK(1)"`);
  });
});
