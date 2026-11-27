"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/_components/ui/Icon";
import { clearRead, markAllRead, readNotification, recentNotifications } from "@/_data/notifications.actions";
import { savePushSubscription } from "@/_data/push.actions";
import type { NotificationItem } from "@/_data/notifications";
import { enablePush, pushState } from "@/_components/pwa/sw";
import { ago, kindOf } from "./kinds";
import n from "@/_styles/app/Notifications.module.css";
import s from "@/_styles/shell/Shell.module.css";

/**
 * Sino da barra do topo: abre um card com os avisos mais recentes.
 * Clicar num aviso marca como lido na hora (sem F5) e leva até ele.
 * Também oferece ligar as notificações do sistema (Windows, celular).
 */
export function NotificationBell({ unread: initial }: { unread: number }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initial);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [push, setPush] = useState<string>("sem-suporte");
  const [pending, start] = useTransition();

  // O número do sino acompanha o servidor (o pulso do app atualiza a página).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setUnread(initial);
  }

  const load = () =>
    start(async () => {
      const r = await recentNotifications();
      setItems(r.items);
      setUnread(r.unread);
    });

  useEffect(() => {
    if (!open) return;
    load();
    void pushState().then(setPush);
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, initial]);

  function go(it: NotificationItem) {
    // Some o destaque na hora; o servidor confirma em seguida.
    if (!it.read) {
      setItems((xs) => xs?.map((x) => (x.id === it.id ? { ...x, read: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    start(async () => {
      const r = await readNotification(it.id);
      router.push(r.href);
      router.refresh();
    });
  }

  function readAll() {
    setItems((xs) => xs?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
    start(async () => {
      await markAllRead();
      router.refresh();
    });
  }

  function clearAllRead() {
    setItems((xs) => xs?.filter((x) => !x.read) ?? null);
    start(async () => {
      await clearRead();
      load();
      router.refresh();
    });
  }

  const hasRead = items?.some((x) => x.read) ?? false;
  return (
    <div className={s.bell} ref={box}>
      <button
        type="button"
        className={s.ic}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notificações${unread ? `: ${unread} novas` : ""}`}
        title="Notificações"
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className={s.dot}>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className={s.bellCard} role="dialog" aria-label="Notificações">
          <div className={s.bellHead}>
            <b>Notificações</b>
            {unread > 0 && <span className={s.bellCount}>{unread} novas</span>}
            <span style={{ flex: 1 }} />
            {unread > 0 && <button type="button" className={s.bellLink} onClick={readAll}>Marcar como lidas</button>}
            {hasRead && <button type="button" className={`${s.bellLink} ${s.bellQuiet}`} onClick={clearAllRead}>Limpar lidas</button>}
          </div>

          {push === "desligado" && (
            <div className={s.bellPush}>
              <Icon name="bell" size={14} />
              <span>Receba os avisos no Windows ou no celular, mesmo com o Gather fechado.</span>
              <button
                type="button"
                className={s.bellLink}
                onClick={async () => {
                  const r = await enablePush(savePushSubscription);
                  setPush(r === "erro" ? "desligado" : r);
                }}
              >
                Ligar
              </button>
            </div>
          )}
          {push === "bloqueado" && (
            <div className={s.bellPush}>
              <Icon name="info" size={14} />
              <span>As notificações do sistema estão bloqueadas neste navegador. Libere no cadeado da barra de endereço.</span>
            </div>
          )}

          <ul className={s.bellList} aria-busy={pending && !items}>
            {items === null && <li className={s.bellEmpty}>Carregando…</li>}
            {items?.length === 0 && <li className={s.bellEmpty}>Nenhum aviso por enquanto.</li>}
            {items?.map((it) => {
              const [icon, color, chip] = kindOf(it.type);
              return (
                <li key={it.id}>
                  <button type="button" className={`${s.bellItem} ${it.read ? "" : s.bellUnread}`} onClick={() => go(it)}>
                    <span className={`${n.icon} ${color}`} style={{ width: 30, height: 30, borderRadius: 8 }}><Icon name={icon} size={14} /></span>
                    <span className={s.bellText}>
                      <span className={s.bellTitle}>{it.title}{it.count > 1 && <small> · {it.count} novas</small>}</span>
                      <span className={s.bellMeta}>{chip}{it.workspace ? ` · ${it.workspace}` : ""} · {ago(it.at)}</span>
                    </span>
                    {!it.read && <span className={n.dot} aria-label="Não lida" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/app/notificacoes" className={s.bellAll} onClick={() => setOpen(false)}>Ver todas as notificações</Link>
        </div>
      )}
    </div>
  );
}
