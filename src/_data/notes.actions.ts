"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { id as Id } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { isChatIcon } from "@/lib/chat-icons";
import { NOTE_KEEP_MONTHS, NOTE_LIMITS, isNoteMonths, plusMonths } from "@/lib/notes";
import { notesInWarning, noteMonths, requireNotes } from "@/_data/notes";
import { randomUUID } from "node:crypto";
import { storageConfigured, uploadObject } from "@/_lib/server/storage";
import { removeUnusedImages } from "@/_lib/server/note-share";
import { sniffImage } from "@/lib/images";
import { noteImageUrl } from "@/lib/notes";

/**
 * Notas do espaço pessoal. Toda ação confere: workspace pessoal, dono dele,
 * e que o caderno/nota é daquele workspace (nada de id de outra pessoa).
 */
const base = (ws: string) => `/app/w/${ws}/notas`;
const refresh = (ws: string) => revalidatePath(base(ws), "layout");
const iconOf = (v: FormDataEntryValue | null) => (isChatIcon(v) ? v : null);

/**
 * Fotos das notas que vão ser apagadas: o banco apaga as linhas em cascata; aqui
 * sai do Storage o que ninguém mais usa (uma anotação enviada pode estar usando).
 */
async function dropImages(where: { noteId?: { in: string[] } | string; note?: { notebookId: string } }) {
  const imgs = await db.noteImage.findMany({ where, select: { id: true, storagePath: true } });
  if (!imgs.length) return;
  await db.noteImage.deleteMany({ where: { id: { in: imgs.map((i) => i.id) } } });
  await removeUnusedImages(imgs.map((i) => i.storagePath));
}

/**
 * Foto colada/arrastada no editor. Chega reduzida (até 1600 px) e regravada
 * pelo navegador, sem os dados da foto original. Aqui: tamanho, tipo pelos
 * bytes, limite por nota, nota tem que ser deste espaço pessoal.
 */
export async function uploadNoteImage(form: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const p = z.object({ workspaceId: Id, noteId: Id }).safeParse({ workspaceId: form.get("workspaceId"), noteId: form.get("noteId") });
  if (!p.success) return { ok: false, error: "dados" };
  const { user } = await requireNotes(p.data.workspaceId);
  if (!storageConfigured()) return { ok: false, error: "storage" };
  if (!(await hit("uploads", user.id))) return { ok: false, error: "muitas" };
  const note = await db.note.findFirst({ where: { id: p.data.noteId, workspaceId: p.data.workspaceId }, select: { id: true, _count: { select: { images: true } } } });
  if (!note) return { ok: false, error: "dados" };
  if (note._count.images >= NOTE_LIMITS.imagesPerNote) return { ok: false, error: "limite" };
  const f = form.get("image");
  if (!(f instanceof Blob) || f.size === 0) return { ok: false, error: "dados" };
  if (f.size > NOTE_LIMITS.imageBytes) return { ok: false, error: "tamanho" };
  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, error: "tipo" };
  const path = `notas/${p.data.workspaceId}/${note.id}/${randomUUID()}.${type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg"}`;
  await uploadObject(path, bytes, type);
  const img = await db.noteImage.create({ data: { noteId: note.id, workspaceId: p.data.workspaceId, storagePath: path, sizeBytes: bytes.length }, select: { id: true } });
  return { ok: true, url: noteImageUrl(img.id) };
}

async function notebookOf(workspaceId: string, notebookId: string) {
  return db.notebook.findFirst({ where: { id: notebookId, workspaceId }, select: { id: true, isDefault: true } });
}

export async function createNotebook(form: FormData) {
  const p = z.object({ workspaceId: Id, name: z.string().trim().min(1).max(NOTE_LIMITS.notebookName) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { user } = await requireNotes(p.data.workspaceId);
  if ((await db.notebook.count({ where: { workspaceId: p.data.workspaceId } })) >= NOTE_LIMITS.notebooks) redirect(`${base(p.data.workspaceId)}?erro=limite`);
  const nb = await db.notebook.create({
    data: { workspaceId: p.data.workspaceId, name: p.data.name, icon: iconOf(form.get("icon")), createdById: user.id },
    select: { id: true },
  });
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?c=${nb.id}`);
}

export async function updateNotebook(form: FormData) {
  const p = z.object({ workspaceId: Id, notebookId: Id, name: z.string().trim().min(1).max(NOTE_LIMITS.notebookName) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await requireNotes(p.data.workspaceId);
  const nb = await notebookOf(p.data.workspaceId, p.data.notebookId);
  if (!nb) return;
  await db.notebook.update({ where: { id: nb.id }, data: { name: p.data.name, icon: iconOf(form.get("icon")) } });
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?c=${nb.id}`);
}

/** Apaga o caderno e as notas dele. O caderno fixo não pode. Pede a palavra APAGAR. */
export async function deleteNotebook(form: FormData) {
  const p = z.object({ workspaceId: Id, notebookId: Id, confirm: z.literal("APAGAR") }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await requireNotes(p.data.workspaceId);
  const nb = await notebookOf(p.data.workspaceId, p.data.notebookId);
  if (!nb || nb.isDefault) return;
  await dropImages({ note: { notebookId: nb.id } });
  await db.notebook.delete({ where: { id: nb.id } });
  refresh(p.data.workspaceId);
  redirect(base(p.data.workspaceId));
}

export async function createNote(form: FormData) {
  const p = z.object({ workspaceId: Id, notebookId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { user } = await requireNotes(p.data.workspaceId);
  const nb = await notebookOf(p.data.workspaceId, p.data.notebookId);
  if (!nb) return;
  if ((await db.note.count({ where: { workspaceId: p.data.workspaceId } })) >= NOTE_LIMITS.notesPerWorkspace) redirect(`${base(p.data.workspaceId)}?c=${nb.id}&erro=limite`);
  const note = await db.note.create({ data: { workspaceId: p.data.workspaceId, notebookId: nb.id, createdById: user.id }, select: { id: true } });
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?c=${nb.id}&n=${note.id}`);
}

const SaveNote = z.object({
  workspaceId: Id,
  noteId: Id,
  title: z.string().max(NOTE_LIMITS.title),
  content: z.string().max(NOTE_LIMITS.content),
});

/** Salvamento automático do editor. Editar zera o relógio do prazo e o aviso. */
export async function saveNote(input: unknown): Promise<{ ok: boolean; updatedAt?: string }> {
  const p = SaveNote.safeParse(input);
  if (!p.success) return { ok: false };
  const { user } = await requireNotes(p.data.workspaceId);
  if (!(await hit("noteSave", user.id))) return { ok: false };
  const r = await db.note.updateMany({
    where: { id: p.data.noteId, workspaceId: p.data.workspaceId },
    data: { title: p.data.title.trim(), content: p.data.content, updatedAt: new Date(), warnedAt: null },
  });
  if (!r.count) return { ok: false };
  refresh(p.data.workspaceId);
  return { ok: true, updatedAt: new Date().toISOString() };
}

export async function deleteNote(form: FormData) {
  const p = z.object({ workspaceId: Id, noteId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await requireNotes(p.data.workspaceId);
  const n = await db.note.findFirst({ where: { id: p.data.noteId, workspaceId: p.data.workspaceId }, select: { id: true, notebookId: true } });
  if (!n) return;
  await dropImages({ noteId: n.id });
  await db.note.delete({ where: { id: n.id } });
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?c=${n.notebookId}`);
}

/** Prazo das notas: 1, 2, 3 ou 5 anos. Diminuir nunca apaga nada: só antecipa o aviso. */
export async function setNoteRetention(form: FormData) {
  const p = z.object({ workspaceId: Id, months: z.coerce.number().int() }).safeParse(Object.fromEntries(form));
  if (!p.success || !isNoteMonths(p.data.months)) return;
  await requireNotes(p.data.workspaceId);
  await db.workspaceSettings.update({ where: { workspaceId: p.data.workspaceId }, data: { noteRetentionMonths: p.data.months } });
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?prazo=ok`);
}

/** "Manter por mais 1 ano": todas as notas que estão no aviso ou vencidas. */
export async function keepWarnedNotes(form: FormData) {
  const p = z.object({ workspaceId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await requireNotes(p.data.workspaceId);
  const ids = (await notesInWarning(p.data.workspaceId, await noteMonths(p.data.workspaceId))).map((n) => n.id);
  if (ids.length) {
    await db.note.updateMany({
      where: { id: { in: ids }, workspaceId: p.data.workspaceId },
      data: { keepUntil: plusMonths(new Date(), NOTE_KEEP_MONTHS), warnedAt: null },
    });
  }
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?mantidas=${ids.length}`);
}

/**
 * Apaga as notas vencidas e as que vencem em até 30 dias.
 * Só depois de a pessoa ter tido a chance de baixar e digitar APAGAR.
 */
export async function deleteWarnedNotes(form: FormData) {
  const p = z.object({ workspaceId: Id, confirm: z.literal("APAGAR") }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await requireNotes(p.data.workspaceId);
  const ids = (await notesInWarning(p.data.workspaceId, await noteMonths(p.data.workspaceId))).map((n) => n.id);
  if (ids.length) {
    await dropImages({ noteId: { in: ids } });
    await db.note.deleteMany({ where: { id: { in: ids }, workspaceId: p.data.workspaceId } });
  }
  refresh(p.data.workspaceId);
  redirect(`${base(p.data.workspaceId)}?apagadas=${ids.length}`);
}
