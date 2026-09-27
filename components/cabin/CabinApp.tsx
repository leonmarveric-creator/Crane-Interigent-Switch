"use client";

/**
 * 車内 iPad (お客さん用の画面)。お父さんのスマホで「出発」を押すと、3 秒以内にこの画面が送迎に切り替わる。
 *   ・待機中: CRANE NEST のロゴ・時計・天気
 *   ・送迎中: 地図・到着予想・観光案内・高速モード・部屋の写真・到着の演出 (cabinEngine)
 *   ・位置: この iPad の GPS (Wi-Fi + Cellular モデル)。無い / 弱いときはお父さんのスマホの位置
 *   ・右下の ⚙: この iPad に保存 (声・効果音・写真・地図) / テスト走行 / 名前の変更
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TRIP_HTML } from "@/components/cabin/cabinMarkup";
import { createEngine, tileCount, type Engine } from "@/components/cabin/cabinEngine";
import type { CabinRoom, CabinTrip } from "@/lib/cabinData";
import { acModeFor, type LL } from "@/lib/cabinGeo";

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
  const toast = useCallback((s: string) => { setMsg(s); setTimeout(() => setMsg(""), 3500); }, []);

  // この iPad の GPS
  const own = useRef<{ ll: LL; kmh: number | null; t: number } | null>(null);
  const gps = useRef<{ has: boolean | null; since: number }>({ has: null, since: Date.now() });
  const phoneAt = useRef<string>("");
  const tripRef = useRef<CabinTrip | null>(null);

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
        eng.current = createEngine(root.current, routes, { onEnd: (id) => void endTrip(id) });
        eng.current.resize();
        if (wxRef.current) eng.current.weather(wxRef.current);
      } catch { toast("地図の部品を読み込めませんでした（通信を確認してください）"); }
    })();
    const onR = () => eng.current?.resize();
    window.addEventListener("resize", onR);
    void tileCount().then(setSaved);
    return () => { live = false; window.removeEventListener("resize", onR); };
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
      if (tripRef.current) eng.current?.feed(own.current.ll, kmh, "ipad");
    }, () => { /* 許可されていない・取れない → スマホの位置を使う */ }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    const chk = setInterval(() => { if (gps.current.has === null && Date.now() - gps.current.since > 60000) { gps.current.has = false; setGpsState("no"); } }, 10000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(chk); };
  }, []);

  /* ---------- 3 秒ごとに「送迎は始まった？」 ---------- */
  const poll = useCallback(async () => {
    if (!dev) return;
    const g = gps.current.has === null ? "" : gps.current.has ? "&gps=1" : "&gps=0";
    try {
      const r = await fetch(`/api/cabin/state?d=${dev.id}${g}`, { cache: "no-store" });
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
        if (first) { setInTrip(true); setMenu(false); await e.start(t, j.room); phoneAt.current = ""; if (own.current && Date.now() - own.current.t < OWN_FRESH_MS) e.feed(own.current.ll, own.current.kmh, "ipad"); }
        // iPad の GPS が新しくなければ、お父さんのスマホの位置で
        const ownFresh = own.current && Date.now() - own.current.t < OWN_FRESH_MS;
        if (!ownFresh && t.phone && t.phone.at !== phoneAt.current && Date.now() - Date.parse(t.phone.at) < 30000) {
          phoneAt.current = t.phone.at; e.feed(t.phone.ll, t.phone.kmh, "phone");
        }
      } else if (e.tripId() && !e.tripId()!.startsWith("demo")) { e.stop(); tripRef.current = null; setInTrip(false); }
    } catch { setOnline(false); }
  }, [dev, toast]);
  useEffect(() => { if (!dev) return; void poll(); const id = setInterval(() => void poll(), POLL_MS); return () => clearInterval(id); }, [dev, poll]);

  async function endTrip(id: string) {
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
    const urls = [...e.audioUrls(), "/cabin/leaflet/leaflet.js", "/cabin/leaflet/leaflet.css", "/cabin/routes.json", "/cabin/rooms/r1.webp", "/cabin/rooms/r2.webp", "/cabin/rooms/r3.webp", "/cabin/rooms/r4.webp",
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

  /* ---------- テスト走行 (スマホなしで動きを確認) ---------- */
  async function testRun(placeKey: string, dir: "in" | "out") {
    const e = eng.current; if (!e) return;
    e.unlock(); setMenu(false);
    const room = rooms.find((r) => r.photo) ?? rooms[0] ?? null;
    const t: CabinTrip = { id: "demo-" + Date.now(), deviceId: null, resId: null, dir, placeKey, placeName: null, placeLL: null, roomId: room?.id ?? null, lang: "zh", ac: acModeFor(Date.now()), startedAt: new Date().toISOString(), phone: null };
    tripRef.current = t; setInTrip(true);
    await e.start(t, room); setTimeout(() => e.demo(), 2500);
  }

  const tap = () => { if (tapped) return; setTapped(true); eng.current?.unlock(); try { (document.documentElement as any).webkitRequestFullscreen?.(); } catch { /* ignore */ } };

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
