import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { EventDetail, EventResponse } from "@/types/domain";
import { deleteEvent, respondEvent } from "@/_data/agenda.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Button } from "@/_components/ui/Button";
import { localTime, weekdayShort } from "@/lib/time";
import s from "@/_styles/meetings/Agenda.module.css";

const RESP: Record<EventResponse, string> = { INVITED: "Convidado", ACCEPTED: "Vai", DECLINED: "Não vai", TENTATIVE: "Talvez" };
const REMINDER: Record<number, string> = { 10: "10 min antes", 60: "1 hora antes", 1440: "1 dia antes" };

export function EventPanel({ e, workspaceId, closeHref }: { e: EventDetail; workspaceId: string; closeHref: string }) {
  const ids = (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="eventId" value={e.id} />
    </>
  );
  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <span className={s.panelTitle}>{e.title}</span>
        <Link href={closeHref} scroll={false} className={s.close} aria-label="Fechar"><Icon name="x" size={18} /></Link>
      </div>
      <p className={s.muted}>
        {weekdayShort(e.startsAt)} · {localTime(e.startsAt)} às {localTime(e.endsAt)}
      </p>
      <p className={s.faint}>
        {e.visibility === "PRIVATE" ? <><Icon name="lock" size={13} /> Só convidados</> : "Todo o workspace"}
        {e.project && <> · Projeto <Link href={`/app/w/${workspaceId}/p/${e.project.id}`}>{e.project.name}</Link></>}
        {e.reminderMin ? <> · Lembrete {REMINDER[e.reminderMin] ?? `${e.reminderMin} min antes`}</> : null}
      </p>
      {e.meetingId && (
        <Link href={`/app/w/${workspaceId}/reuniao/${e.meetingId}`}><Button block><Icon name="video" /> Entrar na reunião</Button></Link>
      )}
      <div className={s.answers} role="group" aria-label="Sua resposta">
        {(["ACCEPTED", "TENTATIVE", "DECLINED"] as const).map((r) => (
          <form key={r} action={respondEvent}>
            {ids}
            <input type="hidden" name="response" value={r} />
            <button className={`${s.answer} ${e.myResponse === r ? s.answerOn : ""}`} aria-pressed={e.myResponse === r}>{r === "ACCEPTED" ? "Vou" : r === "TENTATIVE" ? "Talvez" : "Não vou"}</button>
          </form>
        ))}
      </div>
      {e.description && <p className={s.desc}>{e.description}</p>}
      <div className={s.people}>
        <span className={s.faint}>{e.participants.length} {e.participants.length === 1 ? "participante" : "participantes"}</span>
        {e.participants.map((x) => (
          <div key={x.id} className={s.person}>
            <Avatar id={x.id} name={x.name} small /> {x.name}
            <span className={s.resp}>{x.id === e.createdBy?.id ? "Organizou" : RESP[x.response]}</span>
          </div>
        ))}
      </div>
      {e.canEdit && (
        <div className={s.row}>
          <Link href={`/app/w/${workspaceId}/agenda/${e.id}/editar`}><Button variant="ghost">Editar</Button></Link>
          <form action={deleteEvent}>
            {ids}
            <Button variant="link">Apagar evento</Button>
          </form>
        </div>
      )}
    </div>
  );
}
