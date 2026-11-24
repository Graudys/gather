-- Gather — dados iniciais, buckets do Storage, tempo real e rotinas agendadas.

-- ═══════════════════════════════════════════════════════════════════════
-- Configuração da plataforma (linha única) e documentos legais iniciais
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO legal_documents (type, version, summary, published_at, effective_at)
SELECT t::"LegalDocType", 1, 'Primeira versão', now(), now()
FROM unnest(ARRAY['TERMS', 'PRIVACY_POLICY']) t
WHERE NOT EXISTS (SELECT 1 FROM legal_documents);

-- ═══════════════════════════════════════════════════════════════════════
-- Storage: tudo privado, menos avatares. Upload e download dos buckets
-- privados só com URL assinada criada pelo servidor depois de conferir acesso.
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('chat',    'chat',    false, 10485760, ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/csv',
                                                'application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                                'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('tasks',   'tasks',   false, 26214400, ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/csv',
                                                'application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                                'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('support', 'support', false, 10485760, ARRAY['image/png','image/jpeg','image/webp','application/pdf','text/plain']),
  ('exports', 'exports', false, 52428800, ARRAY['application/zip','application/json']),
  ('avatars', 'avatars', true,  2097152,  ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Avatar: cada pessoa só mexe na própria pasta ({user_id}/arquivo).
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- chat, tasks, support e exports: sem política para authenticated = só a service_role.

-- ═══════════════════════════════════════════════════════════════════════
-- Tempo real (só existe no Supabase; ignorado no teste local)
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, message_reactions, notifications, tasks, channel_members;
  END IF;
  -- Canais "broadcast" privados (digitando…, presença): tópico ws:{workspace_id}
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'realtime' AND table_name = 'messages') THEN
    EXECUTE $p$CREATE POLICY ws_broadcast_read ON realtime.messages FOR SELECT TO authenticated
      USING (realtime.topic() LIKE 'ws:%' AND private.is_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid))$p$;
    EXECUTE $p$CREATE POLICY ws_broadcast_write ON realtime.messages FOR INSERT TO authenticated
      WITH CHECK (realtime.topic() LIKE 'ws:%' AND private.is_member(nullif(split_part(realtime.topic(), ':', 2), '')::uuid))$p$;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Rotinas que rodam só no banco
-- ═══════════════════════════════════════════════════════════════════════
-- Mensagens: janela móvel por workspace. Apaga em lotes para não travar o banco.
-- Respostas de thread vão junto (FK em cascata). Arquivos do chat vencem antes
-- (24 h ou 7 dias), então quando a mensagem sai o arquivo já foi apagado.
CREATE OR REPLACE FUNCTION private.purge_expired_messages(batch int DEFAULT 5000) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE total int := 0; n int;
BEGIN
  LOOP
    DELETE FROM public.messages WHERE id IN (
      SELECT m.id FROM public.messages m
      JOIN public.workspace_settings s ON s.workspace_id = m.workspace_id
      WHERE m.created_at < now() - make_interval(months => s.message_retention_months)
        AND m.parent_message_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.message_attachments a WHERE a.message_id = m.id AND a.expired_at IS NULL)
      LIMIT batch);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    EXIT WHEN n < batch;
  END LOOP;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION private.purge_logs() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.platform_config;
BEGIN
  SELECT * INTO cfg FROM public.platform_config WHERE id = 1;
  DELETE FROM public.access_logs WHERE created_at < now() - make_interval(days => cfg.access_log_retention_days);
  DELETE FROM public.error_events WHERE last_seen_at < now() - make_interval(days => cfg.error_retention_days);
  DELETE FROM public.error_hourly_counts WHERE hour < now() - interval '7 days';
  DELETE FROM public.bot_questions WHERE created_at < now() - make_interval(days => cfg.bot_question_retention_days);
  DELETE FROM private.rate_limits WHERE window_start < now() - interval '1 day';
  DELETE FROM public.notifications WHERE read_at IS NOT NULL AND read_at < now() - interval '90 days';
END $$;

-- Chamados: lembrete 2 dias antes e fechamento depois de N dias sem resposta da pessoa.
-- Os anexos dos chamados fechados são apagados do Storage pela rotina /api/cron/diario.
CREATE OR REPLACE FUNCTION private.close_stale_tickets() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.platform_config;
BEGIN
  SELECT * INTO cfg FROM public.platform_config WHERE id = 1;
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  SELECT t.requester_id, 'TICKET_REMINDER', 'Seu chamado fecha em ' || cfg.ticket_reminder_days_before || ' dias',
         'Responda se ainda precisar de ajuda.', jsonb_build_object('ticketId', t.id)
    FROM public.support_tickets t
   WHERE t.status = 'WAITING_USER' AND t.requester_id IS NOT NULL AND t.auto_close_at IS NOT NULL
     AND t.auto_close_at::date = (now() + make_interval(days => cfg.ticket_reminder_days_before))::date
     AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.type = 'TICKET_REMINDER' AND n.payload ->> 'ticketId' = t.id::text);
  UPDATE public.support_tickets SET status = 'CLOSED_NO_REPLY', closed_at = now(),
         purge_after = now() + make_interval(months => cfg.ticket_retention_months)
   WHERE status = 'WAITING_USER' AND auto_close_at < now();
  DELETE FROM public.support_tickets WHERE purge_after < now();
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Agenda (pg_cron). As rotinas que mexem no Storage ou no LiveKit chamam
-- rotas do Next.js com pg_net e um segredo guardado no Vault:
--   select vault.create_secret('https://SEU-APP.vercel.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.call_app(path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE base text; secret text;
BEGIN
  SELECT decrypted_secret INTO base FROM vault.decrypted_secrets WHERE name = 'app_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF base IS NULL OR secret IS NULL THEN RAISE WARNING 'app_url ou cron_secret ausente no Vault'; RETURN; END IF;
  PERFORM net.http_post(
    url := base || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000);
END $$;
REVOKE ALL ON FUNCTION private.call_app(text) FROM public, authenticated;

SELECT cron.schedule('limpar-mensagens', '15 3 * * *', 'SELECT private.purge_expired_messages()');
SELECT cron.schedule('limpar-registros', '30 3 * * *', 'SELECT private.purge_logs()');
SELECT cron.schedule('chamados-parados', '0 12 * * *', 'SELECT private.close_stale_tickets()');
SELECT cron.schedule('arquivos-vencidos', '5 * * * *', $$SELECT private.call_app('/api/cron/arquivos')$$);
SELECT cron.schedule('reunioes', '* * * * *', $$SELECT private.call_app('/api/cron/reunioes')$$);
SELECT cron.schedule('diario', '45 3 * * *', $$SELECT private.call_app('/api/cron/diario')$$);

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(), private.ws_role(uuid), private.is_member(uuid), private.is_ws_admin(uuid),
  private.shares_workspace(uuid), private.can_see_team(uuid), private.is_team_admin(uuid), private.project_ws(uuid),
  private.can_see_project(uuid), private.can_admin_project(uuid), private.task_project(uuid), private.can_see_channel(uuid),
  private.is_channel_mod(uuid), private.is_conv_member(uuid), private.can_see_message(uuid), private.can_see_event(uuid),
  private.ticket_owner(uuid) TO authenticated;
