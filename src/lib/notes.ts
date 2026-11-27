/** Regras das notas do espaço pessoal (servidor e navegador). */

/** Prazos que a pessoa pode escolher, em meses (o mínimo é 1 ano). */
export const NOTE_RETENTION_OPTIONS = [12, 24, 36, 60] as const;
export const DEFAULT_NOTE_MONTHS = 12;
/** Quantos dias antes do vencimento a pessoa é avisada. */
export const NOTE_WARN_DAYS = 30;
/** "Manter por mais 1 ano". */
export const NOTE_KEEP_MONTHS = 12;

export const NOTE_LIMITS = { title: 120, content: 100_000, notebookName: 60, notebooks: 50, notesPerWorkspace: 5000, imageBytes: 1_500_000, imagesPerNote: 60, imageSide: 1600 } as const;
/** Endereço de uma foto de nota (o único tipo de imagem que o editor mostra). */
export const noteImageUrl = (id: string) => `/api/notas/imagem/${id}`;
export const sharedImageUrl = (id: string) => `/api/notas/compartilhada/imagem/${id}`;
/** Fotos que a prévia aceita: das notas ou de anotação compartilhada. */
export const NOTE_IMAGE_RE = /^\/api\/notas\/(compartilhada\/)?imagem\/[0-9a-f-]{36}$/;
/** Ids de foto citados no texto, com o tipo (nota ou compartilhada). */
export function imageRefs(content: string) {
  const out: { url: string; id: string; shared: boolean }[] = [];
  for (const m of content.matchAll(/\/api\/notas\/(compartilhada\/)?imagem\/([0-9a-f-]{36})/g)) out.push({ url: m[0], id: m[2]!, shared: Boolean(m[1]) });
  return out;
}

export const DEFAULT_NOTEBOOK = "Anotações";
/** Nome antigo do caderno fixo (renomeado sozinho na primeira visita). */
export const OLD_DEFAULT_NOTEBOOK = "Minha vida";
export const ROUTINE_PROJECT = "Minha rotina";

export const isNoteMonths = (n: number) => (NOTE_RETENTION_OPTIONS as readonly number[]).includes(n);
export const yearsLabel = (months: number) => (months % 12 === 0 ? `${months / 12} ${months === 12 ? "ano" : "anos"}` : `${months} meses`);

const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

/** Quando a nota vence: o maior entre (última edição + prazo) e "manter até". */
export function noteExpiresAt(updatedAt: Date, keepUntil: Date | null, months: number) {
  const byEdit = addMonths(updatedAt, months);
  return keepUntil && keepUntil > byEdit ? keepUntil : byEdit;
}

export type NoteState = "ok" | "expiring" | "expired";
export function noteState(updatedAt: Date, keepUntil: Date | null, months: number, now = new Date()): NoteState {
  const exp = noteExpiresAt(updatedAt, keepUntil, months);
  if (exp <= now) return "expired";
  return exp.getTime() - now.getTime() <= NOTE_WARN_DAYS * 86_400_000 ? "expiring" : "ok";
}

/** Data limite de edição a partir da qual a nota já está no aviso (para filtrar no banco). */
export const warnEditCutoff = (months: number, now = new Date()) => addMonths(new Date(now.getTime() + NOTE_WARN_DAYS * 86_400_000), -months);
export const plusMonths = addMonths;
