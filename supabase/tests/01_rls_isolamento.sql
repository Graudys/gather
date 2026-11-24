-- Teste de isolamento entre workspaces (rodar num banco local descartável,
-- depois de 00_stub_supabase.sql e de todas as migrações).
--   psql -v ON_ERROR_STOP=1 -d gt -f tests/01_rls_isolamento.sql
-- Qualquer falha interrompe com "FALHOU: ...".
\set QUIET on
CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;
CREATE OR REPLACE FUNCTION tests.ok(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', msg; END IF; RAISE NOTICE 'ok  %', msg; END $$;
CREATE OR REPLACE FUNCTION tests.fails(sql text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'ok  % (bloqueado: %)', msg, SQLERRM; RETURN; END;
  RAISE EXCEPTION 'FALHOU: % (o comando passou)', msg;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated, anon;

-- três pessoas: Ana (dona), Bruno (de fora), Carla (convidada)
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-00000000000a', 'ana@teste.dev',   now(), '{"display_name":"Ana","age_confirmed":"true"}'),
 ('00000000-0000-0000-0000-00000000000b', 'bruno@teste.dev', now(), '{"display_name":"Bruno","age_confirmed":"true"}'),
 ('00000000-0000-0000-0000-00000000000c', 'carla@teste.dev', now(), '{"display_name":"Carla","age_confirmed":"true"}'),
 ('00000000-0000-0000-0000-00000000000d', 'google@teste.dev', now(), '{"full_name":"Gui"}');
INSERT INTO platform_admins (user_id) VALUES ('00000000-0000-0000-0000-00000000000a');

CREATE OR REPLACE FUNCTION tests.login(u text, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', u, false),
         set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', aal)::text, false);
$$;
GRANT EXECUTE ON FUNCTION tests.login(text, text) TO authenticated;

-- ── Ana cria o workspace de equipe e escreve no #geral
SELECT tests.login('00000000-0000-0000-0000-00000000000a');
SET ROLE authenticated;
SELECT public.create_team_workspace('Estúdio Ana') AS ws_a \gset
SELECT id AS ch_a FROM channels WHERE workspace_id = :'ws_a' AND name = 'geral' \gset
INSERT INTO messages (workspace_id, channel_id, sender_id, content) VALUES (:'ws_a', :'ch_a', auth.uid(), 'oi equipe');
INSERT INTO channels (workspace_id, name, kind, visibility, created_by) VALUES (:'ws_a', 'diretoria', 'CUSTOM', 'PRIVATE', auth.uid()) RETURNING id AS ch_priv \gset
INSERT INTO channel_members (channel_id, user_id, role) VALUES (:'ch_priv', auth.uid(), 'CHANNEL_MODERATOR');
INSERT INTO messages (workspace_id, channel_id, sender_id, content) VALUES (:'ws_a', :'ch_priv', auth.uid(), 'segredo');
SELECT tests.fails($$SELECT public.create_team_workspace('Segundo')$$, 'limite de 1 workspace de equipe no plano grátis');
SELECT tests.fails(format($$UPDATE workspace_settings SET file_retention_hours = 720 WHERE workspace_id = %L$$, :'ws_a'), 'prazo de 30 dias desligado pelo admin');
SELECT tests.fails(format($$UPDATE workspace_settings SET calls_enabled = true WHERE workspace_id = %L$$, :'ws_a'), 'dona não liga reuniões sozinha');
SELECT tests.ok((SELECT count(*) FROM access_logs) = 0 AND (SELECT count(*) FROM error_events) = 0, 'admin sem MFA (aal1) não lê registros');
RESET ROLE;

-- convite para Carla (o servidor guarda só o hash)
INSERT INTO workspace_invites (workspace_id, email, role, token_hash, expires_at, created_by)
VALUES (:'ws_a', 'carla@teste.dev', 'MEMBER', encode(sha256('tok-carla'::bytea), 'hex'), now() + interval '7 days', '00000000-0000-0000-0000-00000000000a');
INSERT INTO workspace_invites (workspace_id, email, role, token_hash, expires_at, created_by)
VALUES (:'ws_a', 'outra@teste.dev', 'MEMBER', encode(sha256('tok-outra'::bytea), 'hex'), now() + interval '7 days', '00000000-0000-0000-0000-00000000000a');

-- ── Bruno, de fora, não vê nem escreve nada do workspace da Ana
SELECT tests.login('00000000-0000-0000-0000-00000000000b');
SET ROLE authenticated;
SELECT tests.ok((SELECT count(*) FROM workspaces WHERE id = :'ws_a') = 0, 'Bruno não vê o workspace da Ana');
SELECT tests.ok((SELECT count(*) FROM channels WHERE workspace_id = :'ws_a') = 0, 'Bruno não vê os canais');
SELECT tests.ok((SELECT count(*) FROM messages WHERE workspace_id = :'ws_a') = 0, 'Bruno não lê as mensagens');
SELECT tests.ok((SELECT count(*) FROM workspace_members WHERE workspace_id = :'ws_a') = 0, 'Bruno não vê os membros');
SELECT tests.ok((SELECT count(*) FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000a') = 0, 'Bruno não vê o perfil da Ana');
SELECT tests.fails(format($$INSERT INTO messages (workspace_id, channel_id, sender_id, content) VALUES (%L, %L, auth.uid(), 'invadi')$$, :'ws_a', :'ch_a'), 'Bruno não escreve no canal da Ana');
SELECT tests.fails(format($$INSERT INTO channel_members (channel_id, user_id) VALUES (%L, auth.uid())$$, :'ch_a'), 'Bruno não se põe no canal da Ana');
SELECT tests.fails(format($$INSERT INTO workspace_invites (workspace_id, role, token_hash, expires_at, created_by) VALUES (%L, 'ADMIN', 'x', now() + interval '1 day', auth.uid())$$, :'ws_a'), 'Bruno não cria convite');
SELECT tests.fails($$SELECT public.accept_invite('tok-carla')$$, 'convite da Carla não serve para o Bruno');
-- mensagem com workspace_id do Bruno mas canal da Ana (troca de IDs)
SELECT id AS ws_b FROM workspaces WHERE kind = 'PERSONAL' \gset
SELECT tests.fails(format($$INSERT INTO messages (workspace_id, channel_id, sender_id, content) VALUES (%L, %L, auth.uid(), 'x')$$, :'ws_b', :'ch_a'), 'IDs trocados não passam');
SELECT tests.fails($$UPDATE admin_actions SET reason = 'x'$$, 'registro de ações não muda') ;
SELECT tests.fails($$SELECT public.log_error('f', 'SERVER', 'm', 'l', null, null, null, null, null)$$, 'só o servidor grava erro');
SELECT tests.fails($$SELECT public.rate_limit_hit('k', 1, 60)$$, 'só o servidor usa o rate limit');
RESET ROLE;

-- ── Carla aceita o convite e passa a ver o #geral, mas não o canal privado
SELECT tests.login('00000000-0000-0000-0000-00000000000c');
SET ROLE authenticated;
SELECT tests.ok(public.accept_invite('tok-carla') = :'ws_a', 'Carla aceita o convite');
SELECT tests.fails($$SELECT public.accept_invite('tok-carla')$$, 'convite não vale duas vezes');
SELECT tests.fails($$SELECT public.accept_invite('tok-outra')$$, 'convite de outro e-mail não serve');
SELECT tests.ok((SELECT count(*) FROM messages WHERE channel_id = :'ch_a') = 1, 'Carla lê o #geral');
SELECT tests.ok((SELECT count(*) FROM messages WHERE channel_id = :'ch_priv') = 0, 'Carla não lê o canal privado');
SELECT tests.ok((SELECT count(*) FROM workspace_invites) = 0, 'membro comum não vê convites');
UPDATE workspace_settings SET message_retention_months = 12 WHERE workspace_id = :'ws_a';
SELECT tests.ok((SELECT message_retention_months FROM workspace_settings WHERE workspace_id = :'ws_a') = 3, 'membro comum não muda o prazo');
DELETE FROM workspace_members WHERE workspace_id = :'ws_a' AND role = 'OWNER';
SELECT tests.ok((SELECT count(*) FROM workspace_members WHERE workspace_id = :'ws_a' AND role = 'OWNER') = 1, 'ninguém remove a dona');
RESET ROLE;

-- ── Ana com MFA (aal2) vê os registros; sem MFA, não
SELECT public.log_access('00000000-0000-0000-0000-00000000000b', 'LOGIN', 'password', '10.0.0.1', 'Chrome');
SELECT * FROM public.log_error('fp1', 'SERVER', 'TypeError x', '/w', 'stack', '0.1', null, null, 'Chrome') \gset e_
SELECT tests.ok(:'e_is_new'::boolean AND :'e_should_alert'::boolean, 'erro novo gera alerta');
SELECT * FROM public.log_error('fp1', 'SERVER', 'TypeError x', '/w', 'stack', '0.1', null, null, 'Chrome') \gset e2_
SELECT tests.ok(NOT :'e2_is_new'::boolean AND NOT :'e2_should_alert'::boolean, 'repetição agrupa e não repete o alerta');
SELECT tests.login('00000000-0000-0000-0000-00000000000a', 'aal2');
SET ROLE authenticated;
SELECT tests.ok((SELECT count(*) FROM access_logs) = 1, 'admin com MFA lê registros de acesso');
SELECT tests.ok((SELECT count FROM error_events WHERE fingerprint = 'fp1') = 2, 'erro agrupado com contagem 2');
SELECT tests.ok((SELECT count(*) FROM notifications WHERE type = 'ERROR_ALERT') = 1, 'alerta foi para o sino do admin');
UPDATE workspace_settings SET calls_enabled = true WHERE workspace_id = :'ws_a';
SELECT tests.ok((SELECT calls_enabled FROM workspace_settings WHERE workspace_id = :'ws_a'), 'admin com MFA libera reuniões');
RESET ROLE;

-- ── Conta criada pelo Google começa sem aceite de idade e termos
SELECT tests.login('00000000-0000-0000-0000-00000000000d');
SET ROLE authenticated;
SELECT tests.ok((SELECT onboarding_step FROM profiles WHERE id = auth.uid()) = 0, 'conta Google precisa confirmar 18+');
SELECT tests.fails($$SELECT public.create_team_workspace('Gui')$$, 'sem confirmar 18+ não cria workspace');
SELECT public.confirm_onboarding();
SELECT tests.ok((SELECT count(*) FROM consents WHERE user_id = auth.uid()) = 3, 'aceites gravados com versão');
RESET ROLE;

-- ── Visitante sem login só vê documentos legais e ajuda publicada
SET ROLE anon;
SELECT tests.fails($$SELECT * FROM profiles$$, 'visitante não lê perfis');
SELECT tests.ok((SELECT count(*) FROM legal_documents) = 2, 'visitante lê termos e privacidade');
RESET ROLE;

-- ── Rotina de mensagens apaga o que passou do prazo
UPDATE messages SET created_at = now() - interval '4 months' WHERE content = 'oi equipe';
SELECT tests.ok(private.purge_expired_messages() = 1, 'rotina apagou a mensagem de 4 meses (prazo 3)');

-- ── Nenhuma tabela pública sem RLS
SELECT tests.ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity), 'todas as tabelas com RLS');
\echo 'Todos os testes de isolamento passaram.'
