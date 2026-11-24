import { AdminNav } from "@/_components/admin/AdminNav";
import { requirePlatformAdmin } from "@/_lib/auth/dal";
import s from "@/_styles/admin/AdminShell.module.css";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// Toda página daqui exige: estar em platform_admins + sessão com MFA (aal2).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className={s.shell}>
      <AdminNav />
      <main className={s.main}>{children}</main>
    </div>
  );
}
