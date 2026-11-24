import { notFound } from "next/navigation";
import { requireUser, isPlatformAdminRow } from "@/lib/auth/dal";
import { AuthCard } from "@/components/ui";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Segundo fator", robots: { index: false } };

// A área de admin só abre com app autenticador (TOTP).
export default async function AdminMfa() {
  const user = await requireUser("/admin/mfa");
  if (!(await isPlatformAdminRow(user.id))) notFound();
  return (
    <AuthCard title="Confirme que é você" subtitle="A área de admin exige o código do app autenticador.">
      <MfaForm />
    </AuthCard>
  );
}
