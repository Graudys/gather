/* Gather — service worker (PWA).
 *
 * Regras de segurança:
 * 1. Só guarda a "casca" pública: a página /offline, ícones e os arquivos
 *    estáticos do Next (/_next/static, que têm hash no nome e não têm dado
 *    de ninguém). Nunca guarda páginas do app, respostas da API, arquivos
 *    do Storage ou qualquer coisa de quem está logado.
 * 2. Ao sair da conta, a página manda "logout": o cache é apagado e as
 *    notificações abertas somem.
 * 3. Notificação só abre links do próprio Gather (/app...).
 */
const VERSION = "gather-v1";
const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(VERSION);
      // Sem cookies: a casca é pública e não pode levar nada da sessão.
      await c.addAll(SHELL.map((u) => new Request(u, { credentials: "omit", cache: "reload" })));
      // CSS e JS que a página /offline usa (estáticos com hash) vão junto.
      const page = await c.match("/offline");
      const html = page ? await page.clone().text() : "";
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
      // Um por um: se um falhar, os outros ficam guardados.
      await Promise.all(assets.map((a) => c.add(new Request(a, { credentials: "omit" })).catch(() => undefined)));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isStatic = (url) => url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Storage, LiveKit etc.: direto, sem cache

  // Páginas: sempre da rede. Sem internet, mostra a página /offline guardada.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match("/offline")) || Response.error()));
    return;
  }

  // Estáticos com hash: do cache, senão da rede (e guarda).
  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Todo o resto (API, páginas de dados, /api/arquivos): o navegador cuida, sem cache aqui.
});

const safeHref = (href) => (typeof href === "string" && /^\/app(\/|$|\?)/.test(href) && !href.includes("//") ? href : "/app");

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title.slice(0, 60) : "Gather";
  const body = typeof data.body === "string" ? data.body.slice(0, 120) : "Você tem um aviso novo";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: typeof data.tag === "string" ? data.tag.slice(0, 64) : undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href: safeHref(data.href) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data && event.notification.data.href);
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          return w.navigate(href);
        }
      }
      return self.clients.openWindow(href);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.data && event.data.type === "logout") {
    event.waitUntil(
      (async () => {
        for (const key of await caches.keys()) await caches.delete(key);
        for (const n of await self.registration.getNotifications()) n.close();
        await caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { credentials: "omit" }))));
      })(),
    );
  }
});
