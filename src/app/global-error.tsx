"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui", background: "#07080c", color: "#eef0f7", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Algo deu errado</h1>
          <p>A gente já foi avisado.</p>
          <button onClick={reset}>Tentar de novo</button>
        </div>
      </body>
    </html>
  );
}
