import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthForm, AuthLinks, Divider } from "@/_components/auth/AuthCard";
import { GoogleButton } from "@/_components/auth/GoogleButton";
import { Captcha } from "@/_components/auth/Captcha";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { signIn } from "@/_data/auth.actions";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: t.auth.entrar.titulo };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { erro, next } = (await searchParams) as { erro?: string; next?: string };
  return (
    <AuthCard title={t.auth.entrar.titulo} subtitle={t.auth.entrar.sub}>
      {erro && <Alert>{erro}</Alert>}
      <GoogleButton next={next} />
      <Divider>{t.comum.ou}</Divider>
      <AuthForm action={signIn}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required maxLength={254} />
        <Field label={t.auth.senha} name="password" type="password" autoComplete="current-password" required maxLength={72} />
        <Captcha />
        <Button>{t.auth.entrar.botao}</Button>
      </AuthForm>
      <AuthLinks>
        <Link href="/esqueci-senha">{t.auth.entrar.esqueci}</Link>
        <Link href="/cadastro">{t.auth.entrar.criar}</Link>
      </AuthLinks>
    </AuthCard>
  );
}
