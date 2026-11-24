import Link from "next/link";
import { Logo } from "@/_components/ui/Logo";
import { t } from "@/_i18n";
import s from "@/_styles/admin/AdminShell.module.css";

export function AdminNav() {
  return (
    <nav className={s.nav} aria-label="Admin da plataforma">
      <div className={s.brand}><Logo /><span className={s.badge}>{t.admin.selo}</span></div>
      <Link className={s.link} href="/admin">{t.admin.menu.visao}</Link>
      <Link className={s.link} href="/admin/erros">{t.admin.menu.erros}</Link>
      <Link className={`${s.link} ${s.back}`} href="/app">{t.comum.voltarAoApp}</Link>
    </nav>
  );
}

export function AdminTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <h1 className={s.title}>{title}</h1>
      {sub && <p className={s.sub}>{sub}</p>}
    </>
  );
}
