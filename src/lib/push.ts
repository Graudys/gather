import { z } from "zod";

/**
 * Regras das notificações no aparelho (PWA), usadas no servidor e nos testes.
 *
 * Segurança:
 * - O servidor só aceita endereços de serviços de push conhecidos. Sem isso,
 *   alguém mandaria um endpoint qualquer e o Gather faria requisições para
 *   onde ele quisesse (SSRF).
 * - O texto que vai para o aparelho é genérico: aparece na tela bloqueada,
 *   então nunca leva trecho de mensagem, nome de tarefa ou de workspace.
 */

const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge (Android e PC), Opera
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari (iPhone instalado e Mac)
];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isPushEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTS.includes(h) || PUSH_HOST_SUFFIXES.some((s) => h.endsWith(s) && h.length > s.length);
}

// Chaves do navegador em base64url: p256dh tem 65 bytes (87 caracteres), auth 16 (22).
const b64url = (min: number, max: number) => z.string().min(min).max(max).regex(/^[A-Za-z0-9_-]+$/);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "endpoint"),
  keys: z.object({ p256dh: b64url(80, 100), auth: b64url(16, 30) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Até quantos aparelhos uma pessoa pode ter recebendo avisos. Passou disso, sai o mais antigo. */
export const MAX_PUSH_DEVICES = 10;

/** Texto genérico de cada tipo de aviso (o que aparece na tela bloqueada). */
export const PUSH_TEXT: Record<string, string> = {
  dm: "Você tem uma nova mensagem direta",
  thread: "Nova resposta numa conversa sua",
  task_assigned: "Uma tarefa foi atribuída a você",
  task_comment: "Novo comentário numa tarefa sua",
  event_invite: "Você foi convidado para um evento",
  event_reminder: "Uma reunião vai começar em breve",
  workspace_added: "Você entrou num novo workspace",
  help_question: "Nova pergunta na central de ajuda",
};

/** Só links internos do app viajam na notificação. */
export const safeHref = (href: string) => (/^\/app(\/|$|\?)/.test(href) && !href.includes("//") ? href : "/app");
