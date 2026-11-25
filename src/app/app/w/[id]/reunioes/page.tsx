import Link from "next/link";
import type { Metadata } from "next";
import { listMeetings } from "@/_data/meetings";
import { getWorkspaceShell } from "@/_data/chat";
import { getEventFormOptions } from "@/_data/agenda";
import { startMeetingNow } from "@/_data/meetings.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { localTime, weekdayShort, localDay } from "@/lib/time";
import type { MeetingRow } from "@/types/domain";
import s from "@/_styles/meetings/Meetings.module.css";

export const metadata: Metadata = { title: "Reuniões" };

const ERROS: Record<string, string> = {
  cota: "Os minutos de reunião deste mês acabaram. Chat, tarefas e agenda continuam normais.",
  desligado: "Reuniões não estão ligadas neste workspace (ou o LiveKit não foi configurado).",
};

function Row({ m, ws }: { m: MeetingRow; ws: string }) {
  const when = m.status === "LIVE" ? null : m.status === "ENDED" ? m.endedAt : m.startsAt;
  const today = when && localDay(when) === localDay(new Date());
  return (
    <Link href={`/app/w/${ws}/reuniao/${m.id}`} className={s.item}>
      <span className={s.when}>{m.status === "LIVE" ? <span className={s.live}>AO VIVO</span> : when ? (today ? localTime(when) : weekdayShort(when)) : "—"}</span>
      <span className={s.what}>
        <div className={s.name}>{m.title}</div>
        <div className={s.sub}>{[m.project?.name, m.status === "ENDED" ? (m.hasNotes ? "com notas" : "sem notas") : null].filter(Boolean).join(" · ") || " "}</div>
      </span>
      <span className={s.faces}>{m.people.map((p) => <Avatar key={p.id} id={p.id} name={p.name} small />)}</span>
    </Link>
  );
}

export default async function Reunioes({ params, searchParams }: PageProps<"/app/w/[id]/reunioes">) {
  const { id } = await params;
  const { erro } = (await searchParams) as { erro?: string };
  const [data, shell, opts] = await Promise.all([listMeetings(id), getWorkspaceShell(id), getEventFormOptions(id)]);
  const u = data.usage;
  const pct = u.quota ? Math.min(100, Math.round((u.used / u.quota) * 100)) : 0;
  const renews = new Date(u.renewsOn).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <div className={s.page}>
      <div className={s.main}>
        <div className={s.top}>
          <h1 className={s.title}>Reuniões</h1>
          <span className={s.spacer} />
          <Link href={`/app/w/${id}/agenda/novo`}><Button variant="ghost">Agendar</Button></Link>
        </div>
        {erro && <Alert>{ERROS[erro] ?? "Não foi possível iniciar agora."}</Alert>}
        {!data.configured && <Alert>O LiveKit ainda não foi configurado no servidor (LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET). O resto funciona; só não dá para entrar na sala.</Alert>}

        {data.current.length > 0 && (
          <>
            <h2 className={s.h2}>Agora</h2>
            <div className={s.list}>{data.current.map((m) => <Row key={m.id} m={m} ws={id} />)}</div>
          </>
        )}
        <h2 className={s.h2}>Próximas</h2>
        <div className={s.list}>
          {data.upcoming.length ? data.upcoming.map((m) => <Row key={m.id} m={m} ws={id} />) : <p className={s.empty}>Nenhuma reunião marcada. Crie um evento com sala, ou inicie uma agora.</p>}
        </div>
        <h2 className={s.h2}>Anteriores</h2>
        <div className={s.list}>
          {data.past.length ? data.past.map((m) => <Row key={m.id} m={m} ws={id} />) : <p className={s.empty}>Ainda não teve reunião.</p>}
        </div>
      </div>

      <aside className={s.side}>
        <form action={startMeetingNow} className={s.card}>
          <input type="hidden" name="workspaceId" value={id} />
          <b className={s.cardTitle}>Iniciar reunião agora</b>
          <label className={s.label}>Nome da sala<input name="title" className={s.input} required maxLength={120} defaultValue="Conversa rápida" /></label>
          {opts.projects.length > 0 && (
            <label className={s.label}>
              Projeto (opcional)
              <select name="projectId" className={s.select} defaultValue="">
                <option value="">Nenhum</option>
                {opts.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {shell.channels.length > 0 && shell.workspace.kind === "TEAM" && (
            <label className={s.label}>
              Avisar num canal (opcional)
              <select name="channelId" className={s.select} defaultValue="">
                <option value="">Não avisar</option>
                {shell.channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>
            </label>
          )}
          <Button disabled={!u.enabled || u.left <= 0}>Iniciar reunião</Button>
        </form>

        <div className={s.card}>
          <b className={s.cardTitle}>Minutos de reunião</b>
          <div><span className={s.big}>{u.left}</span> <span className={s.note}>restantes de {u.quota}</span></div>
          <div className={s.bar}><div className={s.barFill} style={{ width: `${pct}%` }} /></div>
          <p className={s.note}>{u.used} usados · renova em {renews}. Cada pessoa conta: 4 pessoas por 30 minutos usam 120 minutos.</p>
        </div>

        <div className={s.card}>
          <ul className={s.bullets}>
            <li>Só áudio</li>
            <li>Até {data.limits.people} pessoas por sala</li>
            <li>Até {data.limits.minutes} minutos por reunião</li>
          </ul>
          <p className={s.note}>O Gather não grava nem guarda o que é falado. Ficam só quem entrou, quanto tempo e as notas que vocês escreverem.</p>
        </div>
      </aside>
    </div>
  );
}
