import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { ChatView } from "@/types/domain";
import { MessageList, LoadMore } from "@/_components/chat/MessageList";
import { Composer } from "@/_components/chat/Composer";
import s from "@/_styles/chat/Chat.module.css";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/** Conversa aberta: cabeçalho, mensagens, caixa de texto e (se aberta) a thread. */
export function ChatPane({ view, workspaceId, base, limit, months }: {
  view: ChatView;
  workspaceId: string;
  base: string; // /app/w/<ws>/c/<canal> ou /app/w/<ws>/dm/<conversa>
  limit: number;
  months: number;
}) {
  const isChannel = view.target.kind === "channel";
  const target = isChannel ? { channelId: view.target.id } : { conversationId: view.target.id };
  const limitQ = limit > 50 ? `limite=${limit}&` : "";
  const threadBase = `${base}?${limitQ}thread=`;
  const placeholder = isChannel ? `Mensagem em #${view.title}` : `Mensagem para ${view.title}`;

  return (
    <>
      <section className={s.chat} aria-label={view.title}>
        <header className={s.head}>
          <h1 className={s.title}>
            {isChannel && <span className={s.titleHash}><Icon name={view.visibility === "PRIVATE" ? "lock" : "hash"} size={18} /></span>}
            {view.title}
          </h1>
          {view.description && <span className={s.desc}>{view.description}</span>}
          <div className={s.headRight}>
            <span className={`${s.chip} ${s.hideSm}`} title="Prazo das mensagens neste workspace">
              <Icon name="clock" size={13} /> Mensagens somem após {months} {months === 1 ? "mês" : "meses"}
            </span>
            {isChannel ? (
              <Link href={`${base}/ajustes`} className={s.chip} title="Pessoas e ajustes do canal">
                <Icon name="users" size={14} /> {view.members.length}
              </Link>
            ) : (
              <span className={s.chip}><Icon name="users" size={14} /> {view.members.length}</span>
            )}
          </div>
        </header>

        <div className={s.scroll}>
          {view.messages.length === 0 ? (
            <div className={s.empty}>
              <p className={s.emptyTitle}>{isChannel ? `Bem-vindo a #${view.title}` : "Comecem a conversa"}</p>
              <p>Nenhuma mensagem ainda. Diga oi!</p>
            </div>
          ) : (
            <MessageList
              messages={view.messages}
              workspaceId={workspaceId}
              threadBase={threadBase}
              header={
                <>
                  {view.hasMore && limit < 500 ? (
                    <LoadMore href={`${base}?limite=${Math.min(limit + 100, 500)}`} />
                  ) : (
                    <li className={s.notice}>
                      Mensagens de antes de {shortDate(view.cutoff)} já foram apagadas, como definido nas configurações do workspace.
                    </li>
                  )}
                </>
              }
            />
          )}
        </div>

        <Composer workspaceId={workspaceId} target={target} placeholder={placeholder} />
      </section>

      {view.thread && (
        <aside className={s.thread} aria-label="Thread">
          <div className={s.threadHead}>
            <div>
              <div className={s.threadTitle}>Thread</div>
              <div className={s.threadSub}>{isChannel ? `#${view.title}` : view.title}</div>
            </div>
            <Link href={limit > 50 ? `${base}?limite=${limit}` : base} className={s.close} aria-label="Fechar thread" scroll={false}>×</Link>
          </div>
          <div className={s.scroll}>
            <div className={s.threadList}>
              <MessageList messages={[view.thread.parent]} workspaceId={workspaceId} inThread />
              <p className={s.threadCount}>
                {view.thread.replies.length} {view.thread.replies.length === 1 ? "resposta" : "respostas"}
              </p>
              <MessageList messages={view.thread.replies} workspaceId={workspaceId} inThread />
            </div>
          </div>
          {!view.thread.parent.deleted && (
            <Composer workspaceId={workspaceId} target={target} parentId={view.thread.parent.id} placeholder="Responder na thread" compact />
          )}
        </aside>
      )}
    </>
  );
}
