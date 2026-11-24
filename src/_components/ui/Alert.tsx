import type { ReactNode } from "react";
import s from "@/_styles/ui/Alert.module.css";

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" }) {
  return <p role="alert" className={`${s.alert} ${s[tone]}`}>{children}</p>;
}
