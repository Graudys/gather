import "server-only";
import { db } from "@/_lib/db/prisma";
import { notify } from "@/_lib/server/notify";
import { notesInWarning, noteMonths } from "@/_data/notes";
import { NOTE_WARN_DAYS } from "@/lib/notes";

/**
 * Aviso de notas perto de vencer (30 dias antes) ou vencidas.
 * As notas NUNCA são apagadas aqui: o aviso leva para a página de notas,
 * onde a pessoa baixa, mantém por mais 1 ano ou confirma que quer apagar.
 * Cada nota avisa uma vez (warned_at); editar a nota zera o aviso.
 */
export async function runNoteExpiryNotices(opts: { workspaceId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const spaces = await db.workspace.findMany({
    where: { kind: "PERSONAL", ...(opts.workspaceId ? { id: opts.workspaceId } : {}), notes: { some: {} } },
    select: { id: true, createdById: true },
    take: opts.workspaceId ? 1 : 5000,
  });
  let warned = 0;
  for (const ws of spaces) {
    const months = await noteMonths(ws.id);
    const list = await notesInWarning(ws.id, months, now);
    const fresh = await db.note.findMany({ where: { id: { in: list.map((n) => n.id) }, warnedAt: null }, select: { id: true } });
    if (!fresh.length) continue;
    const expired = list.filter((n) => n.state === "expired").length;
    const total = list.length;
    await notify([ws.createdById], {
      workspaceId: ws.id,
      type: "note_expiring",
      title: total === 1 ? "1 nota está perto de vencer" : `${total} notas estão perto de vencer`,
      body: `${expired ? `${expired} já ${expired === 1 ? "venceu" : "venceram"}. ` : ""}Nada é apagado sem você confirmar: baixe, mantenha por mais 1 ano ou apague.`,
      href: `/app/w/${ws.id}/notas?vencendo=1`,
      key: `note_expiring:${ws.id}`,
    });
    await db.note.updateMany({ where: { id: { in: fresh.map((n) => n.id) } }, data: { warnedAt: now } });
    warned += fresh.length;
  }
  return warned;
}

export { NOTE_WARN_DAYS };
