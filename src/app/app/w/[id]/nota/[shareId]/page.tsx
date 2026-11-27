import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireChannel, requireConversation } from "@/_data/chat.access";
import { MarkdownView } from "@/_components/notes/MarkdownView";
import { PageCrumb } from "@/_components/shell/ShellContext";
import { Icon } from "@/_components/ui/Icon";
import { dataHora } from "@/lib/format";
import { id as Id } from "@/lib/validation";
import s from "@/_styles/app/Notes.module.css";

export const metadata: Metadata = { title: "Anotação" };

/** Anotação enviada: só leitura, como estava no envio. Vê quem vê a mensagem. */
export default async function NotaCompartilhada({ params }: PageProps<"/app/w/[id]/nota/[shareId]">) {
  const { id, shareId } = await params;
  if (!Id.safeParse(shareId).success) notFound();
  const share = await db.sharedNote.findFirst({
    where: { id: shareId, workspaceId: id },
    select: { title: true, content: true, createdAt: true, message: { select: { channelId: true, conversationId: true, deletedAt: true, sender: { select: { name: true } } } } },
  });
  if (!share || share.message.deletedAt) notFound();
  // Mesmo acesso da mensagem (404 para quem não vê).
  if (share.message.channelId) await requireChannel(id, share.message.channelId);
  else await requireConversation(id, share.message.conversationId!);
  const back = share.message.channelId ? `/app/w/${id}/c/${share.message.channelId}` : `/app/w/${id}/dm/${share.message.conversationId}`;

  return (
    <>
      <PageCrumb label={share.title} />
      <div className={s.shared}>
        <Link href={back} className={s.tool} style={{ alignSelf: "flex-start" }}><Icon name="back" size={14} /> Voltar para a conversa</Link>
        <h1 className={s.noteTitle}>{share.title}</h1>
        <p className={s.saveState}>
          <Icon name="notebook" size={13} /> Anotação enviada por {share.message.sender?.name ?? "alguém"} em {dataHora(share.createdAt.toISOString())} · só leitura, como estava no envio
        </p>
        <article className={s.preview}>
          <MarkdownView content={share.content} empty="Anotação vazia." />
        </article>
      </div>
    </>
  );
}
