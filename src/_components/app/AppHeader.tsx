import Link from "next/link";
import { Logo } from "@/_components/ui/Logo";
import { Button } from "@/_components/ui/Button";
import { signOut } from "@/_data/auth.actions";
import { t } from "@/_i18n";
import s from "@/_styles/app/AppShell.module.css";

export function AppHeader({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  return (
    <header className={s.header}>
      <Link href="/app"><Logo /></Link>
      <span className={s.spacer} />
      {isAdmin && <Link href="/admin" className={s.adminBadge}>{t.admin.selo}</Link>}
      <span className={s.user}>{name}</span>
      <form action={signOut}><Button variant="link">{t.comum.sair}</Button></form>
    </header>
  );
}
