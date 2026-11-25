"use client";
import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import s from "@/_styles/ui/Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "link"; block?: boolean };

/**
 * Botão do app. Dentro de um formulário, enquanto a ação roda, ele trava e
 * mostra o carregador (mockup "Botão enviando"): evita clique duplo.
 */
export function Button({ variant = "primary", block, className, children, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  const busy = pending && props.type !== "button" && props.type !== "reset";
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[s.button, s[variant], block && s.block, busy && s.busy, className].filter(Boolean).join(" ")}
    >
      {busy && <span className={s.spin} aria-hidden="true" />}
      {children}
    </button>
  );
}
