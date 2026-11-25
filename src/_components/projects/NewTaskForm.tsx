import Link from "next/link";
import { createTaskFromModal } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import { PRIORITY } from "@/lib/projects";
import type { LabelView, Person } from "@/types/domain";
import m from "@/_styles/ui/Modal.module.css";

type Props = {
  workspaceId: string;
  closeHref: string;
  /** Projeto já escolhido (no quadro) ou lista para escolher (Minhas tarefas). */
  project?: { id: string; statuses: { id: string; name: string }[]; people: Person[]; labels: LabelView[] };
  projects?: { id: string; name: string }[];
  me: string;
  erro?: boolean;
  ok?: boolean;
  statusId?: string;
};

/** Janela "Nova tarefa" (mockup "Ov_NovaTarefa"). */
export function NewTaskForm({ workspaceId, closeHref, project, projects, me, erro, ok, statusId }: Props) {
  return (
    <form action={createTaskFromModal}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="back" value={closeHref} />
      <div className={m.fg}>
        {erro && <Alert>Dê um título e escolha o projeto.</Alert>}
        {ok && <Alert tone="ok">Tarefa criada. Pode criar a próxima.</Alert>}
        <input className={`${m.in} ${m.big}`} name="title" required maxLength={200} placeholder="Título da tarefa" aria-label="Título" autoFocus autoComplete="off" />
        <div className={m.two}>
          {project ? (
            <>
              <input type="hidden" name="projectId" value={project.id} />
              <label className={m.f}>
                Status
                <select name="statusId" className={m.in} defaultValue={project.statuses.some((x) => x.id === statusId) ? statusId : project.statuses[0]?.id}>
                  {project.statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label className={m.f}>
              Projeto
              <select name="projectId" className={m.in} required defaultValue={projects?.[0]?.id}>
                {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label className={m.f}>
            Prioridade
            <select name="priority" className={m.in} defaultValue="MEDIUM">
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className={m.two}>
          <label className={m.f}>Prazo<input className={m.in} name="dueAt" type="date" /></label>
          {!project && (
            <label className={m.f}>
              Responsável
              <select name="assigneeIds" className={m.in} defaultValue={me}>
                <option value={me}>Eu</option>
                <option value="">Ninguém por enquanto</option>
              </select>
            </label>
          )}
        </div>
        {project && project.people.length > 0 && (
          <div>
            <div className={m.lbl}>Responsáveis</div>
            <div className={m.people}>
              {project.people.map((p) => (
                <label key={p.id} className={m.person}>
                  <input type="checkbox" name="assigneeIds" value={p.id} defaultChecked={p.id === me} />
                  <Avatar id={p.id} name={p.name} small />
                  {p.id === me ? "Eu" : p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        {project && project.labels.length > 0 && (
          <div>
            <div className={m.lbl}>Etiquetas</div>
            <div className={m.people}>
              {project.labels.map((l) => (
                <label key={l.id} className={m.person} style={{ paddingLeft: 10 }}>
                  <input type="checkbox" name="labelIds" value={l.id} />
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: l.color }} />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className={m.f}>Descrição<textarea name="description" className={m.in} rows={3} maxLength={5000} placeholder="Adicione detalhes" /></label>
      </div>
      <div className={m.df}>
        <label className={m.check}><input type="checkbox" name="outra" defaultChecked={ok} /> Criar outra</label>
        <span style={{ flex: 1 }} />
        <Link href={closeHref} scroll={false} className={m.btn2}>Cancelar</Link>
        <Button>Criar tarefa</Button>
      </div>
    </form>
  );
}
