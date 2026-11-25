"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { bestArticle } from "@/lib/orbi";
import { hit } from "@/_lib/server/rate-limit";
import { notify, snippet } from "@/_lib/server/notify";

export type OrbiAnswer =
  | { found: true; questionId: string; title: string; summary: string; slug: string; actionLabel: string | null; actionPath: string | null }
  | { found: false; questionId: string | null };

/**
 * Pergunta ao Orbi. A pergunta é guardada SEM dizer quem perguntou
 * (some depois de 90 dias) para o admin saber o que falta na ajuda.
 */
export async function askOrbi(question: string): Promise<OrbiAnswer> {
  const user = await requireReadyUser();
  const q = z.string().trim().min(2).max(300).safeParse(question);
  if (!q.success || !(await hit("orbi", user.id))) return { found: false, questionId: null };
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { botEnabled: true } });
  if (cfg && !cfg.botEnabled) return { found: false, questionId: null };
  const articles = await db.helpArticle.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, title: true, summary: true, keywords: true, actionLabel: true, actionPath: true },
  });
  const best = bestArticle(q.data, articles);
  const row = await db.botQuestion.create({ data: { question: q.data, articleId: best?.article.id ?? null }, select: { id: true } });
  if (!best) return { found: false, questionId: row.id };
  const a = best.article;
  return { found: true, questionId: row.id, title: a.title, summary: a.summary, slug: a.slug, actionLabel: a.actionLabel, actionPath: a.actionPath?.startsWith("/") ? a.actionPath : null };
}

export async function orbiFeedback(questionId: string, helpful: boolean) {
  const user = await requireReadyUser();
  if (!z.uuid().safeParse(questionId).success || !(await hit("orbi", user.id))) return;
  // Só pergunta recente e ainda sem resposta (evita mexer em perguntas antigas).
  await db.botQuestion.updateMany({ where: { id: questionId, helpful: null, createdAt: { gte: new Date(Date.now() - 3600_000) } }, data: { helpful } });
}

/** "Mandar para o admin": aqui a pessoa escolhe se identificar, para receber resposta. */
export async function sendQuestionToAdmin(questionId: string | null, text: string) {
  const user = await requireReadyUser();
  const q = z.string().trim().min(2).max(300).safeParse(text);
  if (!q.success || !(await hit("orbi", user.id))) return { ok: false };
  if (questionId && z.uuid().safeParse(questionId).success) {
    await db.botQuestion.updateMany({ where: { id: questionId, createdAt: { gte: new Date(Date.now() - 3600_000) } }, data: { sentToAdmin: true } });
  } else {
    await db.botQuestion.create({ data: { question: q.data, sentToAdmin: true } });
  }
  const admins = await db.user.findMany({ where: { role: "admin", banned: false }, select: { id: true } });
  await notify(admins.map((a) => a.id).filter((id) => id !== user.id), {
    type: "help_question",
    title: `${user.name} mandou uma dúvida`,
    body: `${snippet(q.data, 120)} · ${user.email}`,
    href: "/admin/ajuda",
  });
  return { ok: true };
}

export async function voteArticle(form: FormData) {
  const user = await requireReadyUser();
  const p = z.object({ slug: z.string().max(120), helpful: z.enum(["sim", "nao"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  if (await hit("orbi", `${user.id}:${p.data.slug}`)) {
    await db.helpArticle.updateMany({
      where: { slug: p.data.slug, status: "PUBLISHED" },
      data: p.data.helpful === "sim" ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } },
    });
  }
  redirect(`/app/ajuda/${encodeURIComponent(p.data.slug)}?votou=1`);
}
