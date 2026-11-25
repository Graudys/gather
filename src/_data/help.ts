import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireAdmin, requireReadyUser } from "@/_lib/auth/dal";

/** Central de ajuda (dentro do app): só artigos publicados. */
export async function listHelp() {
  await requireReadyUser("/app/ajuda");
  const cats = await db.helpCategory.findMany({
    orderBy: { position: "asc" },
    select: { id: true, slug: true, name: true, icon: true, articles: { where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { slug: true, title: true } } },
  });
  return cats.filter((c) => c.articles.length);
}

export async function searchHelp(q: string) {
  await requireReadyUser();
  const t = q.trim().slice(0, 100);
  if (t.length < 2) return [];
  const has = { contains: t, mode: "insensitive" as const };
  return db.helpArticle.findMany({
    where: { status: "PUBLISHED", OR: [{ title: has }, { summary: has }, { body: has }, { keywords: { has: t.toLowerCase() } }] },
    take: 20,
    select: { slug: true, title: true, summary: true },
  });
}

export async function getArticle(slug: string) {
  await requireReadyUser();
  const a = await db.helpArticle.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, slug: true, title: true, body: true, actionLabel: true, actionPath: true, updatedAt: true, categoryId: true, category: { select: { name: true, slug: true } } },
  });
  if (!a) notFound();
  const [related] = await Promise.all([
    db.helpArticle.findMany({ where: { status: "PUBLISHED", categoryId: a.categoryId, NOT: { id: a.id } }, orderBy: { views: "desc" }, take: 4, select: { slug: true, title: true } }),
    db.helpArticle.update({ where: { id: a.id }, data: { views: { increment: 1 } } }),
  ]);
  return { ...a, related };
}

// ── Admin › Ajuda

export async function getHelpAdmin() {
  await requireAdmin();
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [articles, categories, questions, asked, answered] = await Promise.all([
    db.helpArticle.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, slug: true, status: true, views: true, helpfulYes: true, helpfulNo: true, updatedAt: true, category: { select: { name: true } } },
    }),
    db.helpCategory.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, _count: { select: { articles: true } } } }),
    db.botQuestion.findMany({
      where: { createdAt: { gte: since }, OR: [{ articleId: null }, { helpful: false }, { sentToAdmin: true }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, question: true, helpful: true, sentToAdmin: true, createdAt: true, article: { select: { title: true } } },
    }),
    db.botQuestion.count({ where: { createdAt: { gte: since } } }),
    db.botQuestion.count({ where: { createdAt: { gte: since }, articleId: { not: null } } }),
  ]);
  return { articles, categories, questions, stats: { asked, answered, published: articles.filter((a) => a.status === "PUBLISHED").length } };
}

export async function getArticleForEdit(id: string | null) {
  await requireAdmin();
  const categories = await db.helpCategory.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } });
  if (!id) return { article: null, categories };
  const article = await db.helpArticle.findUnique({ where: { id } });
  if (!article) notFound();
  return { article, categories };
}
