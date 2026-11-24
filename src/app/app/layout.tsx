import { AppHeader } from "@/_components/app/AppHeader";
import { requireReadyUser } from "@/_lib/auth/dal";
import s from "@/_styles/app/AppShell.module.css";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireReadyUser("/app");
  return (
    <div className={s.shell}>
      <AppHeader name={user.name} isAdmin={user.role === "admin"} />
      <div className={s.content}>{children}</div>
    </div>
  );
}
