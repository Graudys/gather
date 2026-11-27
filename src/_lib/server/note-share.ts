import "server-only";
import { db } from "@/_lib/db/prisma";
import { removeObjects } from "@/_lib/server/storage";
import { imageRefs, sharedImageUrl } from "@/lib/notes";

/**
 * Cria a mensagem com o cartão da anotação (canal ou conversa direta) e a
 * "foto" do texto naquele momento. As fotos da nota não são copiadas: o
 * cartão aponta para os mesmos arquivos, com um id próprio para o acesso.
 */
export async function createNoteShare(opts: {
  senderId: string;
  note: { id: string; title: string; content: string };
  workspaceId: string;
  channelId?: string;
  conversationId?: string;
  text: string;
}) {
  const imgs = await db.noteImage.findMany({
    where: { noteId: opts.note.id, id: { in: imageRefs(opts.note.content).filter((r) => !r.shared).map((r) => r.id) } },
    select: { id: true, storagePath: true },
  });
  return db.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: { workspaceId: opts.workspaceId, channelId: opts.channelId ?? null, conversationId: opts.conversationId ?? null, senderId: opts.senderId, content: opts.text },
      select: { id: true },
    });
    const share = await tx.sharedNote.create({
      data: { messageId: msg.id, workspaceId: opts.workspaceId, title: opts.note.title || "Sem título", content: "" },
      select: { id: true },
    });
    let content = opts.note.content;
    for (const img of imgs) {
      const row = await tx.sharedNoteImage.create({ data: { sharedNoteId: share.id, storagePath: img.storagePath }, select: { id: true } });
      content = content.split(`/api/notas/imagem/${img.id}`).join(sharedImageUrl(row.id));
    }
    await tx.sharedNote.update({ where: { id: share.id }, data: { content } });
    return { messageId: msg.id, shareId: share.id };
  });
}

/** Dos caminhos dados, quais ainda são usados por alguma nota ou anotação enviada. */
async function stillUsed(paths: string[]) {
  if (!paths.length) return new Set<string>();
  const [a, b] = await Promise.all([
    db.noteImage.findMany({ where: { storagePath: { in: paths } }, select: { storagePath: true } }),
    db.sharedNoteImage.findMany({ where: { storagePath: { in: paths } }, select: { storagePath: true } }),
  ]);
  return new Set([...a, ...b].map((x) => x.storagePath));
}

/** Apaga do Storage só os arquivos que ninguém mais usa (nota ou anotação enviada). */
export async function removeUnusedImages(paths: string[]) {
  const used = await stillUsed(paths);
  return removeObjects(paths.filter((p) => !used.has(p)));
}
