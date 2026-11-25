import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getAppShell } from "@/_data/shell";
import { ShellProvider, RememberWorkspace } from "@/_components/shell/ShellContext";
import { Sidebar } from "@/_components/shell/Sidebar";
import { Topbar } from "@/_components/shell/Topbar";
import { MobileTabs } from "@/_components/shell/MobileTabs";
import { NewWorkspaceDialog } from "@/_components/shell/NewWorkspaceDialog";
import s from "@/_styles/shell/Shell.module.css";

/**
 * Casca do app (mockup): barra lateral fixa + topo + conteúdo.
 * A janela não rola: só a barra lateral e a área de conteúdo têm rolagem própria.
 */
export async function AppShell({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  const [data, jar] = await Promise.all([getAppShell(workspaceId), cookies()]);
  return (
    <ShellProvider>
      {workspaceId && <RememberWorkspace id={workspaceId} />}
      <div className={s.app}>
        <Sidebar data={data} startCollapsed={jar.get("gather.sb")?.value === "1"} />
        <div className={s.col}>
          <Topbar data={data} />
          <main className={s.main} id="conteudo">{children}</main>
          <MobileTabs data={data} />
        </div>
      </div>
      <NewWorkspaceDialog opts={data.createWs} />
    </ShellProvider>
  );
}
