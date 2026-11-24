import type { ReactNode } from "react";
import { Logo } from "@/_components/ui/Logo";
import { t } from "@/_i18n";
import s from "@/_styles/auth/Auth.module.css";

/** Tela de entrada em duas colunas: marca à esquerda, formulário à direita. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.split}>
      <aside className={s.side} aria-hidden="true">
        <Logo />
        <div>
          <p className={s.slogan}>{t.auth.lado.lema}</p>
          <p className={s.sideText}>{t.auth.lado.texto}</p>
        </div>
        <p className={s.sideFoot}>{t.auth.lado.rodape}</p>
      </aside>
      <main className={s.page}>
        <div className={s.card}>
          <Logo />
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.sub}>{subtitle}</p>}
          <div className={s.body}>{children}</div>
        </div>
      </main>
    </div>
  );
}

export function AuthForm({ action, children }: { action: (form: FormData) => Promise<void>; children: ReactNode }) {
  return <form action={action} className={s.form}>{children}</form>;
}

export function AuthNote({ children }: { children: ReactNode }) {
  return <p className={s.note}>{children}</p>;
}

export function AuthLinks({ children }: { children: ReactNode }) {
  return <div className={s.links}>{children}</div>;
}
