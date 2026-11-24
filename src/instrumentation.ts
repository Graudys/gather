import type { Instrumentation } from "next";

// Erros do servidor (páginas, rotas, Server Actions) vão para error_events.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/_lib/server/observability");
  const e = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : "";
  await reportError({
    source: "SERVER",
    message: `${e.name}: ${e.message}${digest ? ` (digest ${digest})` : ""}`,
    location: `${context.routeType} ${context.routePath} ${request.method}`,
    stack: e.stack ?? null,
  });
};
