// Constantes do chat usadas no servidor e no navegador.
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅"] as const;
export type Reaction = (typeof REACTIONS)[number];
