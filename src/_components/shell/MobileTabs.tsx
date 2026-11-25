"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppShellData } from "@/_data/shell";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { useShell } from "@/_components/shell/ShellContext";
import s from "@/_styles/shell/Shell.module.css";

/** Abas de baixo no celular (mockup "MobileChat"): Início, Mensagens, Tarefas, Reuniões, Mais. */
export function MobileTabs({ data }: { data: AppShellData }) {
  const path = usePathname();
  const { setDrawer } = useShell();
  const ws = data.current;
  if (!ws) return null;
  const base = `/app/w/${ws.id}`;
  const tabs: [string, IconName, string, string[]][] = [
    [base, "home", "Início", []],
    [`${base}/mensagens?lista=1`, "chat", "Mensagens", [`${base}/mensagens`, `${base}/c/`, `${base}/dm/`, `${base}/novo-canal`, `${base}/nova-conversa`]],
    [`${base}/tarefas`, "task", "Tarefas", [`${base}/p/`, `${base}/projetos`]],
    [ws.kind === "TEAM" ? `${base}/reunioes` : `${base}/agenda`, ws.kind === "TEAM" ? "video" : "cal", ws.kind === "TEAM" ? "Reuniões" : "Agenda", [`${base}/reuniao`]],
  ];
  return (
    <nav className={s.tabs} aria-label="Navegação">
      {tabs.map(([href, icon, label, also]) => {
        const on = href === base ? path === base : path === href.split("?")[0] || path.startsWith(`${href.split("?")[0]}/`) || also.some((a) => path.startsWith(a));
        return (
          <Link key={label} href={href} className={`${s.tab} ${on ? s.tabOn : ""}`} aria-current={on ? "page" : undefined}>
            <Icon name={icon} size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button className={s.tab} onClick={() => setDrawer(true)}>
        <Icon name="more" size={20} />
        <span>Mais</span>
      </button>
    </nav>
  );
}
