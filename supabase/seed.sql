-- Dados de exemplo só para o banco LOCAL (supabase start / db reset).
-- Não roda no projeto de produção.
INSERT INTO help_categories (slug, name, icon, position) VALUES
  ('primeiros-passos', 'Primeiros passos', 'spark', 1),
  ('chat', 'Chat e arquivos', 'msg', 2),
  ('reunioes', 'Reuniões', 'mic', 3),
  ('privacidade', 'Privacidade e dados', 'lock', 4)
ON CONFLICT DO NOTHING;
