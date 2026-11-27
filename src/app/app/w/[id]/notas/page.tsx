import type { Metadata } from "next";
import Link from "next/link";
import { getNotesView } from "@/_data/notes";
import {
  createNote, createNotebook, deleteNote, deleteNotebook, deleteWarnedNotes, keepWarnedNotes, setNoteRetention, updateNotebook,
} from "@/_data/notes.actions";
import { notesInWarning } from "@/_data/notes";
import { NoteEditor } from "@/_components/notes/NoteEditor";
import { sendNoteToChannel, sendNoteToPerson } from "@/_data/share.actions";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { Modal } from "@/_components/ui/Modal";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { PageCrumb } from "@/_components/shell/ShellContext";
import { CHAT_ICONS } from "@/lib/chat-icons";
import { NOTE_KEEP_MONTHS, NOTE_LIMITS, NOTE_RETENTION_OPTIONS, NOTE_WARN_DAYS, yearsLabel } from "@/lib/notes";
import s from "@/_styles/app/Notes.module.css";
import m from "@/_styles/ui/Modal.module.css";
import c from "@/_styles/chat/Chat.module.css";

export const metadata: Metadata = { title: "Notas" };

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

function IconChoice({ current }: { current?: string | null }) {
  return (
    <fieldset className={c.iconField}>
      <legend className={m.lbl}>Ícone</legend>
      <div className={c.iconRadios}>
        <label title="Sem ícone"><input type="radio" name="icon" value="" defaultChecked={!current} /><span><Icon name="file" size={16} /></span></label>
        {CHAT_ICONS.map((e) => (
          <label key={e}><input type="radio" name="icon" value={e} defaultChecked={current === e} /><span>{e}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Notas (só no espaço pessoal): cadernos como canais, mas de anotações.
 * "Minha vida" vem sempre e não pode ser apagado. Prazo das notas: 1 ano ou mais,
 * contado da última edição; antes de vencer a pessoa é avisada e escolhe
 * baixar, manter por mais 1 ano ou apagar (nada some sem confirmação).
 */
export default async function Notas({ params, searchParams }: PageProps<"/app/w/[id]/notas">) {
  const { id } = await params;
  const q = (await searchParams) as Record<string, string | undefined>;
  const v = await getNotesView(id, q.c, q.n);
  const base = `/app/w/${id}/notas`;
  const here = `${base}${v.notebook ? `?c=${v.notebook.id}` : ""}${v.note ? `&n=${v.note.id}` : ""}`;
  const book = v.notebook;
  const level = v.note ? "note" : q.c ? "pages" : "books";
  const warnCount = v.warning.expiring + v.warning.expired;
  const warnList = q.vencendo ? await notesInWarning(id, v.months) : [];
  const exportAll = `/api/notas/exportar?w=${id}`;

  // Destinos para "Enviar": pessoas e canais dos seus workspaces de equipe.
  let targets: { people: { value: string; label: string }[]; channels: { value: string; label: string }[] } = { people: [], channels: [] };
  if (q.enviar && v.note) {
    const me = await requireReadyUser();
    const teams = await db.workspaceMember.findMany({ where: { userId: me.id, workspace: { kind: "TEAM", suspendedAt: null } }, select: { workspace: { select: { id: true, name: true } } } });
    const wsIds = teams.map((t) => t.workspace.id);
    const wsName = new Map(teams.map((t) => [t.workspace.id, t.workspace.name]));
    const [people, chans] = await Promise.all([
      db.workspaceMember.findMany({ where: { workspaceId: { in: wsIds }, userId: { not: me.id } }, select: { workspaceId: true, user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
      db.channel.findMany({ where: { workspaceId: { in: wsIds }, OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: me.id } } }] }, select: { id: true, name: true, workspaceId: true }, orderBy: { name: "asc" } }),
    ]);
    targets = {
      people: people.map((p) => ({ value: `${p.workspaceId}:${p.user.id}`, label: `${p.user.name} · ${wsName.get(p.workspaceId)}` })),
      channels: chans.map((c) => ({ value: `${c.workspaceId}:${c.id}`, label: `#${c.name} · ${wsName.get(c.workspaceId)}` })),
    };
  }

  return (
    <>
      <PageCrumb label={book?.name ?? "Notas"} />
      <div className={s.wrap} data-level={level}>
        {/* Cadernos */}
        <nav className={s.col} aria-label="Cadernos">
          <div className={s.colHead}>
            <h2>Cadernos</h2>
            <Link href={`${base}?${book ? `c=${book.id}&` : ""}novo=1`} className={s.add} aria-label="Novo caderno" title="Novo caderno" scroll={false}><Icon name="plus" size={16} /></Link>
          </div>
          <ul className={s.list}>
            {v.notebooks.map((b) => (
              <li key={b.id}>
                <Link href={`${base}?c=${b.id}`} className={`${s.book} ${b.id === book?.id ? s.on : ""}`} aria-current={b.id === book?.id ? "page" : undefined}>
                  <span className={s.bookIcon}>{b.isDefault ? <Icon name="notebook" size={15} /> : b.icon ?? <Icon name="file" size={15} />}</span>
                  <span>{b.name}</span>
                  {b.isDefault && <span className={s.pin} title="Caderno fixo: não pode ser apagado">fixo</span>}
                  <span className={s.n}>{b.count}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`${here}${here.includes("?") ? "&" : "?"}prazo=1`} className={s.retention} scroll={false}>
            <Icon name="clock" size={13} /> Notas guardadas por {yearsLabel(v.months)} após a última edição
          </Link>
        </nav>

        {/* Páginas do caderno */}
        <section className={s.col} aria-label={book ? `Notas de ${book.name}` : "Notas"}>
          <div className={s.colHead}>
            <Link href={base} className={`${s.add} ${s.back}`} aria-label="Voltar para os cadernos"><Icon name="back" size={16} /></Link>
            <h2>{book ? <>{book.isDefault ? <Icon name="notebook" size={15} /> : book.icon} {book.name}</> : "Notas"}</h2>
            {book && (
              <form action={createNote}>
                <input type="hidden" name="workspaceId" value={id} />
                <input type="hidden" name="notebookId" value={book.id} />
                <button className={s.add} aria-label="Nova nota" title="Nova nota"><Icon name="plus" size={16} /></button>
              </form>
            )}
          </div>
          <ul className={s.list}>
            {v.notes.length === 0 && <li className={s.blank} style={{ padding: 20 }}><span>Nenhuma nota neste caderno.</span></li>}
            {v.notes.map((n) => (
              <li key={n.id}>
                <Link href={`${base}?c=${book!.id}&n=${n.id}`} className={`${s.page} ${n.id === v.note?.id ? s.on : ""}`}>
                  <b>{n.title}</b>
                  {n.snippet && <small>{n.snippet}</small>}
                  <span className={s.meta}>
                    {day(n.updatedAt)}
                    {n.state === "expiring" && <span className={s.warnDot}>vence em breve</span>}
                    {n.state === "expired" && <span className={`${s.warnDot} ${s.late}`}>vencida</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Nota aberta */}
        <main className={s.main}>
          <div className={s.mainHead}>
            {book && <Link href={`${base}?c=${book.id}`} className={`${s.tool} ${s.back}`}><Icon name="back" size={14} /> {book.name}</Link>}
            <span className="grow" style={{ flex: 1 }} />
            {book && <Link href={`${here}&editar=1`} className={s.tool} scroll={false}><Icon name="edit" size={14} /> Caderno</Link>}
            <a href={book ? `${exportAll}&c=${book.id}` : exportAll} className={s.tool} download><Icon name="download" size={14} /> Baixar {book ? "caderno" : "tudo"}</a>
            {v.note && <Link href={`${here}&enviar=1`} className={s.tool} scroll={false}><Icon name="send" size={14} /> Enviar</Link>}
            {v.note && <Link href={`${here}&apagar-nota=1`} className={`${s.tool} ${s.toolDanger}`} scroll={false}><Icon name="trash" size={14} /> Apagar nota</Link>}
          </div>

          {warnCount > 0 && (
            <div className={s.banner} role="status">
              <Icon name="clock" size={16} />
              <span className="grow" style={{ flex: 1, minWidth: 220 }}>
                {warnCount === 1 ? "1 nota" : `${warnCount} notas`} {v.warning.expired ? `(${v.warning.expired} já ${v.warning.expired === 1 ? "vencida" : "vencidas"}) ` : ""}
                {warnCount === 1 ? "vai" : "vão"} vencer em até {NOTE_WARN_DAYS} dias. Nada é apagado sem você confirmar.
              </span>
              <Link href={`${here}&vencendo=1`} className={s.tool} scroll={false}>Ver e decidir</Link>
            </div>
          )}
          {q.mantidas && <p className={s.ok}>{q.mantidas === "1" ? "1 nota mantida" : `${q.mantidas} notas mantidas`} por mais {yearsLabel(NOTE_KEEP_MONTHS)}.</p>}
          {q.apagadas && <p className={s.ok}>{q.apagadas === "1" ? "1 nota apagada" : `${q.apagadas} notas apagadas`}.</p>}
          {q.prazo === "ok" && <p className={s.ok}>Prazo das notas atualizado.</p>}
          {q.enviada === "ok" && <p className={s.ok}>Anotação enviada. Quem recebeu vê a versão de agora; suas edições depois não mudam a dela.</p>}
          {(q.enviada === "erro" || q.enviada === "muitas") && <p className={s.banner}>{q.enviada === "muitas" ? "Muitos envios seguidos. Espere um pouco." : "Não deu para enviar para esse destino."}</p>}
          {q.erro === "limite" && <p className={s.banner}>Você chegou ao limite ({NOTE_LIMITS.notebooks} cadernos ou {NOTE_LIMITS.notesPerWorkspace} notas).</p>}

          {v.note ? (
            <NoteEditor key={v.note.id} workspaceId={id} note={v.note} />
          ) : (
            <div className={s.blank}>
              <Icon name="file" size={28} />
              <b>{book ? "Escolha uma nota ou crie uma nova" : "Escolha um caderno"}</b>
              <span>Cadernos são como canais, mas para anotações suas. Tudo fica só com você.</span>
              {book && (
                <form action={createNote}>
                  <input type="hidden" name="workspaceId" value={id} />
                  <input type="hidden" name="notebookId" value={book.id} />
                  <Button>Nova nota</Button>
                </form>
              )}
            </div>
          )}
        </main>
      </div>

      {q.novo && (
        <Modal title="Novo caderno" closeHref={here} icon="file">
          <form action={createNotebook} className={m.fg}>
            <input type="hidden" name="workspaceId" value={id} />
            <label className={m.f}>Nome<input className={m.in} name="name" required maxLength={NOTE_LIMITS.notebookName} placeholder="ex.: Estudos, Viagens, Receitas" autoFocus /></label>
            <IconChoice />
            <div className={m.df}><Link href={here}><Button type="button" variant="ghost">Cancelar</Button></Link><Button>Criar caderno</Button></div>
          </form>
        </Modal>
      )}

      {q.editar && book && (
        <Modal title="Caderno" sub={book.isDefault ? "Este é o caderno fixo: dá para renomear, mas não apagar." : undefined} closeHref={here} icon="edit">
          <form action={updateNotebook} className={m.fg}>
            <input type="hidden" name="workspaceId" value={id} />
            <input type="hidden" name="notebookId" value={book.id} />
            <label className={m.f}>Nome<input className={m.in} name="name" required maxLength={NOTE_LIMITS.notebookName} defaultValue={book.name} /></label>
            {!book.isDefault && <IconChoice current={book.icon} />}
            <div className={m.df}>
              {!book.isDefault && <Link href={`${base}?c=${book.id}&apagar=1`} className={s.tool + " " + s.toolDanger} style={{ marginRight: "auto" }}><Icon name="trash" size={14} /> Apagar caderno</Link>}
              <Link href={here}><Button type="button" variant="ghost">Cancelar</Button></Link><Button>Salvar</Button>
            </div>
          </form>
        </Modal>
      )}

      {q.apagar && book && !book.isDefault && (
        <Modal title={`Apagar “${book.name}”?`} sub="O caderno e todas as notas dele somem de vez. Baixe antes se quiser guardar." closeHref={`${base}?c=${book.id}`} icon="trash">
          <form action={deleteNotebook} className={m.fg}>
            <input type="hidden" name="workspaceId" value={id} />
            <input type="hidden" name="notebookId" value={book.id} />
            <a href={`${exportAll}&c=${book.id}`} className={s.tool} download style={{ alignSelf: "flex-start" }}><Icon name="download" size={14} /> Baixar este caderno (.md)</a>
            <label className={m.f}>Digite APAGAR para confirmar<input className={m.in} name="confirm" required pattern="APAGAR" autoComplete="off" /></label>
            <div className={m.df}><Link href={`${base}?c=${book.id}`}><Button type="button" variant="ghost">Cancelar</Button></Link><Button variant="danger">Apagar caderno</Button></div>
          </form>
        </Modal>
      )}

      {q.enviar && v.note && (
        <Modal title="Enviar anotação" sub="Vai como mensagem com o cartão da anotação. Quem recebe só lê a versão de agora; não cria cópia." closeHref={here} icon="send">
          {targets.people.length + targets.channels.length === 0 ? (
            <p className={m.sub}>Você ainda não está em nenhum workspace de equipe. Entre num para poder enviar.</p>
          ) : (
            <div className={m.fg}>
              {targets.people.length > 0 && (
                <form action={sendNoteToPerson} className={m.fg}>
                  <input type="hidden" name="workspaceId" value={id} />
                  <input type="hidden" name="noteId" value={v.note.id} />
                  <label className={m.f}>Para uma pessoa
                    <select className={m.in} name="to" required defaultValue="">
                      <option value="" disabled>Escolha</option>
                      {targets.people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className={m.f}>Mensagem (opcional)<input className={m.in} name="text" maxLength={500} placeholder="ex.: dá uma olhada no fluxo" /></label>
                  <div className={m.df} style={{ marginTop: 4 }}><Button>Enviar para a pessoa</Button></div>
                </form>
              )}
              {targets.channels.length > 0 && (
                <form action={sendNoteToChannel} className={m.fg} style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <input type="hidden" name="workspaceId" value={id} />
                  <input type="hidden" name="noteId" value={v.note.id} />
                  <label className={m.f}>Para um canal (equipe)
                    <select className={m.in} name="to" required defaultValue="">
                      <option value="" disabled>Escolha</option>
                      {targets.channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className={m.f}>Mensagem (opcional)<input className={m.in} name="text" maxLength={500} placeholder="ex.: guia do git flow para o time" /></label>
                  <div className={m.df} style={{ marginTop: 4 }}><Button>Enviar para o canal</Button></div>
                </form>
              )}
            </div>
          )}
        </Modal>
      )}

      {q["apagar-nota"] && v.note && (
        <Modal title="Apagar esta nota?" sub="Ela some de vez." closeHref={here} icon="trash">
          <form action={deleteNote} className={m.fg}>
            <input type="hidden" name="workspaceId" value={id} />
            <input type="hidden" name="noteId" value={v.note.id} />
            <div className={m.df}><Link href={here}><Button type="button" variant="ghost">Cancelar</Button></Link><Button variant="danger">Apagar nota</Button></div>
          </form>
        </Modal>
      )}

      {q.prazo === "1" && (
        <Modal title="Por quanto tempo guardar as notas?" sub="Conta da última edição de cada nota. Antes de vencer, você recebe um aviso e decide: baixar, manter ou apagar." closeHref={here} icon="clock">
          <form action={setNoteRetention} className={m.fg}>
            <input type="hidden" name="workspaceId" value={id} />
            <div className={m.opts}>
              {NOTE_RETENTION_OPTIONS.map((mo) => (
                <label key={mo} className={m.opt}>
                  <input type="radio" name="months" value={mo} defaultChecked={mo === v.months} /><span className={m.rd} />
                  <span>{yearsLabel(mo)}{mo === 12 && <small>Mínimo</small>}</span>
                </label>
              ))}
            </div>
            <p className={m.sub}>Diminuir o prazo não apaga nada: as notas que passarem do novo prazo entram no aviso.</p>
            <div className={m.df}><Link href={here}><Button type="button" variant="ghost">Cancelar</Button></Link><Button>Salvar prazo</Button></div>
          </form>
        </Modal>
      )}

      {q.vencendo && (
        <Modal title="Notas perto de vencer" sub={`Vencem em até ${NOTE_WARN_DAYS} dias ou já venceram. Nada é apagado sem você confirmar.`} closeHref={here} icon="clock" width={600}>
          {warnList.length === 0 ? (
            <p className={m.sub}>Nenhuma nota perto de vencer. 🎉</p>
          ) : (
            <>
              <ul className={s.warnList}>
                {warnList.map((n) => (
                  <li key={n.id}>
                    <b>{n.title || "Sem título"}</b>
                    <small style={{ color: "var(--text-faint)" }}>{n.notebook.name}</small>
                    <span>{n.state === "expired" ? "venceu" : "vence"} {day(n.expiresAt.toISOString())}</span>
                  </li>
                ))}
              </ul>
              <div className={m.fg}>
                <a href={`${exportAll}&f=vencendo`} className={s.tool} download style={{ alignSelf: "flex-start" }}><Icon name="download" size={14} /> 1. Baixar estas notas (.md)</a>
                <form action={keepWarnedNotes}>
                  <input type="hidden" name="workspaceId" value={id} />
                  <Button variant="ghost">2. Manter todas por mais {yearsLabel(NOTE_KEEP_MONTHS)}</Button>
                </form>
                <p className={m.sub}>Quer guardar por mais tempo sempre? <Link href={`${here}&prazo=1`}>Aumente o prazo das notas</Link>.</p>
                <form action={deleteWarnedNotes} className={m.fg}>
                  <input type="hidden" name="workspaceId" value={id} />
                  <label className={m.f}>3. Ou apague: digite APAGAR para confirmar<input className={m.in} name="confirm" required pattern="APAGAR" autoComplete="off" /></label>
                  <div className={m.df}><Button variant="danger">Apagar {warnList.length === 1 ? "esta nota" : `estas ${warnList.length} notas`}</Button></div>
                </form>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
