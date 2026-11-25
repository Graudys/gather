// Datas e horas do app: tudo no fuso de São Paulo (sem horário de verão desde 2019).
export const TZ = "America/Sao_Paulo";

/** "2026-11-24" + "14:30" (hora de SP) → Date em UTC. */
export function fromLocal(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}
/** Date → "2026-11-24" no fuso de SP. */
export const localDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
/** Date → "14:30" no fuso de SP. */
export const localTime = (d: Date | string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
/** Primeiro dia do mês (de SP) como "aaaa-mm-01". */
export const monthStart = (d = new Date()) => `${localDay(d).slice(0, 7)}-01`;
/** "seg, 24 nov" */
export const weekdayShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).replace(/\./g, "");
/** Soma dias numa data "aaaa-mm-dd". */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Segunda-feira da semana de `day`. */
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  return addDays(day, -dow);
}
