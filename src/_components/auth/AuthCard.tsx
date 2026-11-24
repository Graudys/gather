import type { ReactNode } from "react";
import { Logo } from "@/_components/ui/Logo";
import s from "@/_styles/auth/Auth.module.css";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className={s.page}>
      <div className={s.card}>
        <Logo />
        <h1 className={s.title}>{title}</h1>
        {subtitle && <p className={s.sub}>{subtitle}</p>}
        <div className={s.body}>{children}</div>
      </div>
    </main>
  );
}

export function AuthForm({ action, children }: { action: (form: FormData) => Promise<void>; children: ReactNode }) {
  return <form action={action} className={s.form}>{children}</form>;
}

export function Divider({ children }: { children: ReactNode }) {
  return <div className={s.divider}>{children}</div>;
}

export function AuthNote({ children }: { children: ReactNode }) {
  return <p className={s.note}>{children}</p>;
}

export function AuthLinks({ children }: { children: ReactNode }) {
  return <div className={s.links}>{children}</div>;
}
