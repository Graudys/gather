import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateEvent } from "@/_data/agenda.actions";
import { getEvent, getEventFormOptions } from "@/_data/agenda";
import { EventForm } from "@/_components/meetings/EventForm";
import { Alert } from "@/_components/ui/Alert";
import { id as Id } from "@/lib/validation";
import { localDay } from "@/lib/time";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditarEvento({ params, searchParams }: PageProps<"/app/w/[id]/agenda/[eventId]/editar">) {
  const { id, eventId } = await params;
  if (!Id.safeParse(eventId).success) notFound();
  const { erro } = (await searchParams) as { erro?: string };
  const [event, opts] = await Promise.all([getEvent(id, eventId), getEventFormOptions(id)]);
  const back = `/app/w/${id}/agenda?dia=${localDay(event.startsAt)}&evento=${eventId}`;
  if (!event.canEdit) redirect(back);
  return (
    <div className={p.page}>
      <div className={p.narrow}><h1 className={p.title}>Editar evento</h1></div>
      {erro && <div className={p.narrow}><Alert>O fim precisa ser depois do início.</Alert></div>}
      <EventForm workspaceId={id} action={updateEvent} opts={opts} event={event} cancelHref={back} />
    </div>
  );
}
