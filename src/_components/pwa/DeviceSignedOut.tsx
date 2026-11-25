"use client";
import { useEffect } from "react";

/**
 * Depois de sair da conta: apaga o cache do service worker, fecha as
 * notificações abertas e cancela a inscrição deste aparelho. O servidor já
 * apagou a inscrição junto com a sessão; isto limpa o lado do navegador.
 */
export function DeviceSignedOut() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) return;
      reg.active?.postMessage({ type: "logout" });
      const sub = await reg.pushManager?.getSubscription();
      await sub?.unsubscribe().catch(() => undefined);
    })();
  }, []);
  return null;
}
