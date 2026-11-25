import Link from "next/link";
import type { Metadata } from "next";
import { getNewProjectOptions, listProjects, listTeams } from "@/_data/projects";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { Modal } from "@/_components/ui/Modal";
import { NewProjectForm } from "@/_components/projects/NewProjectForm";
import { AutoSubmit } from "@/_components/ui/AutoSubmit";
import { PROJECT_STATUS, shortDay } from "@/lib/projects";
import type { ProjectCard } from "@/types/domain";
import s from "@/_styles/app/Page.module.css";

export const metadata: Metadata = { title: "Projetos" };

const FILTERS = [["", "Todos"], ["ACTIVE", "Ativos"], ["PAUSED", "Pausados"], ["COMPLETED", "Concluídos"], ["ARCHIVED", "Arquivados"]] as const;
const STATUS_COLOR = { ACTIVE: s.grn, PAUSED: s.amb, COMPLETED: s.blu, ARCHIVED: "" } as const;

function Card({ p, href, i }: { p: ProjectCard; href: string; i: number }) {
  const total = p.openTasks + p.doneTasks;
  const pct = total ? Math.round((p.doneTasks / total) * 100) : 0;
  return (
    <Link href={href} className={`${s.card} ${s.projCard}`} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
      <div className={s.teamTop}>
        <b style={{ fontSize: 16 }}>{p.name}</b>
        <span className={`${s.chip} ${STATUS_COLOR[p.status]}`}>{PROJECT_STATUS[p.status]}</span>
      </div>
      <p className={s.projDesc}>{p.description ?? "Sem descrição."}</p>
      <span className={s.bar} aria-label={`${pct}% concluído`}><span style={{ width: `${pct}%` }} /></span>
      <div className={s.projFoot}>
        <span className={s.stk}>{p.members.slice(0, 3).map((m) => <Avatar key={m.id} id={m.id} name={m.name} />)}</span>
        <span className={s.grow} />
        <span className={`${s.mut} ${s.sm}`}>{p.doneTasks}/{total} · Prazo {p.dueDate ? shortDay(p.dueDate) : "—"}</span>
        <span className={s.btn}>Abrir</span>
      </div>
    </Link>
  );
}

// Projetos (mockup "Projetos"): busca, equipe, status; "Novo projeto" abre a janela.
export default async function Projetos({ params, searchParams }: PageProps<"/app/w/[id]/projetos">) {
  const { id } = await params;
  const sp = (await searchParams) as { status?: string; q?: string; equipe?: string; novo?: string; erro?: string };
  const [projects, teams, opts] = await Promise.all([
    listProjects(id, { status: sp.status, q: sp.q, teamId: sp.equipe || undefined }),
    listTeams(id),
    sp.novo ? getNewProjectOptions(id) : Promise.resolve(null),
  ]);
  const base = `/app/w/${id}/projetos`;
  const realTeams = teams.filter((t) => t.name !== "Geral");
  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, equipe: sp.equipe, status: sp.status, ...extra })) if (v) u.set(k, v);
    const str = u.toString();
    return str ? `${base}?${str}` : base;
  };
  const filtered = Boolean(sp.q || sp.equipe || sp.status);
  // Sem filtro: "Recentes" + um grupo por equipe (como no mockup).
  const groups: [string, ProjectCard[]][] = filtered
    ? [["", projects]]
    : [
        ["Recentes", [...projects].slice(0, 3)],
        ...realTeams.map((t) => [t.name, projects.filter((p) => p.team.id === t.id)] as [string, ProjectCard[]]),
        ["Sem equipe", projects.filter((p) => p.team.name === "Geral")],
      ].filter(([, list]) => list.length > 0) as [string, ProjectCard[]][];
  if (!filtered && projects.length <= 3) groups.splice(1); // poucos projetos: só uma lista

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1>Projetos</h1>
        <span className={s.grow} />
        <Link href={qs({ novo: "1" })} scroll={false} className={s.btn}><Icon name="plus" size={15} /> Novo projeto</Link>
      </div>
      <p className={s.sub}>Escolha um projeto para abrir o quadro, ou crie um novo.</p>

      <form className={s.tools} action={base} role="search">
        <label className={`${s.in} ${s.searchBox}`}>
          <Icon name="search" />
          <input name="q" defaultValue={sp.q} placeholder="Buscar projeto" aria-label="Buscar projeto" maxLength={80} />
        </label>
        {realTeams.length > 0 && (
          <select name="equipe" defaultValue={sp.equipe ?? ""} className={s.in} style={{ width: 190 }} aria-label="Equipe">
            <option value="">Todas as equipes</option>
            {realTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <AutoSubmit />
        <div className={s.seg} role="group" aria-label="Status">
          {FILTERS.map(([v, label]) => (
            <Link key={v} href={qs({ status: v || undefined })} className={(sp.status ?? "") === v ? s.on : ""} aria-current={(sp.status ?? "") === v ? "page" : undefined}>{label}</Link>
          ))}
        </div>
      </form>

      {projects.length === 0 ? (
        <div className={s.empty}>
          <Icon name="folder" size={26} />
          <b>{filtered ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}</b>
          <span>{filtered ? "Tente outra busca ou filtro." : "Um projeto tem um quadro de tarefas, prazos e, se quiser, um canal só dele."}</span>
          {!filtered && <Link href={qs({ novo: "1" })} scroll={false} className={s.btn} style={{ marginTop: 8 }}>Criar projeto</Link>}
        </div>
      ) : (
        groups.map(([title, list]) => (
          <section key={title || "all"} style={{ marginBottom: 26 }}>
            {title && <h3 className={s.sec}>{title}</h3>}
            <div className={s.g3}>
              {list.map((p, i) => <Card key={p.id} p={p} i={i} href={`/app/w/${id}/p/${p.id}`} />)}
            </div>
          </section>
        ))
      )}

      {opts && (
        <Modal title="Novo projeto" closeHref={qs({})} width={600}>
          <NewProjectForm workspaceId={id} o={opts} erro={sp.erro} teamId={sp.equipe} closeHref={qs({})} />
        </Modal>
      )}
    </div>
  );
}
