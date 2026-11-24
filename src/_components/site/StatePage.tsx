import type { ReactNode } from "react";
import s from "@/_styles/site/Site.module.css";

/** Tela simples de estado: erro, página não encontrada, etc. */
export function StatePage({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className={s.state}>
      <h1 className={s.stateTitle}>{title}</h1>
      <p className={s.stateText}>{text}</p>
      {children}
    </main>
  );
}
