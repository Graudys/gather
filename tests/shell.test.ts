import "./helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Redirect, setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { notify } from "@/_lib/server/notify";
import { updateProfile } from "@/_data/profile.actions";
import { getAppShell, lastWorkspaceId } from "@/_data/shell";
import { getHome } from "@/_data/home";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const dona = randomUUID();
const outro = randomUUID();
let ws = "";
const as = (id: string) => setSessionUser({ id });
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
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
  for (const id of [dona, outro]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(dona, "Casca");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, outro] } } });
  await db.notification.deleteMany({ where: { userId: { in: [dona, outro] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, outro] } } });
  await db.$disconnect();
});

describe("casca, início e perfil", () => {
  it("abre o workspace de equipe e pula o suspenso", async () => {
    expect(await lastWorkspaceId(dona)).toBe(ws);
    await db.workspace.update({ where: { id: ws }, data: { suspendedAt: new Date() } });
    expect(await lastWorkspaceId(dona)).not.toBe(ws);
    await db.workspace.update({ where: { id: ws }, data: { suspendedAt: null } });
  });

  it("a casca traz os workspaces e barra quem não é membro", async () => {
    as(dona);
    const shell = await getAppShell(ws);
    expect(shell.current?.id).toBe(ws);
    as(outro);
    await expect(getAppShell(ws)).rejects.toThrow();
  });

  it("o Início monta os números", async () => {
    as(dona);
    const h = await getHome(ws);
    expect(h.steps).toHaveLength(4);
    expect(h.unreadTotal).toBe(0);
  });

  it("perfil salva e os avisos desligados não chegam", async () => {
    as(dona);
    expect(await to(updateProfile(form({ name: "Dona Nova", username: "dona.casca", bio: "oi", timezone: "America/Sao_Paulo", tarefas: "on" })))).toBe("/app/perfil?aviso=salvo");
    const u = await db.user.findUniqueOrThrow({ where: { id: dona } });
    expect(u.name).toBe("Dona Nova");
    expect(u.notifyPrefs).toEqual({ mencoes: false, tarefas: true, reunioes: false });
    await notify([dona], { type: "dm", title: "x", href: "/app" });
    await notify([dona], { type: "task_assigned", title: "y", href: "/app" });
    const got = await db.notification.findMany({ where: { userId: dona } });
    expect(got.map((n) => n.type)).toEqual(["task_assigned"]);
  });

  it("nome de usuário inválido ou repetido volta com erro", async () => {
    as(dona);
    expect(await to(updateProfile(form({ name: "X", username: "A B", bio: "", timezone: "America/Sao_Paulo" })))).toBe("/app/perfil?perr=usuario");
    as(outro);
    expect(await to(updateProfile(form({ name: "Y", username: "dona.casca", bio: "", timezone: "UTC" })))).toBe("/app/perfil?perr=usuarioUsado");
  });
});
