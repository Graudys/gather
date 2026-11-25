// Regras de arquivos que valem no navegador e no servidor.

/** Limite por arquivo (o plano grátis do Supabase Storage aceita até 50 MB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Quantos arquivos por mensagem. */
export const MAX_FILES_PER_MESSAGE = 10;

// Executáveis e scripts ficam de fora: não dá para garantir que são seguros.
const BLOCKED = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jar", "sh", "app", "dmg", "apk", "dll", "html", "htm", "svg"]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function fileProblem(name: string, size: number): string | null {
  if (!name.trim()) return "Arquivo sem nome.";
  if (size <= 0) return "Arquivo vazio.";
  if (size > MAX_FILE_BYTES) return "Passa de 50 MB.";
  if (BLOCKED.has(extOf(name))) return "Esse tipo de arquivo não é aceito.";
  return null;
}

export const isImage = (mime: string) => /^image\/(png|jpe?g|gif|webp|avif|heic|heif)$/i.test(mime);

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Nome seguro para o caminho no Storage (o nome original fica no banco). */
export function storageName(name: string) {
  const ext = extOf(name);
  const base = name.slice(0, ext ? -(ext.length + 1) : undefined)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "arquivo";
  return ext ? `${base}.${ext.replace(/[^a-z0-9]/g, "")}` : base;
}
