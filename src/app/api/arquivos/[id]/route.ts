import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/_lib/db/prisma";
import { requireChannel, requireConversation } from "@/_data/chat.access";
import { requireTask } from "@/_data/projects.access";
import { signDownload } from "@/_lib/server/storage";
import { id as Id } from "@/lib/validation";

/**
 * Abre um arquivo: confere se a pessoa ainda tem acesso ao canal, conversa
 * ou tarefa e manda para um link assinado que vale 1 minuto.
 * ?k=t para anexo de tarefa; ?baixar=1 para baixar em vez de abrir.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/arquivos/[id]">) {
  const { id } = await params;
  if (!Id.safeParse(id).success) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const task = req.nextUrl.searchParams.get("k") === "t";
  const download = req.nextUrl.searchParams.get("baixar") === "1";

  let path: string | null = null;
  let name = "arquivo";
  if (task) {
    const a = await db.taskAttachment.findUnique({ where: { id }, select: { storagePath: true, fileName: true, taskId: true, task: { select: { project: { select: { team: { select: { workspaceId: true } } } } } } } });
    if (!a) return new NextResponse("Arquivo não encontrado.", { status: 404 });
    await requireTask(a.task.project.team.workspaceId, a.taskId);
    path = a.storagePath;
    name = a.fileName;
  } else {
    const a = await db.messageAttachment.findUnique({ where: { id }, select: { storagePath: true, fileName: true, message: { select: { workspaceId: true, channelId: true, conversationId: true, deletedAt: true } } } });
    if (!a || a.message.deletedAt) return new NextResponse("Arquivo não encontrado.", { status: 404 });
    if (a.message.channelId) await requireChannel(a.message.workspaceId, a.message.channelId);
    else await requireConversation(a.message.workspaceId, a.message.conversationId!);
    if (!a.storagePath) return new NextResponse("Este arquivo passou do prazo do workspace e foi apagado.", { status: 410 });
    path = a.storagePath;
    name = a.fileName;
  }
  const url = await signDownload(path, download ? name : undefined);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
