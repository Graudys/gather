"use client";
import { Icon } from "@/_components/ui/Icon";
import { MeetingCard, TaskCard } from "@/_components/chat/ChatCards";
import { TaskFromMessage } from "@/_components/chat/TaskFromMessage";
import { MENTION_RE } from "@/lib/mentions";
import { FileList } from "@/_components/files/FileList";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/types/domain";
import { deleteMessage, editMessage, togglePin, toggleReaction } from "@/_data/chat.actions";
import { REACTIONS } from "@/lib/chat";
import { LIMITES } from "@/lib/validation";
import { Button } from "@/_components/ui/Button";
import { Avatar } from "@/_components/chat/Avatar";
import s from "@/_styles/chat/Chat.module.css";

type Props = {
  m: ChatMessage;
  workspaceId: string;
  time: string; // já formatado no servidor (mesmo fuso para todo mundo)
  compact: boolean; // mesma pessoa, poucos minutos depois: sem cabeçalho
  threadHref?: string; // ausente dentro da própria thread
};

// O texto é renderizado pelo React: o que a pessoa digita nunca vira HTML.
export function MessageItem({ m, workspaceId, time, compact, threadHref }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const [, startPin] = useTransition();
  const pin = () => startPin(async () => { await togglePin({ workspaceId, messageId: m.id }); router.refresh(); });
  const [picking, setPicking] = useState(false);
  const name = m.sender?.name ?? "Pessoa removida";

  return (
    <li
      className={`${s.msg} ${compact ? s.compact : ""}`}
      onMouseLeave={(e) => {
        // Saiu de cima da mensagem: fecha o seletor de reações e solta o foco da barra.
        if (!picking) return;
        setPicking(false);
        if (e.currentTarget.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && picking) setPicking(false);
      }}
    >
      {compact ? <span className={s.compactTime}>{time}</span> : <Avatar id={m.sender?.id ?? "x"} name={name} />}
      <div>
        {!compact && (
          <div className={s.meta}>
            <span className={s.name}>{name}</span>
            <span className={s.time}>{time}</span>
            {m.pinned && <span className={s.pinTag} title="Fixada no topo do canal"><Icon name="pin" size={11} /> Fixada</span>}
          </div>
        )}

        {m.deleted ? (
          <p className={s.deleted}>mensagem apagada</p>
        ) : editing ? (
          <form
            className={s.editBox}
            action={async (fd) => {
              await editMessage(fd);
              setEditing(false);
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="messageId" value={m.id} />
            <div className={s.box}>
              <textarea
                name="content"
                defaultValue={m.content}
                required
                maxLength={LIMITES.mensagem}
                className={s.textarea}
                autoFocus
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </div>
            <div className={s.editRow}>
              <Button>Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <span>Esc cancela · Enter salva</span>
            </div>
          </form>
        ) : (
          <>
            {(m.content || m.deleted) && (
              <p className={s.text}>
                <WithMentions text={m.content} />
                {m.edited && <span className={s.edited}>(editada)</span>}
              </p>
            )}
            {m.note && (
              <Link href={`/app/w/${workspaceId}/nota/${m.note.id}`} className={s.noteCard}>
                <span className={s.noteCardIc}><Icon name="notebook" size={18} /></span>
                <span className={s.noteCardText}>
                  <b>{m.note.title}</b>
                  {m.note.preview && <small>{m.note.preview}</small>}
                  <em>Anotação · abrir para ler</em>
                </span>
              </Link>
            )}
            {m.meeting && <MeetingCard meeting={m.meeting} workspaceId={workspaceId} />}
            {m.task && <TaskCard task={m.task} workspaceId={workspaceId} />}
            <FileList files={m.files} />
          </>
        )}

        {m.reactions.length > 0 && (
          <div className={s.reactions}>
            {m.reactions.map((r) => (
              <form key={r.emoji} action={toggleReaction}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="messageId" value={m.id} />
                <input type="hidden" name="emoji" value={r.emoji} />
                <button className={`${s.reaction} ${r.mine ? s.reactionMine : ""}`} aria-pressed={r.mine} title={r.mine ? "Tirar sua reação" : "Reagir"}>
                  {r.emoji} <span>{r.count}</span>
                </button>
              </form>
            ))}
          </div>
        )}

        {threadHref && m.replyCount > 0 && (
          <Link href={threadHref} className={s.replies} scroll={false}>
            {m.replyCount} {m.replyCount === 1 ? "resposta" : "respostas"} →
          </Link>
        )}

        {/* Some junto com a mensagem: depois de apagar não há mais o que confirmar */}
        {confirming && !m.deleted && (
          <div className={s.confirm}>
            <span>Apagar para todo mundo?</span>
            <form
              action={async (fd) => {
                await deleteMessage(fd);
                setConfirming(false);
              }}
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="messageId" value={m.id} />
              <Button variant="ghost">Apagar</Button>
            </form>
            <button type="button" className={s.tool} onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {!m.deleted && !editing && (
        <div className={s.tools}>
          {picking ? (
            REACTIONS.map((e) => (
              <form
                key={e}
                className={s.toolForm}
                action={async (fd) => {
                  // Fecha o seletor e tira o foco (senão a barra fica presa aberta).
                  setPicking(false);
                  (document.activeElement as HTMLElement | null)?.blur();
                  await toggleReaction(fd);
                }}
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="messageId" value={m.id} />
                <input type="hidden" name="emoji" value={e} />
                <button className={s.tool} aria-label={`Reagir com ${e}`}>{e}</button>
              </form>
            )).concat(
              <button key="x" type="button" className={s.tool} onClick={() => setPicking(false)} aria-label="Fechar reações"><Icon name="x" size={14} /></button>,
            )
          ) : (
            <>
              <button type="button" className={s.tool} onClick={() => setPicking(true)} title="Reagir"><Icon name="smile" /></button>
              {threadHref && <Link href={threadHref} className={s.tool} scroll={false} title="Responder em thread"><Icon name="reply" /></Link>}
              {!m.deleted && !m.task && !m.note && <TaskFromMessage workspaceId={workspaceId} messageId={m.id} text={m.content} className={s.tool} />}
              {m.canPin && <button type="button" className={s.tool} onClick={pin} title={m.pinned ? "Desafixar" : "Fixar no topo do canal"}><Icon name={m.pinned ? "unpin" : "pin"} /></button>}
              {m.canEdit && <button type="button" className={s.tool} onClick={() => setEditing(true)} title="Editar"><Icon name="edit" /></button>}
              {m.canDelete && <button type="button" className={`${s.tool} ${s.toolDanger}`} onClick={() => setConfirming(true)} title="Apagar"><Icon name="trash" /></button>}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Destaca "@apelido" no texto (só visual; o texto continua texto, sem HTML). */
function WithMentions({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const at = m.index! + m[1]!.length;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(<span key={at} className={s.mention}>@{m[2]}</span>);
    last = at + 1 + m[2]!.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
