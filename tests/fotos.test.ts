import "./helpers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// Storage em memória.
const store = new Map<string, Uint8Array>();
vi.mock("@/_lib/server/storage", () => ({
  storageConfigured: () => true,
  uploadObject: async (p: string, b: Uint8Array) => void store.set(p, b),
  downloadObject: async (p: string) => store.get(p) ?? null,
  removeObjects: async (ps: (string | null)[]) => ps.filter((p) => p && store.delete(p)).length,
  copyObject: async () => undefined, signUpload: async () => "", objectInfo: async () => null, moveObject: async () => undefined, signDownload: async () => "", listFolder: async () => [],
}));

import { setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { removeMyPhoto, setMyPhoto, setWorkspaceIcon, setWorkspacePhoto } from "@/_data/photos.actions";
import { GET } from "@/app/api/avatar/[kind]/[id]/route";
import { GET as noteImg } from "@/app/api/notas/imagem/[id]/route";
import { ensurePersonalWorkspace } from "@/_data/workspaces.server";
import { deleteNote, uploadNoteImage } from "@/_data/notes.actions";
import { sendNoteToChannel, sendNoteToPerson } from "@/_data/share.actions";
import { GET as sharedImg } from "@/app/api/notas/compartilhada/imagem/[id]/route";
import { getChatView } from "@/_data/chat";
import { sniffImage } from "@/lib/images";

const ana = randomUUID();
const bia = randomUUID();
const estranho = randomUUID();
let ws = "";
const as = (id: string) => setSessionUser({ id });
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3]);
const fd = (bytes: Uint8Array, extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.set("photo", new Blob([bytes as BlobPart]), "foto.webp");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
};
const avatar = async (kind: string, id: string) => {
  const r = await GET(new Request(`http://t/api/avatar/${kind}/${id}`), { params: Promise.resolve({ kind, id }) });
  return { type: r.headers.get("content-type"), size: (await r.arrayBuffer()).byteLength };
};

beforeAll(async () => {
  for (const id of [ana, bia, estranho]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(ana, "Fotos");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.create({ data: { workspaceId: ws, userId: bia, role: "MEMBER" } });
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [ana, bia, estranho] } } });
  await db.user.deleteMany({ where: { id: { in: [ana, bia, estranho] } } });
});

describe("fotos", () => {
  it("só aceita WebP/JPEG/PNG pelos bytes (SVG e HTML não)", () => {
    expect(sniffImage(webp())).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
  });

  it("foto de perfil: grava, troca apaga a antiga, tamanho e tipo conferidos", async () => {
    as(ana);
    expect(await setMyPhoto(fd(new TextEncoder().encode("<svg/>")))).toEqual({ ok: false, error: "tipo" });
    expect(await setMyPhoto(fd(new Uint8Array(400_000)))).toEqual({ ok: false, error: "tamanho" });
    expect(await setMyPhoto(fd(webp()))).toEqual({ ok: true });
    const first = (await db.user.findUniqueOrThrow({ where: { id: ana } })).image!;
    expect(first.startsWith(`perfil/u/${ana}/`)).toBe(true);
    await setMyPhoto(fd(webp()));
    expect(store.has(first)).toBe(false);
  });

  it("foto de perfil só aparece para quem divide workspace", async () => {
    as(bia);
    expect((await avatar("u", ana)).type).toBe("image/webp");
    as(estranho);
    expect((await avatar("u", ana)).type).toBe("image/gif"); // pixel vazio
    as(ana);
    await removeMyPhoto();
    as(bia);
    expect((await avatar("u", ana)).type).toBe("image/gif");
  });

  it("foto e ícone do workspace: só dono/admin; só membros veem", async () => {
    as(bia);
    await expect(setWorkspacePhoto(fd(webp(), { workspaceId: ws }))).rejects.toThrow();
    await expect(setWorkspaceIcon({ workspaceId: ws, icon: "🚀" })).rejects.toThrow();
    as(ana);
    expect(await setWorkspaceIcon({ workspaceId: ws, icon: "<b>" })).toEqual({ ok: false, error: "dados" });
    expect(await setWorkspaceIcon({ workspaceId: ws, icon: "🚀" })).toEqual({ ok: true });
    expect(await setWorkspacePhoto(fd(webp(), { workspaceId: ws }))).toEqual({ ok: true });
    as(bia);
    expect((await avatar("w", ws)).type).toBe("image/webp");
    as(estranho);
    expect((await avatar("w", ws)).type).toBe("image/gif");
  });
});

describe("fotos nas notas", () => {
  it("envia, só a dona vê, e apagar a nota tira do armazenamento", async () => {
    const pessoal = await ensurePersonalWorkspace(ana, "Ana");
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    expect(nb.icon).toBeNull(); // caderno fixo usa o ícone do app
    const note = await db.note.create({ data: { workspaceId: pessoal, notebookId: nb.id, createdById: ana } });
    const f = new FormData();
    f.set("workspaceId", pessoal);
    f.set("noteId", note.id);
    f.set("image", new Blob([webp() as BlobPart]));
    as(bia);
    await expect(uploadNoteImage(f)).rejects.toThrow(); // não é o espaço dela
    as(ana);
    const r = await uploadNoteImage(f);
    expect(r.ok).toBe(true);
    const id = (r as { url: string }).url.split("/").pop()!;
    const get = (who: string) => { as(who); return noteImg(new Request("http://t"), { params: Promise.resolve({ id }) }); };
    expect((await get(ana)).status).toBe(200);
    expect((await get(bia)).status).toBe(404);
    const path = (await db.noteImage.findUniqueOrThrow({ where: { id } })).storagePath;
    expect(store.has(path)).toBe(true);
    as(ana);
    const d = new FormData();
    d.set("workspaceId", pessoal);
    d.set("noteId", note.id);
    await deleteNote(d).catch(() => undefined);
    expect(store.has(path)).toBe(false);
    expect(await db.noteImage.count({ where: { id } })).toBe(0);
  });

  it("recusa arquivo que não é foto", async () => {
    const pessoal = await ensurePersonalWorkspace(ana, "Ana");
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    const note = await db.note.create({ data: { workspaceId: pessoal, notebookId: nb.id, createdById: ana } });
    const f = new FormData();
    f.set("workspaceId", pessoal);
    f.set("noteId", note.id);
    f.set("image", new Blob([new TextEncoder().encode("<svg onload=x>") as BlobPart]));
    as(ana);
    expect(await uploadNoteImage(f)).toEqual({ ok: false, error: "tipo" });
  });
});

describe("enviar anotação (sem cópia)", () => {
  it("vai como cartão para canal e pessoa; quem não vê o lugar não vê a foto; apagar a nota não quebra o envio", async () => {
    const pessoal = await ensurePersonalWorkspace(ana, "Ana");
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    const note = await db.note.create({ data: { workspaceId: pessoal, notebookId: nb.id, createdById: ana, title: "Git flow" } });
    as(ana);
    const up = new FormData();
    up.set("workspaceId", pessoal); up.set("noteId", note.id); up.set("image", new Blob([webp() as BlobPart]));
    const r = (await uploadNoteImage(up)) as { ok: true; url: string };
    await db.note.update({ where: { id: note.id }, data: { content: `# Passos\n![fluxo](${r.url})` } });
    const notesBefore = await db.note.count({ where: { createdById: { in: [ana, bia] } } });

    const ch = await db.channel.findFirstOrThrow({ where: { workspaceId: ws } });
    const f = (to: string) => { const x = new FormData(); x.set("workspaceId", pessoal); x.set("noteId", note.id); x.set("to", to); return x; };
    await sendNoteToChannel(f(`${ws}:${ch.id}`)).catch(() => undefined);
    await sendNoteToPerson(f(`${ws}:${bia}`)).catch(() => undefined);
    expect(await db.note.count({ where: { createdById: { in: [ana, bia] } } })).toBe(notesBefore); // não criou nota
    const shares = await db.sharedNote.findMany({ where: { workspaceId: ws }, include: { images: true } });
    expect(shares).toHaveLength(2);
    expect(shares[0]!.content).toContain("/api/notas/compartilhada/imagem/");
    expect(shares[0]!.images[0]!.storagePath).toBe((await db.noteImage.findFirstOrThrow({ where: { noteId: note.id } })).storagePath); // mesmo arquivo

    // Bia vê o cartão no canal e a foto; estranho não.
    as(bia);
    const view = await getChatView(ws, { kind: "channel", id: ch.id }, {});
    expect(view.messages.some((m) => m.note?.title === "Git flow")).toBe(true);
    const imgId = shares[0]!.images[0]!.id;
    const get = (who: string) => { as(who); return sharedImg(new Request("http://t"), { params: Promise.resolve({ id: imgId }) }); };
    expect((await get(bia)).status).toBe(200);
    expect((await get(estranho)).status).toBe(404);

    // Apagar a nota original: a foto continua para quem recebeu (ainda usada).
    const path = shares[0]!.images[0]!.storagePath;
    as(ana);
    const d = new FormData(); d.set("workspaceId", pessoal); d.set("noteId", note.id);
    await deleteNote(d).catch(() => undefined);
    expect(store.has(path)).toBe(true);
    expect((await get(bia)).status).toBe(200);
  });
});
