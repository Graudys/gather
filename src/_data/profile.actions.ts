"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/_lib/auth/auth";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { hit } from "@/_lib/server/rate-limit";
import { nomePessoa } from "@/lib/validation";
import { TIMEZONES } from "@/lib/profile";

const Perfil = z.object({
  name: nomePessoa,
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/).or(z.literal("")),
  bio: z.string().trim().max(280),
  timezone: z.enum(TIMEZONES.map((t) => t[0]) as [string, ...string[]]),
});

/** Perfil › Salvar: nome, usuário, bio, fuso e avisos. */
export async function updateProfile(form: FormData) {
  const user = await requireReadyUser();
  if (!(await hit("profile", `user:${user.id}`))) redirect("/app/perfil?perr=muitas");
  const parsed = Perfil.safeParse({
    name: form.get("name"),
    username: form.get("username") ?? "",
    bio: form.get("bio") ?? "",
    timezone: form.get("timezone"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    redirect(`/app/perfil?perr=${field === "username" ? "usuario" : field === "name" ? "nome" : "geral"}`);
  }
  const d = parsed.data!;
  if (d.username) {
    const taken = await db.user.findFirst({ where: { username: d.username, NOT: { id: user.id } }, select: { id: true } });
    if (taken) redirect("/app/perfil?perr=usuarioUsado");
  }
  const prefs = { mencoes: form.get("mencoes") === "on", canais: form.get("canais") === "on", tarefas: form.get("tarefas") === "on", reunioes: form.get("reunioes") === "on" };
  await db.user.update({
    where: { id: user.id },
    data: { name: d.name, username: d.username || null, bio: d.bio || null, timezone: d.timezone, notifyPrefs: prefs },
  });
  // O nome fica no cookie da sessão: renova para aparecer já.
  await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  revalidatePath("/app", "layout");
  redirect("/app/perfil?aviso=salvo");
}
