/**
 * Painel de desempenho do projeto: contas puras (sem banco), para testar fácil.
 * Recebe as tarefas do projeto e devolve os números e as séries dos gráficos.
 */
const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const STALL_DAYS = 5; // "parada" = mais de 5 dias na mesma coluna sem concluir

export type InsightTask = {
  id: string;
  title: string;
  statusId: string;
  createdAt: Date;
  completedAt: Date | null;
  dueAt: Date | null;
  statusChangedAt: Date | null;
  updatedAt: Date;
  assignees: { id: string; name: string }[];
};

export type WeekPoint = { start: string; scope: number; done: number; created: number; completed: number };

export type Insights = {
  total: number;
  done: number;
  pct: number;
  onTime: { ok: number; of: number; pct: number | null };
  overdue: { count: number; oldestDays: number };
  avgDays: number | null;
  weeks: WeekPoint[];
  /** Ritmo (concluídas por semana, média das últimas 4) e previsão de término. */
  pace: number;
  eta: string | null;
  lateBy: number | null; // dias depois do prazo do projeto (negativo = antes)
  people: { id: string; name: string; open: number; done: number; overdue: number; onTimePct: number | null }[];
  columns: { id: string; name: string; count: number; done: boolean }[];
  attention: { id: string; title: string; kind: "atrasada" | "parada"; days: number; who: string | null }[];
};

const endOfDay = (d: Date) => new Date(Math.floor(d.getTime() / DAY) * DAY + DAY - 1);
/** Segunda-feira 00:00 (UTC) da semana de d. */
export function weekStart(d: Date) {
  const day = Math.floor(d.getTime() / DAY) * DAY;
  const dow = (new Date(day).getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(day - dow * DAY);
}

export function computeInsights(
  tasks: InsightTask[],
  columns: { id: string; name: string; isCompleted: boolean }[],
  opts: { now: Date; startDate: Date | null; dueDate: Date | null; maxWeeks?: number },
): Insights {
  const { now } = opts;
  const total = tasks.length;
  const doneList = tasks.filter((t) => t.completedAt);
  const open = tasks.filter((t) => !t.completedAt);
  const done = doneList.length;

  const withDue = doneList.filter((t) => t.dueAt);
  const okCount = withDue.filter((t) => t.completedAt! <= endOfDay(t.dueAt!)).length;
  const late = open.filter((t) => t.dueAt && endOfDay(t.dueAt) < now);
  const oldestDays = late.reduce((m, t) => Math.max(m, Math.floor((now.getTime() - endOfDay(t.dueAt!).getTime()) / DAY) + 1), 0);
  const cycle = doneList.map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / DAY).filter((d) => d >= 0);

  // Semanas: do começo do projeto (ou 1ª tarefa) até hoje, no máximo N semanas.
  const firstTask = tasks.reduce<Date | null>((m, t) => (!m || t.createdAt < m ? t.createdAt : m), null);
  const from = weekStart(opts.startDate && (!firstTask || opts.startDate < firstTask) ? opts.startDate : firstTask ?? now);
  const max = opts.maxWeeks ?? 26;
  let first = from.getTime();
  const last = weekStart(now).getTime();
  if ((last - first) / WEEK + 1 > max) first = last - (max - 1) * WEEK;
  const weeks: WeekPoint[] = [];
  for (let w = first; w <= last; w += WEEK) {
    const end = new Date(Math.min(w + WEEK - 1, now.getTime()));
    weeks.push({
      start: new Date(w).toISOString().slice(0, 10),
      scope: tasks.filter((t) => t.createdAt <= end).length,
      done: doneList.filter((t) => t.completedAt! <= end).length,
      created: tasks.filter((t) => t.createdAt.getTime() >= w && t.createdAt <= end).length,
      completed: doneList.filter((t) => t.completedAt!.getTime() >= w && t.completedAt! <= end).length,
    });
  }
  // Ritmo: semanas completas mais recentes (até 4); a semana atual entra se for a única.
  const full = weeks.length > 1 ? weeks.slice(-5, -1) : weeks;
  const pace = full.length ? full.reduce((s, x) => s + x.completed, 0) / full.length : 0;
  const remaining = total - done;
  const etaDate = remaining === 0 ? now : pace > 0 ? new Date(now.getTime() + (remaining / pace) * WEEK) : null;
  const eta = etaDate ? etaDate.toISOString().slice(0, 10) : null;
  const lateBy = etaDate && opts.dueDate && remaining > 0 ? Math.round((etaDate.getTime() - endOfDay(opts.dueDate).getTime()) / DAY) : null;

  const byPerson = new Map<string, Insights["people"][number] & { ok: number; due: number }>();
  for (const t of tasks) {
    for (const a of t.assignees) {
      const p = byPerson.get(a.id) ?? { id: a.id, name: a.name, open: 0, done: 0, overdue: 0, onTimePct: null, ok: 0, due: 0 };
      if (t.completedAt) {
        p.done++;
        if (t.dueAt) { p.due++; if (t.completedAt <= endOfDay(t.dueAt)) p.ok++; }
      } else {
        p.open++;
        if (t.dueAt && endOfDay(t.dueAt) < now) p.overdue++;
      }
      byPerson.set(a.id, p);
    }
  }
  const people = [...byPerson.values()]
    .map(({ ok, due, ...p }) => ({ ...p, onTimePct: due ? Math.round((ok / due) * 100) : null }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  const attention: Insights["attention"] = [
    ...late.map((t) => ({ id: t.id, title: t.title, kind: "atrasada" as const, days: Math.floor((now.getTime() - endOfDay(t.dueAt!).getTime()) / DAY) + 1, who: t.assignees[0]?.name ?? null })),
    ...open
      .filter((t) => !late.includes(t))
      .map((t) => ({ t, days: Math.floor((now.getTime() - (t.statusChangedAt ?? t.updatedAt).getTime()) / DAY) }))
      .filter((x) => x.days > STALL_DAYS)
      .map(({ t, days }) => ({ id: t.id, title: t.title, kind: "parada" as const, days, who: t.assignees[0]?.name ?? null })),
  ].sort((a, b) => (a.kind === b.kind ? b.days - a.days : a.kind === "atrasada" ? -1 : 1)).slice(0, 6);

  return {
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    onTime: { ok: okCount, of: withDue.length, pct: withDue.length ? Math.round((okCount / withDue.length) * 100) : null },
    overdue: { count: late.length, oldestDays },
    avgDays: cycle.length ? Math.round((cycle.reduce((a, b) => a + b, 0) / cycle.length) * 10) / 10 : null,
    weeks,
    pace: Math.round(pace * 10) / 10,
    eta,
    lateBy,
    people,
    columns: columns.map((c) => ({ id: c.id, name: c.name, done: c.isCompleted, count: tasks.filter((t) => t.statusId === c.id).length })),
    attention,
  };
}
