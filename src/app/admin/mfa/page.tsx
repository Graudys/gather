import { notFound } from "next/navigation";
import { AuthCard } from "@/_components/auth/AuthCard";
import { MfaForm } from "@/_components/admin/MfaForm";
import { requireUser, isPlatformAdminRow } from "@/_lib/auth/dal";
import { t } from "@/_i18n";

export const metadata = { title: "Segundo fator", robots: { index: false } };

// A área de admin só abre com app autenticador (TOTP).
export default async function AdminMfa() {
  const user = await requireUser("/admin/mfa");
  if (!(await isPlatformAdminRow(user.id))) notFound();
  return (
    <AuthCard title={t.admin.mfa.titulo} subtitle={t.admin.mfa.sub}>
      <MfaForm />
    </AuthCard>
  );
}
