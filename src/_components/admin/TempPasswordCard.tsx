"use client";
import { useState } from "react";
import { Button } from "@/_components/ui/Button";
import { t } from "@/_i18n";
import s from "@/_styles/admin/People.module.css";

const P = t.admin.pessoas;

/** Mostra a senha temporária uma única vez (só fica na memória desta tela). */
export function TempPasswordCard({ name, email, password, days, appUrl, onDone }: {
  name: string; email: string; password: string; days: number; appUrl: string; onDone: () => void;
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
    <div className={s.panel} role="dialog" aria-label={P.senhaCampo}>
      <b className={s.panelTitle}>{name}</b>
      <p className={s.warn}>{P.senhaTitulo}</p>
      <p className={s.mail}>{email}</p>
      <div className={s.secret}>
        <code className={s.code}>{password}</code>
        <Button type="button" variant="ghost" onClick={() => copy(password, "senha")}>{copied === "senha" ? P.copiado : P.copiar}</Button>
      </div>
      <span className={s.label}>{P.mensagemPronta}</span>
      <p className={s.msg}>{message}</p>
      <p className={s.note}>{P.validade(days)}</p>
      <div className={s.actionsRow}>
        <Button type="button" variant="ghost" onClick={() => copy(message, "msg")}>{copied === "msg" ? P.copiado : P.copiarMensagem}</Button>
        <Button type="button" onClick={onDone}>{P.pronto}</Button>
      </div>
    </div>
  );
}
