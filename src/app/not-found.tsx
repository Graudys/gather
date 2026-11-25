import Link from "next/link";
import { StatePage } from "@/_components/site/StatePage";
import s from "@/_styles/site/Site.module.css";

// 404 (mockup "Erro404").
export default function NotFound() {
  return (
    <StatePage code="404" title="Esta página não existe" text="O link pode estar errado, a página foi removida ou você não tem acesso a ela. Se foi uma mensagem ou arquivo, ele pode ter passado do prazo.">
      <Link href="/app" className={s.stateBtn}>Ir para o início</Link>
      <Link href="/app/ajuda" className={s.stateBtn2}>Ver a central de ajuda</Link>
    </StatePage>
  );
}
