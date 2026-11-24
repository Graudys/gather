import { AppHeader } from "@/_components/app/AppHeader";
import { requireReadyUser, isPlatformAdminRow } from "@/_lib/auth/dal";
import s from "@/_styles/app/AppShell.module.css";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireReadyUser("/app");
  const isAdmin = await isPlatformAdminRow(user.id);
  return (
    <div className={s.shell}>
      <AppHeader name={user.displayName} isAdmin={isAdmin} />
      <div className={s.content}>{children}</div>
    </div>
  );
}
