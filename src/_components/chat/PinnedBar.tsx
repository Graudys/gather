"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/types/domain";
import { togglePin } from "@/_data/chat.actions";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/chat/Chat.module.css";

/** "📌 N fixadas" no topo do canal: abre a lista; anotação abre para ler. */
export function PinnedBar({ items, workspaceId }: { items: ChatMessage[]; workspaceId: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!items.length) return null;
  const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
  return (
    <div className={s.pinWrap} ref={box}>
      <button type="button" className={s.chip} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Mensagens fixadas">
        <Icon name="pin" size={13} /> {items.length} {items.length === 1 ? "fixada" : "fixadas"}
      </button>
      {open && (
        <div className={s.pinPop} role="dialog" aria-label="Fixadas">
          <div className={s.pinHead}>Fixadas no canal <small>não somem pelo prazo das mensagens</small></div>
          <ul>
            {items.map((m) => (
              <li key={m.id}>
                {m.note ? (
                  <Link href={`/app/w/${workspaceId}/nota/${m.note.id}`} className={s.pinItem} onClick={() => setOpen(false)}>
                    <Icon name="notebook" size={15} />
                    <span><b>{m.note.title}</b><small>Anotação · {m.sender?.name ?? "alguém"} · {date(m.createdAt)}</small></span>
                  </Link>
                ) : (
                  <div className={s.pinItem}>
                    <Icon name="chat" size={15} />
                    <span><b>{m.content.slice(0, 120) || (m.files.length ? `${m.files.length} arquivo(s)` : "Mensagem")}</b><small>{m.sender?.name ?? "alguém"} · {date(m.createdAt)}</small></span>
                  </div>
                )}
                {m.canPin && (
                  <button type="button" className={s.pinOff} title="Desafixar" aria-label="Desafixar" onClick={() => start(async () => { await togglePin({ workspaceId, messageId: m.id }); router.refresh(); })}>
                    <Icon name="unpin" size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
