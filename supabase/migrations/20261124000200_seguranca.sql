-- Gather — segurança do banco: funções de apoio, RLS em todas as tabelas,
-- permissões por coluna e regras que o Prisma não expressa.
--
-- Regra geral: o navegador lê e escreve com a chave anon + sessão da pessoa,
-- e o banco só devolve o que é do workspace dela. Operações sensíveis
-- (criar workspace, aceitar convite, reuniões, admin, logs) passam por
-- funções SECURITY DEFINER ou pelo servidor com a service_role.

-- ═══════════════════════════════════════════════════════════════════════
-- 0. Permissões base
-- ═══════════════════════════════════════════════════════════════════════
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Funções de apoio ficam num schema que a API não expõe.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Regras de integridade que faltavam
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD CONSTRAINT profiles_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_.]{3,30}$');
ALTER TABLE profiles ADD CONSTRAINT profiles_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 80);
ALTER TABLE workspaces ADD CONSTRAINT workspaces_name_len CHECK (char_length(name) BETWEEN 1 AND 80);
ALTER TABLE messages ADD CONSTRAINT messages_one_target CHECK (num_nonnulls(channel_id, conversation_id) = 1);
ALTER TABLE messages ADD CONSTRAINT messages_content_len CHECK (char_length(content) <= 4000);
ALTER TABLE task_comments ADD CONSTRAINT task_comments_len CHECK (char_length(content) <= 4000);
ALTER TABLE tasks ADD CONSTRAINT tasks_title_len CHECK (char_length(title) BETWEEN 1 AND 200);
ALTER TABLE workspace_settings ADD CONSTRAINT ws_msg_retention CHECK (message_retention_months IN (1, 2, 3, 6, 12));
ALTER TABLE workspace_settings ADD CONSTRAINT ws_file_retention CHECK (file_retention_hours IN (24, 168, 720));
ALTER TABLE error_events ADD CONSTRAINT error_message_len CHECK (char_length(message) <= 500);
ALTER TABLE error_events ADD CONSTRAINT error_stack_len CHECK (stack IS NULL OR char_length(stack) <= 8000);
ALTER TABLE platform_config ADD CONSTRAINT platform_config_singleton CHECK (id = 1);
CREATE UNIQUE INDEX meeting_participants_one_live ON meeting_participants (meeting_id, user_id)
  WHERE user_id IS NOT NULL AND left_at IS NULL;

-- updated_at automático (o app usa supabase-js, não o Prisma Client)
CREATE OR REPLACE FUNCTION private.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'updated_at' LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()', t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Funções de acesso (SECURITY DEFINER, search_path vazio)
-- ═══════════════════════════════════════════════════════════════════════
-- Admin da plataforma só conta com segundo fator (aal2) na sessão.
CREATE OR REPLACE FUNCTION private.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
     AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

CREATE OR REPLACE FUNCTION private.ws_role(ws uuid) RETURNS public."WorkspaceRole"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.role FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.workspace_id = ws AND m.user_id = auth.uid()
    AND w.suspended_at IS NULL AND p.status = 'ACTIVE'
$$;

CREATE OR REPLACE FUNCTION private.is_member(ws uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.ws_role(ws) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION private.is_ws_admin(ws uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.ws_role(ws) IN ('OWNER', 'ADMIN')
$$;

CREATE OR REPLACE FUNCTION private.shares_workspace(other uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members a
    JOIN public.workspace_members b ON a.workspace_id = b.workspace_id
    WHERE a.user_id = auth.uid() AND b.user_id = other)
$$;

CREATE OR REPLACE FUNCTION private.can_see_team(t uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams tm WHERE tm.id = t AND private.is_member(tm.workspace_id) AND (
      tm.visibility = 'WORKSPACE' OR tm.created_by = auth.uid() OR private.is_ws_admin(tm.workspace_id)
      OR EXISTS (SELECT 1 FROM public.team_members x WHERE x.team_id = t AND x.user_id = auth.uid())))
$$;

CREATE OR REPLACE FUNCTION private.is_team_admin(t uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams tm WHERE tm.id = t AND private.is_ws_admin(tm.workspace_id))
      OR EXISTS (SELECT 1 FROM public.team_members x JOIN public.teams tm ON tm.id = x.team_id
                 WHERE x.team_id = t AND x.user_id = auth.uid() AND x.role = 'TEAM_ADMIN' AND private.is_member(tm.workspace_id))
$$;

CREATE OR REPLACE FUNCTION private.project_ws(p uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.workspace_id FROM public.projects pr JOIN public.teams t ON t.id = pr.team_id WHERE pr.id = p
$$;

CREATE OR REPLACE FUNCTION private.can_see_project(p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p AND private.can_see_team(pr.team_id))
$$;

CREATE OR REPLACE FUNCTION private.can_admin_project(p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p AND private.is_team_admin(pr.team_id))
      OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p AND m.user_id = auth.uid()
                 AND m.role = 'PROJECT_ADMIN' AND private.can_see_project(p))
$$;

CREATE OR REPLACE FUNCTION private.task_project(t uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT project_id FROM public.tasks WHERE id = t
$$;

CREATE OR REPLACE FUNCTION private.can_see_channel(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels ch WHERE ch.id = c AND private.is_member(ch.workspace_id) AND (
      ch.visibility = 'PUBLIC' OR ch.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = c AND m.user_id = auth.uid())))
$$;

CREATE OR REPLACE FUNCTION private.is_channel_mod(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels ch WHERE ch.id = c AND (private.is_ws_admin(ch.workspace_id) OR ch.created_by = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = c AND m.user_id = auth.uid() AND m.role = 'CHANNEL_MODERATOR')
$$;

CREATE OR REPLACE FUNCTION private.is_conv_member(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members m JOIN public.conversations cv ON cv.id = m.conversation_id
    WHERE m.conversation_id = c AND m.user_id = auth.uid() AND private.is_member(cv.workspace_id))
$$;

CREATE OR REPLACE FUNCTION private.can_see_message(msg uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.id = msg AND (
      (m.channel_id IS NOT NULL AND private.can_see_channel(m.channel_id))
      OR (m.conversation_id IS NOT NULL AND private.is_conv_member(m.conversation_id))))
$$;

CREATE OR REPLACE FUNCTION private.can_see_event(e uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events ev WHERE ev.id = e AND private.is_member(ev.workspace_id) AND (
      ev.visibility = 'WORKSPACE' OR ev.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.event_participants p WHERE p.event_id = e AND p.user_id = auth.uid())
      OR (ev.visibility = 'TEAM' AND ev.team_id IS NOT NULL AND private.can_see_team(ev.team_id))))
$$;

CREATE OR REPLACE FUNCTION private.ticket_owner(t uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.support_tickets WHERE id = t AND requester_id = auth.uid())
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. RLS ligado em TODAS as tabelas do schema public
-- ═══════════════════════════════════════════════════════════════════════
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Políticas, tabela por tabela
--    (sem política = ninguém além da service_role)
-- ═══════════════════════════════════════════════════════════════════════

-- Pessoas ─────────────────────────────────────────────────────────────
GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (display_name, username, avatar_path, bio, timezone) ON profiles TO authenticated;
CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.shares_workspace(id) OR private.is_platform_admin());
CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT ON platform_admins TO authenticated;
CREATE POLICY platform_admins_self ON platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON platform_config TO authenticated;
GRANT UPDATE ON platform_config TO authenticated;
CREATE POLICY platform_config_read ON platform_config FOR SELECT TO authenticated USING (true);
CREATE POLICY platform_config_admin ON platform_config FOR UPDATE TO authenticated
  USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());

-- Registro de ações: só acrescenta, ninguém edita nem apaga.
GRANT SELECT, INSERT ON admin_actions TO authenticated;
CREATE POLICY admin_actions_read ON admin_actions FOR SELECT TO authenticated USING (private.is_platform_admin());
CREATE POLICY admin_actions_insert ON admin_actions FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_admin() AND admin_id = auth.uid());
REVOKE UPDATE, DELETE, TRUNCATE ON admin_actions FROM authenticated, service_role;
CREATE OR REPLACE FUNCTION private.block_change() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Esta tabela só aceita novos registros (%).', TG_TABLE_NAME; END $$;
CREATE TRIGGER admin_actions_append_only BEFORE UPDATE OR DELETE ON admin_actions
  FOR EACH ROW EXECUTE FUNCTION private.block_change();

-- Workspaces ──────────────────────────────────────────────────────────
GRANT SELECT ON workspaces TO authenticated;
GRANT UPDATE (name, description) ON workspaces TO authenticated;
CREATE POLICY workspaces_read ON workspaces FOR SELECT TO authenticated
  USING (private.is_member(id) OR private.is_platform_admin());
CREATE POLICY workspaces_update ON workspaces FOR UPDATE TO authenticated
  USING (private.is_ws_admin(id)) WITH CHECK (private.is_ws_admin(id));

GRANT SELECT, DELETE ON workspace_members TO authenticated;
CREATE POLICY members_read ON workspace_members FOR SELECT TO authenticated
  USING (private.is_member(workspace_id) OR private.is_platform_admin());
-- sair do workspace (dono não sai sem transferir) ou admin removendo alguém que não é dono
CREATE POLICY members_delete ON workspace_members FOR DELETE TO authenticated
  USING (role <> 'OWNER' AND (user_id = auth.uid() OR private.is_ws_admin(workspace_id)));

GRANT SELECT, INSERT ON workspace_invites TO authenticated;
GRANT UPDATE (revoked_at) ON workspace_invites TO authenticated;
CREATE POLICY invites_read ON workspace_invites FOR SELECT TO authenticated USING (private.is_ws_admin(workspace_id));
CREATE POLICY invites_insert ON workspace_invites FOR INSERT TO authenticated
  WITH CHECK (private.is_ws_admin(workspace_id) AND created_by = auth.uid() AND role <> 'OWNER');
CREATE POLICY invites_revoke ON workspace_invites FOR UPDATE TO authenticated
  USING (private.is_ws_admin(workspace_id)) WITH CHECK (private.is_ws_admin(workspace_id));

GRANT SELECT ON workspace_settings TO authenticated;
GRANT UPDATE (allow_guests, default_channel_visibility, message_retention_months, file_retention_hours,
              calls_enabled, call_minutes_quota) ON workspace_settings TO authenticated;
CREATE POLICY settings_read ON workspace_settings FOR SELECT TO authenticated
  USING (private.is_member(workspace_id) OR private.is_platform_admin());
CREATE POLICY settings_update ON workspace_settings FOR UPDATE TO authenticated
  USING (private.is_ws_admin(workspace_id) OR private.is_platform_admin())
  WITH CHECK (private.is_ws_admin(workspace_id) OR private.is_platform_admin());

-- Prazo só entre as opções ligadas pelo admin; reuniões só o admin da plataforma liga.
CREATE OR REPLACE FUNCTION private.check_workspace_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg public.platform_config;
BEGIN
  SELECT * INTO cfg FROM public.platform_config WHERE id = 1;
  IF NEW.message_retention_months IS DISTINCT FROM OLD.message_retention_months
     AND NOT (NEW.message_retention_months = ANY (cfg.message_retention_options)) THEN
    RAISE EXCEPTION 'Prazo de mensagens não permitido';
  END IF;
  IF NEW.file_retention_hours IS DISTINCT FROM OLD.file_retention_hours
     AND NOT (NEW.file_retention_hours = ANY (cfg.file_retention_options)) THEN
    RAISE EXCEPTION 'Prazo de arquivos não permitido';
  END IF;
  IF (NEW.calls_enabled IS DISTINCT FROM OLD.calls_enabled OR NEW.call_minutes_quota IS DISTINCT FROM OLD.call_minutes_quota)
     AND auth.uid() IS NOT NULL AND NOT private.is_platform_admin() THEN
    RAISE EXCEPTION 'Só o admin da plataforma muda reuniões';
  END IF;
  IF NEW.calls_enabled AND NOT OLD.calls_enabled THEN NEW.calls_enabled_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_settings_check BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION private.check_workspace_settings();

-- Equipes e projetos ──────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON teams TO authenticated;
GRANT UPDATE (name, slug, description, visibility) ON teams TO authenticated;
-- Políticas de leitura usam as colunas da própria linha (não buscam pelo id),
-- senão o INSERT ... RETURNING de quem acabou de criar não enxerga a linha nova.
CREATE POLICY teams_read ON teams FOR SELECT TO authenticated USING (
  private.is_member(workspace_id) AND (visibility = 'WORKSPACE' OR created_by = auth.uid() OR private.is_ws_admin(workspace_id)
    OR EXISTS (SELECT 1 FROM team_members x WHERE x.team_id = id AND x.user_id = auth.uid())));
CREATE POLICY teams_insert ON teams FOR INSERT TO authenticated
  WITH CHECK (private.is_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY teams_update ON teams FOR UPDATE TO authenticated USING (private.is_team_admin(id)) WITH CHECK (private.is_team_admin(id));
CREATE POLICY teams_delete ON teams FOR DELETE TO authenticated USING (private.is_ws_admin(workspace_id));

GRANT SELECT, INSERT, DELETE ON team_members TO authenticated;
GRANT UPDATE (role) ON team_members TO authenticated;
CREATE POLICY team_members_read ON team_members FOR SELECT TO authenticated USING (private.can_see_team(team_id));
CREATE POLICY team_members_insert ON team_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND EXISTS (
    SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = t.workspace_id AND wm.user_id = team_members.user_id))
  AND (private.is_team_admin(team_id)
       OR (user_id = auth.uid() AND role = 'TEAM_MEMBER' AND EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.visibility = 'WORKSPACE' AND private.is_member(t.workspace_id))))
);
CREATE POLICY team_members_update ON team_members FOR UPDATE TO authenticated USING (private.is_team_admin(team_id)) WITH CHECK (private.is_team_admin(team_id));
CREATE POLICY team_members_delete ON team_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR private.is_team_admin(team_id));

GRANT SELECT, INSERT, DELETE ON projects TO authenticated;
GRANT UPDATE (name, slug, description, status, start_date, due_date) ON projects TO authenticated;
CREATE POLICY projects_read ON projects FOR SELECT TO authenticated USING (private.can_see_team(team_id));
CREATE POLICY projects_insert ON projects FOR INSERT TO authenticated WITH CHECK (private.can_see_team(team_id) AND created_by = auth.uid());
CREATE POLICY projects_update ON projects FOR UPDATE TO authenticated USING (private.can_admin_project(id)) WITH CHECK (private.can_admin_project(id));
CREATE POLICY projects_delete ON projects FOR DELETE TO authenticated USING (private.is_team_admin(team_id));

GRANT SELECT, INSERT, DELETE ON project_members TO authenticated;
GRANT UPDATE (role) ON project_members TO authenticated;
CREATE POLICY project_members_read ON project_members FOR SELECT TO authenticated USING (private.can_see_project(project_id));
CREATE POLICY project_members_write ON project_members FOR INSERT TO authenticated WITH CHECK (
  private.can_admin_project(project_id)
  AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = private.project_ws(project_id) AND wm.user_id = project_members.user_id));
CREATE POLICY project_members_update ON project_members FOR UPDATE TO authenticated USING (private.can_admin_project(project_id)) WITH CHECK (private.can_admin_project(project_id));
CREATE POLICY project_members_delete ON project_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR private.can_admin_project(project_id));

-- Chat ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON channels TO authenticated;
GRANT UPDATE (name, description, visibility) ON channels TO authenticated;
CREATE POLICY channels_read ON channels FOR SELECT TO authenticated USING (
  private.is_member(workspace_id) AND (visibility = 'PUBLIC' OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = id AND m.user_id = auth.uid())));
CREATE POLICY channels_insert ON channels FOR INSERT TO authenticated WITH CHECK (
  private.is_member(workspace_id) AND created_by = auth.uid()
  AND (team_id IS NULL OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.workspace_id = channels.workspace_id))
  AND (project_id IS NULL OR private.project_ws(project_id) = workspace_id));
CREATE POLICY channels_update ON channels FOR UPDATE TO authenticated USING (private.is_channel_mod(id)) WITH CHECK (private.is_channel_mod(id));
CREATE POLICY channels_delete ON channels FOR DELETE TO authenticated USING (private.is_ws_admin(workspace_id));

GRANT SELECT, INSERT, DELETE ON channel_members TO authenticated;
GRANT UPDATE (last_read_at) ON channel_members TO authenticated;
CREATE POLICY channel_members_read ON channel_members FOR SELECT TO authenticated USING (private.can_see_channel(channel_id));
CREATE POLICY channel_members_insert ON channel_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM channels c JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
          WHERE c.id = channel_id AND wm.user_id = channel_members.user_id)
  AND (private.is_channel_mod(channel_id)
       OR (user_id = auth.uid() AND role = 'CHANNEL_MEMBER' AND EXISTS (SELECT 1 FROM channels c WHERE c.id = channel_id AND c.visibility = 'PUBLIC'))));
CREATE POLICY channel_members_update_self ON channel_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY channel_members_delete ON channel_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR private.is_channel_mod(channel_id));

GRANT SELECT, INSERT ON conversations TO authenticated;
CREATE POLICY conversations_read ON conversations FOR SELECT TO authenticated USING (
  private.is_member(workspace_id) AND (created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = id AND m.user_id = auth.uid())));
CREATE POLICY conversations_insert ON conversations FOR INSERT TO authenticated
  WITH CHECK (private.is_member(workspace_id) AND created_by = auth.uid());

GRANT SELECT, INSERT, DELETE ON conversation_members TO authenticated;
GRANT UPDATE (last_read_at) ON conversation_members TO authenticated;
CREATE POLICY conv_members_read ON conversation_members FOR SELECT TO authenticated USING (private.is_conv_member(conversation_id));
-- quem criou a conversa adiciona pessoas do mesmo workspace
CREATE POLICY conv_members_insert ON conversation_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
          WHERE c.id = conversation_id AND c.created_by = auth.uid() AND wm.user_id = conversation_members.user_id
            AND private.is_member(c.workspace_id)));
CREATE POLICY conv_members_update_self ON conversation_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY conv_members_leave ON conversation_members FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT ON messages TO authenticated;
GRANT UPDATE (content, edited_at, deleted_at) ON messages TO authenticated;
CREATE POLICY messages_read ON messages FOR SELECT TO authenticated USING (
  (channel_id IS NOT NULL AND private.can_see_channel(channel_id))
  OR (conversation_id IS NOT NULL AND private.is_conv_member(conversation_id)));
CREATE POLICY messages_insert ON messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND deleted_at IS NULL AND edited_at IS NULL AND (
    (channel_id IS NOT NULL AND private.can_see_channel(channel_id)
      AND workspace_id = (SELECT c.workspace_id FROM channels c WHERE c.id = channel_id))
    OR (conversation_id IS NOT NULL AND private.is_conv_member(conversation_id)
      AND workspace_id = (SELECT c.workspace_id FROM conversations c WHERE c.id = conversation_id)))
  AND (parent_message_id IS NULL OR EXISTS (
    SELECT 1 FROM messages p WHERE p.id = parent_message_id
      AND p.channel_id IS NOT DISTINCT FROM messages.channel_id
      AND p.conversation_id IS NOT DISTINCT FROM messages.conversation_id)));
CREATE POLICY messages_update_own ON messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (sender_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
CREATE POLICY reactions_read ON message_reactions FOR SELECT TO authenticated USING (private.can_see_message(message_id));
CREATE POLICY reactions_insert ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.can_see_message(message_id) AND char_length(emoji) <= 16);
CREATE POLICY reactions_delete ON message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Anexos: só leitura dos dados; upload e download passam pelo servidor (URL assinada).
GRANT SELECT ON message_attachments TO authenticated;
CREATE POLICY attachments_read ON message_attachments FOR SELECT TO authenticated USING (private.can_see_message(message_id));

-- Tarefas ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON task_statuses, task_labels TO authenticated;
CREATE POLICY task_statuses_read ON task_statuses FOR SELECT TO authenticated USING (private.can_see_project(project_id));
CREATE POLICY task_statuses_write ON task_statuses FOR ALL TO authenticated
  USING (private.can_admin_project(project_id)) WITH CHECK (private.can_admin_project(project_id));
CREATE POLICY task_labels_read ON task_labels FOR SELECT TO authenticated USING (private.can_see_project(project_id));
CREATE POLICY task_labels_write ON task_labels FOR ALL TO authenticated
  USING (private.can_see_project(project_id)) WITH CHECK (private.can_see_project(project_id));

GRANT SELECT, INSERT, DELETE ON tasks TO authenticated;
GRANT UPDATE (status_id, position, title, description, priority, due_at, completed_at) ON tasks TO authenticated;
CREATE POLICY tasks_read ON tasks FOR SELECT TO authenticated USING (private.can_see_project(project_id));
CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated WITH CHECK (
  private.can_see_project(project_id) AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM task_statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id));
CREATE POLICY tasks_update ON tasks FOR UPDATE TO authenticated USING (private.can_see_project(project_id)) WITH CHECK (
  private.can_see_project(project_id)
  AND EXISTS (SELECT 1 FROM task_statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id));
CREATE POLICY tasks_delete ON tasks FOR DELETE TO authenticated USING (created_by = auth.uid() OR private.can_admin_project(project_id));

GRANT SELECT, INSERT, DELETE ON task_assignees, task_label_links TO authenticated;
CREATE POLICY assignees_read ON task_assignees FOR SELECT TO authenticated USING (private.can_see_project(private.task_project(task_id)));
CREATE POLICY assignees_write ON task_assignees FOR INSERT TO authenticated WITH CHECK (
  private.can_see_project(private.task_project(task_id))
  AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = private.project_ws(private.task_project(task_id)) AND wm.user_id = task_assignees.user_id));
CREATE POLICY assignees_delete ON task_assignees FOR DELETE TO authenticated USING (private.can_see_project(private.task_project(task_id)));
CREATE POLICY label_links_read ON task_label_links FOR SELECT TO authenticated USING (private.can_see_project(private.task_project(task_id)));
CREATE POLICY label_links_write ON task_label_links FOR INSERT TO authenticated WITH CHECK (
  private.can_see_project(private.task_project(task_id))
  AND EXISTS (SELECT 1 FROM task_labels l WHERE l.id = label_id AND l.project_id = private.task_project(task_id)));
CREATE POLICY label_links_delete ON task_label_links FOR DELETE TO authenticated USING (private.can_see_project(private.task_project(task_id)));

GRANT SELECT, INSERT ON task_comments TO authenticated;
GRANT UPDATE (content, deleted_at) ON task_comments TO authenticated;
CREATE POLICY comments_read ON task_comments FOR SELECT TO authenticated USING (private.can_see_project(private.task_project(task_id)));
CREATE POLICY comments_insert ON task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND deleted_at IS NULL AND private.can_see_project(private.task_project(task_id)));
CREATE POLICY comments_update_own ON task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

GRANT SELECT ON task_attachments TO authenticated;
CREATE POLICY task_attachments_read ON task_attachments FOR SELECT TO authenticated USING (private.can_see_project(private.task_project(task_id)));

-- Reuniões: leitura para membros; escrita só pelo servidor (token, webhook, rotinas).
GRANT SELECT ON meetings, meeting_participants, workspace_meeting_usage, meeting_notes TO authenticated;
CREATE POLICY meetings_read ON meetings FOR SELECT TO authenticated USING (private.is_member(workspace_id) OR private.is_platform_admin());
CREATE POLICY participants_read ON meeting_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND private.is_member(m.workspace_id)));
CREATE POLICY usage_read ON workspace_meeting_usage FOR SELECT TO authenticated USING (private.is_member(workspace_id) OR private.is_platform_admin());
GRANT INSERT, UPDATE (content, decisions, updated_by) ON meeting_notes TO authenticated;
CREATE POLICY notes_read ON meeting_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND private.is_member(m.workspace_id)));
CREATE POLICY notes_insert ON meeting_notes FOR INSERT TO authenticated WITH CHECK (
  updated_by = auth.uid() AND EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND private.is_member(m.workspace_id)));
CREATE POLICY notes_update ON meeting_notes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND private.is_member(m.workspace_id)))
  WITH CHECK (updated_by = auth.uid());

GRANT SELECT, INSERT ON meeting_requests TO authenticated;
CREATE POLICY meeting_requests_read ON meeting_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_ws_admin(workspace_id) OR private.is_platform_admin());
CREATE POLICY meeting_requests_insert ON meeting_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND private.is_member(workspace_id));

-- Agenda ──────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, DELETE ON calendar_events TO authenticated;
GRANT UPDATE (title, description, starts_at, ends_at, timezone, visibility, reminder_min) ON calendar_events TO authenticated;
CREATE POLICY events_read ON calendar_events FOR SELECT TO authenticated USING (
  private.is_member(workspace_id) AND (visibility = 'WORKSPACE' OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = id AND p.user_id = auth.uid())
    OR (visibility = 'TEAM' AND team_id IS NOT NULL AND private.can_see_team(team_id))));
CREATE POLICY events_insert ON calendar_events FOR INSERT TO authenticated WITH CHECK (
  private.is_member(workspace_id) AND created_by = auth.uid()
  AND (team_id IS NULL OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.workspace_id = calendar_events.workspace_id))
  AND (project_id IS NULL OR private.project_ws(project_id) = workspace_id));
CREATE POLICY events_update ON calendar_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_ws_admin(workspace_id)) WITH CHECK (private.is_member(workspace_id));
CREATE POLICY events_delete ON calendar_events FOR DELETE TO authenticated USING (created_by = auth.uid() OR private.is_ws_admin(workspace_id));

GRANT SELECT, INSERT, DELETE ON event_participants TO authenticated;
GRANT UPDATE (response) ON event_participants TO authenticated;
CREATE POLICY event_part_read ON event_participants FOR SELECT TO authenticated USING (private.can_see_event(event_id));
CREATE POLICY event_part_insert ON event_participants FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM calendar_events e JOIN workspace_members wm ON wm.workspace_id = e.workspace_id
          WHERE e.id = event_id AND wm.user_id = event_participants.user_id
            AND (e.created_by = auth.uid() OR (event_participants.user_id = auth.uid() AND private.can_see_event(e.id)))));
CREATE POLICY event_part_update_self ON event_participants FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY event_part_delete ON event_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid()));

-- Atividade e notificações ────────────────────────────────────────────
GRANT SELECT ON activity_events TO authenticated;
CREATE POLICY activity_read ON activity_events FOR SELECT TO authenticated USING (private.is_member(workspace_id));

GRANT SELECT, DELETE ON notifications TO authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;
CREATE POLICY notifications_own ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_read_mark ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_delete ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Suporte e denúncias ─────────────────────────────────────────────────
GRANT SELECT, INSERT ON support_tickets TO authenticated;
GRANT UPDATE (status, priority, assignee_id, last_staff_reply_at, auto_close_at, resolved_at, closed_at) ON support_tickets TO authenticated;
CREATE POLICY tickets_read ON support_tickets FOR SELECT TO authenticated USING (requester_id = auth.uid() OR private.is_platform_admin());
CREATE POLICY tickets_insert ON support_tickets FOR INSERT TO authenticated WITH CHECK (
  requester_id = auth.uid() AND status = 'OPEN' AND assignee_id IS NULL
  AND (workspace_id IS NULL OR private.is_member(workspace_id)));
CREATE POLICY tickets_staff_update ON support_tickets FOR UPDATE TO authenticated
  USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());

GRANT SELECT, INSERT ON support_messages TO authenticated;
CREATE POLICY ticket_msgs_read ON support_messages FOR SELECT TO authenticated
  USING ((private.ticket_owner(ticket_id) AND NOT is_internal) OR private.is_platform_admin());
CREATE POLICY ticket_msgs_insert ON support_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    (private.ticket_owner(ticket_id) AND NOT is_staff AND NOT is_internal)
    OR private.is_platform_admin()));

GRANT SELECT ON support_attachments TO authenticated;
CREATE POLICY ticket_files_read ON support_attachments FOR SELECT TO authenticated
  USING ((private.ticket_owner(ticket_id) AND deleted_at IS NULL) OR private.is_platform_admin());

-- Denúncia é criada pelo servidor (ele copia a mensagem denunciada); quem denunciou vê a sua.
GRANT SELECT ON reports TO authenticated;
CREATE POLICY reports_read ON reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR private.is_platform_admin());

-- Documentos legais, consentimentos e dados pessoais ──────────────────
GRANT SELECT ON legal_documents TO anon, authenticated;
CREATE POLICY legal_public ON legal_documents FOR SELECT TO anon, authenticated USING (published_at <= now());

GRANT SELECT, INSERT ON consents TO authenticated;
CREATE POLICY consents_own ON consents FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.is_platform_admin());
CREATE POLICY consents_insert ON consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON data_export_requests TO authenticated;
CREATE POLICY exports_own ON data_export_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.is_platform_admin());
CREATE POLICY exports_insert ON data_export_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'PENDING' AND storage_path IS NULL);

-- Central de ajuda: pública quando publicada; escrita só admin.
GRANT SELECT ON help_categories, help_articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON help_categories, help_articles TO authenticated;
CREATE POLICY help_cat_read ON help_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY help_cat_admin ON help_categories FOR ALL TO authenticated USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());
CREATE POLICY help_art_read ON help_articles FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED' OR private.is_platform_admin());
CREATE POLICY help_art_admin ON help_articles FOR ALL TO authenticated USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());

GRANT SELECT ON bot_questions TO authenticated;
CREATE POLICY bot_q_admin ON bot_questions FOR SELECT TO authenticated USING (private.is_platform_admin());

-- Registros e erros: só admin lê; só o servidor escreve (funções abaixo).
GRANT SELECT ON access_logs, error_events, error_hourly_counts TO authenticated;
GRANT UPDATE (status, resolved_at, resolved_by_id) ON error_events TO authenticated;
CREATE POLICY access_logs_admin ON access_logs FOR SELECT TO authenticated USING (private.is_platform_admin());
CREATE POLICY errors_admin ON error_events FOR SELECT TO authenticated USING (private.is_platform_admin());
CREATE POLICY errors_admin_update ON error_events FOR UPDATE TO authenticated
  USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());
CREATE POLICY errors_hourly_admin ON error_hourly_counts FOR SELECT TO authenticated USING (private.is_platform_admin());

-- Membros e workspaces só são criados pelas funções da próxima migração.
