"use client";
import { useState } from "react";

/** Caixinha "Concluir": marca na hora e grava em segundo plano. */
export function DoneBox({ action, workspaceId, taskId, title, done = false }: { action: (f: FormData) => Promise<void>; workspaceId: string; taskId: string; title: string; done?: boolean }) {
  const [on, setOn] = useState(done);
  return (
    <input
      type="checkbox"
      checked={on}
      aria-label={`Concluir: ${title}`}
      style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", flex: "none" }}
      onChange={() => {
        setOn(!on);
        const f = new FormData();
        f.set("workspaceId", workspaceId);
        f.set("taskId", taskId);
        void action(f);
      }}
    />
  );
}
