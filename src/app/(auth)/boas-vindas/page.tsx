import { AuthCard, AuthForm } from "@/_components/auth/AuthCard";
import { TermsCheck } from "@/_components/auth/TermsCheck";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { requireUser } from "@/_lib/auth/dal";
import { confirmOnboarding, signOut } from "@/_data/auth.actions";
import { t } from "@/_i18n";

// Quem entrou com Google ainda não confirmou idade e termos.
export default async function BoasVindas({ searchParams }: PageProps<"/boas-vindas">) {
  await requireUser("/boas-vindas");
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard title={t.auth.boasVindas.titulo} subtitle={t.auth.boasVindas.sub}>
      {erro && <Alert>{erro}</Alert>}
      <AuthForm action={confirmOnboarding}>
        <TermsCheck />
        <Button>{t.auth.boasVindas.botao}</Button>
      </AuthForm>
      <form action={signOut}><Button variant="link">{t.comum.sair}</Button></form>
    </AuthCard>
  );
}
