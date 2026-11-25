"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/_components/ui/Button";
import { removePushSubscription, savePushSubscription } from "@/_data/push.actions";
import { isIos, isStandalone, pushSupported, registerSw, vapidKey } from "./sw";
import s from "@/_styles/app/Profile.module.css";

const noSubscribe = () => () => undefined;
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type PushState = "carregando" | "sem-suporte" | "instalar-ios" | "bloqueado" | "desligado" | "ligado";

/** Perfil › Neste aparelho: instalar o app e ligar/desligar as notificações. */
export function DeviceCard({ devices }: { devices: number }) {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  // Lidos no navegador; no servidor valem "instalado" e "não é iPhone" (sem erro de hidratação).
  const standalone = useSyncExternalStore(noSubscribe, isStandalone, () => true);
  const ios = useSyncExternalStore(noSubscribe, isIos, () => false);
  const [push, setPush] = useState<PushState>("carregando");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      if (isIos() && !isStandalone()) return setPush("instalar-ios"); // no iPhone, push só com o app na tela de início
      if (!pushSupported()) return setPush("sem-suporte");
      if (Notification.permission === "denied") return setPush("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration("/");
      setPush((await reg?.pushManager.getSubscription()) ? "ligado" : "desligado");
    })();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission(); // só aqui, depois do clique
      if (perm !== "granted") return setPush(perm === "denied" ? "bloqueado" : "desligado");
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerSw());
      const key = vapidKey();
      if (!reg || !key) return setPush("sem-suporte");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) {
        await sub.unsubscribe().catch(() => undefined);
        setMsg("Não deu para ligar agora. Tente de novo em alguns minutos.");
        return setPush("desligado");
      }
      setPush("ligado");
    } catch {
      setMsg("Este navegador não deixou ligar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setPush("desligado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.card2} id="aparelho">
      <h2>Neste aparelho</h2>
      <p className={s.muted}>Instale o Gather como app e receba avisos mesmo com ele fechado.</p>

      {!standalone && (
        <div className={`${s.pref} ${s.prefRow}`}>
          <span>
            <b>Instalar o app</b>
            {install ? (
              <small>Abre em janela própria, com ícone na tela inicial ou na barra de tarefas.</small>
            ) : ios ? (
              <small>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</small>
            ) : (
              <small>No Chrome ou Edge, use o ícone de instalar na barra de endereço ou o menu “Instalar Gather”.</small>
            )}
          </span>
          {install && (
            <Button type="button" variant="ghost" onClick={async () => { await install.prompt(); setInstall(null); }}>Instalar</Button>
          )}
        </div>
      )}

      <div className={`${s.pref} ${s.prefRow}`}>
        <span>
          <b>Notificações no aparelho</b>
          <small>
            {push === "ligado" && "Ligadas. Os avisos mostram só o tipo (ex.: “nova mensagem direta”), nunca o texto."}
            {push === "desligado" && "Desligadas. O sino dentro do app continua funcionando."}
            {push === "bloqueado" && "Bloqueadas no navegador. Libere nas configurações do site para ligar de novo."}
            {push === "instalar-ios" && "No iPhone, primeiro instale o app na tela de início e abra por lá."}
            {push === "sem-suporte" && "Este navegador não recebe notificações do Gather."}
            {push === "carregando" && "Verificando…"}
          </small>
        </span>
        {push === "desligado" && <Button type="button" variant="ghost" disabled={busy} onClick={turnOn}>Ligar</Button>}
        {push === "ligado" && <Button type="button" variant="ghost" disabled={busy} onClick={turnOff}>Desligar</Button>}
      </div>
      {msg && <p className={s.faint} role="status">{msg}</p>}
      <p className={s.faint}>
        {devices === 0 ? "Nenhum aparelho recebe avisos." : devices === 1 ? "1 aparelho recebe avisos." : `${devices} aparelhos recebem avisos.`} Ao sair da conta, o aparelho para de receber na hora.
      </p>
    </section>
  );
}
