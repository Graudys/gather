"use client";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createTaskFromMessage, listTaskTargets, type TaskTarget } from "@/_data/chat-tasks.actions";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/chat/Chat.module.css";

const ERR: Record<string, string> = { muitas: "Muitas tarefas seguidas. Espere um pouco.", apagada: "Essa mensagem foi apagada.", dados: "Confira o título e o projeto." };

/** Botão na barra da mensagem: cria uma tarefa com o texto dela; o cartão aparece na conversa. */
export function TaskFromMessage({ workspaceId, messageId, text, className }: { workspaceId: string; messageId: string; text: string; className: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<TaskTarget[] | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const title = text.replace(/\s+/g, " ").trim().slice(0, 200);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listTaskTargets({ workspaceId, messageId }).then((t) => alive && setTargets(t));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => { alive = false; document.removeEventListener("keydown", onKey); };
  }, [open, workspaceId, messageId]);

  const submit = (form: FormData) => start(async () => {
    setErr("");
    const r = await createTaskFromMessage({
      workspaceId, messageId,
      projectId: form.get("projectId"), title: form.get("title"),
      priority: form.get("priority") || undefined, dueAt: form.get("dueAt") || "",
    });
    if (!r.ok) return setErr(ERR[r.error] ?? ERR.dados);
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <button type="button" className={className} onClick={() => { setErr(""); setTargets(null); setOpen(true); }} title="Criar tarefa com esta mensagem" aria-label="Criar tarefa com esta mensagem">
        <Icon name="task" />
      </button>
      {open && createPortal(
        <div className={s.tfBack} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form className={s.tfBox} action={submit} role="dialog" aria-modal="true" aria-label="Criar tarefa">
            <h2>Criar tarefa com esta mensagem</h2>
            <label>Título<input name="title" defaultValue={title || "Nova tarefa"} maxLength={200} required autoFocus /></label>
            <label>Projeto
              {targets === null ? <select disabled><option>Carregando…</option></select> : targets.length === 0 ? (
                <span className={s.tfErr}>Você não participa de nenhum projeto ativo neste workspace.</span>
              ) : (
                <select name="projectId" defaultValue={targets[0].id}>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.name}{t.suggested ? " (projeto do canal)" : ""}</option>)}
                </select>
              )}
            </label>
            <div className={s.tfTwo}>
              <label>Prioridade
                <select name="priority" defaultValue="MEDIUM">
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Média</option>
                  <option value="LOW">Baixa</option>
                </select>
              </label>
              <label>Prazo<input type="date" name="dueAt" min={today} /></label>
            </div>
            <small style={{ color: "var(--text-muted)", fontSize: 12.5 }}>A tarefa entra na primeira coluna, com o texto da mensagem na descrição. O cartão aparece aqui na conversa.</small>
            {err && <p className={s.tfErr} role="alert">{err}</p>}
            <div className={s.tfRow}>
              <button type="button" className={s.tfGhost} onClick={() => setOpen(false)}>Cancelar</button>
              <button className={s.tfBtn} disabled={pending || !targets?.length}>{pending ? "Criando…" : "Criar tarefa"}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
