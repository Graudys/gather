"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { listChannelsForTask, sendTaskToChannel } from "@/_data/chat-tasks.actions";
import s from "@/_styles/projects/Board.module.css";
import c from "@/_styles/chat/Chat.module.css";

type Ch = { id: string; name: string; icon: string | null; visibility: string };

/** No painel da tarefa: manda o cartão da tarefa para um canal. */
export function SendTaskToChannel({ workspaceId, taskId, onClose }: { workspaceId: string; taskId: string; onClose: () => void }) {
  // Abre já aberto: quem mostra/esconde é o botão no topo do painel
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<Ch[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || list) return;
    let alive = true;
    void listChannelsForTask({ workspaceId }).then((l) => alive && setList(l));
    return () => { alive = false; };
  }, [open, list, workspaceId]);

  if (done) return <p className={s.muted}>Enviada. <Link href={done}>Abrir o canal</Link> · <button type="button" className={s.linkBtn} onClick={onClose}>Fechar</button></p>;
  if (!open) return null;

  const submit = (form: FormData) => start(async () => {
    setErr("");
    const r = await sendTaskToChannel({ workspaceId, taskId, channelId: form.get("channelId"), text: form.get("text") || undefined });
    if (r.ok) setDone(r.href);
    else setErr(r.error === "muitas" ? "Muitas mensagens seguidas. Espere um pouco." : "Não deu para enviar.");
  });

  return (
    <form action={submit} className={`${s.section} ${c.tfBox}`} style={{ boxShadow: "none", width: "100%" }}>
      <h2>Enviar pro canal</h2>
      <label>Canal
        {list === null ? <select disabled><option>Carregando…</option></select> : list.length === 0 ? <span className={c.tfErr}>Nenhum canal disponível.</span> : (
          <select name="channelId" defaultValue={list[0].id}>
            {list.map((ch) => <option key={ch.id} value={ch.id}>{ch.visibility === "PRIVATE" ? "🔒 " : "# "}{ch.icon ? `${ch.icon} · ` : ""}{ch.name}</option>)}
          </select>
        )}
      </label>
      <label>Mensagem (opcional)<input name="text" maxLength={500} placeholder="Ex.: alguém pega essa?" /></label>
      <small className={s.muted}>Vai um cartão com o estado atual da tarefa. Quem não participa do projeto vê só que é uma tarefa privada.</small>
      {err && <p className={c.tfErr} role="alert">{err}</p>}
      <div className={c.tfRow}>
        <button type="button" className={c.tfGhost} onClick={() => { setOpen(false); onClose(); }}>Cancelar</button>
        <button className={c.tfBtn} disabled={pending || !list?.length}>{pending ? "Enviando…" : "Enviar"}</button>
      </div>
    </form>
  );
}
