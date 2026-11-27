"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppShellData } from "@/_data/shell";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { colorFor } from "@/_components/chat/Avatar";
import { WsBadge } from "@/_components/shell/WsBadge";
import { useShell } from "@/_components/shell/ShellContext";
import s from "@/_styles/shell/Shell.module.css";

const LOGO = (
  <svg width="26" height="26" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sb-logo" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
        <stop offset="0" stopColor="#5b8cff" />
        <stop offset="1" stopColor="#b08cff" />
      </linearGradient>
    </defs>
    <path d="M79.5 44.8 A30 30 0 1 1 55.2 20.5" stroke="url(#sb-logo)" strokeWidth="11" strokeLinecap="round" />
    <circle cx="72.6" cy="27.4" r="8.5" fill="url(#sb-logo)" />
  </svg>
);

/** Barra lateral fixa (mockup "Sidebar"). Só ela e o conteúdo têm rolagem própria. */
export function Sidebar({ data, startCollapsed }: { data: AppShellData; startCollapsed: boolean }) {
  const path = usePathname();
  const { drawer, setDrawer, setNewWs } = useShell();
  const [treeOpen, setTreeOpen] = useState(true);
  // Grupos "Projetos" e "Equipes" da árvore: abertos ou recolhidos (lembra neste navegador).
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroups(JSON.parse(localStorage.getItem("gather:tree") ?? "{}"));
    } catch {
      /* sem armazenamento: tudo aberto */
    }
  }, []);
  const setGroup = (k: string, v: boolean) => {
    const next = { ...groups, [k]: v };
    setGroups(next);
    try { localStorage.setItem("gather:tree", JSON.stringify(next)); } catch { /* ok */ }
  };
  const openProjects = groups.projetos !== false;
  const openTeams = groups.equipes !== false;
  const wsInfo = (id: string) => data.workspaces.find((w) => w.id === id) ?? { id, name: ws?.name ?? "", icon: null, photoV: "" };
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const toggle = () => {
    // Lembra no cookie para o servidor já desenhar recolhida (sem piscar).
    document.cookie = `gather.sb=${collapsed ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
    setCollapsed(!collapsed);
  };

  const ws = data.current;
  const base = ws ? `/app/w/${ws.id}` : "/app";
  const team = ws?.kind === "TEAM";
  const canSettings = ws && (ws.role === "OWNER" || ws.role === "ADMIN");
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  const item = (href: string, icon: IconName, label: string, on: boolean, badge?: number) => (
    <Link href={href} className={`${s.nv} ${on ? s.on : ""}`} aria-current={on ? "page" : undefined} title={collapsed ? label : undefined}>
      <Icon name={icon} />
      <span className={s.label}>{label}</span>
      {badge ? <span className={s.bd}>{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );

  return (
    <>
      {drawer && <button className={s.scrim} aria-label="Fechar menu" onClick={() => setDrawer(false)} />}
      <nav
        className={`${s.sb} ${collapsed ? s.collapsed : ""} ${drawer ? s.open : ""}`}
        aria-label="Principal"
        onClick={(e) => {
          // No celular, fecha a gaveta ao escolher um destino.
          if ((e.target as HTMLElement).closest("a")) setDrawer(false);
        }}
      >
        <div className={s.brand}>
          {LOGO}
          <span className={s.label}>gather</span>
          <button className={`${s.ic} ${s.collapseBtn}`} onClick={toggle} aria-label={collapsed ? "Abrir barra lateral" : "Recolher barra lateral"} title={collapsed ? "Abrir barra lateral" : "Recolher barra lateral"}>
            <Icon name="panel" />
          </button>
        </div>

        {ws && (
          <details className={s.wswWrap}>
            <summary className={s.wsw} aria-label={`Trocar de workspace: ${ws.name}`}>
              <WsBadge w={wsInfo(ws.id)} size={30} />
              <span className={s.wswText}>
                <b>{ws.name}</b>
                <small>{ws.kind === "PERSONAL" ? "Só você" : `${data.workspaces.find((w) => w.id === ws.id)?.people ?? 1} membros`}</small>
              </span>
              <Icon name="down" size={14} />
            </summary>
            <div className={s.menu}>
              <span className={s.menuTitle}>Workspaces</span>
              {data.workspaces.map((w) => (
                <Link key={w.id} href={`/app/w/${w.id}`} className={`${s.menuItem} ${w.id === ws.id ? s.menuOn : ""}`}>
                  <WsBadge w={w} />
                  <span className={s.grow}>{w.name}</span>
                  {w.id === ws.id && <Icon name="check" size={14} />}
                </Link>
              ))}
              <span className={s.menuSep} />
              <button type="button" className={s.menuItem} onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); setNewWs(true); }}><Icon name="plus" /> Criar workspace</button>
              {canSettings && <Link href={`${base}/configuracoes`} className={s.menuItem}><Icon name="sliders" /> Configurações do workspace</Link>}
              {team && ws.role !== "OWNER" && <Link href={`${base}/sair`} className={s.menuItem}><Icon name="logout" /> Sair deste workspace</Link>}
            </div>
          </details>
        )}

        <div className={s.scroll}>
          {item(base, "home", "Início", path === base)}
          {item("/app/notificacoes", "bell", "Notificações", under("/app/notificacoes"), data.unread)}
          {ws?.kind === "PERSONAL" && item(`${base}/notas`, "file", "Notas", under(`${base}/notas`))}
          {ws && item(`${base}/mensagens`, "chat", "Mensagens", under(`${base}/mensagens`) || under(`${base}/c`) || under(`${base}/dm`) || under(`${base}/novo-canal`) || under(`${base}/nova-conversa`))}
          {team && item(`${base}/equipes`, "users", "Equipes", under(`${base}/equipes`))}
          {ws && item(`${base}/projetos`, "folder", "Projetos", under(`${base}/projetos`) || under(`${base}/p`))}
          {team && item(`${base}/reunioes`, "video", "Reuniões", under(`${base}/reunioes`) || under(`${base}/reuniao`))}
          {ws && item(`${base}/agenda`, "cal", "Calendário", under(`${base}/agenda`))}
          {ws && item(`${base}/tarefas`, "task", "Tarefas", under(`${base}/tarefas`))}

          <div className={s.sec}>
            <span className={s.label}>Espaços</span>
            <button type="button" onClick={() => setNewWs(true)} className={`${s.ic} ${s.secAdd}`} aria-label="Criar workspace" title="Criar workspace"><Icon name="plus" size={14} /></button>
          </div>
          {ws && (
            <>
              <div className={`${s.nv} ${s.wsRow} ${path === base ? s.on : ""}`}>
                <Link href={base} className={s.wsLink} title={collapsed ? ws.name : undefined}>
                  <WsBadge w={wsInfo(ws.id)} />
                  <span className={s.label}>{ws.kind === "PERSONAL" ? "Pessoal" : ws.name}</span>
                </Link>
                <button type="button" className={`${s.caret} ${treeOpen ? s.caretOpen : ""}`} onClick={() => setTreeOpen(!treeOpen)} aria-expanded={treeOpen} aria-label={treeOpen ? "Esconder projetos e equipes" : "Mostrar projetos e equipes"}>
                  <Icon name="down" size={14} />
                </button>
              </div>
              {treeOpen && (
                <div className={s.tree}>
                  {ws.routine && (
                    <Link href={`${base}/p/${ws.routine.id}`} className={`${s.nv} ${s.sub} ${under(`${base}/p/${ws.routine.id}`) ? s.pill : ""}`} title="Seu quadro pessoal (fixo)">
                      <Icon name="board" size={15} /><span className={s.label}>{ws.routine.name}</span>
                    </Link>
                  )}
                  <div className={`${s.nv} ${s.sub} ${s.groupRow}`}>
                    <Link href={`${base}/projetos`} className={s.groupLink}><Icon name="folder" size={15} /><span className={s.label}>Projetos</span></Link>
                    {ws.projects.length > 0 && (
                      <button type="button" className={`${s.caret} ${openProjects ? s.caretOpen : ""}`} onClick={() => setGroup("projetos", !openProjects)} aria-expanded={openProjects} aria-label={openProjects ? "Recolher projetos" : "Mostrar projetos"}>
                        <Icon name="down" size={13} />
                      </button>
                    )}
                  </div>
                  {openProjects && ws.projects.map((p) => (
                    <Link key={p.id} href={`${base}/p/${p.id}`} className={`${s.nv} ${s.sub2} ${under(`${base}/p/${p.id}`) ? s.pill : ""}`} title={p.name}>
                      <span className={s.sq} style={{ background: colorFor(p.id), width: 16, height: 16, fontSize: 9, borderRadius: 5 }}>{p.name[0]?.toUpperCase()}</span>
                      <span className={s.label}>{p.name}</span>
                    </Link>
                  ))}
                  {ws.teams.length > 0 && (
                    <div className={`${s.nv} ${s.sub} ${s.groupRow}`}>
                      <Link href={`${base}/equipes`} className={s.groupLink}><Icon name="users" size={15} /><span className={s.label}>Equipes</span></Link>
                      <button type="button" className={`${s.caret} ${openTeams ? s.caretOpen : ""}`} onClick={() => setGroup("equipes", !openTeams)} aria-expanded={openTeams} aria-label={openTeams ? "Recolher equipes" : "Mostrar equipes"}>
                        <Icon name="down" size={13} />
                      </button>
                    </div>
                  )}
                  {openTeams && ws.teams.map((t) => (
                    <Link key={t.id} href={`${base}/equipes/${t.id}`} className={`${s.nv} ${s.sub2} ${under(`${base}/equipes/${t.id}`) ? s.pill : ""}`} title={t.name}>
                      <span className={s.sq} style={{ background: colorFor(t.id), width: 16, height: 16, fontSize: 9, borderRadius: 5 }}>{t.name[0]?.toUpperCase()}</span>
                      <span className={s.label}>{t.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
          {data.workspaces.filter((w) => w.id !== ws?.id).map((w) => (
            <Link key={w.id} href={`/app/w/${w.id}`} className={s.nv} title={collapsed ? w.name : undefined}>
              <WsBadge w={w} />
              <span className={s.label}>{w.kind === "PERSONAL" ? "Pessoal" : w.name}</span>
            </Link>
          ))}
        </div>

        <div className={s.foot}>
          {item("/app/ajuda", "help", "Ajuda", under("/app/ajuda"))}
          {data.me.role === "admin" && (
            <Link href="/admin" className={s.nv} title={collapsed ? "Admin" : undefined}>
              <Icon name="shield" />
              <span className={s.label}>Admin</span>
              <span className={`${s.adm} ${s.label}`}>Admin</span>
            </Link>
          )}
          {item(canSettings ? `${base}/configuracoes` : "/app/perfil", "sliders", "Configurações", under(`${base}/configuracoes`) || under("/app/perfil"))}
        </div>
      </nav>
    </>
  );
}
