"use client";
import { useActionState, useState } from "react";
import { createAccess, type TempPasswordState } from "@/_data/people.actions";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { Icon } from "@/_components/ui/Icon";
import { ClientModal } from "@/_components/ui/ClientModal";
import { TempPasswordCard } from "@/_components/admin/TempPasswordCard";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import m from "@/_styles/ui/Modal.module.css";

const P = t.admin.pessoas;
export const PEOPLE_ERRORS: Record<string, string> = {
  muitas: t.auth.erros.muitas,
  dados: "Confira o nome e o e-mail.",
  jaExiste: P.jaExiste,
  voceMesmo: P.voceMesmo,
};

/** "Criar acesso" (mockup "Ov_AdminCriarAcesso") e, depois, a senha ("Ov_AdminSenhaTemp"). */
export function CreateAccessForm({ workspaces, appUrl }: { workspaces: { id: string; name: string }[]; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TempPasswordState, FormData>(createAccess, null);
  const [dismissed, setDismissed] = useState<TempPasswordState>(null);

  if (state?.ok && state !== dismissed) {
    return <TempPasswordCard {...state} appUrl={appUrl} created onDone={() => { setDismissed(state); setOpen(false); }} />;
  }
  return (
    <>
      <div><Button onClick={() => setOpen(true)}><Icon name="plus" size={15} /> {P.criar}</Button></div>
      {open && (
        <ClientModal title={P.criar} sub="A pessoa recebe uma senha temporária e troca no primeiro login." icon="user" onClose={() => setOpen(false)}>
          <form action={action}>
            <div className={m.fg}>
              {state && !state.ok && <Alert>{PEOPLE_ERRORS[state.error] ?? t.auth.erros.geral}</Alert>}
              <label className={m.f}>{P.nome}<input className={m.in} name="name" required maxLength={LIMITES.nome} autoComplete="off" autoFocus placeholder="Ex.: Lia Prado" /></label>
              <label className={m.f}>{P.email}<input className={m.in} name="email" type="email" required maxLength={LIMITES.email} autoComplete="off" placeholder="lia@exemplo.com" /></label>
              <div className={m.two}>
                <label className={m.f}>
                  {P.papelCampo}
                  <select name="role" className={m.in} defaultValue="user">
                    <option value="user">{P.papel.user}</option>
                    <option value="admin">{P.papel.admin}</option>
                  </select>
                </label>
                <label className={m.f}>
                  {P.workspace}
                  <select name="workspaceId" className={m.in} defaultValue="">
                    <option value="">{P.nenhumWs}</option>
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className={m.note}><Icon name="info" size={15} /><span>{P.nota}</span></div>
            <div className={m.df}>
              <button type="button" className={m.btn2} onClick={() => setOpen(false)}>{t.comum.cancelar}</button>
              <Button disabled={pending}>{P.criarBotao}</Button>
            </div>
          </form>
        </ClientModal>
      )}
    </>
  );
}
