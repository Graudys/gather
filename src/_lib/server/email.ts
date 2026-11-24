import "server-only";
import { serverEnv } from "@/_lib/server/env";

/**
 * E-mails do app pelo Resend (convites, aviso de política, alerta de erro).
 * Os e-mails de login (confirmação, senha) saem pelo SMTP do Resend
 * configurado direto no Supabase Auth, não por aqui.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }) {
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn("[email] RESEND_API_KEY ou EMAIL_FROM ausente; e-mail não enviado:", msg.subject);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}
