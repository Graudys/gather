"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import s from "@/_styles/ui/NavProgress.module.css";

/**
 * Barra fina no topo (mockup "Barra no topo"): começa ao clicar num link
 * interno e termina quando a nova tela chega. (Formulários mostram o
 * estado no próprio botão: "Enviando…".)
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const key = `${path}?${search.toString()}`;
  // Guarda em qual tela a navegação começou; chegou em outra = terminou.
  const [from, setFrom] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const done = from !== null && from !== key;

  useEffect(() => {
    const start = () => {
      setFrom(`${location.pathname}?${new URLSearchParams(location.search).toString()}`);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFrom(null), 12_000); // segurança (ação sem troca de tela)
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (url.pathname.startsWith("/api/") || url.pathname.endsWith(".csv")) return;
      start();
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Chegou a nova tela: completa e some.
  useEffect(() => {
    if (!done) return;
    window.clearTimeout(timer.current);
    const t = window.setTimeout(() => setFrom(null), 350);
    return () => window.clearTimeout(t);
  }, [done]);

  if (from === null) return null;
  return <span className={`${s.bar} ${done ? s.done : ""}`} aria-hidden="true" />;
}
