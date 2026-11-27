import type { Metadata } from "next";
import { WorkspaceIconCard } from "@/_components/shell/WorkspaceIconCard";
import Link from "next/link";
import { getWorkspaceSettingsView } from "@/_data/members";
import { addMember, deleteWorkspace, removeMember, setMemberRole, updateWorkspace } from "@/_data/members.actions";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { AutoSubmit } from "@/_components/ui/AutoSubmit";
import { data } from "@/lib/format";
import { addDays } from "@/lib/time";
import { dayWindow } from "@/lib/projects";
import s from "@/_styles/app/Page.module.css";
import c from "@/_styles/app/Settings.module.css";
import { NOTE_KEEP_MONTHS, NOTE_RETENTION_OPTIONS, NOTE_WARN_DAYS, yearsLabel } from "@/lib/notes";

export const metadata: Metadata = { title: "Configurações do workspace" };

const ERROS: Record<string, string> = {
  email: "Confira o e-mail.",
  semAcesso: "Ninguém com esse e-mail tem acesso ao Gather. Peça ao admin do Gather para criar o acesso primeiro.",
  jaMembro: "Essa pessoa já está no workspace.",
  permissao: "Só o dono pode adicionar admins.",
  pessoal: "O espaço pessoal é só seu.",
  prazo: "Escolha um dos prazos da lista.",
  confirmacao: "O nome digitado não confere.",
  muitas: "Muitas mudanças seguidas. Espere um pouco.",
  dados: "Confira os dados.",
};
const OK: Record<string, string> = { adicionado: "Pessoa adicionada.", salvo: "Alterações salvas." };
const ROLE = { OWNER: "Dono", ADMIN: "Admin", MEMBER: "Membro" } as const;
const short = (iso: string) => new Date(`${iso}T15:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");

// Configurações do workspace (mockups "Geral", "Membros" e "Retencao").
export default async function Configuracoes({ params, searchParams }: PageProps<"/app/w/[id]/configuracoes">) {
  const { id } = await params;
  const sp = (await searchParams) as { erro?: string; ok?: string; aba?: string };
  const v = await getWorkspaceSettingsView(id); // só dono e admins
  const owner = v.role === "OWNER";
  const personal = v.workspace.kind === "PERSONAL";
  const tab = sp.aba === "membros" && !personal ? "membros" : sp.aba === "retencao" ? "retencao" : "geral";
  const base = `/app/w/${id}/configuracoes`;
  const tabs = [["geral", "Geral"], ...(personal ? [] : [["membros", "Membros"]]), ["retencao", "Retenção e privacidade"]] as const;
  const { today } = dayWindow();
  const cut = addDays(today, -v.retention.messageMonths * 30);

  return (
    <div className={s.page}>
      <div className={s.head}><h1>Configurações do workspace</h1></div>
      <p className={s.sub}>Só donos e admins veem esta área.</p>
      <nav className={s.tabs} aria-label="Seções">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k === "geral" ? base : `${base}?aba=${k}`} className={tab === k ? s.btn : s.btn2} aria-current={tab === k ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      {sp.erro && <div className={c.alert}><Alert>{ERROS[sp.erro] ?? ERROS.dados}</Alert></div>}
      {sp.ok && <div className={c.alert}><Alert tone="ok">{OK[sp.ok] ?? "Feito."}</Alert></div>}

      {tab === "geral" && (
        <div className={c.stack}>
          <section className={`${s.card} ${c.narrow}`}>
            <h3>Ícone do workspace</h3>
            <WorkspaceIconCard w={{ id, name: v.workspace.name, icon: v.icon, photoV: v.photoV }} />
          </section>
          <section className={`${s.card} ${c.narrow}`}>
            <form action={updateWorkspace} className={c.fg}>
              <input type="hidden" name="workspaceId" value={id} />
              <input type="hidden" name="aba" value="geral" />
              <label className={c.f}>Nome do workspace<input className={s.in} name="name" defaultValue={v.workspace.name} required maxLength={80} /></label>
              <label className={c.f}>Descrição<input className={s.in} name="description" defaultValue={v.description} maxLength={200} placeholder="Do que se trata este workspace" /></label>
              {!personal && (
                <label className={c.f}>
                  Visibilidade padrão de novos canais
                  <select name="channelVisibility" className={s.in} defaultValue={v.channelVisibility}>
                    <option value="PUBLIC">Público</option>
                    <option value="PRIVATE">Privado</option>
                  </select>
                </label>
              )}
              <div className={c.actions}>
                <Link href={base} className={s.btn2}>Cancelar</Link>
                <Button>Salvar alterações</Button>
              </div>
            </form>
          </section>
          {!personal && (
            <section className={`${s.card} ${c.narrow}`} style={{ marginTop: 16 }}>
              <h3>Zona de risco</h3>
              <div className={c.risk}>
                <span className={s.grow}><b>Transferir propriedade</b><div className={`${s.mut} ${s.sm}`}>Fale com o admin do Gather para passar o workspace para outra pessoa.</div></span>
              </div>
              {owner && (
                <details className={c.riskBox}>
                  <summary className={c.risk}>
                    <span className={s.grow}><b>Apagar workspace</b><div className={`${s.mut} ${s.sm}`}>Apaga canais, mensagens, tarefas e tudo mais, para todo mundo.</div></span>
                    <span className={`${s.btn2} ${c.dangerBtn}`}>Apagar</span>
                  </summary>
                  <form action={deleteWorkspace} className={c.fg} style={{ paddingTop: 12 }}>
                    <input type="hidden" name="workspaceId" value={id} />
                    <label className={c.f}>Digite &quot;{v.workspace.name}&quot; para confirmar<input className={s.in} name="confirm" required autoComplete="off" /></label>
                    <div className={c.actions}><Button variant="ghost">Apagar de vez</Button></div>
                  </form>
                </details>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "membros" && (
        <>
          <section className={s.card} style={{ marginBottom: 16 }}>
            <h3>Adicionar por e-mail</h3>
            <form action={addMember} className={c.inline}>
              <input type="hidden" name="workspaceId" value={id} />
              <input className={s.in} style={{ flex: 1, minWidth: 220 }} name="email" type="email" required maxLength={254} placeholder="nome@empresa.com" aria-label="E-mail" />
              {owner ? (
                <select name="role" className={s.in} style={{ width: 140 }} defaultValue="MEMBER" aria-label="Função">
                  <option value="MEMBER">Membro</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : <input type="hidden" name="role" value="MEMBER" />}
              <Button>Adicionar</Button>
            </form>
            <p className={`${s.mut} ${s.sm}`} style={{ margin: "10px 0 0" }}>A pessoa precisa já ter acesso ao Gather. Ela vê o workspace na hora, sem convite.</p>
          </section>
          <div className={c.split}>
            <section className={s.card}>
              <h3>Membros · {v.members.length}</h3>
              {v.members.map((m) => (
                <div key={m.id} className={`${s.row} ${c.mrow}`}>
                  <Avatar id={m.id} name={m.name} />
                  <span className={s.grow}>
                    <b>{m.name}</b>{m.isMe && <span className={s.mut}> (você)</span>}
                    <div className={`${s.mut} ${s.sm}`} style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                  </span>
                  {owner && !m.isMe && m.role !== "OWNER" ? (
                    <form action={setMemberRole}>
                      <input type="hidden" name="workspaceId" value={id} />
                      <input type="hidden" name="userId" value={m.id} />
                      <select name="role" defaultValue={m.role} className={s.in} style={{ width: 120, padding: "6px 10px" }} aria-label={`Função de ${m.name}`}>
                        <option value="MEMBER">Membro</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <AutoSubmit />
                    </form>
                  ) : <span className={s.chip}>{ROLE[m.role]}</span>}
                  {!m.isMe && m.role !== "OWNER" && (owner || m.role === "MEMBER") ? (
                    <form action={removeMember}>
                      <input type="hidden" name="workspaceId" value={id} />
                      <input type="hidden" name="userId" value={m.id} />
                      <button className={s.btn2}>Remover</button>
                    </form>
                  ) : <span className={c.spacerBtn} />}
                </div>
              ))}
            </section>
            <div className={s.fg}>
              <section className={s.card}>
                <h3>Como as pessoas entram</h3>
                <p className={`${s.mut} ${s.sm}`} style={{ margin: 0, lineHeight: 1.6 }}>O Gather é fechado: o admin do Gather cria o acesso da pessoa e você a adiciona aqui pelo e-mail. Não há convite por link.</p>
              </section>
              <section className={s.card}>
                <h3>Mudanças recentes</h3>
                {v.history.length === 0 ? <p className={`${s.mut} ${s.sm}`} style={{ margin: 0 }}>Nada ainda.</p> : (
                  <div className={`${s.mut} ${s.sm}`} style={{ lineHeight: 1.8 }}>
                    {v.history.map((h, i) => <div key={i}>{h.text} · {data(h.at)}</div>)}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {tab === "retencao" && (
        <form action={updateWorkspace}>
          <input type="hidden" name="workspaceId" value={id} />
          <input type="hidden" name="aba" value="retencao" />
          <div className={c.split}>
            <div className={s.fg}>
              <section className={s.card}>
                <div className={c.cardHead}>
                  <span className={c.badge}><Icon name="chat" size={18} /></span>
                  <div className={s.grow}><h3 style={{ margin: 0 }}>Mensagens</h3><div className={`${s.mut} ${s.sm}`}>Canais e conversas diretas</div></div>
                </div>
                <div style={{ fontSize: 14, marginBottom: 10 }}>Mensagens somem depois de</div>
                <div className={`${s.seg} ${c.radios}`} role="radiogroup" aria-label="Prazo das mensagens">
                  {v.options.months.map((m) => (
                    <label key={m}><input type="radio" name="months" value={m} defaultChecked={m === v.retention.messageMonths} /><span>{m} {m === 1 ? "mês" : "meses"}</span></label>
                  ))}
                </div>
                <div className={c.tl} aria-hidden="true"><span className={c.gone}>Apagadas</span><span className={c.keep}>Visíveis: últimos {v.retention.messageMonths} {v.retention.messageMonths === 1 ? "mês" : "meses"}</span></div>
                <div className={`${s.mut} ${c.tlLegend}`}><span style={{ flex: 1 }}>antes de {short(cut)}</span><span style={{ flex: 3, display: "flex", justifyContent: "space-between" }}><span>{short(cut)}</span><span>hoje, {short(today)}</span></span></div>
                <p className={`${s.mut} ${s.sm}`} style={{ lineHeight: 1.6, margin: "14px 0 0" }}>A conversa vai se renovando: toda noite, o que passou do prazo some. Se você diminuir o prazo, ele vale para o histórico também.</p>
              </section>
              <section className={s.card}>
                <div className={c.cardHead}>
                  <span className={c.badge}><Icon name="image" size={18} /></span>
                  <div className={s.grow}><h3 style={{ margin: 0 }}>Arquivos e fotos do chat</h3><div className={`${s.mut} ${s.sm}`}>O que é enviado em canais e conversas</div></div>
                </div>
                <div style={{ fontSize: 14, marginBottom: 10 }}>Arquivos somem depois de</div>
                <div className={`${s.seg} ${c.radios}`} role="radiogroup" aria-label="Prazo dos arquivos">
                  {v.options.hours.map((h) => (
                    <label key={h}><input type="radio" name="hours" value={h} defaultChecked={h === v.retention.fileHours} /><span>{h === 24 ? "24 horas" : h === 168 ? "7 dias" : `${Math.round(h / 24)} dias`}</span></label>
                  ))}
                </div>
                <p className={`${s.mut} ${s.sm}`} style={{ lineHeight: 1.6, margin: "14px 0 0" }}>As opções são definidas pelo admin do Gather. Depois do prazo, o arquivo sai do armazenamento e a mensagem mostra &quot;Arquivo expirado&quot;.</p>
              </section>
              {personal && (
                <section className={s.card}>
                  <div className={c.cardHead}>
                    <span className={c.badge}><Icon name="file" size={18} /></span>
                    <div className={s.grow}><h3 style={{ margin: 0 }}>Notas</h3><div className={`${s.mut} ${s.sm}`}>Cadernos e páginas da aba Notas</div></div>
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 10 }}>Guardar cada nota por</div>
                  <div className={`${s.seg} ${c.radios}`} role="radiogroup" aria-label="Prazo das notas">
                    {NOTE_RETENTION_OPTIONS.map((mo) => (
                      <label key={mo}><input type="radio" name="noteMonths" value={mo} defaultChecked={mo === v.retention.noteMonths} /><span>{yearsLabel(mo)}</span></label>
                    ))}
                  </div>
                  <ul className={`${s.mut} ${s.sm}`} style={{ lineHeight: 1.7, margin: "14px 0 0", paddingLeft: 18 }}>
                    <li>O prazo conta da <b>última edição</b>: editar uma nota renova o prazo dela.</li>
                    <li>{NOTE_WARN_DAYS} dias antes de vencer, chega um aviso no sino (e no aparelho, se ligado).</li>
                    <li>Na aba Notas você decide: baixar em .md, manter por mais {yearsLabel(NOTE_KEEP_MONTHS)} ou apagar.</li>
                    <li><b>Nada é apagado sozinho</b>: só some se você digitar APAGAR.</li>
                  </ul>
                </section>
              )}
              <div className={c.actions}>
                <Link href={`${base}?aba=retencao`} className={s.btn2}>Cancelar</Link>
                <Button>Salvar prazos</Button>
              </div>
            </div>
            <div className={s.fg}>
              <section className={s.card}>
                <h3>O que não expira</h3>
                {[["Tarefas e comentários", "Enquanto existirem"], ["Notas e decisões de reuniões", "Enquanto existirem"], ["Projetos e calendário", "Enquanto existirem"]].map(([k, val]) => (
                  <div key={k} className={c.kv}><span>{k}</span><span>{val}</span></div>
                ))}
              </section>
              <section className={s.card}>
                <h3>Reuniões</h3>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>O Gather não grava nem guarda áudio. Fica só o registro de quem entrou e quanto tempo durou.</div>
              </section>
              <section className={s.card}>
                <h3>Limpeza automática</h3>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>Todo dia às 03:00 (horário de Brasília).</div>
              </section>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
