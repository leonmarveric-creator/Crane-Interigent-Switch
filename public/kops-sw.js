/* K-OPS (AGENT KAKU の新しい画面): 画面の部品・字体・声・曲・地図の写真をこの端末に保存して、走行中のかくつきを防ぐ。
 * 対象: /kops/**・/cabin/leaflet/**・/cabin/routes.json・/cabin/bay.webp・国土地理院の地図・曲とカバー (driver-music: KAKU の曲・お父さんの曲)。ページ本体や API は保存しない。 */
const VERSION = "kops-v17";
const TILES = "kops-tiles-v1";
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("kops-") && k !== VERSION && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});
const isTile = (u) => u.hostname === "cyberjapandata.gsi.go.jp";
const isStatic = (u) =>
  (u.origin === self.location.origin && (/^\/kops\//.test(u.pathname) || /^\/cabin\/leaflet\//.test(u.pathname) || u.pathname === "/cabin/routes.json" || u.pathname === "/cabin/bay.webp")) ||
  /\/storage\/v1\/object\/public\/driver-music\//.test(u.pathname);
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "precache") return;
  const port = e.ports[0];
  e.waitUntil((async () => {
    const st = await caches.open(VERSION), tl = await caches.open(TILES); let done = 0, fail = 0; const urls = e.data.urls || [];
    const one = async (url) => {
      try {
        const u = new URL(url, self.location.origin); const c = isTile(u) ? tl : st;
        if (!(await c.match(u.href))) { const r = await fetch(u.href, { mode: "cors" }); if (r.ok && r.status === 200) await c.put(u.href, r); else fail++; }
      } catch { fail++; }
      done++; if (done % 10 === 0 || done === urls.length) port && port.postMessage({ done, total: urls.length, fail });
    };
    for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(one));
    port && port.postMessage({ done: urls.length, total: urls.length, fail });
  })());
});
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (isTile(u)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES); const hit = await c.match(u.href); if (hit) return hit;
      try { const r = await fetch(u.href, { mode: "cors" }); if (r.ok) c.put(u.href, r.clone()); return r; } catch { return fetch(req); }
    })());
    return;
  }
  if (!isStatic(u) || req.headers.get("range")) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION); const hit = await c.match(req, { ignoreSearch: /\/kops\/kops\.(js|css)$/.test(u.pathname) ? false : true }); if (hit) return hit;
    try { const r = await fetch(req); if (r.ok && r.status === 200) c.put(req, r.clone()); return r; } catch (err) { const any = await c.match(req, { ignoreSearch: true }); if (any) return any; throw err; }
  })());
});
