import type { Metadata } from "next";
import Link from "next/link";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import { colorFor, initialsOf } from "@/_components/chat/Avatar";
import { changePassword, signOut } from "@/_data/auth.actions";
import { updateProfile } from "@/_data/profile.actions";
import { requireReadyUser } from "@/_lib/auth/dal";
import { db } from "@/_lib/db/prisma";
import { LIMITES } from "@/lib/validation";
import { TIMEZONES } from "@/lib/profile";
import { t } from "@/_i18n";
import { DeviceCard } from "@/_components/pwa/DeviceCard";
import f from "@/_styles/ui/Field.module.css";
import s from "@/_styles/app/Profile.module.css";

export const metadata: Metadata = { title: "Perfil" };

const T = t.auth.trocar;
const ERROS: Record<string, string> = {
  erroAtual: T.erroAtual,
  erroIgual: t.auth.primeiro.erroIgual,
  erroVazada: t.auth.primeiro.erroVazada,
  senhaCurta: t.auth.primeiro.regras,
  muitas: t.auth.erros.muitas,
};
const PERR: Record<string, string> = {
  nome: "Diga seu nome (até 80 caracteres).",
  usuario: "Nome de usuário: 3 a 30 letras minúsculas, números, ponto, hífen ou _.",
  usuarioUsado: "Esse nome de usuário já está em uso.",
  muitas: t.auth.erros.muitas,
  geral: "Não deu para salvar. Confira os campos.",
};

// Perfil (mockup "Perfil"): abas Perfil e Trocar senha.
export default async function Perfil({ searchParams }: PageProps<"/app/perfil">) {
  const sess = await requireReadyUser("/app/perfil");
  const sp = (await searchParams) as { erro?: string; aviso?: string; perr?: string; aba?: string };
  const tab = sp.aba === "senha" || sp.erro || sp.aviso === "senha-alterada" ? "senha" : "perfil";
  const user = await db.user.findUniqueOrThrow({
    where: { id: sess.id },
    select: { id: true, name: true, email: true, username: true, bio: true, timezone: true, notifyPrefs: true, createdAt: true },
  });
  const devices = (await db.$queryRaw<{ n: number }[]>`select count(*)::int as n from push_subscriptions where user_id = ${sess.id}::uuid`)[0]?.n ?? 0;
  const prefs = (user.notifyPrefs ?? {}) as Record<string, boolean>;
  const on = (k: string) => prefs[k] !== false;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Meu perfil</h1>
      <nav className={s.tabs} aria-label="Abas do perfil">
        <Link href="/app/perfil" className={tab === "perfil" ? s.tabOn : ""} aria-current={tab === "perfil" ? "page" : undefined}>Perfil</Link>
        <Link href="/app/perfil?aba=senha" className={tab === "senha" ? s.tabOn : ""} aria-current={tab === "senha" ? "page" : undefined}>Trocar senha</Link>
      </nav>

      {tab === "perfil" ? (
        <form action={updateProfile} className={s.layout}>
          <aside className={s.card}>
            <span className={s.avatar} style={{ background: colorFor(user.id) }}>{initialsOf(user.name)}</span>
            <b className={s.name}>{user.name}</b>
            <span className={s.muted}>{user.username ? `@${user.username}` : user.email}</span>
            <span className={s.faint}>No Gather desde {user.createdAt.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}</span>
          </aside>
          <div className={s.col}>
            {sp.aviso === "salvo" && <Alert tone="ok">Perfil salvo.</Alert>}
            {sp.perr && <Alert>{PERR[sp.perr] ?? PERR.geral}</Alert>}
            <section className={s.card2}>
              <h2>Informações</h2>
              <div className={s.two}>
                <Field label="Nome de exibição" name="name" defaultValue={user.name} required maxLength={LIMITES.nome} autoComplete="name" />
                <Field label="Nome de usuário" name="username" defaultValue={user.username ?? ""} maxLength={30} pattern="[a-zA-Z0-9._\-]{3,30}" placeholder="ex.: marina.alves" autoComplete="username" />
              </div>
              <label className={f.field}>
                <span className={f.label}>Bio</span>
                <textarea name="bio" defaultValue={user.bio ?? ""} maxLength={280} rows={3} className={`${f.input} ${s.textarea}`} placeholder="Conte em uma linha o que você faz" />
              </label>
              <div className={s.two}>
                <label className={f.field}>
                  <span className={f.label}>Fuso horário</span>
                  <select name="timezone" defaultValue={user.timezone ?? "America/Sao_Paulo"} className={f.input}>
                    {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <Field label="E-mail" value={user.email} readOnly disabled title="O e-mail é trocado pelo admin" />
              </div>
              <p className={s.faint}>Para trocar o e-mail, fale com o admin do Gather. Por enquanto o app mostra os horários de Brasília.</p>
            </section>
            <section className={s.card2} id="avisos">
              <h2>Notificações</h2>
              <p className={s.muted}>O que aparece no sino.</p>
              <label className={s.pref}><input type="checkbox" name="mencoes" defaultChecked={on("mencoes")} /><span><b>Menções e respostas</b><small>Mensagens diretas e respostas nas suas conversas</small></span></label>
              <label className={s.pref}><input type="checkbox" name="tarefas" defaultChecked={on("tarefas")} /><span><b>Tarefas atribuídas a mim</b><small>Quando te colocam numa tarefa ou comentam nela</small></span></label>
              <label className={s.pref}><input type="checkbox" name="reunioes" defaultChecked={on("reunioes")} /><span><b>Lembretes de reunião</b><small>Convites e lembretes de eventos</small></span></label>
            </section>
            <div className={s.actions}><Button>Salvar alterações</Button></div>
          </div>
        </form>
      ) : null}
      {tab === "perfil" ? (
        <div className={s.layout}>
          <span aria-hidden="true" />
          <div className={s.col}><DeviceCard devices={devices} /></div>
        </div>
      ) : (
        <div className={s.narrow}>
          <section className={s.card2}>
            <h2>{T.titulo}</h2>
            <p className={s.muted}>Ao trocar, os outros aparelhos saem da conta.</p>
            {sp.aviso === "senha-alterada" && <Alert tone="ok">{T.ok}</Alert>}
            {sp.erro && <Alert>{ERROS[sp.erro] ?? t.auth.erros.geral}</Alert>}
            <form action={changePassword} className={s.form}>
              <Field label={T.atual} name="current" type="password" autoComplete="current-password" required maxLength={LIMITES.senhaMax} />
              <Field label={T.nova} name="password" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
              <Field label={T.repetir} name="confirm" type="password" autoComplete="new-password" required minLength={LIMITES.senhaMin} maxLength={LIMITES.senhaMax} />
              <Button>{T.botao}</Button>
            </form>
          </section>
          <section className={s.card2}>
            <h2>Aparelhos</h2>
            <p className={s.muted}>Esqueceu a conta aberta em outro lugar? Saia de todos de uma vez.</p>
            <form action={signOut}>
              <input type="hidden" name="todos" value="1" />
              <Button variant="ghost">Sair de todos os aparelhos</Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
