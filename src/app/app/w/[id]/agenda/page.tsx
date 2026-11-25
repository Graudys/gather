import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { Metadata } from "next";
import { getEvent, listCalendar } from "@/_data/agenda";
import { EventPanel } from "@/_components/meetings/EventPanel";
import { ScrollToHour } from "@/_components/meetings/ScrollToHour";
import { Drawer } from "@/_components/ui/Modal";
import { addDays, localDay, localTime, weekStart } from "@/lib/time";
import { nowMinutes } from "@/lib/projects";
import { id as Id } from "@/lib/validation";
import type { CalendarItem } from "@/types/domain";
import s from "@/_styles/meetings/Agenda.module.css";

export const metadata: Metadata = { title: "Calendário" };

const HOUR = 48; // px por hora
const DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const monthName = (day: string) => {
  const t = new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const dm = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const dow = (day: string) => DOW[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]!;
const dayOf = (it: CalendarItem) => localDay(it.kind === "event" ? it.startsAt : it.dueAt);
const mins = (iso: string) => {
  const [h, m] = localTime(iso).split(":");
  return Number(h) * 60 + Number(m);
};

type Ev = Extract<CalendarItem, { kind: "event" }>;
type Placed = { e: Ev; top: number; height: number; lane: number; lanes: number };

/** Põe os eventos do dia em faixas lado a lado quando os horários se cruzam. */
function place(events: Ev[], day: string): Placed[] {
  const rows = events
    .map((e) => {
      const start = mins(e.startsAt);
      const end = localDay(e.endsAt) > day ? 24 * 60 : Math.max(mins(e.endsAt), start + 15);
      return { e, start, end };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: (typeof out[number] & { end: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(...cluster.map((c) => c.lane)) + 1;
    for (const c of cluster) out.push({ e: c.e, top: c.top, height: c.height, lane: c.lane, lanes });
    cluster = [];
  };
  for (const r of rows) {
    if (cluster.length && r.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.end > r.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ e: r.e, top: (r.start / 60) * HOUR, height: Math.max(((r.end - r.start) / 60) * HOUR, 22), lane, lanes: 1, end: r.end });
    clusterEnd = Math.max(clusterEnd, r.end);
  }
  if (cluster.length) flush();
  return out;
}

// Calendário: semana e dia com coluna de horários (o evento ocupa o horário dele); mês em grade.
export default async function Agenda({ params, searchParams }: PageProps<"/app/w/[id]/agenda">) {
  const { id } = await params;
  const sp = (await searchParams) as { dia?: string; vista?: string; evento?: string };
  const today = localDay(new Date());
  const anchor = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : today;
  const view = sp.vista === "mes" ? "mes" : sp.vista === "dia" ? "dia" : "semana";
  const base = `/app/w/${id}/agenda`;

  const first = view === "mes" ? weekStart(`${anchor.slice(0, 7)}-01`) : view === "dia" ? anchor : weekStart(anchor);
  const days = Array.from({ length: view === "mes" ? 42 : view === "dia" ? 1 : 7 }, (_, i) => addDays(first, i));
  const items = await listCalendar(id, days[0]!, days.at(-1)!);
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) byDay.set(dayOf(it), [...(byDay.get(dayOf(it)) ?? []), it]);

  const eventId = sp.evento && Id.safeParse(sp.evento).success ? sp.evento : null;
  const event = eventId ? await getEvent(id, eventId).catch(() => null) : null;
  const href = (o: { dia?: string; vista?: string; evento?: string }) => {
    const q = new URLSearchParams();
    const dia = o.dia ?? anchor;
    if (dia !== today) q.set("dia", dia);
    const v = o.vista ?? (view === "semana" ? "" : view);
    if (v) q.set("vista", v);
    if (o.evento) q.set("evento", o.evento);
    const str = q.toString();
    return str ? `${base}?${str}` : base;
  };
  const step = view === "mes" ? 35 : view === "dia" ? 1 : 7;
  const title =
    view === "mes" ? monthName(anchor)
    : view === "dia" ? new Date(`${anchor}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).replace(/^./, (c) => c.toUpperCase())
    : `${dm(days[0]!)} a ${dm(days[6]!)} de ${days[6]!.slice(0, 4)}`;
  const now = nowMinutes();
  const events = items.filter((i): i is Ev => i.kind === "event");
  const firstHour = events.length ? Math.min(7, ...events.map((e) => Math.floor(mins(e.startsAt) / 60))) : 7;
  const cols = `56px repeat(${days.length}, minmax(${view === "dia" ? 200 : 120}px, 1fr))`;
  const hasTasks = view !== "mes" && days.some((d) => (byDay.get(d) ?? []).some((i) => i.kind === "task"));

  return (
    <>
      <div className={s.wrap}>
        <header className={s.head}>
          <h1 className={s.title}>{title}</h1>
          <span className={s.spacer} />
          <div className={s.nav}>
            <Link className={s.chip} href={href({ dia: addDays(anchor, -step) })} aria-label="Anterior"><Icon name="back" size={14} /></Link>
            <Link className={s.chip} href={href({ dia: today })}>Hoje</Link>
            <Link className={s.chip} href={href({ dia: addDays(anchor, step) })} aria-label="Próximo"><Icon name="right" size={14} /></Link>
          </div>
          <div className={s.seg} role="group" aria-label="Ver por">
            <Link className={view === "dia" ? s.on : ""} href={href({ vista: "dia" })}>Dia</Link>
            <Link className={view === "semana" ? s.on : ""} href={href({ vista: "" })}>Semana</Link>
            <Link className={view === "mes" ? s.on : ""} href={href({ vista: "mes" })}>Mês</Link>
          </div>
          <Link href={`${base}/novo?dia=${anchor}`} className={s.btn}><Icon name="plus" size={15} /> Novo evento</Link>
        </header>

        {view === "mes" ? (
          <div className={s.month}>
            {DOW.map((d) => <div key={d} className={s.mHead}>{d}</div>)}
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              return (
                <Link key={d} href={href({ dia: d, vista: "dia" })} className={`${s.mCell} ${d.slice(0, 7) !== anchor.slice(0, 7) ? s.mOut : ""} ${d === today ? s.mToday : ""}`}>
                  <span className={s.mNum}>{Number(d.slice(8))}</span>
                  {list.slice(0, 3).map((it) => (
                    <span key={it.id} className={`${s.mItem} ${it.kind === "task" ? s.mTask : ""}`}>{it.kind === "event" ? `${localTime(it.startsAt)} ${it.title}` : <><Icon name="box" size={11} /> {it.title}</>}</span>
                  ))}
                  {list.length > 3 && <span className={s.mMore}>+{list.length - 3}</span>}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={s.cal} data-cal-scroll>
            <ScrollToHour hour={firstHour} px={HOUR} />
            <div className={s.calHead} style={{ gridTemplateColumns: cols }}>
              <span className={s.tz}>GMT-3</span>
              {days.map((d) => (
                <Link key={d} href={href({ dia: d, vista: "dia" })} className={`${s.dh} ${d === today ? s.today : ""}`}>
                  <span>{dow(d)}</span>
                  <b className={s.dayNum}>{Number(d.slice(8))}</b>
                </Link>
              ))}
              {hasTasks && (
                <>
                  <span className={s.allDayLabel}>Prazos</span>
                  {days.map((d) => (
                    <div key={d} className={s.allDay}>
                      {(byDay.get(d) ?? []).filter((i) => i.kind === "task").map((it) => it.kind === "task" && (
                        <Link key={it.id} href={`/app/w/${id}/p/${it.projectId}?tarefa=${it.id}`} className={s.taskChip} title={`${it.title} · ${it.projectName}`}>
                          <Icon name="box" size={11} /> {it.title}
                        </Link>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className={s.calBody} style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
              <div className={s.hours}>
                {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * HOUR }}>{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>)}
              </div>
              {days.map((d) => (
                <div key={d} className={`${s.dayCol} ${d === today ? s.todayCol : ""}`} style={{ backgroundSize: `100% ${HOUR}px` }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <Link key={h} href={`${base}/novo?dia=${d}&hora=${String(h).padStart(2, "0")}:00`} className={s.slot} style={{ top: h * HOUR, height: HOUR }} aria-label={`Novo evento ${dm(d)} às ${h}h`} tabIndex={-1} />
                  ))}
                  {place((byDay.get(d) ?? []).filter((i): i is Ev => i.kind === "event"), d).map(({ e, top, height, lane, lanes }) => (
                    <Link
                      key={e.id}
                      href={href({ evento: e.id })}
                      scroll={false}
                      className={`${s.ev} ${e.hasMeeting ? s.evMeet : ""} ${eventId === e.id ? s.evOn : ""} ${height < 40 ? s.evShort : ""}`}
                      style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }}
                      title={`${localTime(e.startsAt)} – ${localTime(e.endsAt)} · ${e.title}`}
                    >
                      <span className={`${s.evTitle} ${e.myResponse === "DECLINED" ? s.declined : ""}`}>{e.hasMeeting && <Icon name="video" size={12} />} {e.title}</span>
                      <span className={s.evTime}>{localTime(e.startsAt)} – {localTime(e.endsAt)}</span>
                    </Link>
                  ))}
                  {d === today && <span className={s.now} style={{ top: (now / 60) * HOUR }} aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {event && (
        <Drawer closeHref={href({})} label={event.title} width={420}>
          <EventPanel e={event} workspaceId={id} closeHref={href({})} />
        </Drawer>
      )}
    </>
  );
}
