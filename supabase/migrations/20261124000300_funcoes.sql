-- Gather — funções chamadas pelo app (RPC) e pelo servidor.
-- Funções "public.*" com EXECUTE só para service_role são chamadas apenas pelo
-- servidor Next.js; as liberadas para authenticated conferem tudo por dentro.

-- ═══════════════════════════════════════════════════════════════════════
-- Conta nova: perfil, espaço pessoal e consentimentos
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION private.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  base text;
  uname text;
  ws uuid;
  terms_v int;
  privacy_v int;
BEGIN
  base := lower(regexp_replace(coalesce(split_part(NEW.email, '@', 1), 'pessoa'), '[^a-z0-9_.]', '', 'g'));
  IF char_length(base) < 3 THEN base := base || 'gtr'; END IF;
  uname := left(base, 24) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 5);

  INSERT INTO public.profiles (id, display_name, username, onboarding_step)
  VALUES (NEW.id,
          left(coalesce(nullif(trim(meta ->> 'display_name'), ''), nullif(trim(meta ->> 'full_name'), ''), nullif(trim(meta ->> 'name'), ''), base), 80),
          uname,
          CASE WHEN (meta ->> 'age_confirmed') = 'true' THEN 1 ELSE 0 END);

  INSERT INTO public.workspaces (name, slug, kind, created_by)
  VALUES ('Meu espaço', 'p-' || replace(NEW.id::text, '-', ''), 'PERSONAL', NEW.id) RETURNING id INTO ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws, NEW.id, 'OWNER');
  INSERT INTO public.workspace_settings (workspace_id) VALUES (ws);

  -- Cadastro por e-mail manda os aceites junto; com Google, a tela de boas-vindas pede depois.
  IF (meta ->> 'age_confirmed') = 'true' THEN
    SELECT version INTO terms_v FROM public.legal_documents WHERE type = 'TERMS' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1;
    SELECT version INTO privacy_v FROM public.legal_documents WHERE type = 'PRIVACY_POLICY' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1;
    INSERT INTO public.consents (user_id, type, granted, doc_version, source) VALUES
      (NEW.id, 'AGE_18', true, NULL, 'signup'),
      (NEW.id, 'TERMS', true, terms_v, 'signup'),
      (NEW.id, 'PRIVACY_POLICY', true, privacy_v, 'signup');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Quem entrou com Google confirma idade e termos aqui.
CREATE OR REPLACE FUNCTION public.confirm_onboarding() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE terms_v int; privacy_v int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
  SELECT version INTO terms_v FROM public.legal_documents WHERE type = 'TERMS' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1;
  SELECT version INTO privacy_v FROM public.legal_documents WHERE type = 'PRIVACY_POLICY' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1;
  INSERT INTO public.consents (user_id, type, granted, doc_version, source) VALUES
    (auth.uid(), 'AGE_18', true, NULL, 'onboarding'),
    (auth.uid(), 'TERMS', true, terms_v, 'onboarding'),
    (auth.uid(), 'PRIVACY_POLICY', true, privacy_v, 'onboarding');
  UPDATE public.profiles SET onboarding_step = 1 WHERE id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_onboarding() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Workspaces de equipe e convites
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_team_workspace(ws_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  max_owned int;
  owned int;
  ws uuid;
  clean text := trim(ws_name);
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND status = 'ACTIVE' AND onboarding_step >= 1) THEN
    RAISE EXCEPTION 'Conta sem confirmação de idade e termos';
  END IF;
  IF char_length(clean) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  SELECT max_owned_team_workspaces INTO max_owned FROM public.platform_config WHERE id = 1;
  -- trava por pessoa para dois pedidos ao mesmo tempo não passarem do limite
  PERFORM pg_advisory_xact_lock(hashtext('owned_ws:' || uid::text));
  SELECT count(*) INTO owned FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
   WHERE m.user_id = uid AND m.role = 'OWNER' AND w.kind = 'TEAM' AND w.plan = 'FREE';
  IF owned >= coalesce(max_owned, 1) THEN RAISE EXCEPTION 'Limite de workspaces de equipe no plano grátis'; END IF;

  INSERT INTO public.workspaces (name, slug, kind, created_by)
  VALUES (clean, 'w-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), 'TEAM', uid) RETURNING id INTO ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws, uid, 'OWNER');
  INSERT INTO public.workspace_settings (workspace_id, message_retention_months, file_retention_hours)
  SELECT ws, default_message_months, default_file_hours FROM public.platform_config WHERE id = 1;
  INSERT INTO public.channels (workspace_id, name, kind, visibility, created_by) VALUES (ws, 'geral', 'CUSTOM', 'PUBLIC', uid);
  RETURN ws;
END $$;
GRANT EXECUTE ON FUNCTION public.create_team_workspace(text) TO authenticated;

-- O convite guarda só o hash do token; o link leva o token em claro uma única vez.
CREATE OR REPLACE FUNCTION public.accept_invite(token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.workspace_invites;
  my_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;
  SELECT * INTO inv FROM public.workspace_invites
   WHERE token_hash = encode(public.extensions_digest(token), 'hex') FOR UPDATE;
  IF inv.id IS NULL OR inv.revoked_at IS NOT NULL OR inv.accepted_at IS NOT NULL OR inv.expires_at < now() THEN
    RAISE EXCEPTION 'Convite inválido ou vencido';
  END IF;
  SELECT email INTO my_email FROM auth.users WHERE id = uid AND email_confirmed_at IS NOT NULL;
  IF inv.email IS NOT NULL AND lower(inv.email) <> lower(coalesce(my_email, '')) THEN
    RAISE EXCEPTION 'Este convite é para outro e-mail';
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (inv.workspace_id, uid, inv.role)
  ON CONFLICT DO NOTHING;
  UPDATE public.workspace_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.workspace_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- sha256 sem depender do schema da extensão
CREATE OR REPLACE FUNCTION public.extensions_digest(t text) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT sha256(convert_to(t, 'UTF8')) $$;
REVOKE ALL ON FUNCTION public.extensions_digest(text) FROM public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Limite de uso (rate limit) — chamado só pelo servidor
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE private.rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits         int NOT NULL
);
CREATE OR REPLACE FUNCTION public.rate_limit_hit(k text, max_hits int, window_seconds int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.rate_limits;
BEGIN
  INSERT INTO private.rate_limits AS rl (key, window_start, hits) VALUES (k, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN rl.window_start < now() - make_interval(secs => window_seconds) THEN 1 ELSE rl.hits + 1 END,
    window_start = CASE WHEN rl.window_start < now() - make_interval(secs => window_seconds) THEN now() ELSE rl.window_start END
  RETURNING * INTO r;
  RETURN r.hits <= max_hits;
END $$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, int, int) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- Registros de acesso e erros — chamados só pelo servidor
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.log_access(p_user uuid, p_event public."AccessEvent", p_method text, p_ip inet, p_ua text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.access_logs (user_id, event, method, ip, user_agent)
  VALUES (p_user, p_event, left(p_method, 20), p_ip, left(p_ua, 120));
$$;
REVOKE ALL ON FUNCTION public.log_access(uuid, public."AccessEvent", text, inet, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_access(uuid, public."AccessEvent", text, inet, text) TO service_role;

-- Agrupa pelo fingerprint, conta por hora e diz se é hora de alertar.
CREATE OR REPLACE FUNCTION public.log_error(
  p_fingerprint text, p_source public."ErrorSource", p_message text, p_location text,
  p_stack text, p_release text, p_user uuid, p_workspace uuid, p_browser text)
RETURNS TABLE (error_id uuid, is_new boolean, should_alert boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  e public.error_events;
  was_new boolean := false;
  cfg public.platform_config;
  recent int;
BEGIN
  SELECT * INTO cfg FROM public.platform_config WHERE id = 1;
  INSERT INTO public.error_events (fingerprint, source, message, location, stack, release,
                                   users_affected, sample_user_ids, sample_workspace_ids, browsers)
  VALUES (p_fingerprint, p_source, left(p_message, 500), left(p_location, 300), left(p_stack, 8000), left(p_release, 40),
          CASE WHEN p_user IS NULL THEN 0 ELSE 1 END,
          CASE WHEN p_user IS NULL THEN '{}' ELSE ARRAY[p_user] END,
          CASE WHEN p_workspace IS NULL THEN '{}' ELSE ARRAY[p_workspace] END,
          CASE WHEN p_browser IS NULL THEN NULL ELSE jsonb_build_object(p_browser, 1) END)
  ON CONFLICT (fingerprint) DO NOTHING
  RETURNING * INTO e;
  IF e.id IS NOT NULL THEN
    was_new := true;
  ELSE
    UPDATE public.error_events ee SET
      count = ee.count + 1,
      last_seen_at = now(),
      release = coalesce(left(p_release, 40), ee.release),
      status = CASE WHEN ee.status = 'RESOLVED' THEN 'REGRESSED'::public."ErrorStatus" ELSE ee.status END,
      sample_user_ids = CASE WHEN p_user IS NULL OR p_user = ANY (ee.sample_user_ids) OR cardinality(ee.sample_user_ids) >= 20
                             THEN ee.sample_user_ids ELSE ee.sample_user_ids || p_user END,
      users_affected = CASE WHEN p_user IS NULL OR p_user = ANY (ee.sample_user_ids) THEN ee.users_affected ELSE ee.users_affected + 1 END,
      sample_workspace_ids = CASE WHEN p_workspace IS NULL OR p_workspace = ANY (ee.sample_workspace_ids) OR cardinality(ee.sample_workspace_ids) >= 20
                                  THEN ee.sample_workspace_ids ELSE ee.sample_workspace_ids || p_workspace END,
      browsers = CASE WHEN p_browser IS NULL THEN ee.browsers
                      ELSE coalesce(ee.browsers, '{}'::jsonb) || jsonb_build_object(p_browser, coalesce((ee.browsers ->> p_browser)::int, 0) + 1) END
    WHERE ee.fingerprint = p_fingerprint
    RETURNING * INTO e;
  END IF;

  INSERT INTO public.error_hourly_counts (error_id, hour, count) VALUES (e.id, date_trunc('hour', now()), 1)
  ON CONFLICT (error_id, hour) DO UPDATE SET count = public.error_hourly_counts.count + 1;

  SELECT coalesce(sum(count), 0) INTO recent FROM public.error_hourly_counts
   WHERE error_id = e.id AND hour >= date_trunc('hour', now() - make_interval(mins => cfg.error_spike_window_min));

  error_id := e.id;
  is_new := was_new;
  should_alert := e.status NOT IN ('IGNORED')
    AND (was_new OR e.status = 'REGRESSED' OR recent >= cfg.error_spike_threshold)
    AND (e.alerted_at IS NULL OR e.alerted_at < now() - interval '1 hour');
  IF should_alert THEN
    UPDATE public.error_events SET alerted_at = now() WHERE id = e.id;
    INSERT INTO public.notifications (user_id, type, title, body, payload)
    SELECT pa.user_id, 'ERROR_ALERT',
           CASE WHEN was_new THEN 'Erro novo no app' WHEN e.status = 'REGRESSED' THEN 'Erro resolvido voltou' ELSE 'Pico de erros' END,
           left(e.message, 140), jsonb_build_object('errorId', e.id)
      FROM public.platform_admins pa;
  END IF;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.log_error(text, public."ErrorSource", text, text, text, text, uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_error(text, public."ErrorSource", text, text, text, text, uuid, uuid, text) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- Reuniões: o servidor pergunta se pode entrar antes de criar o token
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.meeting_join_check(p_meeting uuid, p_user uuid)
RETURNS TABLE (ok boolean, reason text, room_key text, workspace_id uuid, seconds_left int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  m public.meetings;
  s public.workspace_settings;
  cfg public.platform_config;
  used int;
  live int;
  quota int;
BEGIN
  SELECT * INTO m FROM public.meetings WHERE id = p_meeting;
  IF m.id IS NULL OR m.status IN ('ENDED', 'CANCELLED') THEN
    RETURN QUERY SELECT false, 'Reunião encerrada ou inexistente', NULL::text, NULL::uuid, 0; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members wm JOIN public.profiles p ON p.id = wm.user_id
                 JOIN public.workspaces w ON w.id = wm.workspace_id
                 WHERE wm.workspace_id = m.workspace_id AND wm.user_id = p_user AND p.status = 'ACTIVE' AND w.suspended_at IS NULL) THEN
    RETURN QUERY SELECT false, 'Sem acesso a este workspace', NULL::text, NULL::uuid, 0; RETURN;
  END IF;
  SELECT * INTO s FROM public.workspace_settings WHERE workspace_settings.workspace_id = m.workspace_id;
  SELECT * INTO cfg FROM public.platform_config WHERE id = 1;
  IF NOT (s.calls_enabled OR cfg.calls_for_all_workspaces) THEN
    RETURN QUERY SELECT false, 'Reuniões ainda não liberadas neste workspace', NULL::text, NULL::uuid, 0; RETURN;
  END IF;
  SELECT coalesce(minutes_used, 0) INTO used FROM public.workspace_meeting_usage u
   WHERE u.workspace_id = m.workspace_id AND u.month = date_trunc('month', now())::date;
  quota := coalesce(s.call_minutes_quota, cfg.call_minutes_per_workspace);
  IF coalesce(used, 0) >= quota THEN
    RETURN QUERY SELECT false, 'Os minutos de reunião deste mês acabaram', NULL::text, NULL::uuid, 0; RETURN;
  END IF;
  SELECT count(*) INTO live FROM public.meeting_participants mp
   WHERE mp.meeting_id = m.id AND mp.left_at IS NULL AND mp.user_id IS DISTINCT FROM p_user;
  IF live >= m.max_participants THEN
    RETURN QUERY SELECT false, 'A reunião está cheia', NULL::text, NULL::uuid, 0; RETURN;
  END IF;
  RETURN QUERY SELECT true, NULL::text, m.room_key, m.workspace_id,
    GREATEST(0, LEAST(
      extract(epoch FROM (coalesce(m.hard_end_at, now() + make_interval(mins => m.max_duration_min)) - now()))::int,
      (quota - coalesce(used, 0)) * 60));
END $$;
REVOKE ALL ON FUNCTION public.meeting_join_check(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_join_check(uuid, uuid) TO service_role;

-- O webhook do LiveKit soma os minutos-participante ao sair alguém.
CREATE OR REPLACE FUNCTION public.meeting_add_usage(p_workspace uuid, p_seconds int) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.workspace_meeting_usage (workspace_id, month, minutes_used)
  VALUES (p_workspace, date_trunc('month', now())::date, ceil(p_seconds / 60.0)::int)
  ON CONFLICT (workspace_id, month) DO UPDATE SET minutes_used = public.workspace_meeting_usage.minutes_used + excluded.minutes_used
  RETURNING minutes_used;
$$;
REVOKE ALL ON FUNCTION public.meeting_add_usage(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_add_usage(uuid, int) TO service_role;
