import Link from "next/link";
import { AuthCard } from "@/components/ui";

export default function ContaBloqueada() {
  return (
    <AuthCard title="Conta indisponível" subtitle="Esta conta está bloqueada ou com exclusão agendada.">
      <p className="text-sm text-neutral-400">Se acha que é um engano, fale com o suporte pela <Link className="underline" href="/ajuda">central de ajuda</Link>.</p>
    </AuthCard>
  );
}
