import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_FILE_BYTES } from "@/lib/files";

/**
 * Arquivos no Supabase Storage (bucket privado). A chave secreta só existe no
 * servidor. O navegador nunca a vê: ele recebe uma URL assinada de envio, de
 * uso único, e links de download que valem 1 minuto.
 */
export const BUCKET = "gather-arquivos";

let client: SupabaseClient | null = null;
let bucketReady = false;

export function storageConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function sb() {
  if (!storageConfigured()) throw new Error("Storage não configurado: defina SUPABASE_URL e SUPABASE_SECRET_KEY.");
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Cria o bucket privado na primeira vez (não precisa fazer nada no painel). */
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await sb().storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await sb().storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

/** URL para o navegador enviar o arquivo direto ao Storage (sem passar pela Vercel). */
export async function signUpload(path: string) {
  await ensureBucket();
  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Sem URL de envio");
  return data.signedUrl;
}

/** Tamanho e tipo reais do arquivo já enviado (null se não existe). */
export async function objectInfo(path: string): Promise<{ size: number; mime: string } | null> {
  const { data, error } = await sb().storage.from(BUCKET).info(path);
  if (error || !data) return null;
  const d = data as { size?: number; contentType?: string; metadata?: { size?: number; mimetype?: string } };
  return { size: Number(d.size ?? d.metadata?.size ?? 0), mime: String(d.contentType ?? d.metadata?.mimetype ?? "application/octet-stream") };
}

export async function moveObject(from: string, to: string) {
  const { error } = await sb().storage.from(BUCKET).move(from, to);
  if (error) throw error;
}

/** Link de download curto. `download` força baixar com o nome original. */
export async function signDownload(path: string, download?: string) {
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 60, download ? { download } : undefined);
  if (error || !data) throw error ?? new Error("Sem link");
  return data.signedUrl;
}

/** Apaga do Storage (em lotes). Falha aqui não pode travar a ação do usuário. */
export async function removeObjects(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length || !storageConfigured()) return 0;
  let removed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const { data, error } = await sb().storage.from(BUCKET).remove(list.slice(i, i + 100));
    if (error) console.error("[storage] remove", error.message);
    removed += data?.length ?? 0;
  }
  return removed;
}

/** Lista nomes dentro de uma pasta (um nível). */
export async function listFolder(prefix: string) {
  const { data } = await sb().storage.from(BUCKET).list(prefix, { limit: 1000 });
  return data ?? [];
}
