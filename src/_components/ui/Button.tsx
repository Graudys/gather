import type { ButtonHTMLAttributes } from "react";
import s from "@/_styles/ui/Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "link"; block?: boolean };

export function Button({ variant = "primary", block, className, ...props }: Props) {
  return <button {...props} className={[s.button, s[variant], block && s.block, className].filter(Boolean).join(" ")} />;
}
