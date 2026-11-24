import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server/env";
import { sendEmail } from "@/lib/server/email";

type Source = "BROWSER" | "SERVER" | "EDGE_FUNCTION" | "CRON" | "WEBHOOK";
type AccessEvent = "LOGIN" | "LOGIN_FAILED" | "TOKEN_REFRESH" | "LOGOUT" | "LOGOUT_ALL" | "PASSWORD_CHANGED" | "MFA_CHALLENGE";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;
const TOKEN = /\b(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(secret|publishable)_\w+|re_\w{10,}|Bearer\s+\S+)/g;
const DIGITS = /\b\d{4,}\b/g;

/** Tira e-mail, token e números longos do texto do erro antes de guardar. */
export function scrub(text: string): string {
  return text.replace(TOKEN, "[token]").replace(EMAIL, "[email]");
}

/** Mesma "impressão digital" para erros iguais: tira IDs e números variáveis. */
export function fingerprint(source: Source, message: string, location: string): string {
  const norm = `${source}|${message.replace(UUID, ":id").replace(DIGITS, ":n").slice(0, 200)}|${location.replace(UUID, ":id")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${source.toLowerCase()}-${(h >>> 0).toString(16)}`;
}

/** Grava o erro agrupado em error_events. Nunca lança: erro ao registrar erro só vai pro console. */
export async function reportError(input: {
  source: Source;
  message: string;
  location: string;
  stack?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  browser?: string | null;
}) {
  try {
    const message = scrub(input.message).slice(0, 500);
    const location = scrub(input.location).replace(UUID, "[id]").slice(0, 300);
    const { data, error } = await createAdminClient().rpc("log_error", {
      p_fingerprint: fingerprint(input.source, message, location),
      p_source: input.source,
      p_message: message,
      p_location: location,
      p_stack: input.stack ? scrub(input.stack).slice(0, 8000) : null,
      p_release: process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      p_user: input.userId ?? null,
      p_workspace: input.workspaceId ?? null,
      p_browser: input.browser ?? null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const alertTo = serverEnv().ALERT_EMAIL;
    if (row?.should_alert && alertTo) {
      await sendEmail({
        to: alertTo,
        subject: row.is_new ? `[Gather] Erro novo: ${message.slice(0, 60)}` : `[Gather] Pico de erros: ${message.slice(0, 60)}`,
        text: `Onde: ${location}\nOrigem: ${input.source}\n\nAbra Admin › Erros e acessos para ver os detalhes.\n${process.env.NEXT_PUBLIC_APP_URL}/admin/erros`,
      });
    }
  } catch (e) {
    console.error("[observability] falha ao registrar erro", e);
  }
}

/** Registro de acesso (Marco Civil): entrada, renovação e saída de sessão. */
export async function logAccess(userId: string | null, event: AccessEvent, method: string | null, ip: string, ua: string) {
  try {
    await createAdminClient().rpc("log_access", { p_user: userId, p_event: event, p_method: method, p_ip: ip, p_ua: ua });
  } catch (e) {
    console.error("[observability] falha ao registrar acesso", e);
  }
}
