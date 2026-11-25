import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { ArticleBody } from "@/_components/admin/ArticleEditor";
import { getArticleForEdit } from "@/_data/help";
import { deleteArticle, saveArticle } from "@/_data/admin-help.actions";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import { db } from "@/_lib/db/prisma";
import { z } from "zod";
import s from "@/_styles/admin/HelpAdmin.module.css";

export const metadata: Metadata = { title: "Artigo" };

const ERROS: Record<string, string> = {
  slug: "Já existe um artigo com esse endereço (slug).",
  title: "O título precisa de 3 a 140 caracteres.",
  summary: "O resumo precisa de 10 a 400 caracteres: é o que o Orbi responde.",
  categoryId: "Escolha um assunto.",
  actionPath: "O atalho precisa ser um caminho do app, começando com /.",
};

export default async function EditarArtigo({ params, searchParams }: PageProps<"/admin/ajuda/[id]">) {
  const { id } = await params;
  const isNew = id === "novo";
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  const { erro, ok, pergunta } = (await searchParams) as { erro?: string; ok?: string; pergunta?: string };
  const { article: a, categories } = await getArticleForEdit(isNew ? null : id);
  const question = isNew && pergunta && z.uuid().safeParse(pergunta).success ? await db.botQuestion.findUnique({ where: { id: pergunta }, select: { id: true, question: true } }) : null;

  return (
    <>
      <Link href="/admin/ajuda" className={s.note}>← Central de ajuda</Link>
      <AdminTitle title={isNew ? "Novo artigo" : "Editar artigo"} sub={question ? `Respondendo: “${question.question}”` : undefined} />
      {erro && <Alert>{ERROS[erro] ?? "Confira os campos."}</Alert>}
      {ok && <Alert tone="ok">Artigo salvo.</Alert>}
      {categories.length === 0 && <Alert>Crie um assunto primeiro (ou carregue os artigos iniciais) em Central de ajuda.</Alert>}
      <form action={saveArticle} className={s.grid}>
        <input type="hidden" name="id" value={a?.id ?? ""} />
        <input type="hidden" name="questionId" value={question?.id ?? ""} />
        <div className={s.form}>
          <label className={s.label}>Título<input name="title" defaultValue={a?.title ?? question?.question ?? ""} className={s.input} required maxLength={140} /></label>
          <div className={s.row}>
            <label className={`${s.label} ${s.grow}`}>
              Assunto
              <select name="categoryId" defaultValue={a?.categoryId ?? categories[0]?.id} className={s.select} required>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={`${s.label} ${s.grow}`}>Endereço (slug)<input name="slug" defaultValue={a?.slug ?? ""} className={s.input} maxLength={80} placeholder="gerado do título" /></label>
          </div>
          <label className={s.label}>
            Resumo (é o que o Orbi responde)
            <textarea name="summary" defaultValue={a?.summary ?? ""} className={s.area} required minLength={10} maxLength={400} />
          </label>
          <div className={s.label}>Artigo completo<ArticleBody initial={a?.body ?? ""} /></div>
        </div>
        <div className={s.form}>
          <section className={s.card}>
            <b className={s.cardTitle}>Publicação</b>
            <label className={s.label}>
              Situação
              <select name="status" defaultValue={a?.status ?? "PUBLISHED"} className={s.select}>
                <option value="PUBLISHED">Publicado</option>
                <option value="DRAFT">Rascunho</option>
              </select>
            </label>
            <Button>Salvar</Button>
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Perguntas que este artigo responde</b>
            <textarea name="keywords" defaultValue={a?.keywords.join(", ") ?? question?.question ?? ""} className={s.area} maxLength={600} placeholder="trocar senha, mudar senha, esqueci" />
            <p className={s.note}>Separe por vírgula. O Orbi dá mais peso a estas frases.</p>
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Botão de atalho (opcional)</b>
            <input name="actionLabel" defaultValue={a?.actionLabel ?? ""} className={s.input} placeholder="Abrir perfil" maxLength={40} />
            <input name="actionPath" defaultValue={a?.actionPath ?? ""} className={s.input} placeholder="/app/perfil" maxLength={200} />
          </section>
          {a && (
            <section className={s.card}>
              <b className={s.cardTitle}>Como o Orbi responde</b>
              <div className={s.orbiPreview}><b>{a.title}</b><span>{a.summary}</span></div>
              <p className={s.note}>{a.views} vistas · ajudou {a.helpfulYes} · não ajudou {a.helpfulNo}</p>
            </section>
          )}
        </div>
      </form>
      {a && (
        <form action={deleteArticle}>
          <input type="hidden" name="id" value={a.id} />
          <Button variant="link">Apagar artigo</Button>
        </form>
      )}
    </>
  );
}
