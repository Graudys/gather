"use client";
import { useActionState, useState } from "react";
import { issueTempPassword, type TempPasswordState } from "@/_data/people.actions";
import { TempPasswordCard } from "@/_components/admin/TempPasswordCard";
import { PEOPLE_ERRORS } from "@/_components/admin/CreateAccessForm";
import { t } from "@/_i18n";
import s from "@/_styles/admin/People.module.css";

/** "Gerar nova senha temporária": troca a senha, derruba as sessões e mostra a nova uma vez. */
export function IssuePasswordButton({ userId, appUrl }: { userId: string; appUrl: string }) {
  const [state, action, pending] = useActionState<TempPasswordState, FormData>(issueTempPassword, null);
  const [dismissed, setDismissed] = useState<TempPasswordState>(null);
  if (state?.ok && state !== dismissed) {
    return <TempPasswordCard {...state} appUrl={appUrl} onDone={() => setDismissed(state)} />;
  }
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      {state && !state.ok && <span className={s.danger}>{PEOPLE_ERRORS[state.error] ?? t.auth.erros.geral}</span>}
      <button className={s.menuItem} disabled={pending}>{t.admin.pessoas.novaSenha}</button>
    </form>
  );
}
