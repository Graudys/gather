"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";

const REASONS = ["Suspeita de acesso indevido", "Pedido da própria pessoa", "Ordem judicial", "Investigar erro"] as const;

/** Registra o motivo da consulta e abre o registro de acessos da pessoa. */
export async function consultAccess(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({ personId: z.uuid(), reason: z.enum(REASONS), detail: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) redirect("/admin/acessos?erro=motivo");
  const person = await db.user.findUnique({ where: { id: p.data!.personId }, select: { id: true } });
  if (!person) redirect("/admin/acessos?erro=pessoa");
  await db.adminAction.create({
    data: { adminId: admin.id, action: "access_log_viewed", targetUserId: person!.id, reason: p.data!.detail ? `${p.data!.reason}: ${p.data!.detail}` : p.data!.reason },
  });
  redirect(`/admin/acessos?pessoa=${person!.id}`);
}
