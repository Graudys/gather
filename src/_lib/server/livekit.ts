import "server-only";
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from "livekit-server-sdk";

/**
 * LiveKit (reuniões só por áudio). Se as chaves não estiverem no .env,
 * o app mostra "Reuniões não configuradas" e o resto segue funcionando.
 * Nenhuma mídia passa pelo nosso servidor e nada é gravado.
 */
export function livekitConfig() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret || !url.startsWith("wss://")) return null;
  return { url, key, secret, http: url.replace(/^wss:/, "https:") };
}

/** Token de entrada: só esta sala, só microfone, sem dados, válido até o fim da reunião. */
export async function joinToken(room: string, user: { id: string; name: string }, ttlSeconds: number) {
  const cfg = livekitConfig();
  if (!cfg) throw new Error("LiveKit não configurado");
  const at = new AccessToken(cfg.key, cfg.secret, { identity: user.id, name: user.name, ttl: Math.max(60, Math.min(ttlSeconds, 4 * 3600)) });
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}

function rooms() {
  const cfg = livekitConfig();
  return cfg ? new RoomServiceClient(cfg.http, cfg.key, cfg.secret) : null;
}

/** Cria a sala com limite de pessoas. Falha de rede não impede entrar (a sala nasce sozinha). */
export async function ensureRoom(room: string, maxParticipants: number) {
  try {
    await rooms()?.createRoom({ name: room, maxParticipants, emptyTimeout: 5 * 60, departureTimeout: 20 });
  } catch (e) {
    console.warn("[livekit] createRoom falhou", e);
  }
}

/** Encerra para todo mundo. */
export async function closeRoom(room: string) {
  try {
    await rooms()?.deleteRoom(room);
  } catch (e) {
    console.warn("[livekit] deleteRoom falhou", e);
  }
}

export async function countInRoom(room: string): Promise<number | null> {
  try {
    const r = rooms();
    return r ? (await r.listParticipants(room)).length : null;
  } catch {
    return null;
  }
}

export function webhookReceiver() {
  const cfg = livekitConfig();
  return cfg ? new WebhookReceiver(cfg.key, cfg.secret) : null;
}
