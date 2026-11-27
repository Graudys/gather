import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addChannelMembers, deleteChannel, leaveChannel, updateChannel } from "@/_data/chat.actions";
import { getChatView, listWorkspacePeople } from "@/_data/chat";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Avatar } from "@/_components/chat/Avatar";
import { id as Id } from "@/lib/validation";
import { CHAT_ICONS } from "@/lib/chat-icons";
import { ChannelMark, ChannelName } from "@/_components/chat/ChannelLabel";
import p from "@/_styles/chat/Panel.module.css";
import c from "@/_styles/chat/Chat.module.css";

export const metadata: Metadata = { title: "Ajustes do canal" };

export default async function AjustesCanal({ params }: PageProps<"/app/w/[id]/c/[channelId]/ajustes">) {
  const { id, channelId } = await params;
  if (!Id.safeParse(channelId).success) notFound();
  const view = await getChatView(id, { kind: "channel", id: channelId }, { limit: 1 }); // confere o acesso
  const back = `/app/w/${id}/c/${channelId}`;
  const isPrivate = view.visibility === "PRIVATE";
  const inChannel = new Set(view.members.map((m) => m.id));
  const candidates = isPrivate && view.canManage ? (await listWorkspacePeople(id)).filter((x) => !inChannel.has(x.id)) : [];
  const hidden = (
    <>
      <input type="hidden" name="workspaceId" value={id} />
      <input type="hidden" name="channelId" value={channelId} />
    </>
  );

  return (
    <div className={p.page}>
      <div className={p.narrow}>
        <Link href={back} className={p.note}><Icon name="back" size={14} /> Voltar para #{view.title}</Link>
        <h1 className={p.title}><ChannelMark isPrivate={isPrivate} size={22} /> <ChannelName icon={view.icon} name={view.title} /></h1>
      </div>

      {view.canManage && (
        <form action={updateChannel} className={`${p.card} ${p.narrow}`}>
          {hidden}
          <b className={p.cardTitle}>Nome, ícone e descrição</b>
          <Field label="Nome" name="name" defaultValue={view.title} required maxLength={60} />
          <label className={p.label}>
            Descrição
            <textarea name="description" defaultValue={view.description ?? ""} maxLength={200} className={p.textarea} />
          </label>
          <fieldset className={c.iconField}>
            <legend className={p.label}>Ícone</legend>
            <div className={c.iconRadios}>
              <label title="Sem ícone (#)"><input type="radio" name="icon" value="" defaultChecked={!view.icon} /><span><Icon name={isPrivate ? "lock" : "hash"} size={16} /></span></label>
              {CHAT_ICONS.map((e) => (
                <label key={e}><input type="radio" name="icon" value={e} defaultChecked={view.icon === e} /><span>{e}</span></label>
              ))}
            </div>
          </fieldset>
          <div className={p.actions}><Button>Salvar</Button></div>
        </form>
      )}

      <section className={`${p.card} ${p.narrow}`}>
        <b className={p.cardTitle}>{isPrivate ? "Pessoas no canal" : "Quem vê este canal"} · {view.members.length}</b>
        {!isPrivate && <p className={p.note}>Canal público: todo mundo do workspace vê.</p>}
        <div className={p.people}>
          {view.members.map((m) => (
            <div key={m.id} className={p.person}>
              <Avatar id={m.id} name={m.name} small />
              <span className={p.personName}>{m.name}</span>
            </div>
          ))}
        </div>
      </section>

      {candidates.length > 0 && (
        <form action={addChannelMembers} className={`${p.card} ${p.narrow}`}>
          {hidden}
          <b className={p.cardTitle}>Adicionar pessoas</b>
          <div className={p.people}>
            {candidates.map((x) => (
              <label key={x.id} className={p.person}>
                <input type="checkbox" name="userIds" value={x.id} />
                <Avatar id={x.id} name={x.name} small />
                <span><div className={p.personName}>{x.name}</div><div className={p.personMail}>{x.email}</div></span>
              </label>
            ))}
          </div>
          <div className={p.actions}><Button>Adicionar</Button></div>
        </form>
      )}

      {isPrivate && (
        <form action={leaveChannel} className={`${p.card} ${p.narrow}`}>
          {hidden}
          <b className={p.cardTitle}>Sair do canal</b>
          <p className={p.note}>Você deixa de ver as mensagens. Alguém do canal pode te adicionar de novo.</p>
          <div className={p.actions}><Button variant="ghost">Sair do canal</Button></div>
        </form>
      )}

      {view.canManage && (
        <form action={deleteChannel} className={`${p.card} ${p.narrow} ${p.danger}`}>
          {hidden}
          <b className={`${p.cardTitle} ${p.dangerTitle}`}>Apagar canal</b>
          <p className={p.note}>Apaga o canal e todas as mensagens dele, para todo mundo. Não dá para desfazer.</p>
          <Field label={`Digite ${view.title} para confirmar`} name="confirm" required autoComplete="off" />
          <div className={p.actions}><Button variant="ghost">Apagar canal</Button></div>
        </form>
      )}
    </div>
  );
}
