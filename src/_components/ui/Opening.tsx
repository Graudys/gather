"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoAnimated, Spinner } from "@/_components/ui/Brand";
import s from "@/_styles/ui/Splash.module.css";

/** Abertura (mockup "Carregando"): o logo se desenha enquanto o app carrega por trás. */
export function Opening({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(next);
    // Dá tempo da animação do logo começar; a tela seguinte já vem carregando.
    const t = window.setTimeout(() => router.replace(next), 700);
    return () => window.clearTimeout(t);
  }, [router, next]);
  return (
    <main className={s.splash}>
      <span className={s.bar} aria-hidden="true" />
      <LogoAnimated size={64} />
      <Spinner size={16} label="Abrindo o Gather…" />
    </main>
  );
}
