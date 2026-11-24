import "server-only";
import { headers } from "next/headers";

/** nonce da CSP desta requisição (criado em src/proxy.ts). */
export async function getNonce() {
  return (await headers()).get("x-nonce") ?? undefined;
}
