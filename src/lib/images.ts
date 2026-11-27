/** Fotos de perfil e de workspace (recortadas no navegador em 256×256). */
export const PHOTO_SIZE = 256;
export const MAX_PHOTO_BYTES = 300_000;

/**
 * Tipo real da imagem pelos primeiros bytes (não confia no nome nem no tipo
 * que o navegador diz). Só WebP, JPEG e PNG; SVG nunca (pode ter script).
 */
export function sniffImage(b: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

/** Versão da foto (parte do nome do arquivo) para a URL mudar quando a foto muda. */
export const photoVersion = (path: string | null | undefined) => (path ? path.split("/").pop()!.split(".")[0]!.slice(0, 12) : "");
