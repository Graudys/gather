import type { Metadata } from "next";
import Link from "next/link";
import { listTeams } from "@/_data/projects";
import { listWorkspacePeople, getWorkspaceShell } from "@/_data/chat";
import { createTeam } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { Modal } from "@/_components/ui/Modal";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import s from "@/_styles/app/Page.module.css";
import m from "@/_styles/ui/Modal.module.css";

export const metadata: Metadata = { title: "Equipes" };

// Equipes (mockup "Equipes"; criar abre a janela "Ov_NovaEquipe").
export default async function Equipes({ params, searchParams }: PageProps<"/app/w/[id]/equipes">) {
  const { id } = await params;
  const sp = (await searchParams) as { nova?: string; erro?: string };
  const [teams, people, shell] = await Promise.all([listTeams(id), listWorkspacePeople(id), getWorkspaceShell(id)]);
  const visible = teams.filter((t) => t.name !== "Geral");
  const base = `/app/w/${id}/equipes`;
  const canCreate = shell.workspace.kind === "TEAM";
  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1>Equipes</h1>
        <span className={s.grow} />
        {canCreate && <Link href={`${base}?nova=1`} scroll={false} className={s.btn}><Icon name="plus" size={15} /> Criar equipe</Link>}
      </div>
      <p className={s.sub}>Grupos de pessoas dentro do workspace. Projetos de uma equipe privada só aparecem para quem é dela.</p>

      {visible.length === 0 ? (
        <div className={s.empty}>
          <Icon name="users" size={26} />
          <b>Nenhuma equipe ainda</b>
          <span>Equipes são opcionais: sem elas, todo projeto fica visível para o workspace inteiro.</span>
          {canCreate && <Link href={`${base}?nova=1`} scroll={false} className={s.btn2} style={{ marginTop: 8 }}>Criar a primeira equipe</Link>}
        </div>
      ) : (
        <div className={s.g2}>
          {visible.map((t, i) => (
            <Link key={t.id} href={`${base}/${t.id}`} className={`${s.card} ${s.teamCard}`} style={{ animationDelay: `${i * 30}ms` }}>
              <div className={s.teamTop}>
                <b>{t.name}</b>
                <span className={`${s.chip} ${t.visibility === "PRIVATE" ? s.amb : s.blu}`}>
                  {t.visibility === "PRIVATE" ? <><Icon name="lock" size={11} /> Privada</> : "Workspace"}
                </span>
              </div>
              {t.description && <p className={`${s.mut} ${s.sm}`} style={{ margin: "0 0 8px" }}>{t.description}</p>}
              <div className={s.mut} style={{ fontSize: 14, marginBottom: 14 }}>
                {t.members.length} {t.members.length === 1 ? "membro" : "membros"} · {t.projects} {t.projects === 1 ? "projeto" : "projetos"}
              </div>
              <div className={s.stk}>
                {t.members.slice(0, 5).map((p) => <Avatar key={p.id} id={p.id} name={p.name} />)}
                {t.members.length > 5 && <span className={s.more}>+{t.members.length - 5}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {sp.nova && canCreate && (
        <Modal title="Criar equipe" sub="Equipes agrupam pessoas, canais e projetos dentro do workspace." closeHref={base}>
          <form action={createTeam}>
            <input type="hidden" name="workspaceId" value={id} />
            <div className={m.fg}>
              {sp.erro && <Alert>Dê um nome de até 60 caracteres.</Alert>}
              <label className={m.f}>Nome<input className={m.in} name="name" required maxLength={60} autoComplete="off" autoFocus placeholder="Ex.: Marketing" /></label>
              <label className={m.f}>Descrição (opcional)<input className={m.in} name="description" maxLength={200} placeholder="Campanhas, site e conteúdo" /></label>
              <div>
                <div className={m.lbl}>Quem pode ver</div>
                <div className={m.opts}>
                  <label className={m.opt}><input type="radio" name="visibility" value="WORKSPACE" defaultChecked /><span className={m.rd} /><span><Icon name="users" size={14} /> Todo o workspace<small>Qualquer membro vê os projetos.</small></span></label>
                  <label className={m.opt}><input type="radio" name="visibility" value="PRIVATE" /><span className={m.rd} /><span><Icon name="lock" size={14} /> Privada<small>Só quem for adicionado.</small></span></label>
                </div>
              </div>
              <div>
                <div className={m.lbl}>Membros (você entra como admin da equipe)</div>
                <div className={m.people}>
                  {people.filter((x) => !x.isMe).map((x) => (
                    <label key={x.id} className={m.person}>
                      <input type="checkbox" name="memberIds" value={x.id} />
                      <Avatar id={x.id} name={x.name} small />
                      {x.name}
                    </label>
                  ))}
                  {people.length <= 1 && <span className={s.mut}>Ninguém mais no workspace ainda.</span>}
                </div>
              </div>
              <label className={m.check}><input type="checkbox" name="channel" defaultChecked /> Criar um canal da equipe junto</label>
            </div>
            <div className={m.df}>
              <Link href={base} scroll={false} className={m.btn2}>Cancelar</Link>
              <Button>Criar equipe</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
