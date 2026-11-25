import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamView } from "@/_data/projects";
import { listWorkspacePeople } from "@/_data/chat";
import { addTeamMembers, removeTeamMember, setTeamAdmin } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { Modal } from "@/_components/ui/Modal";
import { Button } from "@/_components/ui/Button";
import { PageCrumb } from "@/_components/shell/ShellContext";
import { PROJECT_STATUS } from "@/lib/projects";
import { id as Id } from "@/lib/validation";
import s from "@/_styles/app/Page.module.css";
import m from "@/_styles/ui/Modal.module.css";

export const metadata: Metadata = { title: "Equipe" };
const STATUS_COLOR = { ACTIVE: s.grn, PAUSED: s.amb, COMPLETED: s.blu, ARCHIVED: "" } as const;

// Equipe (mockup "Equipe"): membros, projetos e canais.
export default async function EquipePage({ params, searchParams }: PageProps<"/app/w/[id]/equipes/[teamId]">) {
  const { id, teamId } = await params;
  if (!Id.safeParse(teamId).success) notFound();
  const { add } = (await searchParams) as { add?: string };
  const [t, people] = await Promise.all([getTeamView(id, teamId), listWorkspacePeople(id)]);
  if (!t) notFound();
  const base = `/app/w/${id}/equipes/${teamId}`;
  const outside = people.filter((p) => !t.members.some((x) => x.id === p.id));
  const ids = (userId: string) => (
    <>
      <input type="hidden" name="workspaceId" value={id} />
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="userId" value={userId} />
    </>
  );

  return (
    <div className={s.page}>
      <PageCrumb label={t.name} />
      <div className={s.head}>
        <h1>{t.name}</h1>
        <span className={`${s.chip} ${t.visibility === "PRIVATE" ? s.amb : s.blu}`}>{t.visibility === "PRIVATE" ? <><Icon name="lock" size={11} /> Privada</> : "Workspace"}</span>
        <span className={s.grow} />
        {t.canManage && outside.length > 0 && <Link href={`${base}?add=1`} scroll={false} className={s.btn}><Icon name="plus" size={15} /> Adicionar membro</Link>}
      </div>
      <p className={s.sub}>{t.description || "Sem descrição."}</p>

      <div className={s.split}>
        <section className={s.card}>
          <h3>Membros · {t.members.length}</h3>
          {t.members.map((p) => (
            <div key={p.id} className={s.row}>
              <Avatar id={p.id} name={p.name} />
              <span className={s.grow}><b>{p.name}</b></span>
              <span className={s.chip}>{p.admin ? "Admin da equipe" : "Membro"}</span>
              {t.canManage && (
                <span style={{ display: "flex", gap: 10 }}>
                  <form action={setTeamAdmin}>{ids(p.id)}<input type="hidden" name="admin" value={p.admin ? "0" : "1"} /><button className={s.link}>{p.admin ? "Tirar admin" : "Tornar admin"}</button></form>
                  <form action={removeTeamMember}>{ids(p.id)}<button className={`${s.link} ${s.linkDanger}`}>Remover</button></form>
                </span>
              )}
            </div>
          ))}
        </section>
        <div className={s.fg}>
          <section className={s.card}>
            <h3>Projetos</h3>
            {t.projects.length === 0 && <p className={`${s.mut} ${s.sm}`} style={{ margin: 0 }}>Nenhum projeto nesta equipe. <Link href={`/app/w/${id}/projetos?novo=1&equipe=${teamId}`}>Criar projeto</Link></p>}
            {t.projects.map((p) => (
              <div key={p.id} className={s.row}>
                <span className={s.grow}>{p.name}</span>
                <span className={`${s.chip} ${STATUS_COLOR[p.status]}`}>{PROJECT_STATUS[p.status]}</span>
                <Link href={`/app/w/${id}/p/${p.id}`} className={s.btn2}>Abrir</Link>
              </div>
            ))}
          </section>
          <section className={s.card}>
            <h3>Canais</h3>
            {t.channels.length === 0 && <p className={`${s.mut} ${s.sm}`} style={{ margin: 0 }}>Nenhum canal ligado a esta equipe.</p>}
            {t.channels.map((c) => (
              <Link key={c.id} href={`/app/w/${id}/c/${c.id}`} className={s.row}>
                <Icon name={c.visibility === "PRIVATE" ? "lock" : "hash"} size={14} />
                <span className={s.grow}>{c.name}</span>
                <span className={`${s.chip} ${c.kind === "PROJECT" ? "" : s.grn}`}>{c.kind === "PROJECT" ? "Projeto" : c.visibility === "PRIVATE" ? "Privado" : "Público"}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>

      {add && t.canManage && (
        <Modal title="Adicionar membro" sub={`Escolha quem entra na equipe ${t.name}.`} closeHref={base}>
          <form action={addTeamMembers}>
            <input type="hidden" name="workspaceId" value={id} />
            <input type="hidden" name="teamId" value={teamId} />
            <div className={m.people}>
              {outside.map((x) => (
                <label key={x.id} className={m.person}>
                  <input type="checkbox" name="memberIds" value={x.id} />
                  <Avatar id={x.id} name={x.name} small />
                  {x.name}
                </label>
              ))}
            </div>
            <div className={m.df}>
              <Link href={base} scroll={false} className={m.btn2}>Cancelar</Link>
              <Button>Adicionar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
