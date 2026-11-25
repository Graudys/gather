import { Spinner } from "@/_components/ui/Brand";
import s from "@/_styles/ui/Splash.module.css";

export default function Loading() {
  return <div className={s.center}><Spinner size={24} label="Carregando…" /></div>;
}
