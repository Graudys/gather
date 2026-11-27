"use client";

/** Liga o service worker. Em dev só com NEXT_PUBLIC_PWA_DEV=1 (o cache atrapalha o recarregar do Next). */
export const pwaEnabled = () =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator && (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_PWA_DEV === "1");

export async function registerSw() {
  if (!pwaEnabled()) return null;
  try {
    // Em dev os arquivos do Next não mudam de nome a cada versão: o worker não guarda nada (?dev=1).
    const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
    return await navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

/** A chave pública VAPID vem em base64url; o navegador quer bytes. */
export function vapidKey(): Uint8Array<ArrayBuffer> | null {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!k) return null;
  const b64 = (k + "=".repeat((4 - (k.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const pushSupported = () =>
  pwaEnabled() && "PushManager" in window && "Notification" in window && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export type PushResult = "ligado" | "bloqueado" | "desligado" | "sem-suporte" | "erro";

/**
 * Liga as notificações do sistema (Windows, Mac, Android, iPhone instalado) neste aparelho.
 * Só deve ser chamada depois de um clique: é aqui que o navegador pede a permissão.
 * `save` grava a inscrição no servidor (Server Action savePushSubscription).
 */
export async function enablePush(save: (sub: PushSubscriptionJSON) => Promise<{ ok: boolean }>): Promise<PushResult> {
  if (!pushSupported()) return "sem-suporte";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "bloqueado" : "desligado";
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerSw());
  const key = vapidKey();
  if (!reg || !key) return "sem-suporte";
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  const r = await save(sub.toJSON());
  if (!r.ok) {
    await sub.unsubscribe().catch(() => undefined);
    return "erro";
  }
  return "ligado";
}

/** Estado atual das notificações do sistema neste aparelho (sem pedir nada). */
export async function pushState(): Promise<"ligado" | "desligado" | "bloqueado" | "sem-suporte" | "instalar-ios"> {
  if (isIos() && !isStandalone()) return "instalar-ios";
  if (!pushSupported()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ? "ligado" : "desligado";
}
