import "server-only";
import { after } from "next/server";
import { db } from "@/_lib/db/prisma";
import { sendPush } from "@/_lib/server/push";

/**
 * Avisos no sino (só dentro do app; a versão pessoal não manda e-mail).
 * `key` junta avisos repetidos: várias mensagens na mesma conversa viram um
 * aviso só enquanto ninguém leu ("3 mensagens novas de Caio").
 * Nunca guarda texto de mensagem inteiro: só um trecho curto.
 */
export type NotifyInput = {
  workspaceId?: string | null;
  type:
    | "dm" | "thread" | "mention" | "channel_message"
    | "task_assigned" | "task_comment" | "task_due_soon" | "task_overdue" | "task_done" | "task_moved"
    | "event_invite" | "event_reminder" | "meeting_started"
    | "workspace_added" | "help_question" | "note_expiring";
  title: string;
  body?: string | null;
  href: string;
  key?: string;
};

/** Grupo de preferência de cada tipo de aviso (tela Perfil › Notificações). */
export const PREF_OF: Record<NotifyInput["type"], "mencoes" | "canais" | "tarefas" | "reunioes" | null> = {
  dm: "mencoes", thread: "mencoes", mention: "mencoes", channel_message: "canais",
  task_assigned: "tarefas", task_comment: "tarefas", task_due_soon: "tarefas", task_overdue: "tarefas", task_done: "tarefas", task_moved: "tarefas",
  event_invite: "reunioes", event_reminder: "reunioes", meeting_started: "reunioes",
  workspace_added: null, help_question: null, note_expiring: null, // sempre chegam
};
export type NotifyPrefs = Partial<Record<"mencoes" | "canais" | "tarefas" | "reunioes", boolean>>;

export const snippet = (text: string, n = 90) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

export async function notify(userIds: string[], n: NotifyInput) {
  let ids = [...new Set(userIds)];
  if (!ids.length) return;
  try {
    const pref = PREF_OF[n.type];
    if (pref) {
      // Quem desligou esse grupo de avisos não recebe.
      const off = await db.user.findMany({ where: { id: { in: ids }, notifyPrefs: { path: [pref], equals: false } }, select: { id: true } });
      if (off.length) ids = ids.filter((id) => !off.some((o) => o.id === id));
    }
    for (const userId of ids) {
      if (n.key) {
        const prev = await db.notification.findFirst({
          where: { userId, readAt: null, type: n.type, payload: { path: ["key"], equals: n.key } },
          select: { id: true, payload: true },
        });
        if (prev) {
          const count = Number((prev.payload as { count?: number }).count ?? 1) + 1;
          await db.notification.update({
            where: { id: prev.id },
            data: { title: n.title, body: n.body ?? null, payload: { key: n.key, href: n.href, count }, createdAt: new Date() },
          });
          continue;
        }
      }
      await db.notification.create({
        data: { userId, workspaceId: n.workspaceId ?? null, type: n.type, title: n.title, body: n.body ?? null, payload: { href: n.href, ...(n.key ? { key: n.key, count: 1 } : {}) } },
      });
    }
    // Aviso no aparelho (PWA), depois da resposta: não atrasa a ação de quem enviou.
    // Vai só o tipo do aviso e o link; o texto que aparece é genérico (src/lib/push.ts).
    const to = ids;
    after(() => sendPush(to, { type: n.type, href: n.href, tag: n.key }).catch((e) => console.error("[push] falhou", e)));
  } catch (e) {
    // Aviso que falha não pode quebrar a ação principal.
    console.error("[notify] falhou", e);
  }
}
