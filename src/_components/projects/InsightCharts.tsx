import type { WeekPoint } from "@/lib/insights";
import s from "@/_styles/projects/Insights.module.css";

const label = (iso: string) => new Date(`${iso}T15:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const nice = (n: number) => { const step = n <= 10 ? 2 : n <= 25 ? 5 : n <= 60 ? 10 : n <= 150 ? 25 : 50; return { max: Math.max(step, Math.ceil(n / step) * step), step }; };

/**
 * Progresso x escopo por semana. Roxo = concluídas; cinza = total de tarefas.
 * Tracejado: projeção no ritmo atual até o prazo (quando o prazo está à frente).
 */
export function BurnUp({ weeks, dueDate, pace }: { weeks: WeekPoint[]; dueDate: string | null; pace: number }) {
  const W = 640, H = 230, L = 40, R = 16, T = 16, B = 196;
  const lastStart = weeks.at(-1)!.start;
  const dueWeeks = dueDate ? Math.ceil((new Date(dueDate).getTime() - new Date(lastStart).getTime()) / (7 * 86_400_000)) : 0;
  const extra = Math.max(0, Math.min(dueWeeks, 12));
  const n = weeks.length + extra;
  const lastDone = weeks.at(-1)!.done, lastScope = weeks.at(-1)!.scope;
  const projected = extra ? Math.min(lastScope, Math.round(lastDone + pace * extra)) : lastDone;
  const { max, step } = nice(Math.max(lastScope, 1));
  const x = (i: number) => L + (n <= 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => B - (v / max) * (B - T);
  const line = (k: "scope" | "done") => weeks.map((w, i) => `${x(i).toFixed(1)},${y(w[k]).toFixed(1)}`).join(" ");
  const li = weeks.length - 1;
  const every = Math.ceil(n / 8);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const future = Array.from({ length: extra }, (_, i) => {
    const d = new Date(lastStart); d.setUTCDate(d.getUTCDate() + 7 * (i + 1)); return d.toISOString().slice(0, 10);
  });
  const all = [...weeks.map((w) => w.start), ...future];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label={`Progresso: ${lastDone} de ${lastScope} tarefas concluídas${extra ? `; no ritmo atual, cerca de ${projected} até o prazo` : ""}.`}>
      {ticks.map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={s.grid} /><text x={L - 8} y={y(v) + 4} textAnchor="end" className={s.axis}>{v}</text></g>
      ))}
      {all.map((d, i) => (i % every === 0 || i === n - 1) && <text key={d} x={x(i)} y={H - 8} textAnchor="middle" className={s.axis}>{label(d)}</text>)}
      {extra > 0 && (
        <>
          <rect x={x(li)} y={T} width={x(n - 1) - x(li)} height={B - T} className={s.futureBand} />
          <line x1={x(n - 1)} x2={x(n - 1)} y1={T} y2={B} className={s.due} />
          <text x={x(n - 1) - 6} y={T + 12} textAnchor="end" className={s.dueText}>Prazo</text>
          <line x1={x(li)} y1={y(lastScope)} x2={x(n - 1)} y2={y(lastScope)} className={s.scopeDash} />
          <line x1={x(li)} y1={y(lastDone)} x2={x(n - 1)} y2={y(projected)} className={s.doneDash} />
          <text x={x(n - 1) - 6} y={y(projected) + 16} textAnchor="end" className={s.doneLabel}>≈ {projected} no prazo</text>
        </>
      )}
      <polyline points={line("scope")} className={s.scope} />
      <polyline points={line("done")} className={s.done} />
      <circle cx={x(li)} cy={y(lastDone)} r={4} className={s.dot} />
      <text x={x(li) + (extra ? 8 : -8)} y={y(lastDone) + 16} textAnchor={extra ? "start" : "end"} className={s.doneLabel}>{lastDone} feitas</text>
      <text x={x(li) - 8} y={y(lastScope) - 8} textAnchor="end" className={s.scopeLabel}>{lastScope} no total</text>
    </svg>
  );
}

/** Criadas x concluídas nas últimas 8 semanas, barras lado a lado. */
export function Flow({ weeks }: { weeks: WeekPoint[] }) {
  const ws = weeks.slice(-8);
  const W = 420, H = 196, L = 32, R = 8, T = 12, B = 168;
  const { max, step } = nice(Math.max(1, ...ws.map((w) => Math.max(w.created, w.completed))));
  const bw = (W - L - R) / ws.length;
  const y = (v: number) => B - (v / max) * (B - T);
  const created = ws.reduce((a, w) => a + w.created, 0), completed = ws.reduce((a, w) => a + w.completed, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label={`Nas últimas ${ws.length} semanas: ${completed} concluídas e ${created} criadas.`}>
      {Array.from({ length: max / step + 1 }, (_, i) => i * step).map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={s.grid} /><text x={L - 8} y={y(v) + 4} textAnchor="end" className={s.axis}>{v}</text></g>
      ))}
      {ws.map((w, i) => {
        const cx = L + bw * i + bw / 2;
        return (
          <g key={w.start}>
            <rect x={cx - 13} y={y(w.created)} width={12} height={B - y(w.created)} rx={3} className={s.barCreated}><title>{`${w.created} criadas`}</title></rect>
            <rect x={cx + 1} y={y(w.completed)} width={12} height={B - y(w.completed)} rx={3} className={s.barDone}><title>{`${w.completed} concluídas`}</title></rect>
            <text x={cx} y={H - 10} textAnchor="middle" className={s.axis}>{label(w.start)}</text>
          </g>
        );
      })}
    </svg>
  );
}
