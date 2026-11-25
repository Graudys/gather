import Link from "next/link";
import { StatePage } from "@/_components/site/StatePage";
import s from "@/_styles/site/Site.module.css";

// 404 dentro do workspace: mantém a barra lateral e o topo.
export default function NotFoundInWorkspace() {
  return (
    <StatePage inShell code="404" title="Não encontramos isso aqui" text="O link pode estar errado, foi apagado, ou é de um canal, equipe ou projeto privado em que você não está. Mensagens e arquivos também somem depois do prazo do workspace.">
      <Link href="/app" className={s.stateBtn}>Ir para o início</Link>
      <Link href="/app/ajuda" className={s.stateBtn2}>Ver a central de ajuda</Link>
    </StatePage>
  );
}
