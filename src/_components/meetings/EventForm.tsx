import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { EventDetail } from "@/types/domain";
import { Field, Check } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Avatar } from "@/_components/chat/Avatar";
import { TimeRange } from "@/_components/meetings/TimeRange";
import { localDay, localTime } from "@/lib/time";
import p from "@/_styles/chat/Panel.module.css";

const addMinutes = (t: string, n: number) => {
  const m = Math.min(Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + n, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

type Opts = { me: string; personal: boolean; people: { id: string; name: string }[]; projects: { id: string; name: string }[] };

/** Formulário de evento (novo e editar). Horários em São Paulo. */
export function EventForm({ workspaceId, action, opts, event, day, hour, cancelHref }: {
  workspaceId: string;
  action: (f: FormData) => Promise<void>;
  opts: Opts;
  event?: EventDetail;
  day?: string;
  hour?: string;
  cancelHref: string;
}) {
  const invited = new Set(event?.participants.map((x) => x.id) ?? []);
  return (
    <form action={action} className={`${p.card} ${p.narrow}`}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <Field label="Título" name="title" defaultValue={event?.title} required maxLength={120} autoFocus autoComplete="off" />
      <div className={p.row}>
        <div className={p.grow}><Field label="Dia" name="date" type="date" required defaultValue={event ? localDay(event.startsAt) : day} /></div>
        <TimeRange start={event ? localTime(event.startsAt) : (hour ?? "10:00")} end={event ? localTime(event.endsAt) : addMinutes(hour ?? "10:00", 30)} />
      </div>
      <p className={p.note}>Horário de Brasília (America/Sao_Paulo).</p>
      {!opts.personal && (
        <div className={p.options} role="radiogroup" aria-label="Quem vê">
          <label className={p.option}>
            <input type="radio" name="visibility" value="WORKSPACE" defaultChecked={(event?.visibility ?? "WORKSPACE") !== "PRIVATE"} />
            <span><div className={p.optTitle}>Todo o workspace</div><div className={p.optText}>Aparece na agenda de todo mundo</div></span>
          </label>
          <label className={p.option}>
            <input type="radio" name="visibility" value="PRIVATE" defaultChecked={event?.visibility === "PRIVATE"} />
            <span><div className={p.optTitle}><Icon name="lock" size={13} /> Só convidados</div><div className={p.optText}>Só você e quem você chamar</div></span>
          </label>
        </div>
      )}
      {opts.personal && <input type="hidden" name="visibility" value="PRIVATE" />}
      {!opts.personal && opts.people.length > 1 && (
        <div className={p.label}>
          Participantes
          <div className={p.people}>
            {opts.people.filter((x) => x.id !== opts.me).map((x) => (
              <label key={x.id} className={p.person}>
                <input type="checkbox" name="participantIds" value={x.id} defaultChecked={invited.has(x.id)} />
                <Avatar id={x.id} name={x.name} small />
                <span className={p.personName}>{x.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {opts.projects.length > 0 && (
        <label className={p.label}>
          Projeto (opcional)
          <select name="projectId" className={p.select} defaultValue={event?.project?.id ?? ""}>
            <option value="">Nenhum</option>
            {opts.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      )}
      <label className={p.label}>
        Lembrete
        <select name="reminder" className={p.select} defaultValue={event ? String(event.reminderMin ?? "") : "10"}>
          <option value="">Sem lembrete</option>
          <option value="10">10 minutos antes</option>
          <option value="60">1 hora antes</option>
          <option value="1440">1 dia antes</option>
        </select>
      </label>
      <label className={p.label}>
        Descrição
        <textarea name="description" maxLength={2000} defaultValue={event?.description ?? ""} className={p.textarea} />
      </label>
      {!event && !opts.personal && <Check name="meeting" optional defaultChecked>Criar sala de reunião por áudio para este evento</Check>}
      <div className={p.actions}>
        <Link href={cancelHref}><Button type="button" variant="ghost">Cancelar</Button></Link>
        <Button>Salvar evento</Button>
      </div>
    </form>
  );
}
