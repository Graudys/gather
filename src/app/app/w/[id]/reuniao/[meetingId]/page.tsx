import { PageCrumb } from "@/_components/shell/ShellContext";
import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMeetingView } from "@/_data/meetings";
import { getEventFormOptions } from "@/_data/agenda";
import { requireReadyUser } from "@/_lib/auth/dal";
import { MeetingRoom } from "@/_components/meetings/MeetingRoom";
import { MeetingNotes } from "@/_components/meetings/MeetingNotes";
import { Avatar } from "@/_components/chat/Avatar";
import { PriorityChip } from "@/_components/projects/TaskBadges";
import { localTime, weekdayShort } from "@/lib/time";
import { id as Id } from "@/lib/validation";
import s from "@/_styles/meetings/Meetings.module.css";

export const metadata: Metadata = { title: "Reunião" };

export default async function ReuniaoPage({ params }: PageProps<"/app/w/[id]/reuniao/[meetingId]">) {
  const { id, meetingId } = await params;
  if (!Id.safeParse(meetingId).success) notFound();
  const [m, opts, user] = await Promise.all([getMeetingView(id, meetingId), getEventFormOptions(id), requireReadyUser()]);

  if (m.status === "ENDED" || m.status === "CANCELLED") {
    const duration = m.startedAt && m.endedAt ? Math.round((Date.parse(m.endedAt) - Date.parse(m.startedAt)) / 60_000) : 0;
    return (
      <div className={s.room}>
        <PageCrumb label={m.title} />
        <div className={s.summary}>
          <Link href={`/app/w/${id}/reunioes`} className={s.note}><Icon name="back" size={14} /> Reuniões</Link>
          <h1 className={s.title}>{m.title}</h1>
          <p className={s.note}>
            {m.status === "CANCELLED" ? "Cancelada" : `${weekdayShort(m.startedAt!)} · ${localTime(m.startedAt!)} às ${localTime(m.endedAt!)} · ${duration} min · ${m.attendance.length} ${m.attendance.length === 1 ? "participante" : "participantes"}`}
            {m.project && ` · ${m.project.name}`}
          </p>
          <div className={s.card}>
            <b className={s.cardTitle}>Participantes</b>
            {m.attendance.length === 0 && <p className={s.note}>Ninguém entrou.</p>}
            {m.attendance.map((a) => (
              <div key={a.id} className={s.att}><Avatar id={a.id} name={a.name} small /> {a.name} <b>{a.minutes} min</b></div>
            ))}
          </div>
          {m.tasks.length > 0 && (
            <div className={s.card}>
              <b className={s.cardTitle}>Tarefas criadas na reunião</b>
              {m.tasks.map((t) => (
                <Link key={t.id} href={`/app/w/${id}/p/${t.projectId}?tarefa=${t.id}`} className={s.att}><Icon name="box" size={13} /> {t.title} <b><PriorityChip p={t.priority} /></b></Link>
              ))}
            </div>
          )}
          <p className={s.note}>O Gather não grava nem guarda áudio. Ficam só as notas, decisões e quem participou.</p>
        </div>
        <MeetingNotes m={m} workspaceId={id} projects={opts.projects} />
      </div>
    );
  }

  return (
    <div className={s.room}>
      <PageCrumb label={m.title} />
      <MeetingRoom m={m} workspaceId={id} me={{ id: user.id, name: user.name }} />
      <MeetingNotes m={m} workspaceId={id} projects={opts.projects} />
    </div>
  );
}
