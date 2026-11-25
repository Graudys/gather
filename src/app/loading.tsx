import { LogoAnimated, Spinner } from "@/_components/ui/Brand";
import s from "@/_styles/ui/Splash.module.css";

// Tela de abertura (mockup "Carregando"): aparece logo depois do login,
// enquanto o app busca seus workspaces.
export default function Loading() {
  return (
    <main className={s.splash}>
      <span className={s.bar} aria-hidden="true" />
      <LogoAnimated size={64} />
      <Spinner size={16} label="Abrindo o Gather…" />
    </main>
  );
}
