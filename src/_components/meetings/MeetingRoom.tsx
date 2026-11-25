"use client";
import { Icon } from "@/_components/ui/Icon";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from "livekit-client";
import type { MeetingView } from "@/types/domain";
import { endMeeting, joinMeeting, leaveMeeting } from "@/_data/meetings.actions";
import { colorFor, initialsOf } from "@/_components/chat/Avatar";
import { Button } from "@/_components/ui/Button";
import { localTime } from "@/lib/time";
import s from "@/_styles/meetings/Meetings.module.css";

type Phase = "pre" | "joining" | "in" | "left";
type Tile = { id: string; name: string; speaking: boolean; muted: boolean; me: boolean };

const ERRORS: Record<string, string> = {
  cota: "Os minutos de reunião deste mês acabaram.",
  cheia: "A sala está cheia.",
  encerrada: "Esta reunião já terminou.",
  desligado: "Reuniões não estão disponíveis (LiveKit não configurado ou desligado no workspace).",
  muitas: "Muitas tentativas. Espere um pouco.",
  mic: "Não consegui acessar o microfone. Libere o microfone no navegador e tente de novo.",
  conexao: "Não foi possível conectar na sala. Confira a internet e tente de novo.",
};

/** Antes de entrar (teste do microfone) e a sala em si. Só áudio. */
export function MeetingRoom({ m, workspaceId, me }: { m: MeetingView; workspaceId: string; me: { id: string; name: string } }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("pre");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [endsAt, setEndsAt] = useState<string | null>(m.hardEndAt);
  const [now, setNow] = useState(() => Date.now());
  const room = useRef<Room | null>(null);
  const participantId = useRef<string | null>(null);

  // ── Teste do microfone (antes de entrar)
  useEffect(() => {
    if (phase !== "pre") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let ctx: AudioContext | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
        setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"));
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("mic");
      }
    })();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [phase, deviceId]);

  // ── Relógio da reunião
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = endsAt ? Math.max(0, Math.floor((Date.parse(endsAt) - now) / 1000)) : null;

  // ── Acabou o tempo ou alguém encerrou: sai da sala.
  useEffect(() => {
    if (phase === "in" && ((left !== null && left <= 0) || m.status === "ENDED" || m.status === "CANCELLED")) void leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, m.status, phase]);

  // ── Fechar a aba no meio: avisa o servidor (o webhook do LiveKit também cobre).
  useEffect(() => {
    const onHide = () => {
      if (!participantId.current) return;
      navigator.sendBeacon("/api/reunioes/sair", new Blob([JSON.stringify({ workspaceId, participantId: participantId.current })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [workspaceId]);

  function sync(r: Room) {
    const all: Participant[] = [r.localParticipant, ...r.remoteParticipants.values()];
    setTiles(
      all.map((p) => ({
        id: p.identity,
        name: p.name || "Pessoa",
        speaking: p.isSpeaking,
        muted: !p.isMicrophoneEnabled,
        me: p.identity === me.id,
      })),
    );
  }

  async function join() {
    setError(null);
    setPhase("joining");
    const res = await joinMeeting(workspaceId, m.id);
    if (!res.ok) {
      setError(res.error);
      setPhase("pre");
      return;
    }
    participantId.current = res.participantId;
    setEndsAt(res.hardEndAt);
    const r = new Room({ adaptiveStream: false, dynacast: false });
    room.current = r;
    const update = () => sync(r);
    r.on(RoomEvent.ParticipantConnected, update)
      .on(RoomEvent.ParticipantDisconnected, update)
      .on(RoomEvent.ActiveSpeakersChanged, update)
      .on(RoomEvent.TrackMuted, update)
      .on(RoomEvent.TrackUnmuted, update)
      .on(RoomEvent.LocalTrackPublished, update)
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.lk = "1";
          document.body.appendChild(el);
        }
        update();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        update();
      })
      .on(RoomEvent.Disconnected, () => {
        document.querySelectorAll("audio[data-lk]").forEach((el) => el.remove());
        setPhase((p) => (p === "in" ? "left" : p));
      });
    try {
      await r.connect(res.url, res.token);
      await r.localParticipant.setMicrophoneEnabled(true, deviceId ? { deviceId } : undefined);
      setMicOn(true);
      sync(r);
      setPhase("in");
      router.refresh();
    } catch {
      setError("conexao");
      setPhase("pre");
      await leaveMeeting(workspaceId, res.participantId);
      participantId.current = null;
    }
  }

  async function leave() {
    const r = room.current;
    room.current = null;
    await r?.disconnect();
    if (participantId.current) await leaveMeeting(workspaceId, participantId.current);
    participantId.current = null;
    setPhase("left");
    router.refresh();
  }

  async function toggleMic() {
    const r = room.current;
    if (!r) return;
    const next = !micOn;
    await r.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
    sync(r);
  }

  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  if (phase === "pre" || phase === "joining") {
    return (
      <div className={s.pre}>
        <h1 className={s.stageTitle}>Antes de entrar</h1>
        {error && <div className={s.error}>{ERRORS[error] ?? "Não foi possível entrar."}</div>}
        <div className={s.card}>
          <b className={s.cardTitle}>{m.title}</b>
          <div className={s.kv}>
            {m.startsAt && <><span>Horário</span><b>{localTime(m.startsAt)}</b></>}
            {m.project && <><span>Projeto</span><b>{m.project.name}</b></>}
            <span>Na sala agora</span><b>{m.inRoom.length} de {m.maxParticipants}</b>
            <span>Termina no máximo</span><b>{m.hardEndAt ? `às ${localTime(m.hardEndAt)}` : `${m.maxDurationMin} min depois de começar`}</b>
            <span>Minutos do workspace</span><b>{m.usage.left} restantes</b>
          </div>
        </div>
        <div className={s.card}>
          <b className={s.cardTitle}>Microfone</b>
          <div className={s.meter} aria-label="Volume do microfone"><div className={s.meterFill} style={{ width: `${Math.round(level * 100)}%` }} /></div>
          <p className={s.note}>{level > 0.08 ? "Microfone funcionando." : "Fale algo para testar."}</p>
          {devices.length > 1 && (
            <select className={s.select} value={deviceId} onChange={(e) => setDeviceId(e.currentTarget.value)} aria-label="Escolher microfone">
              <option value="">Padrão do sistema</option>
              {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microfone"}</option>)}
            </select>
          )}
        </div>
        <Button onClick={join} disabled={phase === "joining" || !m.configured || !m.usage.enabled}>
          {phase === "joining" ? "Entrando…" : "Entrar na reunião"}
        </Button>
        <p className={s.note}>Só áudio. Se os minutos do mês acabarem, novas reuniões ficam bloqueadas até a renovação.</p>
      </div>
    );
  }

  if (phase === "left") {
    return (
      <div className={s.pre}>
        <h1 className={s.stageTitle}>Você saiu da reunião</h1>
        <div className={s.controls}>
          {m.status === "LIVE" && <Button onClick={() => setPhase("pre")}>Voltar para a sala</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className={s.stage}>
      <div className={s.stageHead}>
        <h1 className={s.stageTitle}>{m.title}</h1>
        {left !== null && <span className={`${s.timer} ${left < 300 ? s.timerWarn : ""}`}>⏱ {mmss(left)} restantes</span>}
      </div>
      {left !== null && left < 300 && <div className={s.banner}>Faltam {Math.ceil(left / 60)} minutos. A reunião termina às {endsAt ? localTime(endsAt) : ""} para todos.</div>}
      <div className={s.tiles}>
        {tiles.map((t) => (
          <div key={t.id} className={`${s.tile} ${t.speaking ? s.speaking : ""}`}>
            <span className={s.mic}><Icon name={t.muted ? "micOff" : "mic"} size={14} /></span>
            <span className={s.bigAvatar} style={{ background: colorFor(t.id) }}>{initialsOf(t.name)}</span>
            <span className={s.tileName}>{t.name}{t.me ? " (você)" : ""}</span>
          </div>
        ))}
      </div>
      <div className={s.controls}>
        <button className={`${s.ctrl} ${micOn ? "" : s.ctrlOff}`} onClick={toggleMic} aria-pressed={!micOn}>{micOn ? <><Icon name="mic" /> Silenciar</> : <><Icon name="micOff" /> Ligar microfone</>}</button>
        <button className={`${s.ctrl} ${s.leave}`} onClick={leave}>Sair</button>
        {m.canEnd && (
          <form action={endMeeting}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="meetingId" value={m.id} />
            <button className={s.ctrl}>Encerrar para todos</button>
          </form>
        )}
      </div>
      <p className={s.note} style={{ textAlign: "center" }}>O Gather não grava o áudio.</p>
    </div>
  );
}
