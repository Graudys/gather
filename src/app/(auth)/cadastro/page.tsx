import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, Field, Button, Alert, Check } from "@/components/ui";
import { Captcha } from "@/components/Captcha";
import { signUp, signInWithGoogle } from "../actions";

export const metadata: Metadata = { title: "Criar conta" };

export default async function Cadastro({ searchParams }: PageProps<"/cadastro">) {
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard title="Criar conta" subtitle="Grátis. Sem cartão.">
      {erro && <Alert>{erro}</Alert>}
      <form action={signInWithGoogle}>
        <Button variant="ghost" className="w-full">Continuar com Google</Button>
      </form>
      <p className="text-xs text-neutral-500">Com Google, você confirma idade e termos no primeiro acesso.</p>
      <form action={signUp} className="flex flex-col gap-4">
        <Field label="Seu nome" name="name" autoComplete="name" required maxLength={80} />
        <Field label="E-mail" name="email" type="email" autoComplete="email" required maxLength={254} />
        <Field label="Senha (mínimo 10 caracteres)" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
        <Check name="age">Tenho 18 anos ou mais.</Check>
        <Check name="terms">
          Li e aceito os <Link className="underline" href="/termos">Termos</Link> e a{" "}
          <Link className="underline" href="/privacidade">Política de Privacidade</Link>.
        </Check>
        <Captcha />
        <Button>Criar conta</Button>
      </form>
      <p className="text-sm text-neutral-400">Já tem conta? <Link href="/entrar" className="text-white">Entrar</Link></p>
    </AuthCard>
  );
}
