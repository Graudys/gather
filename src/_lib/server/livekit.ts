import "server-only";
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from "livekit-server-sdk";
import { serverEnv } from "@/_lib/server/env";

function cfg() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = serverEnv();
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) throw new Error("LiveKit não configurado");
  return { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET };
}

/**
 * Token de uma sala só, só microfone, com validade curta.
 * Vídeo e tela ficam bloqueados pelo próprio token.
 */
export async function audioToken(room: string, identity: string, name: string, secondsLeft: number) {
  const { key, secret } = cfg();
  const at = new AccessToken(key, secret, { identity, name, ttl: Math.max(60, Math.min(secondsLeft, 60 * 60)) });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}

export function roomService() {
  const { url, key, secret } = cfg();
  return new RoomServiceClient(url.replace(/^wss:/, "https:"), key, secret);
}

export function webhookReceiver() {
  const { key, secret } = cfg();
  return new WebhookReceiver(key, secret);
}

export const livekitUrl = () => cfg().url;
