/* 車内 iPad (/cabin): 声・効果音・部屋の写真・地図の部品を iPad に保存して、2 回目からは通信なし・待ち時間なしで出す。
 * 対象: /cabin/** の静的ファイル と Supabase に上げた部屋の写真 (driver-music/rooms/)。ページ本体や API は保存しない (いつも最新)。
 * 中身を差し替えたら VERSION を上げる。 */
const VERSION = "cabin-static-v1";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("cabin-static-") && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = (u) =>
  (u.origin === self.location.origin && /^\/cabin\/.+\.(mp3|webp|jpg|png|js|css|json)$/.test(u.pathname)) ||
  /\/storage\/v1\/object\/public\/driver-music\/rooms\//.test(u.pathname);

/* 「この iPad に保存」ボタン: 渡された URL を全部保存 */
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "precache") return;
  const port = e.ports[0];
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION); let done = 0, fail = 0;
    for (const url of e.data.urls) {
      try { if (!(await cache.match(url))) { const r = await fetch(url, { mode: "cors" }); if (r.ok && r.status === 200) await cache.put(url, r); else fail++; } } catch { fail++; }
      done++; port && port.postMessage({ done, total: e.data.urls.length, fail });
    }
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (!isStatic(u)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = u.origin + u.pathname + u.search;
    let res = await cache.match(key);
    if (!res) {
      try {
        const net = await fetch(req.url, { mode: u.origin === self.location.origin ? "same-origin" : "cors" });
        if (net.ok && net.status === 200) { await cache.put(key, net.clone()); res = net; } else return net;
      } catch (err) { return Response.error(); }
    }
    // 音声の Range リクエスト (iPad の audio 要素) は保存済みの全体から切り出して返す
    const range = req.headers.get("range");
    if (!range) return res;
    const buf = await res.clone().arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
    });
  })());
});
