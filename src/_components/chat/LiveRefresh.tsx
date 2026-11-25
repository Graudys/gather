"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Atualização automática (um só em todo o app).
 * Pergunta ao /api/pulso se algo mudou; só recarrega a tela quando muda.
 * Pausa com a aba escondida e confere de novo ao voltar.
 */
export function LiveRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  const path = usePathname();
  const last = useRef<string | null>(null);
  const ws = /^\/app\/w\/([0-9a-f-]{36})/.exec(path)?.[1] ?? "";

  useEffect(() => {
    last.current = null; // trocou de workspace: começa de novo
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch(`/api/pulso${ws ? `?w=${ws}` : ""}`, { cache: "no-store" });
        if (res.ok) {
          const { v } = (await res.json()) as { v: string };
          if (last.current !== null && v !== last.current) router.refresh();
          last.current = v;
        }
      } catch {
        // sem rede: tenta de novo no próximo ciclo
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, every, ws]);
  return null;
}
