import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthForm, AuthLinks, AuthNote } from "@/_components/auth/AuthCard";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { signIn } from "@/_data/auth.actions";
import { getSessionUser } from "@/_lib/auth/dal";
import { t } from "@/_i18n";
import { DeviceSignedOut } from "@/_components/pwa/DeviceSignedOut";

export const metadata: Metadata = { title: "Entrar" };

const ERROS = t.auth.erros;

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  // Já entrou? Vai direto para o app (ou para o primeiro acesso).
  const user = await getSessionUser();
  if (user) redirect(user.ready ? "/app" : "/primeiro-acesso");

  const { erro, next, saiu } = (await searchParams) as { erro?: string; next?: string; saiu?: string };
  const msg = erro ? (ERROS[erro as keyof typeof ERROS] ?? ERROS.geral) : null;
  return (
    <AuthCard title={t.auth.entrar.titulo} subtitle={t.auth.entrar.sub}>
      {saiu === "1" && <DeviceSignedOut />}
      {msg && <Alert>{msg}</Alert>}
      <AuthForm action={signIn}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required maxLength={254} />
        <Field label={t.auth.senha} name="password" type="password" autoComplete="current-password" required maxLength={72} />
        <Button block>{t.auth.entrar.botao}</Button>
      </AuthForm>
      <AuthLinks>
        <Link href="/esqueci-senha">{t.auth.entrar.esqueci}</Link>
      </AuthLinks>
      <AuthNote>{t.auth.entrar.nota}</AuthNote>
    </AuthCard>
  );
}
