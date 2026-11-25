"use client";
import Link from "next/link";
import { useEffect } from "react";
import { StatePage } from "@/_components/site/StatePage";
import { reportClientError } from "@/lib/report-client-error";
import s from "@/_styles/site/Site.module.css";

// Erro inesperado: mesmo jeito da 404, com o Orbi pensando e o código do erro para o suporte.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <StatePage code="Ops" mood="pensando" title="Algo deu errado aqui" text={`O erro já foi registrado para o admin. Tente de novo em instantes.${error.digest ? ` Código: ${error.digest}` : ""}`}>
      <button onClick={reset} className={s.stateBtn}>Tentar de novo</button>
      <Link href="/app" className={s.stateBtn2}>Ir para o início</Link>
    </StatePage>
  );
}
