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

export function Check({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className={s.check}>
      <input type="checkbox" name={name} required className={s.box} />
      <span>{children}</span>
    </label>
  );
}
