"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import { STARTER_ARTICLES, STARTER_CATEGORIES } from "@/_lib/help/starter";

const slugify = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const Article = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  title: z.string().trim().min(3).max(140),
  slug: z.string().trim().max(80).optional(),
  categoryId: z.uuid(),
  summary: z.string().trim().min(10).max(400),
  body: z.string().max(20_000),
  keywords: z.string().max(600).optional(),
  actionLabel: z.string().trim().max(40).optional(),
  actionPath: z.union([z.string().trim().regex(/^\/[^/\\][^\s]*$|^\/$/), z.literal("")]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  questionId: z.union([z.uuid(), z.literal("")]).optional(),
});

export async function saveArticle(form: FormData) {
  const admin = await requireAdmin();
  const p = Article.safeParse(Object.fromEntries(form));
  const back = `/admin/ajuda/${String(form.get("id") || "novo")}`;
  if (!p.success) redirect(`${back}?erro=${encodeURIComponent(p.error.issues[0]?.path.join(".") ?? "dados")}`);
  const d = p.data!;
  const slug = slugify(d.slug || d.title) || "artigo";
  const clash = await db.helpArticle.findFirst({ where: { slug, ...(d.id ? { id: { not: d.id } } : {}) }, select: { id: true } });
  if (clash) redirect(`${back}?erro=slug`);
  const keywords = [...new Set((d.keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
  const data = {
    title: d.title, slug, categoryId: d.categoryId, summary: d.summary, body: d.body, keywords,
    actionLabel: d.actionLabel || null, actionPath: d.actionPath || null, status: d.status, updatedById: admin.id,
  };
  const saved = d.id ? await db.helpArticle.update({ where: { id: d.id }, data, select: { id: true } }) : await db.helpArticle.create({ data, select: { id: true } });
  // Pergunta que virou artigo: liga a ela (sai da lista de "sem resposta").
  if (d.questionId) await db.botQuestion.updateMany({ where: { id: d.questionId }, data: { articleId: saved.id, sentToAdmin: false, helpful: null } });
  await db.adminAction.create({ data: { adminId: admin.id, action: d.id ? "help_article_updated" : "help_article_created", reason: d.title } });
  revalidatePath("/admin/ajuda");
  revalidatePath("/app/ajuda", "layout");
  redirect(`/admin/ajuda/${saved.id}?ok=1`);
}

export async function deleteArticle(form: FormData) {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const a = await db.helpArticle.delete({ where: { id: id.data }, select: { title: true } });
  await db.adminAction.create({ data: { adminId: admin.id, action: "help_article_deleted", reason: a.title } });
  revalidatePath("/admin/ajuda");
  redirect("/admin/ajuda");
}

export async function dismissQuestion(form: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await db.botQuestion.delete({ where: { id: id.data } }).catch(() => undefined);
  revalidatePath("/admin/ajuda");
}

export async function addCategory(form: FormData) {
  await requireAdmin();
  const name = z.string().trim().min(2).max(60).safeParse(form.get("name"));
  if (!name.success) return;
  const max = await db.helpCategory.aggregate({ _max: { position: true } });
  await db.helpCategory.create({ data: { name: name.data, slug: `${slugify(name.data)}-${Date.now().toString(36).slice(-4)}`, icon: "doc", position: (max._max.position ?? -1) + 1 } });
  revalidatePath("/admin/ajuda");
}

/** Carrega os artigos iniciais (só os que ainda não existem pelo slug). */
export async function importStarter() {
  const admin = await requireAdmin();
  const ids = new Map<string, string>();
  for (const c of STARTER_CATEGORIES) {
    const row = await db.helpCategory.upsert({ where: { slug: c.slug }, create: { ...c }, update: {}, select: { id: true } });
    ids.set(c.slug, row.id);
  }
  for (const a of STARTER_ARTICLES) {
    const { category, ...rest } = a;
    await db.helpArticle.upsert({
      where: { slug: a.slug },
      create: { ...rest, categoryId: ids.get(category)!, status: "PUBLISHED", updatedById: admin.id },
      update: {},
    });
  }
  revalidatePath("/admin/ajuda");
  revalidatePath("/app/ajuda", "layout");
}
