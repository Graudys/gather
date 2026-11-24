import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthForm, AuthLinks, AuthNote } from "@/_components/auth/AuthCard";
import { GoogleButton } from "@/_components/auth/GoogleButton";
import { TermsCheck } from "@/_components/auth/TermsCheck";
import { Captcha } from "@/_components/auth/Captcha";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { signUp } from "@/_data/auth.actions";
import { isSignupOpen } from "@/_data/platform";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: t.auth.cadastro.titulo };

export default async function Cadastro({ searchParams }: PageProps<"/cadastro">) {
  const { erro } = (await searchParams) as { erro?: string };
  const c = t.auth.cadastro;

  // Teste fechado: só convidados (Supabase › Authentication › Users › Invite user).
  if (!(await isSignupOpen())) {
    return (
      <AuthCard title={c.fechadoTitulo} subtitle={c.fechadoTexto}>
        <AuthLinks><Link href="/entrar">{t.auth.entrar.titulo}</Link></AuthLinks>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={c.titulo} subtitle={c.sub}>
      {erro && <Alert>{erro}</Alert>}
      <GoogleButton />
      <AuthNote>{c.notaGoogle}</AuthNote>
      <AuthForm action={signUp}>
        <Field label={c.nome} name="name" autoComplete="name" required maxLength={LIMITES.nome} />
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" required maxLength={LIMITES.email} />
        <Field label={c.senha} name="password" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <TermsCheck />
        <Captcha />
        <Button>{c.botao}</Button>
      </AuthForm>
      <AuthLinks><span>{c.jaTem} <Link href="/entrar">{t.auth.entrar.titulo}</Link></span></AuthLinks>
    </AuthCard>
  );
}
