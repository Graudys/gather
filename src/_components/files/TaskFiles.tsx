"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { attachToTask, removeTaskAttachment } from "@/_data/files.actions";
import { AttachDialog } from "@/_components/files/AttachDialog";
import { FileList } from "@/_components/files/FileList";
import { Icon } from "@/_components/ui/Icon";
import type { FileView } from "@/types/domain";
import s from "@/_styles/files/Files.module.css";

/** Anexos da tarefa (mockup "Tarefa" › Anexos). Ficam enquanto a tarefa existir. */
export function TaskFiles({ workspaceId, taskId, files, canManage }: { workspaceId: string; taskId: string; files: (FileView & { mine: boolean })[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const mineOrManager = new Set(files.filter((f) => f.mine || canManage).map((f) => f.id));
  return (
    <div>
      <div className={s.taskHead}>
        <span className={s.taskTitle}>Anexos{files.length ? ` · ${files.length}` : ""}</span>
        <button type="button" className={s.addBtn} onClick={() => setOpen(true)}><Icon name="clip" size={14} /> Anexar</button>
      </div>
      {files.length === 0 ? (
        <button type="button" className={s.emptyDrop} onClick={() => setOpen(true)}>Nenhum anexo. Clique para anexar arquivos ou fotos.</button>
      ) : (
        <FileList
          files={files}
          task
          onRemove={(id) =>
            mineOrManager.has(id) ? (
              <button
                type="button"
                className={s.rm}
                disabled={busy === id}
                aria-label="Remover anexo"
                title="Remover anexo"
                onClick={async () => {
                  setBusy(id);
                  const fd = new FormData();
                  fd.set("workspaceId", workspaceId);
                  fd.set("taskId", taskId);
                  fd.set("attachmentId", id);
                  await removeTaskAttachment(fd);
                  setBusy(null);
                  router.refresh();
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            ) : null
          }
        />
      )}
      {open && (
        <AttachDialog
          workspaceId={workspaceId}
          dest={`t:${taskId}`}
          where="Na tarefa"
          initial={[]}
          sendLabel="Anexar"
          note="Anexos de tarefa ficam guardados enquanto a tarefa existir."
          onClose={() => setOpen(false)}
          onSend={async (tickets) => {
            const fd = new FormData();
            fd.set("workspaceId", workspaceId);
            fd.set("taskId", taskId);
            tickets.forEach((t) => fd.append("files", t));
            await attachToTask(fd);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
