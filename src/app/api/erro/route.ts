import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/_lib/auth/dal";
import { reportError } from "@/_lib/server/observability";
import { hit } from "@/_lib/server/rate-limit";
import { clientIp, sameOrigin, shortUserAgent } from "@/_lib/server/request";

// Erros do navegador chegam aqui (error.tsx e global-error.tsx).
const Body = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(8000).optional(),
  path: z.string().max(300),
  workspaceId: z.uuid().optional(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const ip = await clientIp();
  if (!(await hit("clientError", ip))) return new NextResponse(null, { status: 429 });
  const raw = await req.text();
  if (raw.length > 12_000) return new NextResponse(null, { status: 413 });
  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const user = await getSessionUser();
  await reportError({
    source: "BROWSER",
    message: parsed.data.message,
    location: parsed.data.path.split("?")[0],
    stack: parsed.data.stack ?? null,
    userId: user?.id ?? null,
    workspaceId: parsed.data.workspaceId ?? null,
    browser: shortUserAgent(req.headers.get("user-agent")).split(" · ")[0],
  });
  return new NextResponse(null, { status: 204 });
}
