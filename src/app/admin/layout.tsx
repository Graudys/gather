import { AdminNav } from "@/_components/admin/AdminNav";
import { requireAdmin } from "@/_lib/auth/dal";
import s from "@/_styles/admin/AdminShell.module.css";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// Toda página daqui exige role = "admin". Cada função de _data/admin* e
// _data/people* confere de novo (o layout não protege Server Actions).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className={s.shell}>
      <AdminNav />
      <main className={s.main}>{children}</main>
    </div>
  );
}
