"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Orbi } from "@/_components/help/Orbi";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { askOrbi, orbiFeedback, sendQuestionToAdmin, type OrbiAnswer } from "@/_data/help.actions";
import s from "@/_styles/help/Orbi.module.css";

type Turn = { q: string; a: OrbiAnswer | null; voted?: boolean; sent?: boolean };

const SUGGESTIONS = ["Como adiciono pessoas?", "Por quanto tempo as mensagens ficam?", "Como crio uma tarefa?"];
const TOPICS: [IconName, string][] = [["home", "Primeiros passos"], ["chat", "Chat"], ["task", "Projetos e tarefas"], ["cal", "Agenda e reuniões"], ["user", "Conta e acesso"], ["help", "Todos os artigos"]];

/** Painel do Orbi (mockups "OrbiChatbot" e "OrbiAjuda"): assuntos, atalhos e conversa. */
export function OrbiChat({ name, onClose, initial }: { name: string; onClose: () => void; initial?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const ws = /^\/app\/w\/([0-9a-f-]{36})/.exec(path)?.[1];
  const first = name.split(" ")[0];

  async function ask(q: string) {
    q = q.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setTurns((t) => [...t, { q, a: null }]);
    if (input.current) input.current.value = "";
    const a = await askOrbi(q);
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
    setBusy(false);
  }
  const patch = (i: number, p: Partial<Turn>) => setTurns((t) => t.map((x, j) => (j === i ? { ...x, ...p } : x)));

  useEffect(() => {
    input.current?.focus();
    if (!initial) return;
    const t = setTimeout(() => void ask(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns]);

  return (
    <div className={s.panel} role="dialog" aria-label="Ajuda do Gather">
      <div className={s.head}>
        <Orbi mood={busy ? "procurando" : "feliz"} size={36} />
        <div className={s.grow}>
          <b>Orbi</b>
          <div className={s.mut}>Ajuda do Gather</div>
        </div>
        {turns.length > 0 && <button className={s.ic} onClick={() => setTurns([])} aria-label="Voltar ao início" title="Voltar ao início"><Icon name="home" size={16} /></button>}
        <button className={s.ic} onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
      </div>

      <div className={s.body} aria-live="polite">
        {turns.length === 0 ? (
          <>
            <b className={s.hello}>Oi, {first}! Como posso ajudar?</b>
            <div className={s.chips}>
              {SUGGESTIONS.map((q) => <button key={q} className={s.chip} onClick={() => ask(q)}>{q}</button>)}
            </div>
            <div className={s.pl}>Assuntos</div>
            <div className={s.topics}>
              {TOPICS.map(([icon, label]) => (
                <Link key={label} href={label === "Todos os artigos" ? "/app/ajuda" : `/app/ajuda?q=${encodeURIComponent(label.split(" ")[0]!)}`} className={s.topic} onClick={onClose}>
                  <Icon name={icon} size={15} /> {label}
                </Link>
              ))}
            </div>
            {ws && (
              <>
                <div className={s.pl}>Fazer agora</div>
                <div className={s.actions}>
                  <Link href={`/app/w/${ws}/tarefas?nova=1`} className={s.mi} onClick={onClose}><Icon name="task" /> <span className={s.grow}>Criar uma tarefa</span><Icon name="right" size={14} /></Link>
                  <Link href={`/app/w/${ws}/agenda/novo`} className={s.mi} onClick={onClose}><Icon name="cal" /> <span className={s.grow}>Marcar um evento</span><Icon name="right" size={14} /></Link>
                  <Link href={`/app/w/${ws}/configuracoes?aba=membros`} className={s.mi} onClick={onClose}><Icon name="users" /> <span className={s.grow}>Adicionar pessoas</span><Icon name="right" size={14} /></Link>
                  <Link href={`/app/w/${ws}/configuracoes?aba=retencao`} className={s.mi} onClick={onClose}><Icon name="clock" /> <span className={s.grow}>Mudar o prazo das mensagens</span><Icon name="right" size={14} /></Link>
                </div>
              </>
            )}
          </>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={s.turn}>
              <div className={s.me}>{t.q}</div>
              {t.a === null ? (
                <div className={s.typing}><span className={s.dots}><i /><i /><i /></span> Orbi está escrevendo</div>
              ) : t.a.found ? (
                <>
                  <div className={s.bot}><b>{t.a.title}</b><span>{t.a.summary}</span></div>
                  {t.a.actionPath && t.a.actionLabel && <Link className={s.btn} href={t.a.actionPath} onClick={onClose}><Icon name="right" size={14} /> {t.a.actionLabel}</Link>}
                  <Link className={s.lk} href={`/app/ajuda/${t.a.slug}`} onClick={onClose}><Icon name="help" size={13} /> Do artigo: {t.a.title}</Link>
                  {!t.voted ? (
                    <div className={s.vote}>
                      Isso ajudou?
                      <button className={s.btn2} onClick={() => { void orbiFeedback((t.a as { questionId: string }).questionId, true); patch(i, { voted: true }); }}>Sim</button>
                      <button className={s.btn2} onClick={() => { void orbiFeedback((t.a as { questionId: string }).questionId, false); patch(i, { voted: true, sent: false }); }}>Não</button>
                    </div>
                  ) : <SendToAdmin turn={t} onSent={() => patch(i, { sent: true })} soft />}
                </>
              ) : (
                <>
                  <div className={s.bot}>Ainda não tenho uma resposta para isso. Posso mandar sua pergunta para o admin do Gather, com o seu nome, para ele te responder.</div>
                  <SendToAdmin turn={t} onSent={() => patch(i, { sent: true })} />
                </>
              )}
            </div>
          ))
        )}
        <div ref={end} />
      </div>

      <form className={s.foot} onSubmit={(e) => { e.preventDefault(); void ask(input.current?.value ?? ""); }}>
        <input ref={input} className={s.in} placeholder="Pergunte algo" maxLength={300} aria-label="Pergunta para o Orbi" />
        <button className={s.send} disabled={busy} aria-label="Enviar"><Icon name="right" size={16} /></button>
      </form>
      <div className={s.disclaimer}>O Orbi responde com base na Central de ajuda. Ele não lê suas mensagens.</div>
    </div>
  );
}

function SendToAdmin({ turn, onSent, soft }: { turn: Turn; onSent: () => void; soft?: boolean }) {
  if (turn.sent) return <div className={s.note}><Icon name="check" size={14} /> Mandei para o admin. A resposta chega no sino.</div>;
  return (
    <div className={s.adminRow}>
      {soft && <span className={s.mut}>Quer mandar a pergunta para o admin?</span>}
      <button
        className={soft ? s.btn2 : s.btn}
        onClick={async () => {
          await sendQuestionToAdmin(turn.a?.questionId ?? null, turn.q);
          onSent();
        }}
      >
        <Icon name="mail" size={14} /> Mandar para o admin
      </button>
    </div>
  );
}
