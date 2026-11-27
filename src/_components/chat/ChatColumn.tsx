import Link from "next/link";
import type { WorkspaceShell } from "@/types/domain";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { ChatColumnFilter } from "@/_components/chat/ChatSplit";
import { ChatGlyph } from "@/_components/chat/ChannelLabel";
import { ChannelList } from "@/_components/chat/ChannelList";
import { ChatRowMenu } from "@/_components/chat/ChatRowMenu";
import s from "@/_styles/chat/Column.module.css";

/** Coluna de Mensagens (mockup "Chat"): canais e conversas diretas, com não lidas. */
export function ChatColumn({ shell }: { shell: WorkspaceShell }) {
  const base = `/app/w/${shell.workspace.id}`;
  const personal = shell.workspace.kind === "PERSONAL";
  return (
    <aside className={s.col} aria-label="Conversas">
      <div className={s.head}>
        <h2 className={s.title}>Mensagens</h2>
        {!personal && <Link href={`${base}/nova-conversa`} className={s.add} aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" /></Link>}
      </div>
      <ChatColumnFilter />
      <div className={s.list} data-chat-list>
        <div className={s.sec}>
          <span>Canais</span>
          <Link href={`${base}/novo-canal`} className={s.add} aria-label="Novo canal" title="Novo canal"><Icon name="plus" size={14} /></Link>
        </div>
        {shell.channels.length === 0 && <p className={s.empty}>Nenhum canal ainda.</p>}
        <ChannelList channels={shell.channels} base={base} workspaceId={shell.workspace.id} canReorder={shell.role === "OWNER" || shell.role === "ADMIN"} />
        {!personal && (
          <>
            <div className={s.sec}>
              <span>Conversas diretas</span>
              <Link href={`${base}/nova-conversa`} className={s.add} aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" size={14} /></Link>
            </div>
            {shell.conversations.length === 0 && <p className={s.empty}>Nenhuma conversa ainda.</p>}
            {shell.conversations.map((c) => (
              <div key={c.id} className={s.row}>
                <Link href={`${base}/dm/${c.id}`} className={`${s.nv} ${c.unread ? s.unread : ""}`} data-chat-item={c.title} data-chat-href={`${base}/dm/${c.id}`}>
                  {c.icon ? <ChatGlyph icon={c.icon} /> : <Avatar id={c.id} name={c.title} small />}
                  <span className={s.name}>{c.title}</span>
                  {c.unread > 0 && <span className={s.bd}>{c.unread > 99 ? "99+" : c.unread}</span>}
                </Link>
                {c.kind === "GROUP" && <ChatRowMenu workspaceId={shell.workspace.id} kind="dm" id={c.id} icon={c.icon} />}
              </div>
            ))}
          </>
        )}
      </div>
      <p className={s.retention}>
        <Icon name="clock" size={13} /> Mensagens somem após {shell.retention.messageMonths} {shell.retention.messageMonths === 1 ? "mês" : "meses"}
      </p>
    </aside>
  );
}
