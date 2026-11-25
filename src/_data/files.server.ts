import "server-only";
import { db } from "@/_lib/db/prisma";
import { readTicket } from "@/_lib/server/upload-ticket";
import { listFolder, moveObject, objectInfo, removeObjects } from "@/_lib/server/storage";
import { MAX_FILE_BYTES } from "@/lib/files";

export type Landed = { path: string; name: string; mime: string; size: number };

/**
 * 2º passo: confere os recibos, vê se o arquivo chegou mesmo (e o tamanho real)
 * e move de "pendente/" para o lugar definitivo. Recibo ruim é ignorado.
 */
export async function landFiles(tickets: string[], expect: { w: string; u: string; d: string }, folder: string): Promise<Landed[]> {
  const out: Landed[] = [];
  for (const raw of tickets.slice(0, 10)) {
    const t = readTicket(raw, expect);
    if (!t) continue;
    const info = await objectInfo(t.p);
    if (!info || info.size <= 0 || info.size > MAX_FILE_BYTES) {
      await removeObjects([t.p]);
      continue;
    }
    const uuid = t.p.split("/").at(-2)!;
    const final = `ws/${t.w}/${folder}/${uuid}/${t.p.split("/").at(-1)}`;
    await moveObject(t.p, final);
    out.push({ path: final, name: t.n, mime: info.mime, size: info.size });
  }
  return out;
}


/** Caminhos dos arquivos que vão sumir junto com mensagens/tarefas apagadas (cascade). */
export async function filesOf(where: { workspaceId?: string; projectId?: string; taskId?: string }) {
  const [m, t] = await Promise.all([
    where.workspaceId ? db.messageAttachment.findMany({ where: { message: { workspaceId: where.workspaceId } }, select: { storagePath: true } }) : Promise.resolve([]),
    db.taskAttachment.findMany({
      where: where.taskId ? { taskId: where.taskId } : where.projectId ? { task: { projectId: where.projectId } } : { task: { project: { team: { workspaceId: where.workspaceId } } } },
      select: { storagePath: true },
    }),
  ]);
  return [...m.map((x) => x.storagePath), ...t.map((x) => x.storagePath)];
}

/**
 * Rotina diária:
 * 1. arquivos do chat que passaram do prazo do workspace somem (a mensagem fica, com "Arquivo expirado");
 * 2. envios que ficaram em "pendente/" (a pessoa desistiu) de dias anteriores são apagados.
 */
export async function cleanupFiles(now = new Date()) {
  const due = await db.$queryRaw<{ id: string; storage_path: string }[]>`
    select a.id, a.storage_path
    from message_attachments a
    join messages m on m.id = a.message_id
    join workspace_settings s on s.workspace_id = m.workspace_id
    where a.storage_path is not null
      and a.created_at < ${now}::timestamptz - make_interval(hours => s.file_retention_hours)
    limit 5000`;
  if (due.length) {
    await removeObjects(due.map((d) => d.storage_path));
    await db.messageAttachment.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { storagePath: null, expiredAt: now } });
  }

  let pending = 0;
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const workspaces = await listFolder("ws");
  for (const w of workspaces) {
    const days = await listFolder(`ws/${w.name}/pendente`);
    for (const d of days.filter((x) => x.name < today)) {
      const uploads = await listFolder(`ws/${w.name}/pendente/${d.name}`);
      const paths: string[] = [];
      for (const u of uploads) for (const f of await listFolder(`ws/${w.name}/pendente/${d.name}/${u.name}`)) paths.push(`ws/${w.name}/pendente/${d.name}/${u.name}/${f.name}`);
      pending += await removeObjects(paths);
    }
  }
  return { expired: due.length, pending };
}
