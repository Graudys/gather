import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { getSessionUser } from "@/_lib/auth/dal";

/**
 * "Pulso": uma consulta leve que diz se algo mudou para esta pessoa.
 * O navegador pergunta a cada poucos segundos e só recarrega a tela quando
 * o valor muda (antes recarregava a página inteira toda vez).
 * Só conta o que a pessoa pode ver: canais públicos ou dela, conversas dela,
 * projetos de equipes visíveis.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const ws = z.uuid().safeParse(new URL(req.url).searchParams.get("w"));
  const w = ws.success ? ws.data : null;
  const rows = await db.$queryRaw<{ v: string | null }[]>`
    select concat_ws('|',
      (select count(*) || ':' || coalesce(max(created_at)::text, '') from notifications where user_id = ${user.id}::uuid and read_at is null),
      case when ${w}::uuid is null then null else (
        select concat_ws('|',
          (select max(greatest(m.created_at, coalesce(m.edited_at, m.created_at), coalesce(m.deleted_at, m.created_at)))::text || count(*)::text
             from messages m
             left join channels c on c.id = m.channel_id
             where m.workspace_id = ${w}::uuid
               and m.created_at > now() - interval '30 days'
               and (
                 (c.id is not null and (c.visibility = 'PUBLIC' or exists (select 1 from channel_members cm where cm.channel_id = c.id and cm.user_id = ${user.id}::uuid)))
                 or exists (select 1 from conversation_members vm where vm.conversation_id = m.conversation_id and vm.user_id = ${user.id}::uuid)
               )),
          (select count(*)::text || max(created_at)::text from message_reactions r join messages m2 on m2.id = r.message_id where m2.workspace_id = ${w}::uuid and m2.created_at > now() - interval '30 days'),
          (select max(updated_at)::text from channels where workspace_id = ${w}::uuid),
          (select max(t.updated_at)::text || count(*)::text from tasks t join projects p on p.id = t.project_id join teams tm on tm.id = p.team_id
             where tm.workspace_id = ${w}::uuid and (tm.visibility = 'WORKSPACE' or exists (select 1 from team_members x where x.team_id = tm.id and x.user_id = ${user.id}::uuid))),
          (select max(tc.created_at)::text from task_comments tc join tasks t2 on t2.id = tc.task_id join projects p2 on p2.id = t2.project_id join teams tm2 on tm2.id = p2.team_id where tm2.workspace_id = ${w}::uuid),
          (select max(updated_at)::text from calendar_events where workspace_id = ${w}::uuid),
          (select max(greatest(coalesce(mp.joined_at, 'epoch'), coalesce(mp.left_at, 'epoch')))::text from meeting_participants mp join meetings mt on mt.id = mp.meeting_id where mt.workspace_id = ${w}::uuid),
          (select max(coalesce(ended_at, started_at, created_at))::text || string_agg(status::text, '') from meetings where workspace_id = ${w}::uuid and created_at > now() - interval '2 days'),
          (select max(mn.updated_at)::text from meeting_notes mn join meetings mt2 on mt2.id = mn.meeting_id where mt2.workspace_id = ${w}::uuid)
        )
      ) end
    ) as v`;
  return NextResponse.json({ v: rows[0]?.v ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
