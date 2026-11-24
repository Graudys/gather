import type { Metadata } from "next";
import { AuthCard, AuthForm } from "@/_components/auth/AuthCard";
import { Captcha } from "@/_components/auth/Captcha";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { requestPasswordReset } from "@/_data/auth.actions";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: t.auth.esqueci.titulo };

export default async function EsqueciSenha({ searchParams }: PageProps<"/esqueci-senha">) {
  const { enviado } = (await searchParams) as { enviado?: string };
  return (
    <AuthCard title={t.auth.esqueci.titulo} subtitle={t.auth.esqueci.sub}>
      {enviado ? (
        <Alert tone="ok">{t.auth.esqueci.enviado}</Alert>
      ) : (
        <AuthForm action={requestPasswordReset}>
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" required maxLength={254} />
          <Captcha />
          <Button>{t.auth.esqueci.botao}</Button>
        </AuthForm>
      )}
    </AuthCard>
  );
}
