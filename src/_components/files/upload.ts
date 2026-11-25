"use client";
import { startUpload } from "@/_data/files.actions";
import { fileProblem } from "@/lib/files";

/**
 * Fotos grandes são reduzidas no próprio navegador antes de subir (lado maior
 * até 2560 px). GIF, PNG pequeno e outros arquivos vão como estão.
 */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(png|webp|heic|heif|jpe?g)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file; // navegador sem suporte (ex.: HEIC): vai o original
  }
}

/** Envia um arquivo e devolve o recibo para anexar. Chama onProgress de 0 a 1. */
export async function uploadFile(workspaceId: string, dest: string, original: File, onProgress: (p: number) => void): Promise<{ ticket: string; file: File }> {
  const file = await shrinkPhoto(original);
  const problem = fileProblem(file.name, file.size);
  if (problem) throw new Error(problem);
  const start = await startUpload({ workspaceId, dest, name: file.name, size: file.size, mime: file.type || "application/octet-stream" });
  if (!start.ok) throw new Error(start.error);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", start.url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("O envio falhou. Tente de novo.")));
    xhr.onerror = () => reject(new Error("Sem conexão com o armazenamento."));
    xhr.send(file);
  });
  onProgress(1);
  return { ticket: start.ticket, file };
}
