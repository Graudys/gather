import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthForm } from "@/_components/auth/AuthCard";
import { TermsCheck } from "@/_components/auth/TermsCheck";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { completeFirstAccess } from "@/_data/auth.actions";
import { requireUser } from "@/_lib/auth/dal";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import s from "@/_styles/auth/Auth.module.css";

export const metadata: Metadata = { title: "Primeiro acesso" };

const P = t.auth.primeiro;
const ERROS: Record<string, string> = {
  erroIgual: P.erroIgual,
  erroTemp: P.erroTemp,
  erroVazada: P.erroVazada,
  erroCaixas: P.erroCaixas,
  senhaCurta: P.regras,
  muitas: t.auth.erros.muitas,
};

export default async function PrimeiroAcesso({ searchParams }: PageProps<"/primeiro-acesso">) {
  const user = await requireUser("/primeiro-acesso");
  if (user.ready) redirect("/app");
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard
      title={P.titulo}
      subtitle={<>Primeiro acesso de <span className={s.email}>{user.email}</span>. A senha temporária deixa de valer quando você salvar.</>}
    >
      {erro && <Alert>{ERROS[erro] ?? t.auth.erros.geral}</Alert>}
      <AuthForm action={completeFirstAccess}>
        <Field label={P.senha} name="password" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <p className={s.rules}>{P.regras}</p>
        <Field label={P.repetir} name="confirm" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <TermsCheck />
        <Button block>{P.botao}</Button>
      </AuthForm>
    </AuthCard>
  );
}
