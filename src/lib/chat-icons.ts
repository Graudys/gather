/**
 * Ícones que a pessoa pode escolher para canais e grupos.
 * Lista fechada: o servidor só grava o que estiver aqui (nada de texto livre
 * ou HTML no lugar do ícone).
 */
export const CHAT_ICONS = [
  "💬", "📣", "📌", "💡", "🎯", "🚀", "🛠️", "🧪",
  "📊", "📁", "📝", "📚", "🎨", "🎧", "🎮", "🏠",
  "☕", "🍕", "🌱", "🔥", "⭐", "❤️", "🎉", "🤝",
  "🧠", "💼", "📅", "🔒", "🐛", "✅", "🌎", "🦉",
] as const;

export const isChatIcon = (v: unknown): v is (typeof CHAT_ICONS)[number] => typeof v === "string" && (CHAT_ICONS as readonly string[]).includes(v);
