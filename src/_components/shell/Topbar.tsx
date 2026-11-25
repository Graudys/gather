"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { AppShellData } from "@/_data/shell";
import { Icon } from "@/_components/ui/Icon";
import { colorFor, initialsOf } from "@/_components/chat/Avatar";
import { useShell } from "@/_components/shell/ShellContext";
import { signOut } from "@/_data/auth.actions";
import s from "@/_styles/shell/Shell.module.css";

const SECTIONS: [string, string][] = [
  ["mensagens", "Mensagens"], ["c", "Mensagens"], ["dm", "Mensagens"], ["novo-canal", "Mensagens"], ["nova-conversa", "Mensagens"],
  ["projetos", "Projetos"], ["p", "Projetos"], ["tarefas", "Tarefas"], ["equipes", "Equipes"], ["agenda", "Calendário"],
  ["reunioes", "Reuniões"], ["reuniao", "Reuniões"], ["busca", "Buscar"], ["configuracoes", "Configurações"], ["sair", "Sair do workspace"],
];
const SECTION_HREF: Record<string, string> = { c: "mensagens", dm: "mensagens", "novo-canal": "mensagens", "nova-conversa": "mensagens", p: "projetos", reuniao: "reunioes" };
const GLOBAL: Record<string, string> = { notificacoes: "Notificações", perfil: "Perfil", ajuda: "Ajuda", "novo-workspace": "Criar workspace" };

/** Topo (mockup "Topbar"): voltar, trilha, busca (Ctrl K), sino, configurações e menu da conta. */
export function Topbar({ data }: { data: AppShellData }) {
  const path = usePathname();
  const router = useRouter();
  const { crumb, setDrawer } = useShell();
  const search = useRef<HTMLInputElement>(null);
  const ws = data.current;
  const base = ws ? `/app/w/${ws.id}` : "/app";

  // Ctrl K / Cmd K: vai para a busca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Trilha: Workspace / Seção / detalhe (o detalhe vem da página, via PageCrumb).
  const crumbs: { label: string; href?: string }[] = [];
  const m = /^\/app\/w\/[^/]+\/?([^/]*)/.exec(path);
  if (m) {
    if (ws) crumbs.push({ label: ws.kind === "PERSONAL" ? "Pessoal" : ws.name, href: base });
    const sec = SECTIONS.find(([k]) => k === m[1]);
    if (sec) crumbs.push({ label: sec[1], href: `${base}/${SECTION_HREF[m[1]!] ?? m[1]}` });
    else if (!m[1]) crumbs.push({ label: "Início" });
  } else {
    const g = /^\/app\/([^/]+)/.exec(path)?.[1];
    if (g && GLOBAL[g]) crumbs.push({ label: GLOBAL[g], href: `/app/${g}` });
  }
  if (crumb) crumbs.push({ label: crumb });
  const last = crumbs.pop();
  const canGoBack = path !== base;
  const settingsHref = ws && (ws.role === "OWNER" || ws.role === "ADMIN") ? `${base}/configuracoes` : "/app/perfil";

  return (
    <header className={s.tb}>
      <button className={`${s.ic} ${s.menuBtn}`} onClick={() => setDrawer(true)} aria-label="Abrir menu"><Icon name="menu" size={18} /></button>
      <button className={s.ic} onClick={() => router.back()} disabled={!canGoBack} aria-label="Voltar para a página anterior" title="Voltar"><Icon name="back" size={18} /></button>
      <nav className={s.bc} aria-label="Você está em">
        {crumbs.map((c, i) => (
          <span key={i} className={s.bcItem}>
            {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
            <span aria-hidden="true">/</span>
          </span>
        ))}
        {last && <b aria-current="page">{last.label}</b>}
      </nav>
      {ws && (
        <form action={`${base}/busca`} className={s.srch} role="search">
          <Icon name="search" />
          <input ref={search} name="q" placeholder="Buscar…" aria-label="Buscar no workspace" maxLength={100} />
          <kbd>Ctrl K</kbd>
        </form>
      )}
      <div className={s.tr}>
        {ws && <Link href={`${base}/busca`} className={`${s.ic} ${s.searchIcon}`} aria-label="Buscar"><Icon name="search" size={18} /></Link>}
        <Link href="/app/notificacoes" className={s.ic} aria-label={`Notificações${data.unread ? `: ${data.unread} novas` : ""}`} title="Notificações">
          <Icon name="bell" size={18} />
          {data.unread > 0 && <span className={s.dot}>{data.unread > 99 ? "99+" : data.unread}</span>}
        </Link>
        <Link href={settingsHref} className={`${s.ic} ${s.hideSm}`} aria-label="Configurações" title="Configurações"><Icon name="sliders" size={18} /></Link>
        <details className={s.userMenu}>
          <summary className={s.av} style={{ background: colorFor(data.me.id) }} aria-label={`Menu da conta: ${data.me.name}`}>{initialsOf(data.me.name)}</summary>
          <div className={`${s.menu} ${s.menuRight}`}>
            <div className={s.menuUser}>
              <span className={s.av} style={{ background: colorFor(data.me.id), width: 36, height: 36, fontSize: 13 }}>{initialsOf(data.me.name)}</span>
              <span className={s.wswText}><b>{data.me.name}</b><small>{data.me.email}</small></span>
            </div>
            <span className={s.menuSep} />
            <Link href="/app/perfil" className={s.menuItem}><Icon name="user" /> Meu perfil</Link>
            <Link href="/app/perfil#avisos" className={s.menuItem}><Icon name="bell" /> Preferências de notificação</Link>
            <Link href="/app/perfil?aba=senha" className={s.menuItem}><Icon name="key" /> Trocar senha</Link>
            {ws && (ws.role === "OWNER" || ws.role === "ADMIN") && <Link href={`${base}/configuracoes`} className={s.menuItem}><Icon name="sliders" /> Configurações</Link>}
            <Link href="/app/ajuda" className={s.menuItem}><Icon name="help" /> Ajuda</Link>
            {data.me.role === "admin" && <Link href="/admin" className={s.menuItem}><Icon name="shield" /> Admin do Gather <span className={s.adm} style={{ marginLeft: "auto" }}>Admin</span></Link>}
            <span className={s.menuSep} />
            <form action={signOut}><button className={s.menuItem}><Icon name="logout" /> Sair da conta</button></form>
            <form action={signOut}><input type="hidden" name="todos" value="1" /><button className={`${s.menuItem} ${s.menuFaint}`}>Sair de todos os aparelhos</button></form>
          </div>
        </details>
      </div>
    </header>
  );
}
