"use client";
import { useEffect } from "react";
import { StatePage } from "@/_components/site/StatePage";
import { Button } from "@/_components/ui/Button";
import { reportClientError } from "@/lib/report-client-error";
import { t } from "@/_i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <StatePage title={t.site.erroTitulo} text={t.site.erroTexto}>
      <Button onClick={reset}>{t.comum.tentarDeNovo}</Button>
    </StatePage>
  );
}
