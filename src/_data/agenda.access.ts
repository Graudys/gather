import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";

/**
 * Quem vê um evento:
 * - "Todo o workspace": qualquer membro.
 * - "Só convidados": quem criou e quem foi convidado.
 * - "Equipe": membros da equipe (além de quem criou e convidados).
 */
export const eventVisibleTo = (userId: string) => ({
  OR: [
    { visibility: "WORKSPACE" as const },
    { createdById: userId },
    { participants: { some: { userId } } },
    { visibility: "TEAM" as const, team: { members: { some: { userId } } } },
  ],
});

export async function requireEvent(workspaceId: string, eventId: string) {
  const ctx = await requireMember(workspaceId);
  const event = await db.calendarEvent.findFirst({
    where: { id: eventId, workspaceId, ...eventVisibleTo(ctx.user.id) },
    select: { id: true, createdById: true, meeting: { select: { id: true, status: true, roomKey: true } } },
  });
  if (!event) notFound();
  const canEdit = event.createdById === ctx.user.id || ctx.role === "OWNER" || ctx.role === "ADMIN";
  return { ...ctx, event, canEdit };
}
