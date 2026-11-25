import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoard } from "@/_data/projects";
import { addColumn, deleteColumn, deleteProject, renameColumn, updateProject } from "@/_data/projects.actions";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { PROJECT_STATUS, inputDay } from "@/lib/projects";
import { id as Id } from "@/lib/validation";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Ajustes do projeto" };

export default async function AjustesProjeto({ params }: PageProps<"/app/w/[id]/p/[projectId]/ajustes">) {
  const { id, projectId } = await params;
  if (!Id.safeParse(projectId).success) notFound();
  const board = await getBoard(id, projectId);
  const back = `/app/w/${id}/p/${projectId}`;
  if (!board.canManage) redirect(back);
  const pr = board.project;
  const hidden = (
    <>
      <input type="hidden" name="workspaceId" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
    </>
  );
  const counts = new Map(board.statuses.map((st) => [st.id, board.tasks.filter((t) => t.statusId === st.id).length]));

  return (
    <div className={p.page}>
      <div className={p.narrow}>
        <Link href={back} className={p.note}><Icon name="back" size={14} /> Voltar para o quadro</Link>
        <h1 className={p.title}>Ajustes de {pr.name}</h1>
      </div>

      <form action={updateProject} className={`${p.card} ${p.narrow}`}>
        {hidden}
        <b className={p.cardTitle}>Projeto</b>
        <Field label="Nome" name="name" defaultValue={pr.name} required maxLength={80} />
        <label className={p.label}>
          Descrição
          <textarea name="description" defaultValue={pr.description ?? ""} maxLength={500} className={p.textarea} />
        </label>
        <label className={p.label}>
          Situação
          <select name="status" defaultValue={pr.status} className={p.select}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className={p.row}>
          <div className={p.grow}><Field label="Início" name="startDate" type="date" defaultValue={inputDay(pr.startDate)} /></div>
          <div className={p.grow}><Field label="Prazo" name="dueDate" type="date" defaultValue={inputDay(pr.dueDate)} /></div>
        </div>
        <div className={p.actions}><Button>Salvar</Button></div>
      </form>

      <section className={`${p.card} ${p.narrow}`}>
        <b className={p.cardTitle}>Colunas do quadro</b>
        <p className={p.note}>A última coluna conta como concluída. Só dá para apagar coluna vazia.</p>
        {board.statuses.map((st) => (
          <div key={st.id} className={p.row}>
            <form action={renameColumn} className={`${p.row} ${p.grow}`}>
              {hidden}
              <input type="hidden" name="statusId" value={st.id} />
              <input name="name" defaultValue={st.name} maxLength={40} required className={`${p.select} ${p.grow}`} aria-label="Nome da coluna" />
              <Button variant="ghost">Renomear</Button>
            </form>
            <span className={p.note}>{counts.get(st.id)} {counts.get(st.id) === 1 ? "tarefa" : "tarefas"}{st.isCompleted ? " · concluída" : ""}</span>
            {!st.isCompleted && counts.get(st.id) === 0 && board.statuses.length > 2 && (
              <form action={deleteColumn}>
                {hidden}
                <input type="hidden" name="statusId" value={st.id} />
                <button className={`${p.linkBtn} ${p.linkDanger}`}>Apagar</button>
              </form>
            )}
          </div>
        ))}
        <form action={addColumn} className={p.row}>
          {hidden}
          <input name="name" placeholder="Nova coluna" maxLength={40} required className={`${p.select} ${p.grow}`} />
          <Button variant="ghost">+ Coluna</Button>
        </form>
      </section>

      <form action={deleteProject} className={`${p.card} ${p.narrow} ${p.danger}`}>
        {hidden}
        <b className={`${p.cardTitle} ${p.dangerTitle}`}>Apagar projeto</b>
        <p className={p.note}>Apaga o projeto, as tarefas, os comentários e o canal do projeto. Não dá para desfazer. Se só quer tirar da frente, mude a situação para Arquivado.</p>
        <Field label={`Digite "${pr.name}" para confirmar`} name="confirm" required autoComplete="off" />
        <div className={p.actions}><Button variant="ghost">Apagar projeto</Button></div>
      </form>
    </div>
  );
}
