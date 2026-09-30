"use client";

/**
 * 車内 iPad (お客さん用の画面)。お父さんのスマホで「出発」を押すと、3 秒以内にこの画面が送迎に切り替わる。
 *   ・待機中: CRANE NEST のロゴ・時計・天気
 *   ・送迎中: 地図・到着予想・観光案内・高速モード・部屋の写真・到着の演出 (cabinEngine)
 *   ・位置: この iPad の GPS (Wi-Fi + Cellular モデル)。無い / 弱いときはお父さんのスマホの位置
 *   ・右下の ⚙: この iPad に保存 (声・効果音・写真・地図) / テスト走行 / 名前の変更
 */
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { TRIP_HTML } from "@/components/cabin/cabinMarkup";
import { createEngine, tileCount, type Engine } from "@/components/cabin/cabinEngine";
import { createDeadhead, type Deadhead } from "@/components/cabin/cabinDeadhead";
import { TOILET_IMG } from "@/components/cabin/cabinToilet";
import { TOILET_VOICE, toiletAudio, type ToiletKey } from "@/lib/cabinToilet";
import { LOCK_IMG, LOCK_VOICE, lockAudio, type LockKey } from "@/lib/cabinLock";
import { DH_LINES, dhAudio } from "@/lib/cabinDeadheadLines";
import type { CabinRoom, CabinTrip } from "@/lib/cabinData";
import type { CabinTrack } from "@/lib/cabinMusic";
import { acModeFor, type LL, type GLang } from "@/lib/cabinGeo";

const WX = { lat: 34.4066, lng: 135.3269 };
const POLL_MS = 3000;
const OWN_FRESH_MS = 6000;   // iPad の GPS がこれより新しければ、スマホの位置は使わない
const GOOD_ACC = 60;         // この精度 (m) より良ければ使う

function loadLeaflet(): Promise<void> {
  const w = window as any;
  if (w.L) return Promise.resolve();
  return new Promise((ok, ng) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/cabin/leaflet/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "/cabin/leaflet/leaflet.js"; s.onload = () => ok(); s.onerror = () => ng(new Error("leaflet")); document.head.appendChild(s);
  });
}

export default function CabinApp({ rooms }: { rooms: CabinRoom[] }) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null); // 送迎画面の中身 (React は触らない。engine が直接動かす)
  const eng = useRef<Engine | null>(null);
  const dhRef = useRef<Deadhead | null>(null);
  const ckLink = useRef<{ link: string; img: string | null } | null>(null); // 予約つきチェックイン QR // 回送モード (ゲストなし: 迎えに行く途中・送ったあとの帰り道)
  const [dev, setDev] = useState<{ id: string; name: string } | null>(null);
  const [needSetup, setNeedSetup] = useState(false);
  const [setupErr, setSetupErr] = useState("");
  const [name, setName] = useState("1号車");
  const [tapped, setTapped] = useState(false);
  const [menu, setMenu] = useState(false);
  const [clock, setClock] = useState({ t: "--:--", d: "" });
  const [wx, setWx] = useState<{ temp: number; code: number } | null>(null);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState<{ label: string; p: number } | null>(null);
  const [saved, setSaved] = useState<number>(0);
  const [inTrip, setInTrip] = useState(false);
  const [gpsState, setGpsState] = useState<"?" | "yes" | "no">("?");
  const [standalone, setStandalone] = useState(true);
  useEffect(() => { setStandalone(!!(navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches); }, []);
  const toast = useCallback((s: string) => { setMsg(s); setTimeout(() => setMsg(""), 3500); }, []);

  // この iPad の GPS
  const own = useRef<{ ll: LL; kmh: number | null; t: number } | null>(null);
  const gps = useRef<{ has: boolean | null; since: number }>({ has: null, since: Date.now() });
  const phoneAt = useRef<string>("");
  const tripRef = useRef<CabinTrip | null>(null);
  const trackRef = useRef<CabinTrack | null>(null);
  const npWarned = useRef(false); // 再生中の曲 (曲名・カバー・歌詞)。変わったときだけサーバから来る

  /* ---------- 起動 ---------- */
  useEffect(() => {
    let live = true;
    try {
      const d = localStorage.getItem("cabDev");
      if (d) setDev(JSON.parse(d)); else setNeedSetup(true);
    } catch { setNeedSetup(true); }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/cabin-sw.js", { scope: "/cabin" }).catch(() => {});
    void (async () => {
      try {
        await loadLeaflet();
        const routes = await (await fetch("/cabin/routes.json")).json();
        if (!live || !root.current || !host.current) return;
        if (!host.current.firstChild) host.current.innerHTML = TRIP_HTML;
        eng.current = createEngine(root.current, routes, {
          onEnd: (id) => void endTrip(id),
          // 全画面の再生ボタン → お父さんのスマホへ
          onCmd: (id, c, v) => void fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "cmd", trip: id, c, v }) }).catch(() => {}),
          // ゲストの「お部屋の明かりをつけて」→ 本物の照明
          onLights: (id) => void fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "lights", trip: id }) }).catch(() => {}),
          // 声はスマホ (Bluetooth) から流す
          onSay: (id, u, s) => void fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "say", trip: id, u, s }) }).catch(() => {}),
        });
        // 回送モード (ゲストが乗っていない区間。お父さん向けの画面)
        const post = (b: any) => fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((x) => x.json()).catch(() => null);
        dhRef.current = createDeadhead({
          stage: root.current.querySelector(".stage") as HTMLElement, routes, ac: () => { try { const w = window as any; w.__dhAc = w.__dhAc || new (w.AudioContext || w.webkitAudioContext)(); void w.__dhAc.resume(); return w.__dhAc; } catch { return null; } },
          remote: () => !!eng.current?.remoteVoice(),
          say: (u, s) => { const id = tripRef.current?.id; if (id) void post({ op: "say", trip: id, u, s }); },
          board: async (id) => { const r = await post({ op: "board", trip: id }); if (!r?.ok) toast(r?.error === "SETUP" ? "Supabase の SQL（migration_cabin_voice.sql）を実行してください" : "切り替えられませんでした"); else void poll(); },
          end: (id) => void endTrip(id, true),
        });
        eng.current.resize();
        if (wxRef.current) eng.current.weather(wxRef.current);
      } catch { toast("地図の部品を読み込めませんでした（通信を確認してください）"); }
    })();
    const onR = () => eng.current?.resize();
    window.addEventListener("resize", onR);
    const onO = () => setTimeout(onR, 300); // iPad を回したとき (縦 ⇄ 横)
    window.addEventListener("orientationchange", onO);
    void tileCount().then(setSaved);
    return () => { live = false; window.removeEventListener("resize", onR); window.removeEventListener("orientationchange", onO); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 時計・天気・画面を消さない ---------- */
  const wxRef = useRef<any>(null);
  useEffect(() => {
    const tick = () => {
      const n = new Date(Date.now() + 9 * 3600e3);
      setClock({ t: `${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}`, d: `${n.getUTCFullYear()}.${n.getUTCMonth() + 1}.${n.getUTCDate()} ${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][n.getUTCDay()]}` });
    };
    tick(); const id = setInterval(tick, 10000);
    const getWx = () => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WX.lat}&longitude=${WX.lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=3`)
      .then((r) => r.json()).then((j) => {
        const w = { temp: j.current.temperature_2m, code: j.current.weather_code, max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0], rain: j.daily.precipitation_probability_max[0], days: j.daily.weather_code.map((c: number, i: number) => ({ code: c, max: j.daily.temperature_2m_max[i] })) };
        wxRef.current = w; setWx({ temp: w.temp, code: w.code }); eng.current?.weather(w);
      }).catch(() => {});
    void getWx(); const wid = setInterval(getWx, 30 * 60e3);
    let lock: any = null;
    const wake = () => { if ("wakeLock" in navigator && document.visibilityState === "visible") (navigator as any).wakeLock.request("screen").then((l: any) => { lock = l; }).catch(() => {}); };
    wake(); document.addEventListener("visibilitychange", wake);
    return () => { clearInterval(id); clearInterval(wid); document.removeEventListener("visibilitychange", wake); lock?.release?.().catch?.(() => {}); };
  }, []);

  /* ---------- この iPad の GPS ---------- */
  useEffect(() => {
    if (!("geolocation" in navigator)) { gps.current.has = false; setGpsState("no"); return; }
    const id = navigator.geolocation.watchPosition((p) => {
      const acc = p.coords.accuracy;
      // GPS のある iPad は数 m〜十数 m で速さも出る。Wi-Fi だけの iPad は数十〜数百 m
      if (acc <= 30 && p.coords.speed != null && gps.current.has !== true) { gps.current.has = true; setGpsState("yes"); }
      if (acc > GOOD_ACC) return;
      const kmh = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
      own.current = { ll: [p.coords.latitude, p.coords.longitude], kmh, t: Date.now() };
      if (tripRef.current) { if (dhRef.current?.on()) dhRef.current.feed(own.current.ll, kmh); else eng.current?.feed(own.current.ll, kmh, "ipad"); }
    }, () => { /* 許可されていない・取れない → スマホの位置を使う */ }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    const chk = setInterval(() => { if (gps.current.has === null && Date.now() - gps.current.since > 60000) { gps.current.has = false; setGpsState("no"); } }, 10000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(chk); };
  }, []);

  /* ---------- 3 秒ごとに「送迎は始まった？」 ---------- */
  const poll = useCallback(async () => {
    if (!dev) return;
    const g = gps.current.has === null ? "" : gps.current.has ? "&gps=1" : "&gps=0";
    try {
      const r = await fetch(`/api/cabin/state?d=${dev.id}${g}&np=${trackRef.current?.id ?? ""}`, { cache: "no-store" });
      if (r.status === 401) { location.href = "/staff/login?next=/cabin"; return; }
      const j = await r.json(); setOnline(true);
      if (!j.ok) { if (j.error === "SETUP") toast("Supabase の SQL（migration_cabin.sql）がまだ実行されていません"); return; }
      if (!j.device) { try { localStorage.removeItem("cabDev"); } catch { /* ignore */ } setDev(null); setNeedSetup(true); return; }
      if (j.device.name !== dev.name) { const d = { id: dev.id, name: j.device.name }; setDev(d); try { localStorage.setItem("cabDev", JSON.stringify(d)); } catch { /* ignore */ } }
      const e = eng.current; if (!e) return;
      const t: CabinTrip | null = j.trip;
      if (t) {
        const first = e.tripId() !== t.id;
        tripRef.current = t;
        // スマホが声を取りに来ているか (来ていれば声はスマホから)
        e.setVoiceSeen(t.voiceSeen && typeof j.now === "number" ? Math.max(0, j.now - Date.parse(t.voiceSeen)) : null);
        // 回送中 (ゲストなし) は父向けの画面。ゲスト乗車 (phase = guest) でいつもの送迎画面へ
        const dh = dhRef.current;
        if (t.phase === "dead" && dh) {
          if (e.tripId() === t.id) e.stop();
          setInTrip(true); setMenu(false);
          dh.show(t, j.room, j.dh ?? null, typeof j.checkin === "string" || typeof j.checkinLink === "string");
          const ownF = own.current && Date.now() - own.current.t < OWN_FRESH_MS;
          if (!ownF && t.phone && t.phone.at !== phoneAt.current && Date.now() - Date.parse(t.phone.at) < 30000) { phoneAt.current = t.phone.at; dh.feed(t.phone.ll, t.phone.kmh); }
          else if (ownF) dh.feed(own.current!.ll, own.current!.kmh);
          return;
        }
        if (dh?.on()) dh.hide();
        if (first) { setInTrip(true); setMenu(false); await e.start(t, j.room); phoneAt.current = ""; if (own.current && Date.now() - own.current.t < OWN_FRESH_MS) e.feed(own.current.ll, own.current.kmh, "ipad"); }
        // iPad の GPS が新しくなければ、お父さんのスマホの位置で
        const ownFresh = own.current && Date.now() - own.current.t < OWN_FRESH_MS;
        if (!ownFresh && t.phone && t.phone.at !== phoneAt.current && Date.now() - Date.parse(t.phone.at) < 30000) {
          phoneAt.current = t.phone.at; e.feed(t.phone.ll, t.phone.kmh, "phone");
        }
        e.setQuiet(!!t.aiQuiet); // AI の静かモード (お父さんのスマホで切り替え)
        // チェックイン QR: 予約つき (合言葉入り・その予約に自動で紐づく) があればそれ、無ければ全員共通の画像
        if (typeof j.checkinLink === "string") {
          if (ckLink.current?.link !== j.checkinLink) { const link = j.checkinLink; ckLink.current = { link, img: null }; QRCode.toDataURL(link, { margin: 2, width: 560, errorCorrectionLevel: "M" }).then((img) => { const c = ckLink.current; if (c && c.link === link) { c.img = img; eng.current?.setCheckin(img); } }).catch(() => {}); }
          e.setCheckin(ckLink.current?.img ?? (typeof j.checkin === "string" ? j.checkin : null));
        } else e.setCheckin(typeof j.checkin === "string" ? j.checkin : null);
        e.aiCommand(t.aiCmd ?? null); // お父さんから ASTRAEA への指示
        // 再生中の曲 (歌詞は iPad で時間を進めながら合わせる)
        if (t.npReady === false && !npWarned.current) { npWarned.current = true; toast("歌詞を出すには Supabase の SQL（migration_cabin_music.sql）を実行してください"); }
        if (j.track) trackRef.current = j.track;
        e.nowPlaying(t.np ?? null, t.np && trackRef.current?.id === t.np.id ? trackRef.current : null, typeof j.now === "number" ? j.now - Date.now() : 0);
      } else { dhRef.current?.hide(); if (e.tripId() && !e.tripId()!.startsWith("demo")) { e.stop(); tripRef.current = null; setInTrip(false); } }
    } catch { setOnline(false); }
  }, [dev, toast]);
  useEffect(() => { if (!dev) return; void poll(); const id = setInterval(() => void poll(), POLL_MS); return () => clearInterval(id); }, [dev, poll]);

  async function endTrip(id: string, force = false) {
    // お見送りの到着のあとは、終わりにせず「帰り道 (回送)」へ (SQL がまだなら今までどおり終わり)
    if (!force && !id.startsWith("demo") && tripRef.current?.id === id && tripRef.current.dir === "out") {
      const r = await fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "deadhead", trip: id }) }).then((x) => x.json()).catch(() => null);
      if (r?.ok) { eng.current?.stop(); void poll(); return; }
    }
    dhRef.current?.hide();
    if (!id.startsWith("demo")) await fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "end", trip: id }) }).catch(() => {});
    eng.current?.stop(); tripRef.current = null; setInTrip(false);
  }

  /* ---------- 登録 ---------- */
  async function register() {
    setSetupErr("");
    const r = await fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "register", name }) }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setSetupErr(r?.error === "SETUP" ? "Supabase の SQL（migration_cabin.sql）を先に実行してください" : "登録できませんでした（通信・ログインを確認してください）"); return; }
    const d = { id: r.device.id, name: r.device.name }; setDev(d); setNeedSetup(false);
    try { localStorage.setItem("cabDev", JSON.stringify(d)); } catch { /* ignore */ }
    navigator.geolocation?.getCurrentPosition(() => {}, () => {}); // 位置情報の許可を先に聞いておく
  }
  async function rename() {
    if (!dev) return; const n = prompt("この iPad の名前", dev.name); if (!n?.trim()) return;
    const r = await fetch("/api/cabin/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "rename", id: dev.id, name: n.trim() }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { const d = { ...dev, name: n.trim().slice(0, 30) }; setDev(d); try { localStorage.setItem("cabDev", JSON.stringify(d)); } catch { /* ignore */ } toast("✓ 名前を変えました"); }
  }

  /* ---------- この iPad に保存 (声・効果音・写真・地図の部品 → 地図) ---------- */
  async function saveAll() {
    const e = eng.current; if (!e) return;
    e.unlock();
    const urls = [...e.audioUrls(),
      // 到着画面のガイド (トイレ・お部屋の鍵) と回送モードの声・写真も
      ...(Object.keys(TOILET_VOICE) as ToiletKey[]).map(toiletAudio), ...Object.values(TOILET_IMG),
      ...(Object.keys(LOCK_VOICE) as LockKey[]).map(lockAudio), ...Object.values(LOCK_IMG),
      ...Object.keys(DH_LINES).map(dhAudio), "/cabin/audio/boost-sfx.mp3",
      "/cabin/leaflet/leaflet.js", "/cabin/leaflet/leaflet.css", "/cabin/routes.json", "/cabin/bay.webp", "/cabin/rooms/r1.webp", "/cabin/rooms/r2.webp", "/cabin/rooms/r3.webp", "/cabin/rooms/r4.webp",
      ...rooms.map((r) => r.photo).filter((x): x is string => !!x && x.startsWith("http"))].map((u) => new URL(u, location.href).href);
    setProg({ label: "声・効果音・写真", p: 0 });
    const reg = await navigator.serviceWorker?.ready.catch(() => null);
    if (reg?.active) {
      await new Promise<void>((ok) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (m) => { setProg({ label: "声・効果音・写真", p: m.data.done / m.data.total }); if (m.data.done >= m.data.total) ok(); };
        reg.active!.postMessage({ type: "precache", urls }, [ch.port2]);
        setTimeout(ok, 60000);
      });
    } else { for (let i = 0; i < urls.length; i++) { await fetch(urls[i]).catch(() => null); setProg({ label: "声・効果音・写真", p: (i + 1) / urls.length }); } }
    // 写真は先に読み込んで、表示のときに待たないように
    await Promise.all(rooms.filter((r) => r.photo).map((r) => { const im = new Image(); im.src = r.photo!; return im.decode?.().catch(() => {}); }));
    setProg({ label: "地図", p: 0 });
    const res = await e.saveOffline((d, n) => setProg({ label: "地図", p: d / n }));
    setProg(null); setSaved(res.tiles);
    toast(`✓ この iPad に保存しました（地図 ${res.tiles} 枚・約 ${res.mb.toFixed(1)} MB${res.fail ? `・失敗 ${res.fail}` : ""}）`);
  }

  /* ---------- 手動ガイド (待機中に ⚙ から。トイレやドアの前でゲストと一緒に聞く) ---------- */
  const [mRoom, setMRoom] = useState<string | null>(rooms[0]?.id ?? null);
  const [mLang, setMLang] = useState<GLang>(() => { try { const v = localStorage.getItem("cab.mlang"); if (v === "en" || v === "zh" || v === "ko" || v === "ja") return v; } catch { /* ignore */ } return "en"; });
  const [mMsg, setMMsg] = useState("");
  function manual(k: "ent" | "room" | "toilet" | "ck" | "wifi") {
    const e = eng.current; if (!e) return;
    if (inTrip) { setMMsg("送迎中は使えません（到着画面のボタンを使ってください）"); return; }
    const ok = e.manual(k, rooms.find((r) => r.id === mRoom) ?? null, mLang);
    if (!ok) { setMMsg(k === "ck" ? "チェックインの QR がまだ登録されていません（お父さんのスマホで登録）" : "このお部屋のガイドはまだありません"); return; }
    setMMsg(""); setMenu(false);
  }
  /* ---------- テスト走行 (スマホなしで動きを確認) ---------- */
  async function testRun(placeKey: string, dir: "in" | "out") {
    const e = eng.current; if (!e) return;
    e.unlock(); setMenu(false);
    const room = rooms.find((r) => r.photo) ?? rooms[0] ?? null;
    const t: CabinTrip = { id: "demo-" + Date.now(), deviceId: null, resId: null, dir, placeKey, placeName: null, placeLL: null, roomId: room?.id ?? null, lang: "zh", ac: acModeFor(Date.now()), startedAt: new Date().toISOString(), phone: null, np: null, cmd: null, npReady: true, aiQuiet: false, voiceSeen: null, phase: "guest", aiCmd: null };
    tripRef.current = t; setInTrip(true);
    await e.start(t, room); setTimeout(() => e.demo(), 2500);
  }

  const tap = () => { if (tapped) return; setTapped(true); eng.current?.unlock(); dhRef.current?.unlock(); try { (document.documentElement as any).webkitRequestFullscreen?.(); } catch { /* ignore */ } };

  return (
    <div className="cab" ref={root} onClick={tap}>
      <div className="stage">
        <div className="stby">
          <div className="rings" />
          <div className="logo">CRANE NEST</div>
          <div className="sub">WELCOME TO IZUMISANO</div>
          <div className="clock">{clock.t}</div>
          <div className="date">{clock.d}</div>
          {wx && <div className="wxl">{wx.code <= 1 ? "☀" : wx.code <= 3 ? "🌤" : wx.code <= 48 ? "☁" : wx.code <= 67 ? "🌧" : "❄"} {Math.round(wx.temp)}° · IZUMISANO</div>}
          <div className={`dev ${online ? "" : "ng"}`}><i />{dev ? dev.name : "—"} · {online ? "STANDBY" : "OFFLINE"} · GPS {gpsState === "yes" ? "✓" : gpsState === "no" ? "PHONE" : "…"}</div>
          <button className="gear" onClick={(ev) => { ev.stopPropagation(); setMenu((v) => !v); }}>⚙</button>
        </div>
        <div ref={host} style={{ display: "contents" }} suppressHydrationWarning />
        {inTrip && tripRef.current?.id.startsWith("demo") && (
          <button className="gear" style={{ position: "absolute", right: 18, bottom: 14, zIndex: 2000, width: 52, height: 52, borderRadius: "50%", border: "1px solid rgba(95,176,255,.35)", background: "rgba(4,10,22,.8)", color: "#8fb2d9", fontSize: 18 }}
            onClick={(ev) => { ev.stopPropagation(); void endTrip(tripRef.current!.id); }}>■</button>
        )}
        <div className={`menu ${menu ? "on" : ""}`} onClick={(ev) => ev.stopPropagation()}>
          <h4>THIS iPAD</h4>
          <button onClick={() => void saveAll()} disabled={!!prog}>📥 この iPad に保存（声・効果音・写真・地図）</button>
          {prog && <><small>{prog.label}… {Math.round(prog.p * 100)}%</small><div className="bar"><i style={{ width: `${prog.p * 100}%` }} /></div></>}
          <small>家の Wi-Fi で 1 回押してください。保存すると、走行中は通信なし・待ち時間なしで表示と音が出ます（地図 {saved} 枚保存済み）。</small>
          <h4>手動ガイド（押したときだけ流れます）</h4>
          <div className="row gsel">{rooms.map((r) => <button key={r.id} className={mRoom === r.id ? "on" : ""} onClick={() => setMRoom(r.id)}>{r.kanji}</button>)}</div>
          <div className="row gsel">{(["en", "zh", "ko", "ja"] as GLang[]).map((l) => <button key={l} className={mLang === l ? "on" : ""} onClick={() => { setMLang(l); try { localStorage.setItem("cab.mlang", l); } catch { /* ignore */ } }}>{({ en: "English", zh: "中文", ko: "한국어", ja: "日本語" } as const)[l]}</button>)}</div>
          <div className="row"><button onClick={() => manual("toilet")}>🚻 トイレの使い方</button><button onClick={() => manual("ent")}>🚪 エントランス</button></div>
          <div className="row"><button onClick={() => manual("wifi")}>📶 Wi-Fi の QR</button></div>
          <div className="row"><button onClick={() => manual("room")} disabled={!eng.current?.hasRoomGuide(rooms.find((r) => r.id === mRoom) ?? null)}>🔑 お部屋の開け方・鍵</button><button onClick={() => manual("ck")}>🛂 チェックイン</button></div>
          {mMsg && <small style={{ color: "#ffd199" }}>{mMsg}</small>}
          <h4>テスト走行（スマホなしで動きを確認）</h4>
          <div className="row"><button onClick={() => void testRun("kix", "in")}>✈ 関空T1 → 住まい</button><button onClick={() => void testRun("rinku", "out")}>住まい → りんくう</button></div>
          <h4>設定</h4>
          <div className="row"><button onClick={() => void rename()}>✎ 名前を変える</button><button onClick={() => { setMenu(false); }}>閉じる</button></div>
          <small>GPS: {gpsState === "yes" ? "この iPad の GPS を使います" : gpsState === "no" ? "GPS が無いので、お父さんのスマホの位置を使います" : "確認中…"}</small>
        </div>
        {needSetup && (
          <div className="setup" onClick={(ev) => ev.stopPropagation()}>
            <h2>この iPad を登録</h2>
            <p>車ごとの名前を付けてください（例：1号車・2号車）。<br />お父さんのスマホで「出発」を押すと、この iPad に表示されます。</p>
            {!standalone && <p style={{ color: "#ffd199", fontSize: 13 }}>先に Safari の共有ボタン →「ホーム画面に追加」をして、ホーム画面の「CRANE NEST」から開いて登録してください。<br />（ホーム画面から開いた画面は Safari とログイン・登録が別々のため）</p>}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
            <button onClick={() => void register()}>登録する</button>
            {setupErr && <p style={{ color: "#ff9b9b" }}>{setupErr}</p>}
          </div>
        )}
        {!tapped && !needSetup && (
          <div className="tapgo"><div className="ring">▶</div>画面をタップしてください<b>音を出す準備をします（最初に 1 回だけ）</b></div>
        )}
        <div className={`toast2 ${msg ? "on" : ""}`}>{msg}</div>
      </div>
    </div>
  );
}
