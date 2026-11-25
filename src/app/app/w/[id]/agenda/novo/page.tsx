import type { Metadata } from "next";
import { createEvent } from "@/_data/agenda.actions";
import { getEventFormOptions } from "@/_data/agenda";
import { EventForm } from "@/_components/meetings/EventForm";
import { Alert } from "@/_components/ui/Alert";
import { localDay } from "@/lib/time";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Novo evento" };
const ERROS: Record<string, string> = { dados: "Confira os campos.", horario: "O fim precisa ser depois do início." };

export default async function NovoEvento({ params, searchParams }: PageProps<"/app/w/[id]/agenda/novo">) {
  const { id } = await params;
  const { dia, erro, hora } = (await searchParams) as { dia?: string; erro?: string; hora?: string };
  const opts = await getEventFormOptions(id);
  const day = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : localDay(new Date());
  return (
    <div className={p.page}>
      <div className={p.narrow}><h1 className={p.title}>Novo evento</h1></div>
      {erro && <div className={p.narrow}><Alert>{ERROS[erro] ?? ERROS.dados}</Alert></div>}
      <EventForm workspaceId={id} action={createEvent} opts={opts} day={day} hour={hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : undefined} cancelHref={`/app/w/${id}/agenda?dia=${day}`} />
    </div>
  );
}
