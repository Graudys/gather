import type { ReactNode } from "react";
import s from "@/_styles/site/Site.module.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className={s.legal}>
      <h1 className={s.legalTitle}>{title}</h1>
      <p className={s.updated}>Atualizado em {updated}</p>
      {children}
    </main>
  );
}
