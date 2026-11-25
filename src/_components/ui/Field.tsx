import type { InputHTMLAttributes, ReactNode } from "react";
import s from "@/_styles/ui/Field.module.css";

export function Field({ label, className, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <input {...props} className={[s.input, className].filter(Boolean).join(" ")} />
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[s.input, props.className].filter(Boolean).join(" ")} />;
}

/** Caixa de marcar. Obrigatória por padrão (18+, termos); `optional` para as demais. */
export function Check({ name, children, optional, defaultChecked }: { name: string; children: ReactNode; optional?: boolean; defaultChecked?: boolean }) {
  return (
    <label className={s.check}>
      <input type="checkbox" name={name} required={!optional} defaultChecked={defaultChecked} className={s.box} />
      <span>{children}</span>
    </label>
  );
}
