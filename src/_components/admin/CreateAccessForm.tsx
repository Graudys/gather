"use client";
import { useActionState, useState } from "react";
import { createAccess, type TempPasswordState } from "@/_data/people.actions";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { TempPasswordCard } from "@/_components/admin/TempPasswordCard";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import s from "@/_styles/admin/People.module.css";

const P = t.admin.pessoas;
export const PEOPLE_ERRORS: Record<string, string> = {
  muitas: t.auth.erros.muitas,
  dados: "Confira o nome e o e-mail.",
  jaExiste: P.jaExiste,
  voceMesmo: P.voceMesmo,
};

export function CreateAccessForm({ workspaces, appUrl }: { workspaces: { id: string; name: string }[]; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TempPasswordState, FormData>(createAccess, null);
  const [dismissed, setDismissed] = useState<TempPasswordState>(null);

  if (state?.ok && state !== dismissed) {
    return <TempPasswordCard {...state} appUrl={appUrl} onDone={() => { setDismissed(state); setOpen(false); }} />;
  }
  if (!open) return <div><Button onClick={() => setOpen(true)}>{P.criar}</Button></div>;
  return (
    <form action={action} className={s.panel}>
      <b className={s.panelTitle}>{P.criar}</b>
      {state && !state.ok && <Alert>{PEOPLE_ERRORS[state.error] ?? t.auth.erros.geral}</Alert>}
      <div className={s.row2}>
        <Field label={P.nome} name="name" required maxLength={LIMITES.nome} autoComplete="off" />
        <Field label={P.email} name="email" type="email" required maxLength={LIMITES.email} autoComplete="off" />
      </div>
      <div className={s.row2}>
        <label className={s.label}>
          {P.papelCampo}
          <select name="role" className={s.select} defaultValue="user">
            <option value="user">{P.papel.user}</option>
            <option value="admin">{P.papel.admin}</option>
          </select>
        </label>
        <label className={s.label}>
          {P.workspace}
          <select name="workspaceId" className={s.select} defaultValue="">
            <option value="">{P.nenhumWs}</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      </div>
      <p className={s.note}>{P.nota}</p>
      <div className={s.actionsRow}>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.comum.cancelar}</Button>
        <Button disabled={pending}>{P.criarBotao}</Button>
      </div>
    </form>
  );
}
