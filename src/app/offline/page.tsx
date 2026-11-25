import type { Metadata } from "next";
import { StatePage } from "@/_components/site/StatePage";
import s from "@/_styles/site/Site.module.css";

export const metadata: Metadata = { title: "Sem conexão" };

// Guardada pelo service worker (public/sw.js) e mostrada quando a internet cai.
// Não tem dado de ninguém: é igual para todo mundo.
export default function Offline() {
  return (
    <StatePage mood="procurando" title="Sem conexão" text="Parece que a internet caiu. Assim que ela voltar, o Gather continua de onde você parou.">
      <a href="/app" className={s.stateBtn}>Tentar de novo</a>
    </StatePage>
  );
}
