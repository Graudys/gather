/**
 * Menções com @ no chat. O "apelido" de cada pessoa é o nome de usuário
 * (Perfil) ou, sem ele, o nome completo sem acento, com pontos: "Ana Souza" → @ana.souza.
 */
export const normalizeHandle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40);

export const handleOf = (p: { name: string; username?: string | null }) => normalizeHandle(p.username || p.name) || "pessoa";

/** Pedaços "@algo" do texto (no começo ou depois de espaço). */
export const MENTION_RE = /(^|[\s(])@([a-z0-9][a-z0-9._-]{1,39})/gi;

export function extractHandles(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) out.add(m[2]!.toLowerCase().replace(/[._-]+$/, ""));
  return [...out].slice(0, 20); // no máximo 20 menções por mensagem
}
