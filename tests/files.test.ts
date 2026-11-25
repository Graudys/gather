import "./helpers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// Storage em memória: o teste não fala com o Supabase.
const store = new Map<string, number>();
vi.mock("@/_lib/server/storage", () => ({
  BUCKET: "teste",
  storageConfigured: () => true,
  signUpload: async (path: string) => `https://storage.test/upload/${path}`,
  objectInfo: async (path: string) => (store.has(path) ? { size: store.get(path)!, mime: "image/png" } : null),
  moveObject: async (from: string, to: string) => { store.set(to, store.get(from)!); store.delete(from); },
  signDownload: async (path: string) => `https://storage.test/get/${path}`,
  removeObjects: async (paths: (string | null)[]) => { let n = 0; for (const p of paths) if (p && store.delete(p)) n++; return n; },
  listFolder: async () => [],
}));

import { setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { startUpload, attachToTask, removeTaskAttachment } from "@/_data/files.actions";
import { sendMessage, deleteMessage } from "@/_data/chat.actions";
import { cleanupFiles } from "@/_data/files.server";
import { createProject } from "@/_data/projects.actions";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { getChatView } from "@/_data/chat";

const dona = randomUUID();
const intruso = randomUUID();
let ws = "";
let channel = "";
let task = "";
const as = (id: string) => setSessionUser({ id });
const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
/** Faz o "envio": pede a URL e grava no storage falso. */
async function upload(dest: string, name = "foto.png", size = 1000) {
  const r = await startUpload({ workspaceId: ws, dest, name, size, mime: "image/png" });
  if (!r.ok) throw new Error(r.error);
  store.set(r.url.replace("https://storage.test/upload/", ""), size);
  return r.ticket;
}

beforeAll(async () => {
  for (const id of [dona, intruso]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(dona, "Arquivos");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  channel = (await db.channel.findFirstOrThrow({ where: { workspaceId: ws } })).id;
  as(dona);
  let url = "";
  try {
    await createProject(form({ workspaceId: ws, name: "P", teamId: "", memberIds: [], columns: [] }));
  } catch (e) {
    url = (e as { to: string }).to;
  }
  const projectId = url.split("/p/")[1]!;
  const st = await db.taskStatus.findFirstOrThrow({ where: { projectId }, orderBy: { position: "asc" } });
  task = (await db.task.create({ data: { projectId, statusId: st.id, title: "T", position: "a", createdById: dona } })).id;
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, intruso] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, intruso] } } });
  await db.$disconnect();
});

describe("arquivos no chat", () => {
  it("recusa executável e arquivo grande", async () => {
    as(dona);
    expect(await startUpload({ workspaceId: ws, dest: `c:${channel}`, name: "a.exe", size: 10, mime: "x" })).toMatchObject({ ok: false });
    expect(await startUpload({ workspaceId: ws, dest: `c:${channel}`, name: "a.zip", size: 60 * 1024 * 1024, mime: "x" })).toMatchObject({ ok: false });
  });

  it("quem não é do workspace não consegue nem começar o envio", async () => {
    as(intruso);
    await expect(startUpload({ workspaceId: ws, dest: `c:${channel}`, name: "a.png", size: 10, mime: "image/png" })).rejects.toThrow();
  });

  it("envia mensagem só com foto; o arquivo sai de pendente/", async () => {
    as(dona);
    const t = await upload(`c:${channel}`);
    await sendMessage(form({ workspaceId: ws, channelId: channel, content: "", files: [t] }));
    const v = await getChatView(ws, { kind: "channel", id: channel });
    const last = v.messages.at(-1)!;
    expect(last.files).toHaveLength(1);
    expect(last.files[0]!.name).toBe("foto.png");
    const a = await db.messageAttachment.findFirstOrThrow({ where: { id: last.files[0]!.id } });
    expect(a.storagePath).toMatch(new RegExp(`^ws/${ws}/m/`));
    expect(store.has(a.storagePath!)).toBe(true);
  });

  it("recibo forjado, de outra pessoa ou de outro destino é ignorado", async () => {
    as(dona);
    const t = await upload(`t:${task}`); // recibo de tarefa usado no chat
    const before = await db.messageAttachment.count({ where: { message: { workspaceId: ws } } });
    await sendMessage(form({ workspaceId: ws, channelId: channel, content: "x", files: [t, "lixo.assinatura", t.replace(/.$/, "A")] }));
    expect(await db.messageAttachment.count({ where: { message: { workspaceId: ws } } })).toBe(before);
  });

  it("apagar a mensagem apaga o arquivo do storage", async () => {
    as(dona);
    const t = await upload(`c:${channel}`, "b.png");
    await sendMessage(form({ workspaceId: ws, channelId: channel, content: "com arquivo", files: [t] }));
    const msg = await db.message.findFirstOrThrow({ where: { workspaceId: ws, content: "com arquivo" }, include: { attachments: true } });
    const path = msg.attachments[0]!.storagePath!;
    await deleteMessage(form({ workspaceId: ws, messageId: msg.id }));
    expect(store.has(path)).toBe(false);
    expect(await db.messageAttachment.count({ where: { messageId: msg.id } })).toBe(0);
  });

  it("depois do prazo o arquivo expira e a mensagem fica", async () => {
    as(dona);
    const t = await upload(`c:${channel}`, "velho.png");
    await sendMessage(form({ workspaceId: ws, channelId: channel, content: "antigo", files: [t] }));
    const a = await db.messageAttachment.findFirstOrThrow({ where: { fileName: "velho.png", message: { workspaceId: ws } } });
    await db.messageAttachment.update({ where: { id: a.id }, data: { createdAt: new Date(Date.now() - 48 * 3600_000) } });
    const r = await cleanupFiles();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const after = await db.messageAttachment.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.storagePath).toBeNull();
    expect(after.expiredAt).not.toBeNull();
    expect(store.has(a.storagePath!)).toBe(false);
    const v = await getChatView(ws, { kind: "channel", id: channel });
    expect(v.messages.find((m) => m.content === "antigo")?.files[0]?.expired).toBe(true);
  });
});

describe("anexos da tarefa", () => {
  it("anexa e remove", async () => {
    as(dona);
    const t = await upload(`t:${task}`, "doc.pdf", 2048);
    await attachToTask(form({ workspaceId: ws, taskId: task, files: [t] }));
    const a = await db.taskAttachment.findFirstOrThrow({ where: { taskId: task } });
    expect(a.fileName).toBe("doc.pdf");
    expect(Number(a.sizeBytes)).toBe(2048);
    await removeTaskAttachment(form({ workspaceId: ws, taskId: task, attachmentId: a.id }));
    expect(await db.taskAttachment.count({ where: { taskId: task } })).toBe(0);
    expect(store.has(a.storagePath)).toBe(false);
  });
});
