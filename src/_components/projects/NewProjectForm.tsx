import Link from "next/link";
import { createProject } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import m from "@/_styles/ui/Modal.module.css";

const ERROS: Record<string, string> = { dados: "Confira os campos.", datas: "O prazo precisa ser depois do início.", equipe: "Escolha uma equipe válida." };
const COLS = ["A fazer", "Em andamento", "Em revisão", "Concluído"];

type Opts = { personal: boolean; me: string; teams: { id: string; name: string }[]; people: { id: string; name: string }[] };

/** Formulário da janela "Novo projeto" (mockup "NovoProjeto"). */
export function NewProjectForm({ workspaceId, o, erro, teamId, closeHref }: { workspaceId: string; o: Opts; erro?: string; teamId?: string; closeHref: string }) {
  const teams = o.teams.filter((t) => t.name !== "Geral");
  return (
    <form action={createProject}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className={m.fg}>
        {erro && <Alert>{ERROS[erro] ?? ERROS.dados}</Alert>}
        <label className={m.f}>Nome do projeto<input className={m.in} name="name" required maxLength={80} autoFocus autoComplete="off" placeholder="Ex.: Lançamento v2" /></label>
        {!o.personal && teams.length > 0 && (
          <label className={m.f}>
            Equipe
            <select name="teamId" className={m.in} defaultValue={teamId ?? ""}>
              <option value="">Sem equipe (todo o workspace)</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <label className={m.f}>Descrição<textarea name="description" maxLength={500} rows={2} className={m.in} placeholder="Do que se trata" /></label>
        <div className={m.two}>
          <label className={m.f}>Início<input className={m.in} name="startDate" type="date" /></label>
          <label className={m.f}>Prazo<input className={m.in} name="dueDate" type="date" /></label>
        </div>
        {!o.personal && o.people.length > 1 && (
          <div>
            <div className={m.lbl}>Membros (você entra como admin)</div>
            <div className={m.people}>
              {o.people.filter((x) => x.id !== o.me).map((x) => (
                <label key={x.id} className={m.person}>
                  <input type="checkbox" name="memberIds" value={x.id} />
                  <Avatar id={x.id} name={x.name} small />
                  {x.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className={m.lbl}>Colunas do quadro (a última conta como concluída)</div>
          <div className={m.two}>
            {[...COLS, "", ""].map((c, i) => <input key={i} name="columns" defaultValue={c} maxLength={40} className={m.in} placeholder={i >= COLS.length ? "+ Coluna" : undefined} aria-label={`Coluna ${i + 1}`} />)}
          </div>
        </div>
        {!o.personal && <label className={m.check}><input type="checkbox" name="channel" defaultChecked /> Criar um canal dedicado para este projeto</label>}
      </div>
      <div className={m.df}>
        <Link href={closeHref} scroll={false} className={m.btn2}>Cancelar</Link>
        <Button>Criar projeto</Button>
      </div>
    </form>
  );
}
