/* ゲスト画面 (/room/…): 部屋の絵・肖像画の動画・額縁・効果音・声をゲストのスマホに保存して、
 * 2 回目からはスマホの中から出す (サーバーへの確認もダウンロードもなし)。
 * 対象は下の isStatic だけ。ページ本体・API・ログイン (PIN) は保存しない (いつもサーバーで確認)。
 * 絵や音を差し替えたら VERSION を上げる (ゲストのスマホも自動で入れ替わる)。 */
const VERSION = "room-static-v1";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("room-static-") && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = (u) =>
  (u.origin === self.location.origin && /^\/(magic-portraits|rooms|audio\/voice|audio\/sfx|magic-seasons)\/[^?]+\.(jpg|jpeg|png|webp|mp4|mp3|m4a)$/.test(u.pathname)) ||
  /\/storage\/v1\/object\/public\/room-art\//.test(u.pathname);

async function getFull(url, cache) {
  let res = await cache.match(url);
  if (res) return res;
  const u = new URL(url);
  const net = await fetch(url, { mode: u.origin === self.location.origin ? "same-origin" : "cors", credentials: "omit" });
  if (net.ok && net.status === 200) await cache.put(url, net.clone());
  return net;
}

/* 画面を開いたあと、その部屋で使う絵・動画を先に保存 (ページから URL の一覧が届く) */
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "precache" || !Array.isArray(e.data.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    for (const url of e.data.urls.slice(0, 40)) { try { if (isStatic(new URL(url))) await getFull(url, cache); } catch { /* 次へ */ } }
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
    let res;
    try { res = await getFull(key, cache); } catch { return fetch(req); }
    if (!res.ok) return res;
    // 動画・音声の Range リクエスト (iPhone) は保存済みの全体から切り出して返す
    const range = req.headers.get("range");
    if (!range) return res;
    const buf = await res.clone().arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream", "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
    });
  })());
});
