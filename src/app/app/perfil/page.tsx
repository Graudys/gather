import type { Metadata } from "next";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { changePassword, signOut } from "@/_data/auth.actions";
import { requireReadyUser } from "@/_lib/auth/dal";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export const metadata: Metadata = { title: "Perfil" };

const T = t.auth.trocar;
const ERROS: Record<string, string> = {
  erroAtual: T.erroAtual,
  erroIgual: t.auth.primeiro.erroIgual,
  erroVazada: t.auth.primeiro.erroVazada,
  senhaCurta: t.auth.primeiro.regras,
  muitas: t.auth.erros.muitas,
};

export default async function Perfil({ searchParams }: PageProps<"/app/perfil">) {
  const user = await requireReadyUser("/app/perfil");
  const { erro, aviso } = (await searchParams) as { erro?: string; aviso?: string };
  return (
    <main className={s.page}>
      <h1 className={s.title}>{user.name}</h1>
      <p className={s.hint}>{user.email}</p>

      <h2 className={s.subtitle}>{T.titulo}</h2>
      {aviso === "senha-alterada" && <Alert tone="ok">{T.ok}</Alert>}
      {erro && <Alert>{ERROS[erro] ?? t.auth.erros.geral}</Alert>}
      <form action={changePassword} className={s.create}>
        <Field label={T.atual} name="current" type="password" autoComplete="current-password" required maxLength={LIMITES.senhaMax} />
        <Field label={T.nova} name="password" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <Field label={T.repetir} name="confirm" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
        <Button>{T.botao}</Button>
      </form>

      <form action={signOut} className={s.create}>
        <input type="hidden" name="todos" value="1" />
        <Button variant="ghost">Sair de todos os aparelhos</Button>
      </form>
    </main>
  );
}
