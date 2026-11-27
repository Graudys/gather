import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { notFound } from "next/navigation";
import { DEFAULT_NOTEBOOK, OLD_DEFAULT_NOTEBOOK, DEFAULT_NOTE_MONTHS, NOTE_WARN_DAYS, noteExpiresAt, noteState, warnEditCutoff, type NoteState } from "@/lib/notes";

/**
 * Notas: só no espaço pessoal, só para a dona/o dono dele.
 * Quem não pode ver recebe 404 (como no resto do app).
 */
export async function requireNotes(workspaceId: string) {
  const ctx = await requireMember(workspaceId, ["OWNER"]);
  if (ctx.workspace.kind !== "PERSONAL") notFound();
  return ctx;
}

/** Caderno fixo "Anotações" (não pode ser apagado). Cria se ainda não existir. */
export async function ensureDefaultNotebook(workspaceId: string, userId: string) {
  const found = await db.notebook.findFirst({ where: { workspaceId, isDefault: true }, select: { id: true, name: true } });
  if (found?.name === OLD_DEFAULT_NOTEBOOK) await db.notebook.update({ where: { id: found.id }, data: { name: DEFAULT_NOTEBOOK } });
  // O fixo usa o ícone de caderno do app (não emoji): tira a plantinha antiga.
  if (found) {
    await db.notebook.updateMany({ where: { id: found.id, icon: "🌱" }, data: { icon: null } });
    return found.id;
  }
  const nb = await db.notebook.create({ data: { workspaceId, name: DEFAULT_NOTEBOOK, icon: null, isDefault: true, createdById: userId }, select: { id: true } });
  return nb.id;
}

export async function noteMonths(workspaceId: string) {
  const s = await db.workspaceSettings.findUnique({ where: { workspaceId }, select: { noteRetentionMonths: true } });
  return s?.noteRetentionMonths ?? DEFAULT_NOTE_MONTHS;
}

/** Notas que já estão no aviso (vencem em até 30 dias) ou vencidas. */
export async function notesInWarning(workspaceId: string, months: number, now = new Date()) {
  const rows = await db.note.findMany({
    where: { workspaceId, updatedAt: { lte: warnEditCutoff(months, now) } },
    select: { id: true, title: true, updatedAt: true, keepUntil: true, notebook: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
    take: 500,
  });
  return rows
    .map((n) => ({ ...n, state: noteState(n.updatedAt, n.keepUntil, months, now), expiresAt: noteExpiresAt(n.updatedAt, n.keepUntil, months) }))
    .filter((n) => n.state !== "ok");
}

export type NotesView = {
  months: number;
  notebooks: { id: string; name: string; icon: string | null; isDefault: boolean; count: number }[];
  notebook: { id: string; name: string; icon: string | null; isDefault: boolean } | null;
  notes: { id: string; title: string; snippet: string; updatedAt: string; state: NoteState }[];
  note: { id: string; title: string; content: string; updatedAt: string; expiresAt: string; state: NoteState } | null;
  warning: { expiring: number; expired: number; firstExpiry: string | null };
};

export async function getNotesView(workspaceId: string, notebookId?: string, noteId?: string): Promise<NotesView> {
  const { user } = await requireNotes(workspaceId);
  const defaultId = await ensureDefaultNotebook(workspaceId, user.id);
  const months = await noteMonths(workspaceId);
  const now = new Date();

  const books = await db.notebook.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, isDefault: true, _count: { select: { notes: true } } },
  });
  const current = books.find((b) => b.id === notebookId) ?? books.find((b) => b.id === defaultId) ?? null;
  const list = current
    ? await db.note.findMany({
        where: { notebookId: current.id },
        orderBy: { updatedAt: "desc" },
        take: 300,
        select: { id: true, title: true, content: true, updatedAt: true, keepUntil: true },
      })
    : [];
  let open = noteId ? await db.note.findFirst({ where: { id: noteId, workspaceId }, select: { id: true, title: true, content: true, updatedAt: true, keepUntil: true, notebookId: true } }) : null;
  if (open && current && open.notebookId !== current.id) open = null;

  const warn = await notesInWarning(workspaceId, months, now);
  return {
    months,
    notebooks: books.map((b) => ({ id: b.id, name: b.name, icon: b.icon, isDefault: b.isDefault, count: b._count.notes })),
    notebook: current ? { id: current.id, name: current.name, icon: current.icon, isDefault: current.isDefault } : null,
    notes: list.map((n) => ({
      id: n.id,
      title: n.title || "Sem título",
      snippet: n.content.replace(/\s+/g, " ").trim().slice(0, 90),
      updatedAt: n.updatedAt.toISOString(),
      state: noteState(n.updatedAt, n.keepUntil, months, now),
    })),
    note: open
      ? {
          id: open.id,
          title: open.title,
          content: open.content,
          updatedAt: open.updatedAt.toISOString(),
          expiresAt: noteExpiresAt(open.updatedAt, open.keepUntil, months).toISOString(),
          state: noteState(open.updatedAt, open.keepUntil, months, now),
        }
      : null,
    warning: {
      expiring: warn.filter((n) => n.state === "expiring").length,
      expired: warn.filter((n) => n.state === "expired").length,
      firstExpiry: warn[0]?.expiresAt.toISOString() ?? null,
    },
  };
}

export { NOTE_WARN_DAYS };
