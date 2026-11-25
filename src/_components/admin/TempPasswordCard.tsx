"use client";
import { useState } from "react";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { ClientModal } from "@/_components/ui/ClientModal";
import { t } from "@/_i18n";
import m from "@/_styles/ui/Modal.module.css";

const P = t.admin.pessoas;

/** Senha temporária numa janela (mockup "Ov_AdminSenhaTemp"); só existe na memória desta tela. */
export function TempPasswordCard({ name, email, password, days, appUrl, created, onDone }: {
  name: string; email: string; password: string; days: number; appUrl: string; created?: boolean; onDone: () => void;
}) {
  const [copied, setCopied] = useState<"senha" | "msg" | null>(null);
  const message = P.mensagem(name, appUrl, email, password, days);
  const copy = async (text: string, which: "senha" | "msg") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      setCopied(null);
    }
  };
  return (
    <ClientModal title={created ? "Acesso criado" : "Nova senha temporária"} sub={P.senhaTitulo} icon="key" onClose={onDone}>
      <div className={m.fg}>
        <div className={m.kv} style={{ borderTop: 0, paddingTop: 0 }}><span>Pessoa</span><span>{name} · {email}</span></div>
        <label className={m.f}>
          {P.senhaCampo}
          <span style={{ display: "flex", gap: 8 }}>
            <input className={`${m.in} ${m.mono}`} readOnly value={password} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={m.btn2} onClick={() => copy(password, "senha")}><Icon name={copied === "senha" ? "check" : "clip"} size={14} /> {copied === "senha" ? P.copiado : P.copiar}</button>
          </span>
        </label>
        <label className={m.f}>
          {P.mensagemPronta}
          <textarea className={m.in} rows={4} readOnly value={message} onFocus={(e) => e.currentTarget.select()} />
        </label>
      </div>
      <div className={m.note}><Icon name="info" size={15} /><span>{P.validade(days)}</span></div>
      <div className={m.df}>
        <button type="button" className={m.btn2} onClick={() => copy(message, "msg")}>{copied === "msg" ? P.copiado : P.copiarMensagem}</button>
        <Button type="button" onClick={onDone}>{P.pronto}</Button>
      </div>
    </ClientModal>
  );
}
