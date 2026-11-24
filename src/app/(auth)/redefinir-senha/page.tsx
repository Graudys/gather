import type { Metadata } from "next";
import { AuthCard, Field, Button, Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenha({ searchParams }: PageProps<"/redefinir-senha">) {
  await requireUser("/redefinir-senha");
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard title="Nova senha" subtitle="Ao salvar, os outros aparelhos saem da conta.">
      {erro && <Alert>{erro}</Alert>}
      <form action={updatePassword} className="flex flex-col gap-4">
        <Field label="Nova senha (mínimo 10 caracteres)" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
        <Button>Salvar senha</Button>
      </form>
    </AuthCard>
  );
}
