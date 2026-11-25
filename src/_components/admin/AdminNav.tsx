import Link from "next/link";
import { Logo } from "@/_components/ui/Logo";
import { livekitConfig } from "@/_lib/server/livekit";
import { t } from "@/_i18n";
import s from "@/_styles/admin/AdminShell.module.css";

const LINKS = [
  ["/admin", "Visão geral"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/configuracoes", "Configurações"],
  ["/admin/pessoas", "Pessoas"],
  ["/admin/ajuda", "Central de ajuda"],
  ["/admin/registro", "Registro de ações"],
  ["/admin/erros", "Erros do app"],
  ["/admin/acessos", "Registros de acesso"],
] as const;

export function AdminNav() {
  const services = [
    ["Banco (Supabase)", Boolean(process.env.DATABASE_URL)],
    ["Reuniões (LiveKit)", Boolean(livekitConfig())],
    ["Rotina diária", Boolean(process.env.CRON_SECRET)],
  ] as const;
  return (
    <nav className={s.nav} aria-label="Admin do Gather">
      <div className={s.brand}><Logo /><span className={s.badge}>{t.admin.selo}</span></div>
      {LINKS.map(([href, label]) => <Link key={href} className={s.link} href={href}>{label}</Link>)}
      <div className={s.services}>
        <span className={s.servicesTitle}>Serviços</span>
        {services.map(([name, on]) => (
          <span key={name} className={s.service}><span className={on ? s.on : s.off} aria-hidden="true" />{name}<span className={s.serviceState}>{on ? "ok" : "falta"}</span></span>
        ))}
      </div>
      <Link className={`${s.link} ${s.back}`} href="/app">{t.comum.voltarAoApp}</Link>
    </nav>
  );
}

export function AdminTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <h1 className={s.title}>{title}</h1>
      {sub && <p className={s.sub}>{sub}</p>}
    </>
  );
}
