-- Gather — consultas usadas pelas rotinas /api/cron/* (só service_role).
-- O banco diz O QUE vencer; o servidor apaga os arquivos no Storage e
-- encerra salas no LiveKit, que o SQL não alcança.

CREATE OR REPLACE FUNCTION public.expired_chat_files(lim int DEFAULT 500)
RETURNS TABLE (id uuid, storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.id, a.storage_path
  FROM public.message_attachments a
  JOIN public.messages m ON m.id = a.message_id
  JOIN public.workspace_settings s ON s.workspace_id = m.workspace_id
  WHERE a.expired_at IS NULL AND a.created_at < now() - make_interval(hours => s.file_retention_hours)
  ORDER BY a.created_at
  LIMIT lim
$$;

CREATE OR REPLACE FUNCTION public.closed_ticket_files(lim int DEFAULT 500)
RETURNS TABLE (id uuid, storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.id, a.storage_path
  FROM public.support_attachments a
  JOIN public.support_tickets t ON t.id = a.ticket_id
  WHERE a.deleted_at IS NULL AND t.status IN ('RESOLVED', 'CLOSED_NO_REPLY')
  LIMIT lim
$$;

-- Reuniões que precisam acabar: passou do horário-limite ou acabou a cota do mês.
CREATE OR REPLACE FUNCTION public.meetings_to_end()
RETURNS TABLE (id uuid, room_key text, reason public."MeetingEndReason")
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.id, m.room_key,
         CASE WHEN m.hard_end_at < now() THEN 'MAX_DURATION'::public."MeetingEndReason"
              ELSE 'QUOTA_EXHAUSTED'::public."MeetingEndReason" END
  FROM public.meetings m
  JOIN public.workspace_settings s ON s.workspace_id = m.workspace_id
  CROSS JOIN public.platform_config c
  LEFT JOIN public.workspace_meeting_usage u ON u.workspace_id = m.workspace_id AND u.month = date_trunc('month', now())::date
  WHERE c.id = 1 AND m.status = 'LIVE'
    AND (m.hard_end_at < now()
         OR coalesce(u.minutes_used, 0) >= coalesce(s.call_minutes_quota, c.call_minutes_per_workspace))
$$;

-- Contas com exclusão pedida há mais de 30 dias.
CREATE OR REPLACE FUNCTION public.accounts_to_delete(lim int DEFAULT 100)
RETURNS TABLE (id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.status = 'DELETION_SCHEDULED' AND p.deletion_requested_at < now() - interval '30 days'
  LIMIT lim
$$;

REVOKE ALL ON FUNCTION public.expired_chat_files(int), public.closed_ticket_files(int), public.meetings_to_end(), public.accounts_to_delete(int)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expired_chat_files(int), public.closed_ticket_files(int), public.meetings_to_end(), public.accounts_to_delete(int)
  TO service_role;
