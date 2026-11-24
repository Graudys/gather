import Link from "next/link";
import { AuthCard, Button, Alert, Check } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { confirmOnboarding, signOut } from "../actions";

// Quem entrou com Google ainda não confirmou idade e termos.
export default async function BoasVindas({ searchParams }: PageProps<"/boas-vindas">) {
  await requireUser("/boas-vindas");
  const { erro } = (await searchParams) as { erro?: string };
  return (
    <AuthCard title="Quase lá" subtitle="Antes de começar, confirme duas coisas.">
      {erro && <Alert>{erro}</Alert>}
      <form action={confirmOnboarding} className="flex flex-col gap-4">
        <Check name="age">Tenho 18 anos ou mais.</Check>
        <Check name="terms">
          Li e aceito os <Link className="underline" href="/termos">Termos</Link> e a{" "}
          <Link className="underline" href="/privacidade">Política de Privacidade</Link>.
        </Check>
        <Button>Continuar</Button>
      </form>
      <form action={signOut}><button className="text-sm text-neutral-400 hover:text-white">Sair</button></form>
    </AuthCard>
  );
}
