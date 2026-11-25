import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { firstChannelId } from "@/_data/chat";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/chat/Column.module.css";

export const metadata: Metadata = { title: "Mensagens" };

// No computador abre o primeiro canal; no celular esta página é a lista (a coluna).
export default async function Mensagens({ params, searchParams }: PageProps<"/app/w/[id]/mensagens">) {
  const { id } = await params;
  const { lista } = (await searchParams) as { lista?: string };
  if (!lista) {
    const first = await firstChannelId(id);
    if (first) redirect(`/app/w/${id}/c/${first}`);
  }
  return (
    <div className={s.emptyPane}>
      <Icon name="chat" size={28} />
      <b>Escolha uma conversa</b>
      <span>Ou crie um canal no + ao lado de Canais.</span>
    </div>
  );
}
