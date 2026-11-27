import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageCrumb } from "@/_components/shell/ShellContext";
import { Icon } from "@/_components/ui/Icon";
import { Avatar } from "@/_components/chat/Avatar";
import { BurnUp, Flow } from "@/_components/projects/InsightCharts";
import { getProjectInsights } from "@/_data/insights";
import { STALL_DAYS } from "@/lib/insights";
import { id as Id } from "@/lib/validation";
import s from "@/_styles/projects/Insights.module.css";

export const metadata: Metadata = { title: "Desempenho do projeto" };

const COL_COLORS = ["#3a3a46", "#5b8cff", "#f2c14e", "#2b8a9e", "#c0428a", "#14866d"];
const day = (iso: string) => new Date(`${iso}T15:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Aba "Desempenho" do projeto (mockup "DesempenhoProjeto"). Só dono e admin do workspace.
export default async function Desempenho({ params }: PageProps<"/app/w/[id]/p/[projectId]/desempenho">) {
  const { id, projectId } = await params;
  if (!Id.safeParse(projectId).success) notFound();
  const { project: p, data: d } = await getProjectInsights(id, projectId);
  const base = `/app/w/${id}/p/${projectId}`;
  const remaining = d.total - d.done;
  const lastWeeks = d.weeks.slice(-4);
  const grew = d.weeks.length > 1 ? d.weeks.at(-1)!.scope - d.weeks[0].scope : 0;
  const doneCols = d.columns.filter((c) => c.done).length;
  const open = d.columns.filter((c) => !c.done);
  const colColor = (c: { id: string; done: boolean }) => (c.done ? "#8b7bff" : COL_COLORS[open.findIndex((o) => o.id === c.id) % COL_COLORS.length]);

  let alert: { tone: "bad" | "ok"; title: string; text: string } | null = null;
  if (d.total > 0 && remaining === 0) alert = { tone: "ok", title: "Tudo concluído.", text: plural(d.done, "tarefa feita", "tarefas feitas") + "." };
  else if (d.total > 0 && d.pace === 0) alert = { tone: "bad", title: "Nenhuma tarefa concluída nas últimas semanas.", text: `Faltam ${plural(remaining, "tarefa", "tarefas")}. Sem ritmo, não dá para prever o término.` };
  else if (d.eta && d.lateBy !== null) {
    alert = d.lateBy > 0
      ? { tone: "bad", title: `No ritmo atual o projeto termina por volta de ${day(d.eta)}, ${plural(d.lateBy, "dia", "dias")} depois do prazo.`, text: `Faltam ${plural(remaining, "tarefa", "tarefas")} e o time conclui cerca de ${String(d.pace).replace(".", ",")} por semana.${grew > 0 ? ` O escopo cresceu ${plural(grew, "tarefa", "tarefas")} no período.` : ""}` }
      : { tone: "ok", title: `No ritmo atual o projeto termina por volta de ${day(d.eta)}, dentro do prazo.`, text: `Faltam ${plural(remaining, "tarefa", "tarefas")}; o time conclui cerca de ${String(d.pace).replace(".", ",")} por semana.` };
  }

  return (
    <div className={s.wrap}>
      <PageCrumb label={`${p.name} · Desempenho`} />
      <div className={s.head}>
        <h1>{p.name}</h1>
        <span className={`${s.chip} ${s.pur}`}><Icon name="shield" size={12} /> Só dono e admin veem</span>
        <span className={s.grow} />
        <a className={s.btn2} href={`/api/projetos/${projectId}/desempenho?w=${id}`} download><Icon name="download" size={14} /> Baixar CSV</a>
      </div>
      <p className={s.sub}>
        {p.dueDate ? <>Prazo {day(p.dueDate)}</> : "Sem prazo"}
        {p.teamName !== "Geral" && <> · Equipe {p.teamName}</>} · {plural(d.total, "tarefa", "tarefas")}
      </p>
      <nav className={s.tabs} aria-label="Seções do projeto">
        <Link href={base}><Icon name="kanban" size={14} /> Quadro</Link>
        <Link href={`${base}?vista=lista`}><Icon name="list" size={14} /> Lista</Link>
        <Link href={`${base}/desempenho`} className={s.on} aria-current="page"><Icon name="chart" size={14} /> Desempenho</Link>
      </nav>

      {d.total === 0 ? (
        <section className={s.card}><p className={s.empty}>Ainda não há tarefas neste projeto. Os números aparecem quando o time começar a criar e concluir tarefas.</p></section>
      ) : (
        <>
          {alert && (
            <section className={`${s.card} ${s.alert} ${alert.tone === "bad" ? s.alertBad : s.alertOk}`} role="status">
              <Icon name={alert.tone === "bad" ? "alert" : "ok"} size={20} />
              <div className={s.grow}><b>{alert.title}</b><span>{alert.text}</span></div>
            </section>
          )}

          <div className={s.kpis}>
            <section className={`${s.card} ${s.kpi}`}>
              <span className={s.l}>Concluído</span><span className={s.v}>{d.pct}%</span>
              <div className={s.bar}><span style={{ width: `${d.pct}%` }} /></div>
              <span className={s.s}>{d.done} de {d.total} tarefas</span>
            </section>
            <section className={`${s.card} ${s.kpi}`}>
              <span className={s.l}>Entregues no prazo</span><span className={s.v}>{d.onTime.pct === null ? "—" : `${d.onTime.pct}%`}</span>
              <span className={s.s}>{d.onTime.of ? `${d.onTime.ok} de ${d.onTime.of} concluídas com prazo` : "Nenhuma concluída tinha prazo"}</span>
            </section>
            <section className={`${s.card} ${s.kpi}`}>
              <span className={s.l}>Atrasadas agora</span><span className={`${s.v} ${d.overdue.count ? s.bad : ""}`}>{d.overdue.count}</span>
              <span className={s.s}>{d.overdue.count ? `a mais antiga há ${plural(d.overdue.oldestDays, "dia", "dias")}` : "nada passou do prazo"}</span>
            </section>
            <section className={`${s.card} ${s.kpi}`}>
              <span className={s.l}>Tempo médio por tarefa</span><span className={s.v}>{d.avgDays === null ? "—" : `${String(d.avgDays).replace(".", ",")} ${d.avgDays === 1 ? "dia" : "dias"}`}</span>
              <span className={s.s}>da criação até concluir</span>
            </section>
          </div>

          <div className={s.two}>
            <section className={s.card}>
              <div className={s.cardHead}><h3>Progresso x escopo</h3><span className={s.grow} /><span className={s.chip}>por semana</span></div>
              <p className={s.note}>A linha roxa sobe quando algo é concluído; a cinza, quando entra tarefa nova. Tracejado: projeção no ritmo atual.</p>
              <BurnUp weeks={d.weeks} dueDate={p.dueDate} pace={d.pace} />
            </section>
            <section className={s.card}>
              <div className={s.cardHead}><h3>Criadas x concluídas</h3></div>
              <p className={s.note}>Nas últimas {plural(lastWeeks.length, "semana", "semanas")}: {lastWeeks.reduce((a, w) => a + w.completed, 0)} concluídas, {lastWeeks.reduce((a, w) => a + w.created, 0)} criadas.</p>
              <div className={s.legend}><span><i style={{ background: "#5a5a68" }} />Criadas</span><span><i style={{ background: "#8b7bff" }} />Concluídas</span></div>
              <Flow weeks={d.weeks} />
            </section>
          </div>

          <div className={s.two}>
            <section className={s.card}>
              <h3>Por pessoa</h3>
              {d.people.length === 0 ? <p className={s.empty}>Nenhuma tarefa tem responsável ainda.</p> : (
                <table className={s.tbl}>
                  <thead><tr><th scope="col">Pessoa</th><th scope="col" className={s.num}>Abertas</th><th scope="col" className={s.num}>Concluídas</th><th scope="col" className={s.num}>Atrasadas</th><th scope="col" className={s.num}>No prazo</th></tr></thead>
                  <tbody>
                    {d.people.map((x) => (
                      <tr key={x.id}>
                        <td><span className={s.person}><Avatar id={x.id} name={x.name} small />{x.name}</span></td>
                        <td className={s.num}>{x.open}</td>
                        <td className={s.num}>{x.done}</td>
                        <td className={s.num}>{x.overdue ? <span className={`${s.chip} ${s.red}`}>{x.overdue}</span> : 0}</td>
                        <td className={s.num}>{x.onTimePct === null ? "—" : `${x.onTimePct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <div className={s.stack}>
              <section className={s.card}>
                <h3>Onde estão as tarefas</h3>
                <div className={s.cols} aria-hidden="true">
                  {d.columns.filter((c) => c.count).map((c) => <span key={c.id} style={{ flex: c.count, background: colColor(c) }} />)}
                </div>
                {d.columns.map((c) => (
                  <div key={c.id} className={s.colRow}><i style={{ background: colColor(c) }} /><span>{c.name}{c.done && doneCols ? " (concluída)" : ""}</span><b>{c.count}</b></div>
                ))}
              </section>
              <section className={s.card}>
                <h3>Precisa de atenção</h3>
                {d.attention.length === 0 ? <p className={s.empty}>Nada atrasado nem parado há mais de {STALL_DAYS} dias.</p> : d.attention.map((a) => (
                  <Link key={a.id} href={`${base}?tarefa=${a.id}`} className={s.att}>
                    <span className={`${s.chip} ${a.kind === "atrasada" ? s.red : s.amb}`}>{a.kind === "atrasada" ? `Atrasada ${plural(a.days, "dia", "dias")}` : `Parada ${plural(a.days, "dia", "dias")}`}</span>
                    <b>{a.title}</b>
                    {a.who && <small>{a.who}</small>}
                  </Link>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
