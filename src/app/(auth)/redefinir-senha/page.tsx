import type { Metadata } from "next";
import { AuthCard, AuthForm } from "@/_components/auth/AuthCard";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { requireUser } from "@/_lib/auth/dal";
import { updatePassword } from "@/_data/auth.actions";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: t.auth.redefinir.titulo };

export default async function RedefinirSenha({ searchParams }: PageProps<"/redefinir-senha">) {
  await requireUser("/redefinir-senha");
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard title={t.auth.redefinir.titulo} subtitle={t.auth.redefinir.sub}>
      {erro && <Alert>{erro}</Alert>}
      <AuthForm action={updatePassword}>
        <Field label={t.auth.redefinir.campo} name="password" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <Button>{t.auth.redefinir.botao}</Button>
      </AuthForm>
    </AuthCard>
  );
}
