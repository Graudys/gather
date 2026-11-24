import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, Field, Button, Alert } from "@/components/ui";
import { Captcha } from "@/components/Captcha";
import { signIn, signInWithGoogle } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { erro, next } = (await searchParams) as { erro?: string; next?: string };
  return (
    <AuthCard title="Entrar" subtitle="Bom te ver de novo.">
      {erro && <Alert>{erro}</Alert>}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Button variant="ghost" className="w-full">Continuar com Google</Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-neutral-500"><hr className="flex-1 border-white/10" />ou<hr className="flex-1 border-white/10" /></div>
      <form action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="E-mail" name="email" type="email" autoComplete="email" required maxLength={254} />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required maxLength={72} />
        <Captcha />
        <Button>Entrar</Button>
      </form>
      <div className="flex justify-between text-sm text-neutral-400">
        <Link href="/esqueci-senha" className="hover:text-white">Esqueci a senha</Link>
        <Link href="/cadastro" className="hover:text-white">Criar conta</Link>
      </div>
    </AuthCard>
  );
}
