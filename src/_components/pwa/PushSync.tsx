"use client";
import { useEffect } from "react";
import { savePushSubscription } from "@/_data/push.actions";
import { pushSupported } from "./sw";

/**
 * Dentro do app (logado): se este aparelho já tem notificações ligadas,
 * reaponta a inscrição para a sessão atual. Assim, depois de sair e entrar
 * de novo, os avisos voltam sem a pessoa ter que ligar outra vez.
 * Nunca pede permissão sozinho: isso só acontece no botão do Perfil.
 */
export function PushSync() {
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== "granted") return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await savePushSubscription(sub.toJSON()).catch(() => undefined);
    })();
  }, []);
  return null;
}
