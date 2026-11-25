"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/chat/Column.module.css";

/**
 * Mensagens em duas colunas no computador. No celular mostra uma de cada vez:
 * a lista em /mensagens, a conversa nas outras rotas. Marca o item aberto.
 */
export function ChatSplit({ column, children }: { column: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const isList = path.endsWith("/mensagens");
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-chat-href]").forEach((el) => {
      const on = path === el.dataset.chatHref || path.startsWith(`${el.dataset.chatHref}/`);
      el.classList.toggle(s.on, on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }, [path]);
  return (
    <div className={`${s.split} ${isList ? s.showList : s.showChat}`}>
      {column}
      <div className={s.pane}>{children}</div>
    </div>
  );
}

/** "Buscar conversas": filtra a lista na hora, sem ir ao servidor. */
export function ChatColumnFilter() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-chat-item]").forEach((el) => {
      el.hidden = Boolean(t) && !(el.dataset.chatItem ?? "").toLowerCase().includes(t);
    });
  }, [q]);
  return (
    <label className={s.srch}>
      <Icon name="search" />
      <input value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" />
    </label>
  );
}
