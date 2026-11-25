"use client";
import { useEffect, useRef } from "react";
import { createWorkspace } from "@/_data/workspaces.actions";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { useShell } from "@/_components/shell/ShellContext";
import type { AppShellData } from "@/_data/shell";
import m from "@/_styles/ui/Modal.module.css";

/** Janela "Criar workspace" (mockup "WorkspaceNovo"), aberta de qualquer tela. */
export function NewWorkspaceDialog({ opts }: { opts: AppShellData["createWs"] }) {
  const { newWs, setNewWs } = useShell();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!newWs) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNewWs(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newWs, setNewWs]);
  if (!newWs) return null;
  const close = () => setNewWs(false);
  return (
    <div className={m.ov}>
      <button className={m.scrim} onClick={close} aria-label="Fechar" tabIndex={-1} style={{ border: 0 }} />
      <div className={m.dlg} role="dialog" aria-modal="true" aria-labelledby="novo-ws" style={{ width: 600 }}>
        <div className={m.dh}>
          <div className={m.grow}>
            <h2 id="novo-ws">Criar workspace</h2>
            <p className={m.sub}>É opcional. Você pode usar o Gather sozinho no espaço pessoal e criar um workspace quando quiser trabalhar com outras pessoas.</p>
          </div>
          <button type="button" className={m.ic} onClick={close} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        {opts.canCreate ? (
          <form action={createWorkspace}>
            <div className={m.fg}>
              <label className={m.f}>Nome do workspace<input ref={first} className={m.in} name="name" required maxLength={80} placeholder="Ex.: Acme Studio" autoComplete="off" /></label>
              <label className={m.f}>Descrição (opcional)<input className={m.in} name="description" maxLength={200} placeholder="Estúdio de produto e design" /></label>
              <div className={m.two}>
                <label className={m.f}>
                  Mensagens somem depois de
                  <select name="months" className={m.in} defaultValue={opts.months.includes(3) ? 3 : opts.months[0]}>
                    {opts.months.map((x) => <option key={x} value={x}>{x} {x === 1 ? "mês" : "meses"}</option>)}
                  </select>
                </label>
                <label className={m.f}>
                  Arquivos do chat somem depois de
                  <select name="hours" className={m.in} defaultValue={opts.hours[0]}>
                    {opts.hours.map((x) => <option key={x} value={x}>{x === 24 ? "24 horas" : x === 168 ? "7 dias" : `${Math.round(x / 24)} dias`}</option>)}
                  </select>
                </label>
              </div>
              <p className={m.hint}>Dá para mudar depois em Configurações. Você pode ser dono de até {opts.max} workspaces.</p>
            </div>
            <div className={m.df}>
              <button type="button" className={m.btn2} onClick={close}>Agora não</button>
              <Button>Criar workspace</Button>
            </div>
          </form>
        ) : (
          <>
            <p className={m.sub}>Você já é dono de {opts.max} workspaces, o limite atual. Apague um ou peça ao admin do Gather para aumentar o limite.</p>
            <div className={m.df}><button type="button" className={m.btn2} onClick={close}>Fechar</button></div>
          </>
        )}
      </div>
    </div>
  );
}
