import Link from "next/link";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { getOverview } from "@/_data/admin-overview";
import { dataHora } from "@/lib/format";
import s from "@/_styles/admin/AdminPages.module.css";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(0)} MB`;
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

export default async function AdminHome() {
  const o = await getOverview();
  const max = Math.max(1, ...o.days.map((d) => d.n));
  const lkPct = o.livekit.cap ? Math.min(100, Math.round((o.livekit.used / o.livekit.cap) * 100)) : 0;
  const dbPct = Math.min(100, Math.round((o.dbBytes / (500 * 1024 * 1024)) * 100));
  return (
    <>
      <AdminTitle title="Visão geral" sub="Como o Gather está sendo usado. O admin vê contagens, não o conteúdo das conversas." />
      {o.maintenance && <div className={s.callout}>Modo manutenção ligado: só admins conseguem usar o app. Desligue em Configurações.</div>}
      <div className={s.kpis}>
        <div className={s.kpi}><span className={s.kpiLabel}>Pessoas com acesso</span><span className={s.kpiValue}>{o.people}</span><span className={s.kpiSub}>{o.active7} entraram nos últimos 7 dias{o.pending ? ` · ${o.pending} sem primeiro acesso` : ""}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>Workspaces de equipe</span><span className={s.kpiValue}>{o.workspaces}</span><Link href="/admin/workspaces" className={s.kpiSub}>Ver todos</Link></div>
        <div className={s.kpi}>
          <span className={s.kpiLabel}>Mensagens (7 dias)</span><span className={s.kpiValue}>{o.msgs7}</span>
          <span className={`${s.kpiSub} ${o.msgsTrend !== null ? (o.msgsTrend >= 0 ? s.up : s.down) : ""}`}>{o.msgsTrend === null ? "sem semana anterior" : `${o.msgsTrend >= 0 ? "+" : ""}${o.msgsTrend}% na semana`}</span>
        </div>
        <div className={s.kpi}><span className={s.kpiLabel}>Reuniões (30 dias)</span><span className={s.kpiValue}>{o.meetings30}</span><span className={s.kpiSub}>{o.livekit.used} {o.livekit.used === 1 ? "minuto" : "minutos"} este mês</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>Erros novos</span><span className={s.kpiValue}>{o.errors}</span><Link href="/admin/erros" className={s.kpiSub}>Abrir erros</Link></div>
      </div>

      <div className={s.grid}>
        <div className={s.col}>
          <section className={s.card}>
            <div className={s.cardHead}><b className={s.cardTitle}>Pessoas ativas por dia</b><span className={s.spacer} /><span className={s.faint}>últimos 30 dias</span></div>
            <div className={s.chart} role="img" aria-label="Pessoas ativas por dia nos últimos 30 dias">
              {o.days.map((d) => <div key={d.day} className={s.bar} style={{ height: `${(d.n / max) * 100}%` }} title={`${short(d.day)}: ${d.n}`} />)}
            </div>
            <div className={s.axis}><span>{short(o.days[0]!.day)}</span><span>{short(o.days[14]!.day)}</span><span>hoje</span></div>
            <p className={s.faint}>Conta quem entrou ou mandou mensagem no dia.</p>
          </section>
          <section className={s.card}>
            <div className={s.cardHead}><b className={s.cardTitle}>Workspaces mais ativos</b><span className={s.spacer} /><Link href="/admin/workspaces" className={s.faint}>Ver todos</Link></div>
            {o.topWorkspaces.length === 0 && <p className={s.muted}>Nenhum workspace de equipe ainda.</p>}
            {o.topWorkspaces.map((w) => (
              <Link key={w.id} href={`/admin/workspaces/${w.id}`} className={s.row}>{w.name} <span className={s.faint}>· {w.people} pessoas</span><b>{w.msgs} mensagens</b></Link>
            ))}
          </section>
        </div>
        <div className={s.col}>
          <section className={s.card}>
            <div className={s.cardHead}><b className={s.cardTitle}>LiveKit</b><span className={s.spacer} /><span className={`${s.chip} ${o.livekit.configured ? s.ok : s.warn}`}>{o.livekit.configured ? "configurado" : "sem chaves"}</span></div>
            <div className={s.row}>Minutos de reunião <b>{o.livekit.used} de {o.livekit.cap}</b></div>
            <div className={s.meter}><div className={`${s.meterFill} ${lkPct > 80 ? s.meterWarn : ""}`} style={{ width: `${lkPct}%` }} /></div>
            <p className={s.faint}>Teto geral do mês. Passou dele, ninguém começa reunião nova (muda em Configurações).</p>
          </section>
          <section className={s.card}>
            <div className={s.cardHead}><b className={s.cardTitle}>Supabase</b><span className={s.spacer} /><span className={s.chip}>banco</span></div>
            <div className={s.row}>Banco de dados <b>{mb(o.dbBytes)} de 500 MB</b></div>
            <div className={s.meter}><div className={`${s.meterFill} ${dbPct > 80 ? s.meterWarn : ""}`} style={{ width: `${dbPct}%` }} /></div>
            <p className={s.faint}>Limite do plano grátis. Arquivos e tráfego aparecem no painel do Supabase.</p>
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Rotinas</b>
            <div className={s.row}>Limpeza diária <b>{o.lastCleanup ? dataHora(o.lastCleanup.at) : "ainda não rodou"}</b></div>
            {o.lastCleanup && <p className={s.faint}>{o.lastCleanup.messages} mensagens fora do prazo apagadas na última vez.</p>}
            {!o.lastCleanup && <p className={s.faint}>Roda na Vercel às 03:00 (vercel.json), com CRON_SECRET configurado.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
