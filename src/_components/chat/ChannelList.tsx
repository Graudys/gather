"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SidebarChannel } from "@/types/domain";
import { ChannelMark, ChannelName } from "@/_components/chat/ChannelLabel";
import { ChatRowMenu } from "@/_components/chat/ChatRowMenu";
import { reorderChannels } from "@/_data/chat.actions";
import s from "@/_styles/chat/Column.module.css";

/**
 * Lista de canais. Dono e admins arrastam para mudar a ordem (vale para todo mundo).
 * Pelo teclado: com o canal em foco, Alt + seta para cima/baixo.
 */
export function ChannelList({ channels, base, workspaceId, canReorder }: { channels: SidebarChannel[]; base: string; workspaceId: string; canReorder: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState(channels);
  const [seen, setSeen] = useState(channels);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [, start] = useTransition();
  if (seen !== channels) {
    setSeen(channels);
    setOrder(channels);
  }

  const save = (next: SidebarChannel[]) => {
    setOrder(next);
    start(async () => {
      const r = await reorderChannels({ workspaceId, ids: next.map((c) => c.id) });
      if (!r.ok) setOrder(channels);
      router.refresh();
    });
  };
  const move = (id: string, to: number) => {
    const from = order.findIndex((c) => c.id === id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it!);
    save(next);
  };

  return (
    <>
      {order.map((c, i) => {
        const from = dragId ? order.findIndex((x) => x.id === dragId) : -1;
        const drop = overId === c.id && dragId !== c.id ? (from > i ? s.dropAbove : s.dropBelow) : "";
        return (
        <div
          key={c.id}
          className={`${s.row} ${dragId === c.id ? s.dragging : ""} ${drop}`}
          draggable={canReorder}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", c.id);
            setDragId(c.id);
          }}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setOverId(c.id);
          }}
          onDragLeave={() => setOverId((o) => (o === c.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) move(dragId, i);
            setDragId(null);
            setOverId(null);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
        >
          <Link
            href={`${base}/c/${c.id}`}
            className={`${s.nv} ${c.unread ? s.unread : ""}`}
            data-chat-item={c.name}
            data-chat-href={`${base}/c/${c.id}`}
            draggable={false}
            title={canReorder ? "Arraste para mudar a ordem" : undefined}
            onKeyDown={(e) => {
              if (!canReorder || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              move(c.id, i + (e.key === "ArrowUp" ? -1 : 1));
            }}
          >
            <ChannelMark isPrivate={c.visibility === "PRIVATE"} />
            <span className={s.name}><ChannelName icon={c.icon} name={c.name} /></span>
            {c.unread > 0 && <span className={s.bd}>{c.unread > 99 ? "99+" : c.unread}</span>}
          </Link>
          {c.canManage && <ChatRowMenu workspaceId={workspaceId} kind="channel" id={c.id} icon={c.icon} settingsHref={`${base}/c/${c.id}/ajustes`} />}
        </div>
        );
      })}
    </>
  );
}
