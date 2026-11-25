"use client";
import { Icon } from "@/_components/ui/Icon";
import { FileList } from "@/_components/files/FileList";
import Link from "next/link";
import { useState } from "react";
import type { ChatMessage } from "@/types/domain";
import { deleteMessage, editMessage, toggleReaction } from "@/_data/chat.actions";
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
                {m.content}
                {m.edited && <span className={s.edited}>(editada)</span>}
              </p>
            )}
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

        {confirming && (
          <div className={s.confirm}>
            <span>Apagar para todo mundo?</span>
            <form action={deleteMessage}>
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
              {m.canEdit && <button type="button" className={s.tool} onClick={() => setEditing(true)} title="Editar"><Icon name="edit" /></button>}
              {m.canDelete && <button type="button" className={`${s.tool} ${s.toolDanger}`} onClick={() => setConfirming(true)} title="Apagar"><Icon name="trash" /></button>}
            </>
          )}
        </div>
      )}
    </li>
  );
}
