"use client";

/** Manda o erro do navegador para /api/erro (sem dados da tela, só mensagem e pilha). */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({
      message: `${error.name}: ${error.message}`.slice(0, 1000),
      stack: error.stack?.slice(0, 8000),
      path: window.location.pathname,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/erro", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/erro", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    // nunca quebrar a tela por causa do relatório
  }
}
