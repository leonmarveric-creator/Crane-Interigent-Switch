/* HIROSHI DRIVE: 画面の画像・アンドロイドの声をスマホに保存して、2 回目からはギガを使わずに表示・再生する。
 * 対象は /driver/*.(jpg|png|webmanifest) と /audio/driver/*.mp3 だけ。ページ本体や API は保存しない (いつも最新)。
 * 画像や声を差し替えたら VERSION を上げる。 */
const VERSION = "drv-static-v1";

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("drv-static-") && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = (u) =>
  u.origin === self.location.origin &&
  (/^\/driver\/[^/]+\.(jpg|png|webmanifest)$/.test(u.pathname) || /^\/audio\/driver\/[^/]+\.mp3$/.test(u.pathname));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (!isStatic(u)) return;
  // 音声の Range リクエストは保存済みの全体から返す (iPhone の audio 要素用)
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = u.origin + u.pathname + u.search;
    let res = await cache.match(key);
    if (!res) {
      try {
        const net = await fetch(key);
        if (net.ok && net.status === 200) { await cache.put(key, net.clone()); res = net; }
        else return net;
      } catch (err) {
        return Response.error();
      }
    }
    const range = req.headers.get("range");
    if (!range) return res;
    const buf = await res.clone().arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
      },
    });
  })());
});
