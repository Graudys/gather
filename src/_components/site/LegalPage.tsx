import type { ReactNode } from "react";
import s from "@/_styles/site/Site.module.css";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={s.legal}>
      <h1 className={s.legalTitle}>{title}</h1>
      {children}
    </main>
  );
}
