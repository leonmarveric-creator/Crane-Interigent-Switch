/**
 * 車内 iPad の送迎画面を動かす (地図・位置・到着予想・観光案内・高速モード・部屋の写真・到着画面・音)。
 *   React の外で DOM を直接動かす (地図や演出は 1 秒に何十回も変わるため)。
 *   Leaflet は /cabin/leaflet/leaflet.js を先に読み込んでおくこと (window.L)。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BASE_MIN, BRIDGE, BOOST_INIT, CRANE_NEST, PLACES, POIS, boostStep, bridgePos, bufferMin, decodePolyline, dist, etaMin,
  makeRoute, pointAt, poisFor, project, type BoostState, type GLang, type LL, type PoiKey, type Route,
} from "@/lib/cabinGeo";
import { CABIN_T, type CabinText } from "@/lib/cabinI18n";
import type { CabinRoom, CabinTrip } from "@/lib/cabinData";
import { MUSIC_T, qrUrls, type CabinTrack, type MusicCmd, type NowPlaying } from "@/lib/cabinMusic";
import { createNowPlaying } from "@/components/cabin/cabinNowPlaying";
import { createAi } from "@/components/cabin/cabinAi";
import { createGuide } from "@/components/cabin/cabinGuide";
import { createToilet } from "@/components/cabin/cabinToilet";
import { createLock } from "@/components/cabin/cabinLock";
import { SFX_MARK } from "@/lib/remoteVoice";
import { createTrains } from "@/components/cabin/cabinTrains";
import { stationsFor } from "@/lib/cabinTrains";
import { hasRoomLock, LOCK_T } from "@/lib/cabinLock";
import { CHECKIN_T, roomGuideOf, GUEST_WIFI, WIFI_T, wifiQrText, CHECKIN_DEFAULT_URL } from "@/lib/cabinAiTalk";
import QRCode from "qrcode";
import { playSafe, stopVoice } from "@/lib/cabinAudio";

const TILES = {
  dark: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
  photo: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};
const AUDIO = "/cabin/audio/";
export type Src = "ipad" | "phone" | "demo";

/* ---------------- 地図の保存 (IndexedDB) ---------------- */
let DB: IDBDatabase | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (DB) return Promise.resolve(DB);
  return new Promise((ok) => {
    try {
      const r = indexedDB.open("cabinTiles", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("t");
      r.onsuccess = () => { DB = r.result; ok(DB); }; r.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
const tget = async (k: string): Promise<Blob | null> => { const db = await openDb(); if (!db) return null; return new Promise((ok) => { const q = db.transaction("t").objectStore("t").get(k); q.onsuccess = () => ok((q.result as Blob) || null); q.onerror = () => ok(null); }); };
const tput = async (k: string, v: Blob) => { const db = await openDb(); if (!db) return; await new Promise<void>((ok) => { const t = db.transaction("t", "readwrite"); t.objectStore("t").put(v, k); t.oncomplete = () => ok(); t.onerror = () => ok(); }); };
export const tileCount = async (): Promise<number> => { const db = await openDb(); if (!db) return 0; return new Promise((ok) => { const q = db.transaction("t").objectStore("t").count(); q.onsuccess = () => ok(q.result); q.onerror = () => ok(0); }); };

export interface Engine {
  start(trip: CabinTrip, room: CabinRoom | null): Promise<void>;
  stop(): void;
  feed(ll: LL, kmh: number | null, src: Src): void;
  tripId(): string | null;
  audioUrls(): string[];
  unlock(): void;
  demo(stop?: boolean): void;
  saveOffline(onProgress: (done: number, total: number) => void): Promise<{ tiles: number; mb: number; fail: number }>;
  resize(): void;
  weather(w: { temp: number; code: number; max?: number; min?: number; days?: { code: number; max: number }[]; rain?: number } | null): void;
  /** お父さんのスマホで流れている曲 (skewMs = サーバの時計 - この iPad の時計) */
  nowPlaying(np: NowPlaying | null, track: CabinTrack | null, skewMs: number): void;
  /** AI (ASTRAEA) の静かモード */
  setQuiet(q: boolean): void;
  /** ユーモアモード (映画・アニメ・ゲームのオマージュも話す) */
  setHumor(on: boolean): void;
  setVoiceSeen(ageMs: number | null): void;
  /** 声をスマホから流すか (スマホが取りに来ているか) */
  remoteVoice(): boolean;
  /** お父さんから ASTRAEA への指示 */
  aiCommand(cmd: { c: string; n: number } | null): void;
  /** 待機中に ⚙ から手動でガイドを流す (トイレの前・ドアの前で)。送迎中は false */
  manual(k: "ent" | "room" | "toilet" | "ck" | "wifi" | "stop", room: CabinRoom | null, lang: GLang): boolean;
  /** このお部屋で「お部屋の開け方」が使えるか */
  hasRoomGuide(room: CabinRoom | null): boolean;
  /** チェックイン QR の画像 (全員共通) */
  setCheckin(url: string | null): void;
}

export function createEngine(root: HTMLElement, routes: Record<string, [number, number][]>, hooks: { onEnd: (tripId: string) => void; onCmd?: (tripId: string, c: MusicCmd, v: number | null) => void; onLights?: (tripId: string) => void; onSay?: (tripId: string, url: string, text: string) => Promise<boolean> | void; /** スマホが最近ちゃんと返事をしている (返事が無かった直後は false) */ phoneOk?: () => boolean }): Engine {
  const L = (window as any).L;
  const $ = (id: string) => root.querySelector("#" + id) as HTMLElement;
  const stage = root.querySelector(".stage") as HTMLElement;

  /* ---------- 地図 ---------- */
  const CachedLayer = L.TileLayer.extend({
    createTile(c: any, done: any) {
      const img = document.createElement("img"); img.alt = ""; img.setAttribute("role", "presentation");
      const url = this.getTileUrl(c);
      void tget(url).then((b) => {
        img.onload = () => { if (b) URL.revokeObjectURL(img.src); done(null, img); };
        img.onerror = (e: any) => done(e, img);
        img.src = b ? URL.createObjectURL(b) : url;
      });
      return img;
    },
  });
  const MAP = L.map($("lmap"), { zoomControl: false, attributionControl: false, zoomSnap: 0.25, inertia: false });
  let base: any = null, mode: "photo" | "dark" = "photo";
  try { if (localStorage.getItem("cabMap") === "dark") mode = "dark"; } catch { /* ignore */ }
  const setMode = (m: "photo" | "dark") => {
    mode = m; if (base) MAP.removeLayer(base);
    base = new CachedLayer(TILES[m], { maxZoom: 18, maxNativeZoom: 18, crossOrigin: true, keepBuffer: 4 }).addTo(MAP);
    $("map").classList.toggle("mode-dark", m === "dark"); $("map").classList.toggle("mode-photo", m === "photo");
    $("mDark").classList.toggle("on", m === "dark"); $("mPhoto").classList.toggle("on", m === "photo");
    try { localStorage.setItem("cabMap", m); } catch { /* ignore */ }
  };
  setMode(mode);
  $("mDark").onclick = () => setMode("dark"); $("mPhoto").onclick = () => setMode("photo");
  MAP.setView(CRANE_NEST, 13);
  const layer = L.layerGroup().addTo(MAP);

  /* ---------- 音 ---------- */
  let ctx: AudioContext | null = null;
  const ac = () => { try { ctx = ctx || new ((window as any).AudioContext || (window as any).webkitAudioContext)(); if (ctx!.state !== "running") void ctx!.resume(); } catch { /* ignore */ } return ctx; };
  const tone = (f0: number, f1: number, t: number, du: number, p: number) => {
    const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + du);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(p, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + du);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + du + 0.05);
  };
  const now = () => (ac()?.currentTime ?? 0) + 0.01;
  const chime = () => { const t = now(); tone(988, 988, t, 0.2, 0.05); tone(1319, 1319, t + 0.16, 0.35, 0.05); };
  const arriveS = () => { const t = now(); [523, 659, 784, 1046, 1319].forEach((q, i) => tone(q, q, t + i * 0.09, 1.3, 0.05)); };
  const byeS = () => { const t = now(); [1319, 1046, 784, 659, 784, 1046].forEach((q, i) => tone(q, q, t + i * 0.12, 1.1, 0.045)); };
  const linkS = () => { const t = now(); [1200, 1600, 2400].forEach((f, i) => tone(f, f, t + i * 0.09, 0.08, 0.05)); tone(300, 1400, t + 0.3, 0.5, 0.04); };
  const scanS = () => { const t = now(); tone(1800, 1800, t, 0.06, 0.03); tone(2400, 2400, t + 0.08, 0.06, 0.03); [0.9, 1.25, 1.6].forEach((d) => tone(2600, 3400, t + d, 0.09, 0.025)); };
  const blobs: Record<string, string> = {};
  const src = (k: string) => blobs[k] || AUDIO + k + ".mp3";
  const voice = new Audio(); let Q: Promise<void> = Promise.resolve();
  let voiceN = 0; // 道案内などの声が出ている (待っている) 数。AI はこの間は話さない
  /* 声はスマホ (Bluetooth で車のスピーカー) から流す。スマホが来ていないときだけ iPad から。
     スマホで流すときも、iPad は音を消して同じ声を再生して、長さ (字幕・順番) を合わせる。
     スマホが「鳴らした」と返事をしなければ (画面が消えている・電話中など)、iPad が自分で鳴らす */
  let phoneSeen = 0;
  const remote = () => !!trip && !trip.id.startsWith("demo") && Date.now() - phoneSeen < 12000 && (hooks.phoneOk?.() ?? true);
  /** スマホへ声を送り、スマホが鳴らし始めたら true (返事が無ければ false → iPad が鳴らす) */
  const viaPhone = async (url: string, text: string) => {
    if (!trip || !remote()) return false;
    const r = await Promise.resolve(hooks.onSay?.(trip.id, url, text)).catch(() => false);
    return r !== false;
  };
  const say = (k: string) => {
    voiceN++;
    Q = Q.then(async () => {
      if (!trip) return; /* 送迎が終わったあとに残っていた声は流さない */
      const rm = await viaPhone(AUDIO + k + ".mp3", "");
      if (!trip) return;
      await new Promise<void>((r) => { voice.muted = rm; voice.src = src(k); voice.onended = () => r(); voice.onerror = () => r(); playSafe(voice, () => ac(), () => r()); setTimeout(r, 15000); });
    }).then(() => { voiceN = Math.max(0, voiceN - 1); });
    return Q;
  };
  // ブーストの効果音もスマホから (Bluetooth で車のスピーカー)。スマホが来ていなければ iPad から。音そのものは同じ
  const sfx = (k: string) => { if (remote()) { hooks.onSay?.(trip!.id, AUDIO + k + ".mp3", SFX_MARK); return; } const a = new Audio(src(k)); a.play().catch(() => {}); };
  const AUDIO_KEYS = ["en-arrive", "en-bridge", "en-rinku", "en-izumi", "en-boost-on", "en-boost-off", "boost-sfx", "boost-end",
    ...["kix", "kix2", "rinku", "r833", "hineno", "other"].flatMap((k) => [`en-${k}_in-go`, `en-${k}_out-go`, `en-${k}_out-arrive`])];

  /* ---------- 状態 ---------- */
  let trip: CabinTrip | null = null, room: CabinRoom | null = null, lang: GLang = "en", T: CabinText = CABIN_T.en;
  let R: Route = makeRoute([[CRANE_NEST[1], CRANE_NEST[0]], [CRANE_NEST[1] + 0.001, CRANE_NEST[0]]]);
  let baseMin = 10, dest: LL = CRANE_NEST, goKey = "", byeKey = "", pois: { k: PoiKey; d: number }[] = [];
  let rerouteBase = 0, origin: LL = CRANE_NEST; // origin = お迎えの場所 (道を引き直しても印はそのまま)
  let d = 0, prevD: number | undefined, carLL: LL | null = null, lastFeed: { ll: LL; t: number } | null = null, kmhNow: number | null = null;
  let hit = new Set<PoiKey>(), arrived = false, offroute = false, backN = 0, offT = 0, rerouteAt = 0;
  let bs: BoostState = { ...BOOST_INIT }, bMax = 0, bTrivI = 0, bTrivT = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const T_ = (ms: number, f: () => void) => { timers.push(setTimeout(f, ms)); };
  let doneLine: any = null, car: any = null;

  /* ---------- 文字 ---------- */
  const setText = (id: string, s: string) => { const e = $(id); if (e) e.textContent = s; };
  const placeName = () => {
    if (!trip) return "";
    const p = (PLACES as any)[trip.placeKey];
    return p ? p.name[lang] : (trip.placeName || T.dest);
  };
  function texts() {
    if (!trip) return;
    const O = trip.dir === "out";
    setText("etaL", O ? T.etaTo.replace("{p}", trip.placeKey === "other" ? T.dest : placeName()) : T.etaIn); setText("etaU", T.u);
    setText("h-wx", T.wx); setText("h-rec", T.rec);
    $("rec").innerHTML = T.recs.map(([e, b, s]) => `<div><span class="e">${e}</span><span><b>${b}</b><small>${s}</small></span></div>`).join("");
    setText("rtChip", O ? `CRANE NEST → ${placeName()}` : `${placeName()} → CRANE NEST`);
    roomTexts();
    setText("arrT1", O ? placeName() : "CRANE NEST"); setText("arrT2", O ? "HAVE A SAFE TRIP" : "WELCOME HOME");
    const rows = O ? T.outRows : T.inRows; rows.forEach((x, i) => setText("arr" + (i + 1), x));
    setText("bSub", T.bSub); setText("bFoot", T.bFoot); setText("bBr", T.bBr); setText("bTriv", T.bTriv[bTrivI % 3]);
    $("arrive").classList.toggle("out", O);
    qrTexts(); npv.texts();
  }

  /* ---------- 部屋の写真カード ---------- */
  const acMode = () => (trip?.ac === "heat" ? "heat" : "cool") as "cool" | "heat";
  function roomTexts() {
    if (!trip) return;
    const O = trip.dir === "out", r = room, m = acMode();
    root.style.setProperty("--acc", r?.accent ?? "#5fe3ff");
    // お部屋の写真は前に撮った写真 (カメラの映像ではない) と分かるように
    setText("rlive", ({ ja: "📷 イメージ写真", zh: "📷 示意照片", en: "📷 Sample photo", ko: "📷 참고 사진" } as Record<GLang, string>)[lang] ?? "📷 Sample photo");
    const img = $("rimg") as HTMLImageElement;
    if (r?.photo) { if (img.getAttribute("src") !== r.photo) { img.src = r.photo; img.decode?.().catch(() => {}); } $("abg").style.backgroundImage = `url(${r.photo})`; $("rph").style.display = ""; }
    else { $("rph").style.display = "none"; $("abg").style.backgroundImage = ""; }
    // 4:3 の写真を 3:2 で表示するので、上下の位置を合わせる
    const Y = (y: number) => Math.max(4, Math.min(96, (y - 5.56) / 0.889));
    const sp = r?.spots ?? { ac: null, lamp: null, wifi: null };
    const lamp = sp.lamp ?? [50, 55];
    $("rph").style.setProperty("--lx", lamp[0] + "%"); $("rph").style.setProperty("--ly", Y(lamp[1]) + "%");
    const pos = (id: string, p: [number, number] | null) => { const e = $(id); e.style.display = p ? "" : "none"; if (p) { e.style.left = p[0] + "%"; e.style.top = Y(p[1]) + "%"; } };
    pos("tagAc", trip.ac === "none" ? null : sp.ac); pos("tagLt", sp.lamp); pos("tagWf", sp.wifi); pos("rair", trip.ac === "none" ? null : sp.ac);
    ($("tagAc").querySelector("span") as HTMLElement).textContent = (m === "cool" ? "❄ " : "🔥 ") + T.tAc[m];
    ($("tagLt").querySelector("span") as HTMLElement).textContent = "💡 " + ($("room").classList.contains("lit") && !O ? T.tLtOn : T.tLt);
    ($("tagWf").querySelector("span") as HTMLElement).textContent = "📶 " + T.tWf;
    $("rair").className = "rair " + m;
    setText("rkanji", r?.kanji ?? ""); setText("ak", r?.kanji ?? ""); setText("akEn", r ? `${r.en} · ${T.yr}` : "");
    setText("h-room", `${T.room}${r ? ` · ${r.kanji} ${r.en}` : ""} · ${O ? T.out : T.live}`);
    if (O) {
      setText("acT", T.ac); setText("acE", T.off); setText("ltT", T.lt); setText("ltE", T.off); setText("wfT", T.lock); setText("wfE", T.locked);
      $("acI").className = "off"; $("ltI").className = "off"; $("room").classList.add("closed"); $("cmeter").style.display = "none";
      setText("arrT", `${T.outT}${r ? ` · ${r.kanji} ${r.en}` : ""}`);
    } else {
      setText("acT", trip.ac === "none" ? T.ac : `${T.ac} ${T.acm[m]}`); setText("acE", trip.ac === "none" ? "—" : T.run);
      setText("ltT", T.lt); setText("ltE", arrived ? T.ltOn : T.ltWait); setText("wfT", T.wifi); setText("wfE", T.wifiOk);
      $("acI").className = trip.ac === "none" ? "w" : "run"; if (!arrived) $("ltI").className = "w";
      $("room").classList.remove("closed"); $("cmeter").style.display = trip.ac === "none" ? "none" : "";
      const M = T.meter[m]; setText("clL", arrived ? M[2] : M[0]); setText("clS", M[1]); setText("clA", T.ends[m][0]); setText("clB", T.ends[m][1]);
      $("cmeter").className = "cmeter " + m; setText("arrT", T.inT);
    }
  }
  const meter = (u: number) => { $("cbar").style.width = 18 + 72 * Math.pow(Math.max(0, Math.min(1, u)), 0.8) + "%"; };

  /* ---------- ルート ---------- */
  async function osrm(a: LL, b: LL): Promise<{ r: Route; min: number } | null> {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=polyline`, { signal: ctl.signal })).json();
      clearTimeout(to);
      const x = j?.routes?.[0]; if (!x) return null;
      return { r: makeRoute(decodePolyline(x.geometry)), min: x.duration / 60 };
    } catch { return null; }
  }
  function draw() {
    layer.clearLayers();
    L.polyline(R.pts, { color: "#2f8fff", weight: 14, opacity: 0.28, className: "rt-glow", interactive: false }).addTo(layer);
    doneLine = L.polyline([R.pts[0]], { color: trip?.dir === "out" ? "#ffc27a" : "#5fe3ff", weight: 7, opacity: 1, className: trip?.dir === "out" ? "rt-done out" : "rt-done", interactive: false }).addTo(layer);
    L.polyline(R.pts, { color: "#e9f6ff", weight: 3, opacity: 0.75, className: "rt-flow", interactive: false }).addTo(layer);
    L.circle(dest, { radius: 200, color: "#ffb35c", weight: 1.5, dashArray: "6 6", fillColor: "#ffa24a", fillOpacity: 0.08, interactive: false }).addTo(layer);
    const home = room?.home ?? CRANE_NEST;
    L.marker(home, { icon: L.divIcon({ className: "", html: `<div class="homeI"><i></i>${room?.building?.toUpperCase?.() || "CRANE NEST"}</div>`, iconSize: [0, 0] }), interactive: false }).addTo(layer);
    const pll = trip?.dir === "out" ? dest : origin;
    L.marker(pll, { icon: L.divIcon({ className: "", html: `<div class="homeI stn"><i></i><span>${placeName()}</span></div>`, iconSize: [0, 0] }), interactive: false }).addTo(layer);
    pois.forEach((p) => { const [e, n] = T.poi[p.k]; L.marker(pointAt(R, p.d), { icon: L.divIcon({ className: "", html: `<div class="poiI" data-poi="${p.k}"><i></i>${n}</div>`, iconSize: [0, 0] }), interactive: false }).addTo(layer); void e; });
    car = L.marker(carLL ?? R.pts[0], { icon: L.divIcon({ className: "", html: '<div class="carI"><i class="ring"></i><i class="arw"></i><i class="dot"></i></div>', iconSize: [0, 0] }), interactive: false, zIndexOffset: 1000 }).addTo(layer);
    MAP.fitBounds(L.latLngBounds(R.pts.concat([home])).pad(0.18));
  }

  /* ---------- 寄り道のあと: 今いる所から道を引き直す ---------- */
  async function reroute(from: LL) {
    rerouteAt = Date.now(); const id = trip?.id; if (!id) return;
    const o = await osrm(from, dest); if (!o || trip?.id !== id) return;
    R = o.r; baseMin = Math.ceil(o.min + bufferMin(R.total / 1000)); rerouteBase = Date.now();
    d = 0; prevD = undefined; backN = 0; offT = 0; offroute = false; $("map").classList.remove("offroute");
    pois = poisFor(R, trip!.dir).map((k) => ({ k, d: project(R, POIS[k]).d })).filter((p) => !hit.has(p.k));
    const keep = MAP.getZoom(), c = MAP.getCenter(); draw(); MAP.setView(c, keep, { animate: false });
  }

  /* ---------- 位置が来るたび ---------- */
  let anim = 0;
  function moveCar(to: LL) {
    const from = carLL ?? to; carLL = to; const t0 = performance.now(); const id = ++anim;
    const f = (n: number) => {
      if (id !== anim || !car) return; const u = Math.min(1, (n - t0) / 900);
      car.setLatLng([from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u]); if (u < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    if (dist(from, to) > 2) {
      const y = Math.sin(((to[1] - from[1]) * Math.PI) / 180) * Math.cos((to[0] * Math.PI) / 180);
      const x = Math.cos((from[0] * Math.PI) / 180) * Math.sin((to[0] * Math.PI) / 180) - Math.sin((from[0] * Math.PI) / 180) * Math.cos((to[0] * Math.PI) / 180) * Math.cos(((to[1] - from[1]) * Math.PI) / 180);
      const a = root.querySelector(".carI .arw") as HTMLElement | null; if (a) a.style.transform = `rotate(${(Math.atan2(y, x) * 180) / Math.PI}deg)`;
    }
    MAP.panTo(to, { animate: true, duration: 0.8 });
  }
  function feed(ll: LL, kmh: number | null, from: Src) {
    if (!trip) return;
    const tNow = Date.now();
    if (kmh == null && lastFeed && tNow - lastFeed.t > 500) kmh = (dist(lastFeed.ll, ll) / ((tNow - lastFeed.t) / 1000)) * 3.6;
    lastFeed = { ll, t: tNow }; kmhNow = kmh;
    const g = $("gpsT"); g.classList.toggle("phone", from === "phone"); (g.querySelector("span") as HTMLElement).textContent = from === "phone" ? "GPS · PHONE" : from === "demo" ? "GPS · DEMO" : "GPS · LIVE";
    moveCar(ll);
    const pr = project(R, ll, prevD);
    offroute = pr.off > 150; $("map").classList.toggle("offroute", offroute);
    if (!offroute) {
      // 少し戻った (GPS のぶれ) は無視。3 回続けて戻っていたら本当に引き返した → そのまま戻す
      if (prevD != null && pr.d < prevD - 40) { backN++; d = backN >= 3 ? pr.d : prevD; } else { backN = 0; d = pr.d; }
      prevD = d; offT = 0;
    } else {
      // 寄り道・別の道: 25 秒続いたら、今いる所から目的地までの道を引き直す (1 分に 1 回まで)
      if (!offT) offT = tNow;
      if (tNow - offT > 25000 && tNow - rerouteAt > 60000 && !arrived) void reroute(ll);
    }
    const toDest = dist(ll, dest);
    const rem = offroute ? toDest * 1.3 : Math.max(0, R.total - d);
    const mins = arrived ? 0 : etaMin(baseMin, rem, R.total);
    ($("etaM").firstChild as Text).textContent = String(mins);
    setText("km", arrived ? T.arrived : T.km.replace("{k}", (rem / 1000).toFixed(1)));
    if (doneLine && !offroute) { let i = 1; while (i < R.cum.length - 1 && R.cum[i] < d) i++; doneLine.setLatLngs(R.pts.slice(0, i).concat([pointAt(R, d)])); }
    meter(offroute ? 1 - rem / R.total : d / R.total);
    // 高速モード (スカイゲートブリッジ)
    const b = boostStep(bs, ll, kmh); bs = b.s;
    if (b.event === "start") boostOn(); else if (b.event === "end") boostOff();
    if (bs.phase === "on") boostPanel(ll, kmh);
    // 観光案内
    if (!offroute) for (const p of pois) {
      if (hit.has(p.k) || d < p.d - 30) continue;
      hit.add(p.k);
      if (p.k === "bridge" && bs.phase !== "off") continue; // 高速モードが代わりに案内する
      chime(); cap(p.k); void say(`en-${p.k}`);
      const el = root.querySelector(`[data-poi="${p.k}"]`); el?.classList.add("hit");
    }
    if (!arrived && toDest < 200) arrive();
  }
  function cap(k: PoiKey) {
    const [i, t, s] = T.poi[k]; setText("capI", i); setText("capT", t); setText("capS", s);
    $("cap").classList.add("show"); setTimeout(() => $("cap").classList.remove("show"), 7000);
  }

  /* ---------- 到着 ---------- */
  function arrive() {
    if (!trip) return; arrived = true; const id = trip.id;
    ($("etaM").firstChild as Text).textContent = "0"; setText("km", T.arrived);
    if (trip.dir === "in") { $("ltI").className = ""; setText("ltE", T.ltOn); $("room").classList.add("lit"); roomTexts(); arriveS(); void say("en-arrive"); }
    else { byeS(); void say(byeKey); }
    $("sweep").classList.remove("on");
    T_(600, () => { $("arrive").classList.add("on"); startPtc(); });
    ai.event("arrive");
    // 2 分たったら送迎を終わりにして、待機画面へ (ガイドを見ている間は待つ)
    const endIfIdle = () => { if (guide.on() || toilet.on() || lock.on()) T_(30000, endIfIdle); else hooks.onEnd(id); };
    T_(trip.dir === "out" ? 45000 : 120000, endIfIdle); // お見送りは早めに「帰り道 (回送)」へ
  }
  $("arrive").onclick = () => { $("arrive").classList.remove("on"); stopPtc(); qrHide(); };

  /* ---------- 到着画面: エントランスの鍵 / お部屋 の QR (ゲストが自分のスマホで読む) ---------- */
  let qrK: "key" | "room" = "key", qrTimer: ReturnType<typeof setTimeout> | null = null;
  const qrLinks = () => qrUrls(location.origin, room, lang);
  async function qrShow(k: "key" | "room") {
    const u = qrLinks()[k]; if (!u) return;
    qrK = k; const M = MUSIC_T[lang] ?? MUSIC_T.en;
    try { $("qrSvg").innerHTML = await QRCode.toString(u, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#0a1426", light: "#ffffff" } }); } catch { return; }
    setText("qrU", u.replace(/^https?:\/\//, "")); setText("qrT", M.qTitle[k]);
    $("qrSteps").innerHTML = M.qSteps[k].map((x) => `<li>${x.replace(/[<&>]/g, "")}</li>`).join("");
    root.querySelectorAll<HTMLElement>("[data-qt]").forEach((b) => { const q = b.dataset.qt as "key" | "room"; b.classList.toggle("on", q === k); b.textContent = (q === "key" ? "🔑 " : "🚪 ") + (q === "key" ? M.qKey : M.qRoom); b.style.display = qrLinks()[q] ? "" : "none"; });
    setText("qrX", "✕ " + M.qClose);
    const p = $("qrp"); p.classList.remove("on"); void p.offsetWidth; p.classList.add("on");
    const t = now(); tone(1320, 1320, t, 0.07, 0.035); tone(1760, 1760, t + 0.07, 0.12, 0.035);
    if (qrTimer) clearTimeout(qrTimer); qrTimer = setTimeout(qrHide, 120000); // 2 分で自動で閉じる
  }
  function qrHide() { $("qrp").classList.remove("on"); if (qrTimer) clearTimeout(qrTimer); qrTimer = null; }
  function qrTexts() {
    const M = MUSIC_T[lang] ?? MUSIC_T.en, q = qrLinks();
    // 到着画面のガイド (押したときだけ流れる): エントランスの開け方 / お部屋の開け方 / トイレの使い方
    const GL: Record<GLang, Record<string, string>> = {
      ja: { gEnt: "エントランスの開け方", gRoom: "お部屋の開け方", gToilet: "トイレの使い方", ck: "チェックイン・パスポート登録", wifi: "Wi-Fi につなぐ" },
      zh: { gEnt: "入口怎么开", gRoom: "房间怎么开", gToilet: "卫生间怎么用", ck: "办理入住·登记护照", wifi: "连接 Wi-Fi" },
      en: { gEnt: "Open the entrance", gRoom: "Open your room", gToilet: "Using the restroom", ck: "Check-in · passport", wifi: "Connect to Wi-Fi" },
      ko: { gEnt: "입구 여는 법", gRoom: "객실 여는 법", gToilet: "화장실 사용법", ck: "체크인·여권 등록", wifi: "Wi-Fi 연결" },
    };
    root.querySelectorAll<HTMLElement>("#aq [data-q]").forEach((b) => {
      const k = b.dataset.q as string;
      // 春・秋・冬のお部屋は「お部屋の鍵の使い方」(内側のつまみ)
      const lk = k === "gRoom" && !guide.hasRoom() && hasRoomLock(room?.slug);
      (b.querySelector("b") as HTMLElement).textContent = k === "key" ? M.qKey : k === "room" ? M.qRoom : lk ? (LOCK_T[lang] ?? LOCK_T.en).btn : (GL[lang] ?? GL.en)[k];
      b.style.display = k === "key" || k === "room" ? (q[k as "key" | "room"] ? "" : "none") : k === "gRoom" ? (guide.hasRoom() || lk ? "" : "none") : k === "ck" ? (checkinUrl ? "" : "none") : "";
    });
    setText("aqTip", M.qTip);
    $("aq").style.display = trip?.dir === "out" ? "none" : ""; // お見送りのときは出さない
    if ($("qrp").classList.contains("on")) void qrShow(qrK);
  }
  root.querySelectorAll<HTMLElement>("#aq [data-q]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const k = b.dataset.q!;
    if (k === "key" || k === "room") return void qrShow(k);
    if (k === "ck") { qrHide(); guide.stop(); toilet.stop(); lock.stop(); return void showCheckin(); }
    if (k === "wifi") { qrHide(); guide.stop(); toilet.stop(); lock.stop(); return void showWifi(); }
    qrHide(); guide.stop(); toilet.stop(); lock.stop();
    if (k === "gEnt") guide.start("ent"); else if (k === "gRoom") { if (guide.hasRoom()) guide.start("room"); else lock.start(); } else if (k === "gToilet") toilet.start();
  }));
  root.querySelectorAll<HTMLElement>("[data-qt]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); void qrShow(b.dataset.qt as "key" | "room"); }));
  $("qrX").onclick = (e) => { e.stopPropagation(); qrHide(); };
  $("qrp").onclick = (e) => { e.stopPropagation(); if ((e.target as HTMLElement).id === "qrp") qrHide(); };

  /* ---------- 季節の舞うもの ---------- */
  const pc = $("ptc") as HTMLCanvasElement, px = pc.getContext("2d")!; let ptOn = false;
  function startPtc() {
    ptOn = true; const fx = trip?.dir === "out" ? "none" : room?.fx ?? "petal"; if (fx === "none") return;
    const w = (pc.width = pc.clientWidth), h = (pc.height = pc.clientHeight);
    const pts = Array.from({ length: fx === "firefly" ? 45 : 70 }, () => ({ x: Math.random() * w, y: Math.random() * h - (fx === "firefly" ? 0 : h), s: 0.6 + Math.random() * 0.9, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.06, ph: Math.random() * 6.28 }));
    const loop = () => {
      if (!ptOn) { px.clearRect(0, 0, w, h); return; }
      px.clearRect(0, 0, w, h); const t = performance.now() / 1000;
      for (const p of pts) {
        if (fx === "firefly") {
          p.x += Math.sin(t * 0.7 + p.ph) * 0.6; p.y += Math.cos(t * 0.5 + p.ph) * 0.4 - 0.15; const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6 + p.ph));
          const g = px.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10 * p.s); g.addColorStop(0, `rgba(230,255,150,${a})`); g.addColorStop(1, "rgba(180,255,120,0)");
          px.fillStyle = g; px.beginPath(); px.arc(p.x, p.y, 10 * p.s, 0, 6.28); px.fill(); if (p.y < -20) p.y = h + 10; continue;
        }
        p.y += (fx === "snow" ? 0.7 : 1.1) * p.s; p.x += Math.sin(t + p.ph) * (fx === "snow" ? 0.4 : 0.9) + (fx === "snow" ? 0 : 0.35); p.r += p.vr;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        px.save(); px.translate(p.x, p.y); px.rotate(p.r); px.globalAlpha = 0.85;
        if (fx === "petal") { px.fillStyle = "#ffc3d9"; px.beginPath(); px.ellipse(0, 0, 7 * p.s, 4 * p.s, 0, 0, 6.28); px.fill(); px.fillStyle = "#ff9ec4"; px.beginPath(); px.ellipse(2 * p.s, 0, 3 * p.s, 2 * p.s, 0, 0, 6.28); px.fill(); }
        else if (fx === "leaf") { px.fillStyle = ["#ff7a2e", "#e8452c", "#ffb13c"][Math.floor(p.ph) % 3]; px.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; px.lineTo(Math.cos(a) * 9 * p.s, Math.sin(a) * 9 * p.s); px.lineTo(Math.cos(a + 0.63) * 3.5 * p.s, Math.sin(a + 0.63) * 3.5 * p.s); } px.closePath(); px.fill(); }
        else { px.fillStyle = "#fff"; px.shadowColor = "#cfe6ff"; px.shadowBlur = 6; px.beginPath(); px.arc(0, 0, 2.6 * p.s, 0, 6.28); px.fill(); }
        px.restore();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }
  const stopPtc = () => { ptOn = false; };

  /* ---------- 高速モード SKY GATE BOOST ---------- */
  const cv = $("warp") as HTMLCanvasElement, cx2 = cv.getContext("2d")!;
  let stars: { a: number; r: number; v: number; c: string }[] = [], warpOn = false, warpK = 1;
  function warpLoop() {
    if (!warpOn) { cx2.clearRect(0, 0, cv.width, cv.height); return; }
    const w = (cv.width = cv.clientWidth), h = (cv.height = cv.clientHeight), ox = w / 2, oy = h * 0.5;
    while (stars.length < 140) stars.push({ a: Math.random() * Math.PI * 2, r: Math.random() * 40, v: 2 + Math.random() * 5, c: Math.random() < 0.5 ? "95,227,255" : "190,120,255" });
    cx2.clearRect(0, 0, w, h); cx2.lineCap = "round";
    for (const s of stars) {
      const r0 = s.r, r1 = s.r + (s.v * 6 + s.r * 0.12) * warpK; s.r += s.v * (1 + s.r / 140) * (0.08 + 0.92 * warpK);
      cx2.strokeStyle = `rgba(${s.c},${Math.min(0.55, s.r / 500) * warpK})`; cx2.lineWidth = 1 + s.r / 260;
      cx2.beginPath(); cx2.moveTo(ox + Math.cos(s.a) * r0, oy + Math.sin(s.a) * r0); cx2.lineTo(ox + Math.cos(s.a) * r1, oy + Math.sin(s.a) * r1); cx2.stroke();
      if (s.r > Math.hypot(w, h)) { s.r = Math.random() * 30; s.a = Math.random() * Math.PI * 2; }
    }
    requestAnimationFrame(warpLoop);
  }
  let chg: any = null;
  function chargeLoop() {
    if (!chg || chg.stop) return;
    const t = performance.now(), u = Math.min(1, (t - chg.t0) / chg.dur), dt = Math.min(0.05, (t - chg.last) / 1000); chg.last = t;
    const w = (cv.width = cv.clientWidth), h = (cv.height = cv.clientHeight), ox = w / 2, oy = h / 2, RM = Math.hypot(w, h) / 2;
    while (chg.p.length < 40 + 160 * u) chg.p.push({ a: Math.random() * 6.283, r: RM * (0.55 + Math.random() * 0.5), c: Math.random() < 0.5 ? "95,227,255" : "192,139,255" });
    cx2.clearRect(0, 0, w, h); cx2.lineCap = "round";
    const g = cx2.createRadialGradient(ox, oy, 0, ox, oy, 150); g.addColorStop(0, `rgba(160,220,255,${0.15 + 0.35 * u})`); g.addColorStop(1, "rgba(120,80,255,0)"); cx2.fillStyle = g; cx2.fillRect(0, 0, w, h);
    for (const q of chg.p) {
      const v = (120 + 900 * u * u) * dt, r0 = q.r, a0 = q.a; q.r -= v * (0.6 + 400 / (q.r + 60)); q.a += (0.4 + 2.5 * u) * dt;
      if (q.r < 40) { q.r = RM * (0.6 + Math.random() * 0.45); q.a = Math.random() * 6.283; continue; }
      cx2.strokeStyle = `rgba(${q.c},${Math.min(0.9, 0.25 + 0.6 * (1 - q.r / RM))})`; cx2.lineWidth = 1.2 + 1.5 * (1 - q.r / RM);
      cx2.beginPath(); cx2.moveTo(ox + Math.cos(a0) * r0, oy + Math.sin(a0) * r0); cx2.lineTo(ox + Math.cos(q.a) * q.r, oy + Math.sin(q.a) * q.r); cx2.stroke();
    }
    [0, 1, 2].forEach((i) => { if (chg.lk[i]) return; chg.ang[i] += [1, -1.4, 2.1][i] * (40 + 520 * u * u) * dt; $("rg" + i).setAttribute("transform", `rotate(${chg.ang[i]})`); });
    const n = Math.round(u * 24); root.querySelectorAll("#segs .sg").forEach((e, i) => { e.classList.toggle("on", i < n); e.classList.toggle("hot", i < n && u > 0.8); });
    setText("bpct", Math.round(u * 100) + "%");
    requestAnimationFrame(chargeLoop);
  }
  function flipMode(txt: string) { const m = $("bmode"); setText("bmodeV", txt); m.classList.remove("flip"); void m.offsetWidth; m.classList.add("flip"); }
  function lockRing(i: number, txt: string) {
    if (chg) chg.lk[i] = true; const a = Math.round((chg?.ang[i] ?? 0) / 120) * 120, e = $("rg" + i);
    e.setAttribute("transform", `rotate(${a})`); e.classList.add("lk"); setTimeout(() => e.classList.remove("lk"), 260); flipMode(txt);
  }
  function bLog(lines: [number, string, string?][]) {
    const el = $("blog"); el.innerHTML = "";
    lines.forEach(([ms, txt, ok]) => T_(ms, () => { const x = document.createElement("div"); x.innerHTML = txt + (ok ? ` <b>${ok}</b>` : ""); el.appendChild(x); }));
  }
  const kmhStr = () => (kmhNow != null ? `${Math.round(kmhNow)} km/h` : "OK");
  function boostOn() {
    const m = $("map"), h = $("bhud"); bMax = 0;
    hit.add("bridge");
    sfx("boost-sfx");
    setText("bmodeV", "NORMAL"); $("bmode").className = "bmode"; setText("bLbl", "CHARGE"); [0, 1, 2].forEach((i) => $("rg" + i).setAttribute("transform", "rotate(0)"));
    m.classList.add("boost-charge"); h.className = "bhud boot";
    bLog([[60, "SGB-OS v3.0 ▸ BOOST SEQUENCE"], [260, "GPS LOCK ·········", "OK"], [460, "VELOCITY ·········", kmhStr()], [660, "BRIDGE LINK ······", "3,750 m"], [900, "REACTOR ··········", "CHARGING"]]);
    T_(350, () => { h.className = "bhud charge"; chg = { t0: performance.now(), last: performance.now(), dur: 4050, p: [], ang: [0, 0, 0], lk: [false, false, false], stop: false }; chargeLoop(); });
    T_(4450, () => { h.className = "bhud lock"; lockRing(0, "▓▓▓▓▓"); });
    T_(4700, () => lockRing(1, "B▓▓S▓"));
    T_(4950, () => { lockRing(2, "BOOST"); $("bmode").classList.add("boost"); h.classList.add("wiping"); });
    T_(5200, () => {
      if (chg) chg.stop = true; h.className = "bhud fire"; m.classList.add("boost", "punch"); m.classList.remove("boost-charge"); setTimeout(() => m.classList.remove("punch"), 600);
      ["shock", "shock2"].forEach((id) => { const e = $(id); e.classList.remove("go"); void e.offsetWidth; e.classList.add("go"); });
      $("boostT").className = "boostT on"; stars = []; warpK = 1; warpOn = true; warpLoop();
    });
    T_(5750, () => void say("en-boost-on"));
    T_(8000, () => { $("boostT").className = "boostT on mini"; $("boostP").classList.add("on"); h.className = "bhud cruise"; });
  }
  function boostPanel(ll: LL, kmh: number | null) {
    const v = kmh ?? 0; bMax = Math.max(bMax, v);
    setText("bSpd", String(Math.round(v))); ($("gv") as any).style.strokeDasharray = `${(Math.min(120, v) / 120) * 245} 400`;
    const { t } = bridgePos(ll); const along = bs.dir === -1 ? 1 - t : t;
    const rem = Math.max(0, Math.min(1, 1 - along)) * BRIDGE.len;
    setText("bRem", (rem / 1000).toFixed(2) + " km"); $("bBar").style.width = 100 * (1 - rem / BRIDGE.len) + "%";
    const n = performance.now(); if (n - bTrivT > 6000) { bTrivT = n; bTrivI++; const e = $("bTriv"); e.classList.remove("in"); void e.offsetWidth; e.textContent = T.bTriv[bTrivI % 3]; e.classList.add("in"); }
  }
  function boostOff() {
    timers.forEach(clearTimeout); timers = []; if (chg) chg.stop = true;
    const m = $("map"), h = $("bhud");
    sfx("boost-end"); ai.event("boostEnd");
    $("boostT").className = "boostT"; $("boostP").classList.remove("on");
    setText("bLbl", "COOLING"); $("bmode").className = "bmode boost"; setText("bmodeV", "BOOST");
    h.className = "bhud cool";
    const c = { t0: performance.now(), last: performance.now(), dur: 2000, ang: [0, 0, 0], stop: false };
    const cool = () => {
      if (c.stop) return; const t = performance.now(), u = Math.min(1, (t - c.t0) / c.dur), dt = Math.min(0.05, (t - c.last) / 1000); c.last = t;
      [0, 1, 2].forEach((i) => { c.ang[i] += [1, -1.4, 2.1][i] * (560 * (1 - u) * (1 - u) + 15) * dt; $("rg" + i).setAttribute("transform", `rotate(${c.ang[i]})`); });
      const n = Math.round((1 - u) * 24); root.querySelectorAll("#segs .sg").forEach((e, i) => { e.classList.toggle("on", i < n); e.classList.remove("hot"); });
      setText("bpct", Math.round((1 - u) * 100) + "%"); warpK = Math.max(0, 1 - u * 1.6); if (warpK <= 0) warpOn = false;
      requestAnimationFrame(cool);
    };
    cool();
    const flash = (i: number) => { const e = $("rg" + i); e.classList.add("lk"); setTimeout(() => e.classList.remove("lk"), 250); };
    T_(1600, () => { flipMode("B▓▓S▓"); flash(0); });
    T_(1850, () => { flipMode("▓▓▓▓▓"); flash(1); });
    T_(2100, () => { flipMode("NORMAL"); $("bmode").classList.remove("boost"); flash(2); h.classList.add("wiping", "rev"); m.classList.remove("boost"); warpOn = false; });
    T_(2350, () => {
      c.stop = true; h.className = "bhud";
      const mx = Math.round(bMax), sec = mx > 5 ? Math.round(BRIDGE.len / ((mx * 0.93) / 3.6)) : 0;
      $("bdS").innerHTML = T.bStat.replace("{km}", '<b id="dk">0</b>').replace("{max}", '<b id="dm">0</b>').replace("{t}", `<b>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}</b>`);
      $("bdone").classList.add("on"); countUp($("dk"), BRIDGE.len / 1000, 2); countUp($("dm"), mx, 0);
    });
    T_(2750, () => void say("en-boost-off"));
    T_(7000, () => $("bdone").classList.remove("on"));
  }
  function countUp(el: HTMLElement, to: number, dec: number) { const t0 = performance.now(); const f = () => { const u = Math.min(1, (performance.now() - t0) / 900), e = 1 - Math.pow(1 - u, 3); el.textContent = (to * e).toFixed(dec); if (u < 1) requestAnimationFrame(f); }; f(); }
  function boostReset() {
    bs = { ...BOOST_INIT }; warpOn = false; warpK = 1; if (chg) chg.stop = true;
    $("map").classList.remove("boost", "boost-charge", "punch"); $("boostT").className = "boostT"; $("boostP").classList.remove("on"); $("bhud").className = "bhud"; $("bdone").classList.remove("on");
  }

  /* ---------- デモ走行 (テスト用: GPS の代わりに道の上を動かす) ---------- */
  let demoT: ReturnType<typeof setInterval> | null = null, demoD = 0;
  function demo(stop?: boolean) {
    if (demoT) { clearInterval(demoT); demoT = null; }
    if (stop || !trip) return;
    demoD = Math.max(0, d);
    demoT = setInterval(() => {
      if (!trip) { if (demoT) clearInterval(demoT); demoT = null; return; }
      const p0 = pointAt(R, demoD), onBridge = bridgePos(p0).lat < 150 && bridgePos(p0).t > -0.2 && bridgePos(p0).t < 1.2;
      const kmh = onBridge ? 82 + Math.random() * 6 : 55 + Math.random() * 10;
      const fast = bs.phase === "on" || (onBridge && bs.phase === "off") ? 1.2 : 6; // 橋の上は演出が見えるようにゆっくり
      demoD = Math.min(R.total, demoD + (kmh / 3.6) * fast);
      feed(pointAt(R, demoD), kmh, "demo");
      if (demoD >= R.total && demoT) { clearInterval(demoT); demoT = null; }
    }, 1000);
  }

  /* ---------- 天気 ---------- */
  let lastWx: any = null;
  function weather(w: any) {
    if (!w) return; lastWx = w;
    const em = (c: number) => (c <= 1 ? "☀" : c <= 3 ? "🌤" : c <= 48 ? "☁" : c <= 67 || (c >= 80 && c <= 82) ? "🌧" : c <= 86 ? "❄" : "⛈");
    setText("wxI", em(w.code)); setText("wxT", `${Math.round(w.temp)}°`);
    $("wxD").innerHTML = `${T.wxName(w.code)}${w.max != null ? `<br>${Math.round(w.max)}° / ${Math.round(w.min)}°` : ""}`;
    $("wx2").innerHTML = (w.days ?? []).slice(1, 3).map((x: any, i: number) => `<div>${["+1", "+2"][i]} ${em(x.code)} ${Math.round(x.max)}°</div>`).join("") + (w.rain != null ? `<div>☂ ${w.rain}%</div>` : "");
  }

  /* ---------- 再生中の曲 (カバーと歌詞) ---------- */
  const SEASONS = ["haru", "natsu", "aki", "fuyu"];
  const npv = createNowPlaying({
    root, stage, map: MAP,
    refit: () => MAP.fitBounds(L.latLngBounds(R.pts.concat([room?.home ?? CRANE_NEST])).pad(0.12), { animate: false }),
    car: () => carLL, started: () => !!carLL, lang: () => lang,
    setLang: (l) => { if (!trip || !CABIN_T[l]) return; lang = l; T = CABIN_T[l]; texts(); weather(lastWx); },
    tripInfo: () => trip ? { dir: trip.dir, route: trip.dir === "out" ? `CRANE NEST → ${placeName()}` : `${placeName()} → CRANE NEST`, season: room && SEASONS.includes(room.en.toLowerCase()) ? room.en.toLowerCase() : null } : null,
    cmd: (c, v) => { if (trip && !trip.id.startsWith("demo")) hooks.onCmd?.(trip.id, c, v); },
    tick: () => { const t = now(); tone(1500, 1500, t, 0.04, 0.03); },
  });

  /* ---------- AI「ASTRAEA」: 状況に合わせて自分から話す ---------- */
  let aiQuiet = false, aiHumor = false, startedAt = 0, npId: string | null = null;
  const ai = createAi({
    root, stage, ac, quiet: () => aiQuiet, humor: () => aiHumor, voiceBusy: () => voiceN > 0,
    duck: (sec) => { if (trip && !trip.id.startsWith("demo") && !remote()) hooks.onCmd?.(trip.id, "duck", sec); },
    remote, send: (url, text) => viaPhone(url, text),
    hasCheckin: () => !!checkinUrl, checkin: () => showCheckin(), guide: () => guide.start(),
    roomLights: () => { if (trip && !trip.id.startsWith("demo")) hooks.onLights?.(trip.id); setTimeout(roomLit, 2500); },
    roomLit: () => roomLit(),
    state: () => ({
      tripId: trip?.id ?? null, dir: trip?.dir ?? "in", placeKey: trip?.placeKey ?? "", lang,
      started: startedAt, paceStart: rerouteBase || startedAt, total: R.total, d, toDest: carLL ? dist(carLL, dest) : R.total, baseMin, kmh: kmhNow, ll: carLL,
      arrived, offroute, boosting: bs.phase === "on" || warpOn, // "done" (橋を渡り終えた直後) は話してよい
      crossesBridge: pois.some((p) => p.k === "bridge"), hasIzumiPoi: pois.some((p) => p.k === "izumi"), weather: lastWx,
    }),
  });
  setInterval(() => { if (!guide.on() && !toilet.on() && !lock.on()) ai.tick(); }, 1000);
  function roomLit() { if (!trip || trip.dir !== "in") return; $("room").classList.add("lit"); $("ltI").className = ""; setText("ltE", T.ltOn); roomTexts(); }

  /* ---------- 入り方ガイド (押したときだけ) ---------- */
  const guide = createGuide({
    root, stage, lang: () => lang, code: () => room?.keypad ?? null, keyUrl: () => qrLinks().key, ac,
    // お部屋の開け方 (今は夏のお部屋だけ。他の部屋は開け方が分かったら足す)
    roomUrl: () => qrLinks().room,
    room: () => ({ guide: roomGuideOf(room?.slug), code: room?.roomCode ?? null, name: room ? `${room.kanji} · ${room.en}` : "" }),
    duck: (sec) => { if (trip && !trip.id.startsWith("demo")) hooks.onCmd?.(trip.id, "duck", sec); }, busy: () => ai.busy(),
  });

  /* ---------- トイレの使い方 (到着画面のボタンで。写真は撮らなくてよい) ---------- */
  const toilet = createToilet({ stage, lang: () => lang, ac, duck: (sec) => { if (trip && !trip.id.startsWith("demo")) hooks.onCmd?.(trip.id, "duck", sec); } });
  /* ---------- お見送り: 電車の案内 (右下の枠) ---------- */
  const trains = createTrains({ box: $("recBox"), title: $("h-rec"), lang: () => lang });
  /* ---------- お部屋の鍵の使い方 (春・秋・冬: 内側のつまみ。到着画面のボタンで) ---------- */
  const lock = createLock({ stage, lang: () => lang, ac, room: () => ({ code: room?.roomCode ?? null, name: room ? `${room.kanji} · ${room.en}` : "" }), duck: (sec) => { if (trip && !trip.id.startsWith("demo")) hooks.onCmd?.(trip.id, "duck", sec); } });

  /* ---------- チェックイン QR (全員共通の画像。お父さんのスマホで登録) ---------- */
  let checkinUrl: string | null = null, ckT: ReturnType<typeof setTimeout> | null = null;
  /* 登録された QR が無いときは、Crane Nest のチェックインページ (ポスターと同じ QR) を出す */
  let ckSet: string | null = null, ckDefault: string | null = null;
  void QRCode.toDataURL(CHECKIN_DEFAULT_URL, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#0a5bc4", light: "#ffffff" } }).then((u) => { ckDefault = u; if (!ckSet) checkinUrl = u; }).catch(() => {});
  /* Wi-Fi の QR (ローミングが遅いときは、先に Wi-Fi につないでからチェックイン) */
  let wifiImg: string | null = null;
  void QRCode.toDataURL(wifiQrText(), { margin: 1, width: 560, errorCorrectionLevel: "M" }).then((u) => { wifiImg = u; }).catch(() => {});
  function showCk(mode: "ck" | "wifi") {
    const W = WIFI_T[lang] ?? WIFI_T.en, esc2 = (x: string) => x.replace(/[<&>]/g, "");
    $("ckTabC").classList.toggle("on", mode === "ck"); $("ckTabW").classList.toggle("on", mode === "wifi");
    ($("ckTabC") as HTMLElement).style.display = checkinUrl ? "" : "none";
    if (mode === "wifi") {
      if (wifiImg) ($("ckImg") as HTMLImageElement).src = wifiImg;
      setText("ckK", "GUEST Wi-Fi · SCAN WITH YOUR PHONE"); setText("ckT", W.title);
      $("ckS").innerHTML = W.steps.map((x) => `<li>${esc2(x)}</li>`).join("");
      $("ckW").innerHTML = `<div><small>${esc2(W.ssid)}</small><b>${esc2(GUEST_WIFI.ssid)}</b></div><div><small>${esc2(W.pass)}</small><b>${esc2(GUEST_WIFI.pass)}</b></div>${checkinUrl ? `<button data-ck="ck">🛂 ${esc2(W.ck)} ›</button>` : ""}`;
    } else {
      const [title, steps] = CHECKIN_T[lang] ?? CHECKIN_T.en;
      ($("ckImg") as HTMLImageElement).src = checkinUrl!; setText("ckK", "CHECK-IN · SCAN WITH YOUR PHONE"); setText("ckT", title);
      $("ckS").innerHTML = steps.map((x) => `<li>${esc2(x)}</li>`).join("");
      $("ckW").innerHTML = `<button data-ck="wifi">📶 ${esc2(W.btn)}</button>`;
    }
  }
  root.querySelector("#ckp")!.addEventListener("click", (e) => { const b = (e.target as HTMLElement).closest("[data-ck]") as HTMLElement | null; if (!b) return; e.stopPropagation(); showCk(b.dataset.ck as "ck" | "wifi"); if (ckT) clearTimeout(ckT); ckT = setTimeout(hideCheckin, 180000); });
  function showWifi() {
    showCk("wifi"); const p = $("ckp"); p.classList.remove("on"); void p.offsetWidth; p.classList.add("on");
    if (ckT) clearTimeout(ckT); ckT = setTimeout(hideCheckin, 180000);
  }
  function showCheckin() {
    if (!checkinUrl) return; showCk("ck");
    const p = $("ckp"); p.classList.remove("on"); void p.offsetWidth; p.classList.add("on");
    if (ckT) clearTimeout(ckT); ckT = setTimeout(hideCheckin, 120000);
  }
  function hideCheckin() { $("ckp").classList.remove("on"); if (ckT) clearTimeout(ckT); ckT = null; }
  $("ckx").onclick = (e) => { e.stopPropagation(); hideCheckin(); };
  $("ckp").onclick = (e) => { e.stopPropagation(); if ((e.target as HTMLElement).id === "ckp") hideCheckin(); };

  /* ---------- 送迎の開始・終了 ---------- */
  async function start(t: CabinTrip, r: CabinRoom | null) {
    if (trip?.id === t.id) { if (r && room?.id !== r.id) { room = r; roomTexts(); } return; }
    stop();
    trip = t; room = r; lang = t.lang; T = CABIN_T[lang] ?? CABIN_T.en;
    arrived = false; d = 0; prevD = undefined; carLL = null; lastFeed = null; hit = new Set(); offroute = false; backN = 0; offT = 0; rerouteAt = 0; rerouteBase = 0; bs = { ...BOOST_INIT };
    const home = r?.home ?? CRANE_NEST, known = (PLACES as any)[t.placeKey] as { ll: LL } | undefined;
    const place: LL = known?.ll ?? t.placeLL ?? home;
    dest = t.dir === "in" ? home : place; origin = place;
    const key = `${t.placeKey}_${t.dir}`;
    const fixed = known && dist(home, CRANE_NEST) < 400 ? routes[key] : null;
    if (fixed) { R = makeRoute(fixed); baseMin = BASE_MIN[key] ?? 15; }
    else {
      const a = t.dir === "in" ? place : home, b = t.dir === "in" ? home : place;
      const o = await osrm(a, b);
      if (o) { R = o.r; baseMin = Math.ceil(o.min + bufferMin(R.total / 1000)); }
      else { R = makeRoute([[a[1], a[0]], [b[1], b[0]]]); baseMin = Math.ceil((R.total * 1.3) / 1000 / 35 * 60 + bufferMin(R.total / 1000)); }
      if (trip?.id !== t.id) return;
    }
    const vk = known ? t.placeKey : "other";
    goKey = `en-${vk}_${t.dir}-go`; byeKey = `en-${vk}_out-arrive`;
    pois = poisFor(R, t.dir).map((k) => ({ k, d: project(R, POIS[k]).d }));
    $("room").classList.remove("lit", "rscanning", "tagged"); $("arrive").classList.remove("on"); $("cap").classList.remove("show");
    if (t.dir === "out") $("room").classList.add("lit");
    texts(); draw(); meter(0);
    // お見送りで駅へ: 右下の枠を「電車の案内」に (時刻表を登録した駅だけ)
    if (t.dir === "out") trains.show(stationsFor(t.placeKey, t.placeName)); else trains.hide();
    ($("etaM").firstChild as Text).textContent = String(baseMin); setText("km", T.km.replace("{k}", (R.total / 1000).toFixed(1)));
    stage.classList.add("trip"); startedAt = Date.now(); ai.reset(); npId = null;
    setTimeout(() => MAP.invalidateSize(), 50);
    // 出発の演出
    linkS(); void say(goKey); $("sweep").classList.add("on");
    if (t.dir === "in") T_(1800, () => { const rm = $("room"); rm.classList.remove("rscanning", "tagged"); void rm.offsetWidth; rm.classList.add("rscanning"); scanS(); setTimeout(() => { rm.classList.remove("rscanning"); rm.classList.add("tagged"); }, 4200); });
    else T_(2000, () => { $("room").classList.remove("lit"); });
  }
  function stop() {
    timers.forEach(clearTimeout); timers = []; demo(true); boostReset(); stopPtc();
    trip = null; stage.classList.remove("trip"); $("arrive").classList.remove("on"); $("sweep").classList.remove("on");
    qrHide(); npv.reset(); ai.reset(); guide.stop(); toilet.stop(); lock.stop(); hideCheckin(); trains.hide(); stopVoice(voice);
  }

  /* ---------- 地図をこの iPad に保存 ---------- */
  async function saveOffline(onProgress: (done: number, total: number) => void) {
    const out = new Set<string>();
    const all = Object.values(routes).map((x) => makeRoute(x)).concat(trip ? [R] : []);
    for (let z = 12; z <= 16; z++) {
      const n = 2 ** z, pad = 0.005;
      const tx = (lon: number) => Math.floor(((lon + 180) / 360) * n), ty = (lat: number) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
      for (const r of all) for (let dd = 0; dd <= r.total; dd += 150) {
        const p = pointAt(r, dd);
        for (let x = tx(p[1] - pad); x <= tx(p[1] + pad); x++) for (let y = ty(p[0] + pad); y <= ty(p[0] - pad); y++) out.add(`${z}/${x}/${y}`);
      }
    }
    const urls: string[] = [];
    for (const m of ["dark", "photo"] as const) for (const k of out) { const [z, x, y] = k.split("/"); urls.push(TILES[m].replace("{z}", z).replace("{x}", x).replace("{y}", y)); }
    const total = urls.length; let done = 0, bytes = 0, fail = 0;
    const work = async () => {
      while (urls.length) {
        const u = urls.pop()!;
        try { if (!(await tget(u))) { const r = await fetch(u); if (r.ok) { const b = await r.blob(); bytes += b.size; await tput(u, b); } else fail++; } } catch { fail++; }
        onProgress(++done, total);
      }
    };
    await Promise.all(Array.from({ length: 6 }, work));
    return { tiles: await tileCount(), mb: bytes / 1048576, fail };
  }

  /* ---------- 最初のタップで音を使えるように + 声・効果音をこの iPad に保存 ---------- */
  function unlock() {
    ai.preload(); ai.unlock(); guide.unlock(); toilet.unlock(); lock.unlock();
    ac(); voice.muted = true; voice.src = AUDIO + "en-arrive.mp3"; voice.play().then(() => { voice.pause(); voice.muted = false; }).catch(() => { voice.muted = false; });
    // 声・効果音を先に読み込んでおく (保存済みなら iPad の中から。再生のときに待たない)
    void (async () => {
      for (const k of AUDIO_KEYS) {
        if (blobs[k]) continue;
        try { const r = await fetch(AUDIO + k + ".mp3"); if (r.ok) blobs[k] = URL.createObjectURL(await r.blob()); } catch { /* 次へ */ }
      }
    })();
  }

  /** 画面の大きさに合わせる。iPad を縦にしたら縦の並び (820 x 1180)、横なら横の並び (1180 x 820) */
  function resize() {
    const port = window.innerHeight > window.innerWidth * 1.05, was = stage.classList.contains("port");
    stage.classList.toggle("port", port);
    const W = port ? 820 : 1180, H = port ? 1180 : 820;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    MAP.invalidateSize();
    if (was !== port) requestAnimationFrame(() => {
      MAP.invalidateSize();
      if (trip) { if (carLL) MAP.panTo(carLL, { animate: false }); else MAP.fitBounds(L.latLngBounds(R.pts.concat([room?.home ?? CRANE_NEST])).pad(0.18)); }
      if (ptOn) { stopPtc(); setTimeout(startPtc, 50); }
      npv.relayout();
    });
  }

  /* ---------- 待機中の手動ガイド (⚙ から。お部屋と言語を選んで押したときだけ流れる) ---------- */
  function manual(k: "ent" | "room" | "toilet" | "ck" | "wifi" | "stop", r: CabinRoom | null, l: GLang): boolean {
    if (trip) return false;
    qrHide(); guide.stop(); toilet.stop(); lock.stop(); hideCheckin();
    if (k === "stop") return true;
    room = r; lang = CABIN_T[l] ? l : "en"; T = CABIN_T[lang] ?? CABIN_T.en;
    unlock();
    if (k === "ck") { showCheckin(); return !!checkinUrl; }
    if (k === "wifi") { showWifi(); return true; }
    if (k === "ent") guide.start("ent");
    else if (k === "room") { if (roomGuideOf(r?.slug)) guide.start("room"); else if (hasRoomLock(r?.slug)) lock.start(); else return false; }
    else if (k === "toilet") toilet.start();
    return true;
  }
  const hasRoomGuide = (r: CabinRoom | null) => !!roomGuideOf(r?.slug) || hasRoomLock(r?.slug);
  return { manual, hasRoomGuide, start, stop, feed, tripId: () => trip?.id ?? null, audioUrls: () => AUDIO_KEYS.map((k) => AUDIO + k + ".mp3").concat(ai.urls()), unlock, demo, saveOffline, resize, weather,
    nowPlaying: (np, track, skew) => {
      npv.update(np, track, skew);
      // 曲が変わったら AI がひと言
      if (np && track && np.id === track.id && np.id !== npId) { if (npId) ai.event("song"); npId = np.id; }
    },
    setQuiet: (q) => { aiQuiet = q; stage.classList.toggle("ai-quiet", q); },
    setHumor: (on) => { aiHumor = on; },
    /** スマホが声を取りに来ている (ageMs = 最後に来てからの時間) */
    remoteVoice: () => Date.now() - phoneSeen < 12000,
    setVoiceSeen: (ageMs: number | null) => { phoneSeen = ageMs == null ? 0 : Date.now() - ageMs; },
    aiCommand: (cmd) => { if (trip) ai.command(cmd); },
    setCheckin: (u) => { ckSet = u; checkinUrl = u || ckDefault; const b = root.querySelector<HTMLElement>('#aq [data-q="ck"]'); if (b) b.style.display = checkinUrl ? "" : "none"; } };
}
