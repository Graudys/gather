"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireChannel, requireConversation } from "@/_data/chat.access";
import { requireTask } from "@/_data/projects.access";
import { hit } from "@/_lib/server/rate-limit";
import { makeTicket } from "@/_lib/server/upload-ticket";
import { removeObjects, signUpload, storageConfigured } from "@/_lib/server/storage";
import { landFiles } from "@/_data/files.server";
import { fileProblem, MAX_FILE_BYTES, storageName } from "@/lib/files";
import { id as Id } from "@/lib/validation";
import { localDay } from "@/lib/time";

/** Destino do arquivo: canal, conversa ou tarefa. */
const Dest = z.string().regex(/^(c|dm|t):[0-9a-f-]{36}$/);

async function checkDest(workspaceId: string, dest: string) {
  const [kind, id] = dest.split(":") as ["c" | "dm" | "t", string];
  if (kind === "c") return (await requireChannel(workspaceId, id)).user;
  if (kind === "dm") return (await requireConversation(workspaceId, id)).user;
  return (await requireTask(workspaceId, id)).user;
}

export type StartUpload = { ok: true; url: string; ticket: string } | { ok: false; error: string };

/**
 * 1º passo do envio: confere o acesso e devolve uma URL de envio direto ao
 * Storage + um recibo assinado. O arquivo vai para "pendente/" até ser anexado.
 */
export async function startUpload(input: { workspaceId: string; dest: string; name: string; size: number; mime: string }): Promise<StartUpload> {
  const p = z.object({
    workspaceId: Id,
    dest: Dest,
    name: z.string().trim().min(1).max(200),
    size: z.number().int().positive().max(MAX_FILE_BYTES),
    mime: z.string().max(120),
  }).safeParse(input);
  if (!p.success) return { ok: false, error: "Arquivo inválido ou maior que 50 MB." };
  const problem = fileProblem(p.data.name, p.data.size);
  if (problem) return { ok: false, error: problem };
  if (!storageConfigured()) return { ok: false, error: "O envio de arquivos ainda não foi configurado pelo admin." };
  const user = await checkDest(p.data.workspaceId, p.data.dest);
  if (!(await hit("uploads", user.id))) return { ok: false, error: "Muitos arquivos seguidos. Espere alguns minutos." };
  const path = `ws/${p.data.workspaceId}/pendente/${localDay(new Date())}/${randomUUID()}/${storageName(p.data.name)}`;
  try {
    const url = await signUpload(path);
    return { ok: true, url, ticket: makeTicket({ p: path, n: p.data.name, s: p.data.size, w: p.data.workspaceId, u: user.id, d: p.data.dest }) };
  } catch (e) {
    console.error("[storage] signUpload", e);
    return { ok: false, error: "Não deu para preparar o envio. Tente de novo." };
  }
}

/** Anexos da tarefa (não expiram). */
export async function attachToTask(form: FormData) {
  const p = z.object({ workspaceId: Id, taskId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const files = await landFiles(form.getAll("files").map(String), { w: p.data.workspaceId, u: ctx.user.id, d: `t:${ctx.task.id}` }, `t/${ctx.task.id}`);
  if (!files.length) return;
  await db.taskAttachment.createMany({
    data: files.map((f) => ({ taskId: ctx.task.id, storagePath: f.path, fileName: f.name, mimeType: f.mime, sizeBytes: BigInt(f.size), createdById: ctx.user.id })),
  });
  await db.activityEvent.create({
    data: { workspaceId: p.data.workspaceId, actorId: ctx.user.id, projectId: ctx.project.id, eventType: "task_file", entityType: "task", entityId: ctx.task.id, metadata: { files: files.map((f) => f.name).join(", ") } },
  });
  revalidatePath(`/app/w/${p.data.workspaceId}`, "layout");
}

export async function removeTaskAttachment(form: FormData) {
  const p = z.object({ workspaceId: Id, taskId: Id, attachmentId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireTask(p.data.workspaceId, p.data.taskId);
  const a = await db.taskAttachment.findFirst({ where: { id: p.data.attachmentId, taskId: ctx.task.id }, select: { id: true, storagePath: true, createdById: true } });
  // Quem enviou, quem pode apagar a tarefa, ou quem gerencia o projeto.
  if (!a || (a.createdById !== ctx.user.id && !ctx.canDeleteTask)) return;
  await db.taskAttachment.delete({ where: { id: a.id } });
  await removeObjects([a.storagePath]);
  revalidatePath(`/app/w/${p.data.workspaceId}`, "layout");
}
