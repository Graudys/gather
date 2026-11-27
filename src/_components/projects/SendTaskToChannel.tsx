"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { listChannelPeople, listChannelsForTask, sendTaskToChannel } from "@/_data/chat-tasks.actions";
import { MentionInput, type MentionPerson } from "@/_components/ui/MentionInput";
import s from "@/_styles/projects/Board.module.css";
import c from "@/_styles/chat/Chat.module.css";

type Ch = { id: string; name: string; icon: string | null; visibility: string };

/** No painel da tarefa: manda o cartão da tarefa para um canal. */
export function SendTaskToChannel({ workspaceId, taskId, onClose, assignees, high }: {
  workspaceId: string;
  taskId: string;
  onClose: () => void;
  assignees: { id: string; name: string }[];
  high: boolean;
}) {
  // Abre já aberto: quem mostra/esconde é o botão no topo do painel
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<Ch[] | null>(null);
  const [done, setDone] = useState<{ href: string; called: number } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const [channel, setChannel] = useState("");
  const [people, setPeople] = useState<MentionPerson[]>([]);
  // A lista do @ muda com o canal: só aparece quem enxerga o canal escolhido
  const chosen = channel || list?.[0]?.id || "";
  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    listChannelPeople({ workspaceId, channelId: chosen })
      .then((p) => alive && setPeople(p))
      .catch(() => alive && setPeople([])); // sem lista, o campo funciona como texto comum
    return () => { alive = false; };
  }, [chosen, workspaceId]);

  useEffect(() => {
    if (!open || list) return;
    let alive = true;
    void listChannelsForTask({ workspaceId }).then((l) => alive && setList(l));
    return () => { alive = false; };
  }, [open, list, workspaceId]);

  if (done) {
    return (
      <p className={s.muted}>
        Enviada{done.called ? ` e ${done.called === 1 ? "1 pessoa avisada" : `${done.called} pessoas avisadas`}` : ""}.{" "}
        <Link href={done.href}>Abrir o canal</Link> · <button type="button" className={s.linkBtn} onClick={onClose}>Fechar</button>
      </p>
    );
  }
  if (!open) return null;

  const submit = (form: FormData) => start(async () => {
    setErr("");
    const r = await sendTaskToChannel({
      workspaceId, taskId, channelId: form.get("channelId"), text: form.get("text") || undefined,
      callAssignees: form.get("call") === "on", urgent: form.get("urgent") === "on",
    });
    if (r.ok) setDone({ href: r.href, called: r.called });
    else setErr(r.error === "muitas" ? "Muitas mensagens seguidas. Espere um pouco." : "Não deu para enviar.");
  });

  return (
    <form action={submit} className={`${s.section} ${c.tfBox}`} style={{ boxShadow: "none", width: "100%" }}>
      <h2>Enviar pro canal</h2>
      <label>Canal
        {list === null ? <select disabled><option>Carregando…</option></select> : list.length === 0 ? <span className={c.tfErr}>Nenhum canal disponível.</span> : (
          <select name="channelId" value={chosen} onChange={(e) => setChannel(e.target.value)}>
            {list.map((ch) => <option key={ch.id} value={ch.id}>{ch.visibility === "PRIVATE" ? "🔒 " : "# "}{ch.icon ? `${ch.icon} · ` : ""}{ch.name}</option>)}
          </select>
        )}
      </label>
      <label>Mensagem (opcional)<MentionInput name="text" people={people} maxLength={500} placeholder="Ex.: @fulano consegue pegar essa?" /></label>
      {assignees.length > 0 && (
        <label className={c.tfCheck}>
          <input type="checkbox" name="call" defaultChecked />
          <span>Avisar {assignees.length === 1 ? "o responsável" : "os responsáveis"} ({assignees.map((a) => a.name.split(" ")[0]).join(", ")}): marca com @ e chega no sino e no celular</span>
        </label>
      )}
      {!high && (
        <label className={c.tfCheck}>
          <input type="checkbox" name="urgent" />
          <span>É urgente: muda a prioridade para Alta</span>
        </label>
      )}
      <small className={s.muted}>Vai um cartão com o estado atual da tarefa. Quem não participa do projeto vê só que é uma tarefa privada.</small>
      {err && <p className={c.tfErr} role="alert">{err}</p>}
      <div className={c.tfRow}>
        <button type="button" className={c.tfGhost} onClick={() => { setOpen(false); onClose(); }}>Cancelar</button>
        <button className={c.tfBtn} disabled={pending || !list?.length}>{pending ? "Enviando…" : "Enviar"}</button>
      </div>
    </form>
  );
}
