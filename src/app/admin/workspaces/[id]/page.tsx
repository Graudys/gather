import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { getWorkspaceAdmin } from "@/_data/admin-workspaces";
import { adminAddPerson, adminSetMember, adminSuspend, adminTransferOwner, adminUpdateWorkspace } from "@/_data/admin-workspaces.actions";
import { ACTION_LABEL } from "@/_data/admin-log";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { Modal } from "@/_components/ui/Modal";
import m from "@/_styles/ui/Modal.module.css";
import { data, dataHora } from "@/lib/format";
import s from "@/_styles/admin/AdminPages.module.css";

export const metadata: Metadata = { title: "Workspace" };

const ERROS: Record<string, string> = {
  motivo: "Diga o motivo (pelo menos 3 letras).", reason: "Diga o motivo (pelo menos 3 letras).",
  semAcesso: "Ninguém com esse e-mail tem acesso ao Gather. Crie o acesso em Pessoas primeiro.",
  jaMembro: "Essa pessoa já está no workspace.", dono: "O dono só muda por Transferir propriedade.",
  novoDono: "O novo dono precisa já ser membro do workspace.", quota: "Minutos inválidos.", dados: "Confira os campos.",
};
const OK: Record<string, string> = { salvo: "Salvo e registrado.", adicionado: "Pessoa adicionada.", transferido: "Propriedade transferida." };
const ROLE = { OWNER: "Dono", ADMIN: "Admin", MEMBER: "Membro" } as const;

function Reason({ placeholder = "Ex.: pedido do dono do workspace" }: { placeholder?: string }) {
  return <input name="reason" className={s.input} required minLength={3} maxLength={300} placeholder={`Motivo · ${placeholder}`} />;
}

export default async function AdminWorkspace({ params, searchParams }: PageProps<"/admin/workspaces/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { erro, ok, modal } = (await searchParams) as { erro?: string; ok?: string; modal?: string };
  const w = await getWorkspaceAdmin(id);
  const st = w.settings;
  const hidden = <input type="hidden" name="workspaceId" value={w.id} />;
  const others = w.members.filter((x) => x.role !== "OWNER");
  const self = `/admin/workspaces/${w.id}`;

  return (
    <>
      <Link href="/admin/workspaces" className={s.faint}><Icon name="back" size={13} /> Workspaces</Link>
      <AdminTitle title={w.name} sub={`Dono: ${w.owner?.name ?? "—"} · criado em ${data(w.createdAt.toISOString())}${w.suspendedAt ? " · SUSPENSO" : ""}`} />
      {erro && <Alert>{ERROS[erro] ?? ERROS.dados}</Alert>}
      {ok && <Alert tone="ok">{OK[ok] ?? "Feito."}</Alert>}
      <div className={s.kpis}>
        <div className={s.kpi}><span className={s.kpiLabel}>Pessoas</span><span className={s.kpiValue}>{w.stats.people}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>Mensagens (7 dias)</span><span className={s.kpiValue}>{w.stats.msgs7}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>Tarefas criadas (7 dias)</span><span className={s.kpiValue}>{w.stats.tasks7}</span></div>
        <div className={s.kpi}><span className={s.kpiLabel}>Minutos de reunião no mês</span><span className={s.kpiValue}>{w.stats.minutes}</span></div>
      </div>
      <p className={s.faint}>Por privacidade, você vê números deste workspace, não as mensagens nem os arquivos.</p>

      <div className={s.grid}>
        <div className={s.col}>
          <form action={adminUpdateWorkspace} className={s.card}>
            {hidden}
            <b className={s.cardTitle}>Reuniões e prazos</b>
            <label className={s.label}>
              Reuniões
              <select name="calls" defaultValue={st?.callsEnabled ? "on" : "off"} className={s.select}>
                <option value="on">Ligadas neste workspace</option>
                <option value="off">{w.defaults.callsForAll ? "Seguem a regra geral (ligadas para todos)" : "Desligadas"}</option>
              </select>
            </label>
            <label className={s.label}>
              Minutos por mês (vazio = padrão de {w.defaults.quota})
              <input name="quota" type="number" min={0} max={100000} defaultValue={st?.callMinutesQuota ?? ""} className={s.input} />
            </label>
            <div className={s.inline}>
              <label className={`${s.label} ${s.grow}`}>
                Mensagens somem após
                <select name="months" defaultValue={st?.messageRetentionMonths ?? 3} className={s.select}>
                  {w.defaults.months.map((m) => <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>)}
                </select>
              </label>
              <label className={`${s.label} ${s.grow}`}>
                Arquivos do chat
                <select name="hours" defaultValue={st?.fileRetentionHours ?? 24} className={s.select}>
                  {w.defaults.hours.map((h) => <option key={h} value={h}>{h === 24 ? "24 horas" : `${h / 24} dias`}</option>)}
                </select>
              </label>
            </div>
            <Reason />
            <div><Button>Salvar</Button></div>
          </form>

          <section className={s.card}>
            <b className={s.cardTitle}>Pessoas · {w.members.length}</b>
            {w.members.map((m) => (
              <div key={m.user.id} className={s.form} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                <div className={s.row}>{m.user.name} <span className={s.faint}>{m.user.email}</span><b>{ROLE[m.role]}</b></div>
                {m.role !== "OWNER" && (
                  <form action={adminSetMember} className={s.inline}>
                    {hidden}
                    <input type="hidden" name="userId" value={m.user.id} />
                    <select name="op" defaultValue={m.role} className={s.select} style={{ width: "auto" }} aria-label={`Mudar ${m.user.name}`}>
                      <option value="MEMBER">Membro</option>
                      <option value="ADMIN">Admin</option>
                      <option value="REMOVE">Remover do workspace</option>
                    </select>
                    <div className={s.grow}><Reason /></div>
                    <Button variant="ghost">Aplicar</Button>
                  </form>
                )}
              </div>
            ))}
          </section>
        </div>

        <div className={s.col}>
          <section className={s.card}>
            <b className={s.cardTitle}>Ações do admin</b>
            <p className={s.faint} style={{ marginTop: -6 }}>Use quando o dono pedir. Tudo fica registrado com o motivo.</p>
            <div className={s.adminActions}>
              {others.length > 0 && <Link href={`${self}?modal=transferir`} scroll={false} className={s.actionBtn}><Icon name="key" size={15} /> Transferir propriedade</Link>}
              <Link href={`${self}?modal=adicionar`} scroll={false} className={s.actionBtn}><Icon name="plus" size={15} /> Adicionar pessoa</Link>
              <Link href={`${self}?modal=suspender`} scroll={false} className={`${s.actionBtn} ${s.actionDanger}`}><Icon name="shield" size={15} /> {w.suspendedAt ? "Reativar workspace" : "Suspender workspace"}</Link>
            </div>
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Histórico do admin</b>
            {w.history.length === 0 && <p className={s.faint}>Nada ainda.</p>}
            <ul className={s.history}>
              {w.history.map((h, i) => (
                <li key={i}><span>{ACTION_LABEL[h.action] ?? h.action}{h.target ? ` · ${h.target}` : ""}</span><span className={s.faint}>{h.reason} · {h.admin} · {dataHora(h.at)}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {modal === "transferir" && others.length > 0 && (
        <Modal title={`Transferir propriedade de ${w.name}`} sub={`Dono atual: ${w.owner?.name ?? "—"}`} icon="key" closeHref={self} width={540}>
          <form action={adminTransferOwner}>
            {hidden}
            <div className={m.fg}>
              <label className={m.f}>
                Novo dono
                <select name="newOwnerId" className={m.in} required>
                  {others.map((x) => <option key={x.user.id} value={x.user.id}>{x.user.name} · {x.user.email} · {ROLE[x.role]}</option>)}
                </select>
                <span className={m.hint} style={{ margin: 0 }}>Só quem já é membro do workspace. Para outra pessoa, adicione antes.</span>
              </label>
              <label className={m.f}>Motivo<textarea name="reason" className={m.in} rows={2} required minLength={3} maxLength={300} placeholder="Ex.: pedido do dono do workspace" /></label>
              <label className={m.f}>
                O dono atual passa a ser
                <select name="oldBecomes" className={m.in} defaultValue="ADMIN">
                  <option value="ADMIN">Admin</option><option value="MEMBER">Membro</option><option value="REMOVE">Removido do workspace</option>
                </select>
              </label>
              <label className={m.check}><input type="checkbox" name="notifyBoth" defaultChecked /> Avisar o dono atual e o novo dono</label>
            </div>
            <div className={m.note}><Icon name="info" size={15} /><span>Fica registrado no histórico do workspace e no registro de ações do admin, com o motivo.</span></div>
            <div className={m.df}><Link href={self} scroll={false} className={m.btn2}>Cancelar</Link><Button>Transferir</Button></div>
          </form>
        </Modal>
      )}

      {modal === "adicionar" && (
        <Modal title={`Adicionar pessoa a ${w.name}`} icon="users" closeHref={self} width={540}>
          <form action={adminAddPerson}>
            {hidden}
            <div className={m.fg}>
              <label className={m.f}>E-mail<input name="email" type="email" required className={m.in} placeholder="e-mail de quem já tem acesso" autoFocus /></label>
              <label className={m.f}>
                Função
                <select name="role" className={m.in} defaultValue="MEMBER"><option value="MEMBER">Membro</option><option value="ADMIN">Admin</option></select>
              </label>
              <label className={m.f}>Motivo<textarea name="reason" className={m.in} rows={2} required minLength={3} maxLength={300} placeholder="Ex.: pedido do dono do workspace" /></label>
            </div>
            <div className={m.note}><Icon name="info" size={15} /><span>Só entra quem já tem acesso ao Gather. Para alguém novo, crie o acesso antes em Pessoas.</span></div>
            <div className={m.df}><Link href={self} scroll={false} className={m.btn2}>Cancelar</Link><Button>Adicionar</Button></div>
          </form>
        </Modal>
      )}

      {modal === "suspender" && (
        <Modal title={w.suspendedAt ? `Reativar ${w.name}?` : `Suspender ${w.name}?`} sub={w.suspendedAt ? "As pessoas voltam a abrir o workspace." : "Ninguém abre o workspace até você reativar. Nada é apagado."} icon="shield" closeHref={self} width={500}>
          <form action={adminSuspend}>
            {hidden}
            <input type="hidden" name="op" value={w.suspendedAt ? "resume" : "suspend"} />
            <label className={m.f}>Motivo<textarea name="reason" className={m.in} rows={2} required minLength={3} maxLength={300} placeholder={w.suspendedAt ? "Ex.: resolvido" : "Ex.: uso indevido"} autoFocus /></label>
            <div className={m.df}><Link href={self} scroll={false} className={m.btn2}>Cancelar</Link><Button>{w.suspendedAt ? "Reativar" : "Suspender"}</Button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
