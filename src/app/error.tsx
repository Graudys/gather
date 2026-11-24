"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-neutral-400">A gente já foi avisado. Tente de novo em instantes.</p>
      <button onClick={reset} className="rounded-lg bg-white px-4 py-2 font-medium text-black">
        Tentar de novo
      </button>
    </main>
  );
}
