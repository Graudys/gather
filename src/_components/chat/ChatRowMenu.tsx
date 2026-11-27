"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/_components/ui/Icon";
import { CHAT_ICONS } from "@/lib/chat-icons";
import { setChatIcon } from "@/_data/chat.actions";
import s from "@/_styles/chat/Column.module.css";

/**
 * "⋯" ao lado do canal/grupo na lista: trocar o ícone e (canal) abrir os ajustes.
 * Só aparece para quem pode mudar; o servidor confere de novo.
 */
export function ChatRowMenu({ workspaceId, kind, id, icon, settingsHref }: { workspaceId: string; kind: "channel" | "dm"; id: string; icon: string | null; settingsHref?: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [, start] = useTransition();

  // A lista de canais rola e corta o que passa da borda: o menu fica "fixo" na tela.
  const toggle = (btn: HTMLButtonElement) => {
    if (open) return setOpen(false);
    const r = btn.getBoundingClientRect();
    const w = 300, h = 260;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    setPos({ top, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (v: string | null) => {
    setOpen(false);
    start(async () => {
      await setChatIcon({ workspaceId, kind, id, icon: v });
      router.refresh();
    });
  };

  return (
    <div className={`${s.rowMenu} ${open ? s.rowMenuOpen : ""}`} ref={box}>
      <button type="button" className={s.rowDots} onClick={(e) => toggle(e.currentTarget)} aria-haspopup="menu" aria-expanded={open} aria-label="Opções" title="Opções">
        <Icon name="more" size={16} />
      </button>
      {open && pos && (
        <div className={s.rowPop} role="menu" style={{ top: pos.top, left: pos.left }}>
          <div className={s.rowPopTitle}>Ícone</div>
          <div className={s.iconGridInline}>
            {CHAT_ICONS.map((e) => (
              <button key={e} type="button" role="menuitem" onClick={() => pick(e)} className={e === icon ? s.iconOn : ""} aria-label={`Usar ${e}`}>{e}</button>
            ))}
          </div>
          <button type="button" role="menuitem" className={s.rowPopItem} onClick={() => pick(null)}>Sem ícone</button>
          {settingsHref && (
            <Link href={settingsHref} role="menuitem" className={s.rowPopItem} onClick={() => setOpen(false)}>
              <Icon name="sliders" size={14} /> Ajustes do canal
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
