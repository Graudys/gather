// Constantes de projetos usadas no servidor e no navegador.
export const LABEL_COLORS = ["#5b8cff", "#55da8f", "#f2c14e", "#ff8a90", "#b08cff", "#4fd1c5", "#f6a35b", "#9a9aa6"] as const;

export const PRIORITY = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
export const PROJECT_STATUS = { ACTIVE: "Ativo", PAUSED: "Pausado", COMPLETED: "Concluído", ARCHIVED: "Arquivado" } as const;

const TZ = "America/Sao_Paulo";
/** "12 dez" (ou "12 dez 2027" se for outro ano). */
export function shortDay(iso: string) {
  const d = new Date(iso);
  const sameYear = d.toLocaleDateString("pt-BR", { year: "numeric", timeZone: TZ }) === new Date().toLocaleDateString("pt-BR", { year: "numeric", timeZone: TZ });
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: TZ }).replace(".", "");
}
/** "2026-12-12" para <input type="date">. */
export function inputDay(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
/** Vencida? (prazo antes de hoje, no fuso de SP) */
export function isOverdue(iso: string | null) {
  if (!iso) return false;
  return inputDay(iso) < new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export type DueState = "done" | "late" | "today" | "tomorrow" | "ok";
/**
 * Situação do prazo (fuso de SP): concluída, atrasada, vence hoje, vence amanhã ou ok.
 * Usado nos cartões ("Atrasada") e nos avisos de prazo.
 */
export function dueState(iso: string | null, completed: boolean, now = new Date()): DueState {
  if (!iso) return "ok";
  if (completed) return "done";
  const day = inputDay(iso);
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrow = new Date(now.getTime() + 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  return day < today ? "late" : day === today ? "today" : day === tomorrow ? "tomorrow" : "ok";
}
export const DUE_LABEL: Record<DueState, string> = { done: "Concluída", late: "Atrasada", today: "Vence hoje", tomorrow: "Vence amanhã", ok: "" };

/** Hoje e daqui a 7 dias ("aaaa-mm-dd", fuso de SP), para agrupar prazos. */
export function dayWindow(now = new Date()) {
  return {
    today: now.toLocaleDateString("en-CA", { timeZone: TZ }),
    weekEnd: new Date(now.getTime() + 7 * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ }),
  };
}

/** Minutos desde a meia-noite agora, no fuso de SP (para a linha do "agora" no calendário). */
export function nowMinutes(now = new Date()) {
  const [h, m] = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).split(":");
  return Number(h) * 60 + Number(m);
}
