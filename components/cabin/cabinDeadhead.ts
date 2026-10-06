/**
 * 車内 iPad: 回送モード (ゲストが乗っていない区間)。お父さん (キャプテン) 向けの画面。
 *   迎えに行く途中: ミッション (ゲスト・便・カウントダウン) / 到着前チェック / 上空レーダー (お迎えの便を強調)
 *                   → スカイゲート・ブースト → 近づくとお出迎えボード → 「🧳 ゲスト乗車」でゲスト用の画面へ
 *   お見送りのあと: 任務完了 → 忘れ物チェック → 静かな帰り道 → 帰着
 *   見た目はゲスト用と同じ枠と部品で、色だけ青 (③ 中間)。声は ASTRAEA → キャプテン (英語 + 日本語の字幕)。
 *   Leaflet は先に読み込んでおくこと (window.L)。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SFX_MARK } from "@/lib/remoteVoice";
import { DH_LINES, DH_IDLE, dhSpdFor, dhAudio, callsignOf } from "@/lib/cabinDeadheadLines";
import { BRIDGE, CRANE_NEST, PLACES, dist, type GLang, type LL } from "@/lib/cabinGeo";
import type { CabinRoom, CabinTrip } from "@/lib/cabinData";
import { playSafe, unlockAudio, stopVoice } from "@/lib/cabinAudio";

export interface DhInfo { guest: string | null; flightNo: string | null; flight: any; prepared: string | null; pickupAt: string | null; battery: number | null }
export interface DhCtx {
  stage: HTMLElement;
  routes: Record<string, [number, number][]>;
  ac: () => AudioContext | null;
  remote: () => boolean;                          // 声はスマホから
  say: (url: string, text: string) => Promise<boolean>; // スマホへ声を送る (スマホが鳴らし始めたら true)
  board: (tripId: string) => void;                // ゲスト乗車
  end: (tripId: string) => void;                  // 帰着 (送迎を終わりに)
}
export interface Deadhead { show(t: CabinTrip, room: CabinRoom | null, info: DhInfo | null, checkin: boolean): void; feed(ll: LL, kmh: number | null): void; hide(): void; on(): boolean; tripId(): string | null; unlock(): void }

const esc = (s: string) => String(s ?? "").replace(/[<&>"]/g, "");
const LANG: Record<GLang, string> = { ja: "日本語", zh: "中文", en: "English", ko: "한국어" };
const WEL: Record<GLang, string> = { ja: "Crane Nest へようこそ", zh: "欢迎光临 Crane Nest", en: "Welcome to Crane Nest", ko: "Crane Nest에 오신 것을 환영합니다" };
const tfm = (d: Date) => d.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
const LIMIT = 80;

const HTML = `<div class="dhs">
 <div class="map dhmap"><div id="dhMap"></div><div class="dhgrid"></div><div class="dhscan"></div><div class="tint"></div>
  <i class="dhcn a"></i><i class="dhcn b"></i><i class="dhcn c"></i><i class="dhcn d"></i>
  <div class="dhgps"><b>● GPS</b><span id="dhGps">-- N · -- E</span><span id="dhHd">HDG ---°</span></div>
  <div class="hud"><div class="eta"><small id="dhEtaL">迎え先まで あと</small><b id="dhEta">--<em>分</em></b><div class="km" id="dhKm">—</div></div>
   <div class="dhpill"><span class="dhtag" id="dhTag">回送中 · DEADHEAD</span><b id="dhRoute"></b></div>
   <div class="dhspd"><b id="dhSpd">0</b><small>km/h</small></div></div>
  <canvas id="dhStars"></canvas>
  <div class="dhboost"><small>SKY GATE BRIDGE</small><b id="dhBT">BOOST</b><div class="dhbar"><i id="dhBP"></i></div></div>
  <div class="dhsub" id="dhSub"><i class="o"></i><div><div class="n">ASTRAEA · CAPTAIN CHANNEL</div><div class="j" id="dhJ">コパイロット待機中</div><div class="e" id="dhE"></div></div></div>
  <button class="dhjvb" id="dhJvB"><i></i><span>JARVIS</span><em id="dhJvS">OFF</em></button>
  <button class="dhwbtn" id="dhWb">🪧 お出迎えボード</button>
 </div>
 <div class="side">
  <div class="box dhmis" id="dhMis"></div>
  <div class="box dhveh"><h3>VEHICLE SCAN<span class="vtab"><b data-v="car" class="on">車両</b><b data-v="rad">レーダー</b><b data-v="chk">チェック</b></span></h3><div class="dg"><canvas id="dhCar"></canvas></div>
   <div class="vdat"><div><small>SPEED</small><b id="dhVS">0<em>km/h</em></b></div><div><small>LIMIT KEPT</small><b id="dhVK">--<em>%</em></b></div><div><small>DRIVE</small><b id="dhVD">00:00</b></div><div><small>HDG</small><b id="dhVH">---<em>°</em></b></div></div></div>
  <div class="box dhchk"><h3 id="dhChkH">到着前チェック · PRE-ARRIVAL</h3><div class="dhck" id="dhCk"></div></div>
  <div class="box dhrad"><h3>上空レーダー · SKY RADAR</h3><canvas id="dhRc" width="170" height="150"></canvas><div class="dhfl" id="dhFl"></div></div>
 </div></div>
<div class="dhwb" id="dhWbP"><div class="w1">WELCOME</div><div class="nm" id="dhWN"></div><div class="w2" id="dhW2"></div><div class="w3" id="dhW3"></div>
 <button class="ab" id="dhBoard">🧳 ゲスト乗車</button><div class="sm">※ ロビーで iPad を掲げてください · 画面をタップで地図に戻る</div></div>
<div class="dhdone" id="dhDone"><b>MISSION COMPLETE</b><small id="dhDoneS"></small></div>`;

/** 朝 8 時前 (日本時間) に出発したお見送りか */
const dawnOut = (t: CabinTrip | null) => !!t && t.dir === "out" && new Date(Date.parse(t.startedAt) + 9 * 3600e3).getUTCHours() < 8;
export function createDeadhead(c: DhCtx): Deadhead {
  const L = (window as any).L;
  const host = document.createElement("div"); host.className = "dh"; host.innerHTML = HTML; c.stage.appendChild(host);
  const $ = (id: string) => host.querySelector("#" + id) as any;
  let trip: CabinTrip | null = null, room: CabinRoom | null = null, info: DhInfo | null = null, back = false, onNow = false;
  let RT: LL[] = [], CUM: number[] = [0], TOT = 1, prog = 0, carLL: LL | null = null, kmh = 0, said: Record<string, number> = {}, spdLv = 0, spdN = 0, spdAt = 0, quietAt = 0, idleAt = 0, boosting = false, t0 = 0;
  let map: any = null, done: any = null, dash: any = null, car: any = null, tgt: any = null;

  /* ---------- 声 (スマホから。スマホが来ていなければ iPad から) ---------- */
  const el = new Audio(); let Q: Promise<void> = Promise.resolve(), talking = false;
  function say(k: string) {
    const line = DH_LINES[k]; if (!line) return Q;
    Q = Q.then(async () => {
      if (!onNow) return; /* 回送が終わったあとに残っていたひと言は流さない */
      $("dhJ").textContent = line.ja; $("dhE").textContent = line.en; $("dhSub").classList.add("talk"); talking = true;
      // スマホが鳴らし始めたら iPad は音を消して長さだけ合わせる。返事が無ければ iPad が鳴らす
      const rm = c.remote() ? await c.say(dhAudio(k), line.en) : false;
      await new Promise<void>((ok) => {
        const end = () => { talking = false; quietAt = Date.now(); $("dhSub").classList.remove("talk"); ok(); };
        if (!onNow) return end();
        el.muted = rm; el.src = dhAudio(k); el.onended = end; el.onerror = end; playSafe(el, () => c.ac(), end);
        setTimeout(end, 18000);
      });
    });
    return Q;
  }
  const once = (k: string) => { if (said[k]) return; said[k] = 1; void say(k); };
  const tone = (f: number, t: number, d: number, v: number, type: OscillatorType = "sine") => {
    const ctx = c.ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(1e-4, ctx.currentTime + t + d); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05);
  };
  // 効果音もスマホから (スマホが来ていなければ iPad から)
  const sfx = (u: string) => { if (c.remote()) { void c.say(u, SFX_MARK); return; } const a = new Audio(u); a.play().catch(() => {}); };

  /* ---------- 地図 ---------- */
  function ensureMap() {
    if (map) return;
    map = L.map($("dhMap"), { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false }).setView(CRANE_NEST, 13); // 先に表示位置を決めておく (未設定のまま線や車を足すと描けない)
    // 地図は国土地理院 (淡色)。CSS で暗い青のホログラム風にして、少し奥へ傾ける (cabin.css の .dhmap)
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
    L.polyline([CRANE_NEST, CRANE_NEST], { color: "#2f8fff", weight: 18, opacity: 0.22, className: "dhbg" }).addTo(map);
    dash = L.polyline([CRANE_NEST, CRANE_NEST], { color: "#5fe3ff", weight: 5, opacity: 0.9, dashArray: "2 14", lineCap: "round", className: "dhflow" }).addTo(map);
    done = L.polyline([CRANE_NEST], { color: "#eafaff", weight: 6, className: "dhdone2" }).addTo(map);
    tgt = L.marker(CRANE_NEST, { icon: L.divIcon({ className: "", html: '<div class="dhtgt"><s></s><s></s><i></i><em id="dhTgL">PICKUP</em></div>' }) }).addTo(map);
    car = L.marker(CRANE_NEST, { zIndexOffset: 1000, icon: L.divIcon({ className: "", html: '<div class="dhcar"><u></u><b></b><b></b><i id="dhCi"></i></div>' }) }).addTo(map);
  }
  function setRoute(pts: LL[]) {
    RT = pts.length > 1 ? pts : [pts[0], pts[0]]; CUM = [0]; for (let i = 1; i < RT.length; i++) CUM.push(CUM[i - 1] + dist(RT[i - 1], RT[i])); TOT = Math.max(1, CUM[CUM.length - 1]);
    map.eachLayer((l: any) => { if (l.options?.className === "dhbg") l.setLatLngs(RT); }); dash.setLatLngs(RT); done.setLatLngs([RT[0]]); tgt.setLatLng(RT[RT.length - 1]); car.setLatLng(RT[0]);
    const tl = document.getElementById("dhTgL"); if (tl) tl.textContent = back ? "HOME · CRANE NEST" : "PICKUP";
    // 奥へ傾けているので、上は広め・下は狭めに余白をとる
    setTimeout(() => { map.invalidateSize(); map.fitBounds(L.latLngBounds(RT), { paddingTopLeft: [90, 150], paddingBottomRight: [90, 130] }); }, 80);
  }
  function project(p: LL) {
    let best = { d: 0, off: Infinity, hd: 0 }; const cx = Math.cos(p[0] * Math.PI / 180), R = 6371000, rad = Math.PI / 180;
    for (let i = 1; i < RT.length; i++) {
      const a = RT[i - 1], b = RT[i], ax = (a[1] - p[1]) * rad * R * cx, ay = (a[0] - p[0]) * rad * R, bx = (b[1] - p[1]) * rad * R * cx, by = (b[0] - p[0]) * rad * R;
      const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / L2)), off = Math.hypot(ax + vx * t, ay + vy * t);
      if (off < best.off) best = { d: CUM[i - 1] + t * (CUM[i] - CUM[i - 1]), off, hd: Math.atan2(vx, vy) / rad };
    }
    return best;
  }

  /* ---------- 右の 3 つの枠 ---------- */
  const minsTo = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? Math.round((t - Date.now()) / 60000) : null; };
  function flightLand(): string | null { const f = info?.flight; const v = f ? f.actual || f.expected || f.scheduled || null : null; return v && Number.isFinite(Date.parse(v)) ? v : null; }
  function renderMission() {
    if (!trip) return;
    if (back) {
      const sec = Math.round((Date.now() - t0) / 1000);
      $("dhMis").innerHTML = `<h3>任務完了 · MISSION COMPLETE</h3><div class="dhbig g">✓ ${esc(PLACES[trip.placeKey as keyof typeof PLACES]?.name.ja ?? trip.placeName ?? "")} までお送りしました</div>
        <div class="dhcds"><div><b>${Math.floor(sec / 60)}</b><small>帰り道 分</small></div><div><b id="dhHomeM">--</b><small>帰着まで 分</small></div></div>`;
      return;
    }
    const f = info?.flight, land = flightLand(), lm = minsTo(land), st = f?.status || "";
    const stTxt = /Landed|Arrived/i.test(st) || f?.actual ? "LANDED" : f?.delayMin && f.delayMin > 5 ? `DELAY +${f.delayMin}` : f?.delayMin && f.delayMin < -5 ? `EARLY ${f.delayMin}` : f ? "ON TIME" : "";
    $("dhMis").innerHTML = `<h3>ミッション · お迎え</h3>
      <div class="dhg"><b>${esc(info?.guest || "ゲスト")} 様</b><small>${LANG[trip.lang]}${room ? " · " + esc(room.kanji + " " + room.en) : ""}${info?.pickupAt ? " · お迎え " + tfm(new Date(info.pickupAt)) : ""}</small></div>
      ${info?.flightNo ? `<div class="dhf"><b>${esc(info.flightNo)}</b><span class="${/DELAY/.test(stTxt) ? "w" : /EARLY/.test(stTxt) ? "a" : ""}">${stTxt}</span><small>${land ? "着陸 " + tfm(new Date(land)) : "着陸時刻 確認中"}${f?.terminal ? " · " + esc(f.terminal) : ""}</small></div>` : ""}
      <div class="dhcds"><div><b id="dhCdE">--</b><small>到着まで 分</small></div><div class="a"><b>${lm == null ? "--" : lm <= 0 ? "✓" : lm}</b><small>${info?.flightNo ? "着陸まで 分" : "お迎えまで 分"}</small></div></div>`;
    if (!info?.flightNo && info?.pickupAt) { const pm = minsTo(info.pickupAt); (host.querySelector(".dhcds .a b") as HTMLElement).textContent = pm == null ? "--" : pm <= 0 ? "✓" : String(pm); }
  }
  let checkShown = false;
  async function renderCheck(checkin: boolean) {
    if (back) {
      $("dhChkH").textContent = "降りたあとの確認 · AFTER DROP-OFF";
      $("dhCk").innerHTML = `<div class="w"><i>⚠</i>後部座席・トランクの忘れ物<em>確認</em></div><div class="ok"><i>✓</i>ゲストを無事にお送り<em>完了</em></div>`;
      return;
    }
    $("dhChkH").textContent = "到着前チェック · PRE-ARRIVAL";
    const bt = info?.battery;
    const rows: [string, string, "ok" | "w" | "n", string][] = [
      ["rm", "お部屋の準備 (照明・エアコン)", info?.prepared ? "ok" : "w", info?.prepared ? "準備済み" : "未準備"],
      ["qr", "チェックイン QR", checkin ? "ok" : "n", checkin ? "登録済み" : "なし"],
      ["bt", "お部屋の鍵 · 電池", bt == null ? "n" : bt < 30 ? "w" : "ok", bt == null ? "--" : `${bt}%`],
      ["lg", "ゲストの言語", "ok", LANG[trip!.lang]],
    ];
    $("dhCk").innerHTML = rows.map(([k, n]) => `<div data-k="${k}"><i>□</i>${n}<em>…</em></div>`).join("");
    if (checkShown) { rows.forEach(([k, , s, v]) => fill(k, s, v)); return; }
    checkShown = true;
    for (const [k, , s, v] of rows) { const r = $("dhCk").querySelector(`[data-k="${k}"]`); r?.classList.add("scan"); tone(1600, 0, 0.04, 0.03, "square"); await wait(650); r?.classList.remove("scan"); fill(k, s, v); }
    if (!info?.prepared) once("roomWarn"); else once("roomOk");
    if (bt != null && bt < 30) once("checkWarn");
  }
  function fill(k: string, s: string, v: string) { const r = $("dhCk").querySelector(`[data-k="${k}"]`); if (!r) return; r.className = s; r.querySelector("i").textContent = s === "ok" ? "✓" : s === "w" ? "⚠" : "—"; r.querySelector("em").textContent = v; }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* ---------- 上空レーダー (お迎えの便を強調) ---------- */
  const KIX: LL = [34.4347, 135.244], RK = 40; let planes: any[] = [], live = false, sw = 0, lastList = 0;
  async function loadPl() { try { const r = await (await fetch("/api/kaku?op=ext&k=planes", { cache: "no-store" })).json(); if (r.ok) { planes = r.data || []; live = true; } else live = false; } catch { live = false; } }
  function sim() {
    const t = Date.now() / 1000;
    return ([["APJ143", "OKA", 45, 1], ["JAL226", "HND", 200, 1], ["CPA596", "HKG", 300, -1], ["EVA178", "TPE", 250, 1]] as [string, string, number, number][]).map(([cs, from, b, dir], k) => {
      const r = (((t / 40 + k * 0.23) % 1) * 2 - 1) * 35 * dir, a = b * Math.PI / 180;
      return { cs, from, lat: KIX[0] + Math.cos(a) * r / 111, lng: KIX[1] + Math.sin(a) * r / 91.5, alt: Math.round(Math.abs(r) * 95 + 300), hd: (b + (dir < 0 ? 180 : 0)) % 360, v: 420 };
    });
  }
  function radar() {
    if (!onNow) return; const rc = $("dhRc") as HTMLCanvasElement, rx = rc.getContext("2d")!; const P = live ? planes : sim(), c0 = 85, c1 = 75, R0 = 70, me = callsignOf(info?.flightNo);
    sw = (sw + 0.035) % (Math.PI * 2); rx.clearRect(0, 0, 170, 150);
    rx.strokeStyle = "rgba(95,227,255,.25)"; rx.lineWidth = 1; [1, 0.66, 0.33].forEach((f) => { rx.beginPath(); rx.arc(c0, c1, R0 * f, 0, 7); rx.stroke(); });
    const g = (rx as any).createConicGradient ? (rx as any).createConicGradient(sw - Math.PI / 2, c0, c1) : null;
    if (g) { g.addColorStop(0, "rgba(95,227,255,.45)"); g.addColorStop(0.12, "rgba(95,227,255,0)"); g.addColorStop(1, "rgba(95,227,255,0)"); rx.fillStyle = g; rx.beginPath(); rx.arc(c0, c1, R0, 0, 7); rx.fill(); }
    const pxy = (a: number, b: number) => [c0 + (b - KIX[1]) * 91.5 / RK * R0, c1 - (a - KIX[0]) * 111 / RK * R0];
    rx.fillStyle = "#fff"; rx.font = "bold 8px Menlo,monospace"; rx.fillText("KIX", c0 + 4, c1 - 4);
    const b1 = pxy(BRIDGE.m[0], BRIDGE.m[1]), b2 = pxy(BRIDGE.i[0], BRIDGE.i[1]); rx.strokeStyle = "rgba(95,227,255,.6)"; rx.lineWidth = 2; rx.beginPath(); rx.moveTo(b1[0], b1[1]); rx.lineTo(b2[0], b2[1]); rx.stroke();
    if (carLL) { const m = pxy(carLL[0], carLL[1]); rx.fillStyle = "#46e08a"; rx.beginPath(); rx.arc(m[0], m[1], 3, 0, 7); rx.fill(); }
    for (const p of P) {
      const [x, y] = pxy(p.lat, p.lng); if (Math.hypot(x - c0, y - c1) > R0) continue; const hit = !!me && String(p.cs).toUpperCase() === me;
      rx.save(); rx.translate(x, y); rx.rotate(p.hd * Math.PI / 180); rx.fillStyle = hit ? "#ffb020" : "#e8f7ff"; rx.shadowColor = hit ? "#ffb020" : "#5fe3ff"; rx.shadowBlur = hit ? 14 : 8; const s = hit ? 1.6 : 1;
      rx.beginPath(); rx.moveTo(0, -6 * s); rx.lineTo(4 * s, 5 * s); rx.lineTo(0, 3 * s); rx.lineTo(-4 * s, 5 * s); rx.fill(); rx.restore();
      if (hit) { rx.strokeStyle = "rgba(255,176,32,.9)"; rx.lineWidth = 1.5; rx.beginPath(); rx.arc(x, y, 10 + Math.sin(Date.now() / 200) * 2, 0, 7); rx.stroke(); }
      rx.fillStyle = hit ? "#ffb020" : "rgba(200,235,255,.85)"; rx.font = (hit ? "bold 9px" : "7px") + " Menlo,monospace"; rx.fillText(p.cs, x + 7, y - 3);
    }
    if (performance.now() - lastList > 2000) {
      lastList = performance.now();
      const L2 = P.map((p) => ({ ...p, d: Math.hypot((p.lat - KIX[0]) * 111, (p.lng - KIX[1]) * 91.5), hit: !!me && String(p.cs).toUpperCase() === me })).filter((p) => p.d < RK).sort((a, b) => Number(b.hit) - Number(a.hit) || a.d - b.d).slice(0, 3);
      $("dhFl").innerHTML = L2.map((p) => `<div class="${p.hit ? "me" : ""}"><b>${p.hit ? "★ " : ""}${esc(p.cs)}</b><span>${p.d.toFixed(1)} km</span><small>${p.from ? esc(p.from) + " · " : ""}${p.alt.toLocaleString()} m${p.hit ? " · お迎えの便" : ""}</small></div>`).join("")
        + `<div class="src">${live ? "LIVE · opensky" : "SIM · 取得できないため参考表示"}</div>`;
    }
  }

  /* ---------- ブースト (スカイゲートブリッジ) ---------- */
  const onBridge = (ll: LL) => {
    const R = 6371000, rad = Math.PI / 180, x = (p: LL) => [(p[1] - BRIDGE.m[1]) * rad * R * Math.cos(BRIDGE.m[0] * rad), (p[0] - BRIDGE.m[0]) * rad * R];
    const b = x(BRIDGE.i), q = x(ll), L2 = b[0] * b[0] + b[1] * b[1], t = (q[0] * b[0] + q[1] * b[1]) / L2;
    return { on: t > 0 && t < 1 && Math.abs(q[0] * b[1] - q[1] * b[0]) / Math.sqrt(L2) < 300, t };
  };
  function scr(e: HTMLElement, txt: string, ms: number) { const C = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#$%&"; const tb = performance.now(); (function f(n: number) { const u = Math.min(1, (n - tb) / ms); e.textContent = [...txt].map((ch, i) => (ch === " " || i / txt.length < u ? ch : C[Math.random() * C.length | 0])).join(""); if (u < 1) requestAnimationFrame(f); })(tb); }
  function boostIn() { boosting = true; host.classList.add("boost"); $("dhTag").textContent = "SKY GATE BOOST"; sfx("/cabin/audio/boost-sfx.mp3"); scr($("dhBT"), "BOOST", 800); void say("boostIn"); said.bm = 0; }
  function boostOut() { boosting = false; host.classList.remove("boost"); $("dhTag").textContent = back ? "帰り道 · RETURN" : "回送中 · DEADHEAD"; tone(880, 0, 0.1, 0.05); tone(1320, 0.1, 0.3, 0.05); void say("boostOut"); }
  const cv = $("dhStars") as HTMLCanvasElement, cx = cv.getContext("2d")!, SS = Array.from({ length: 200 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
  function stars() {
    if (!boosting) return; const W = cv.width = cv.clientWidth, H = cv.height = cv.clientHeight; cx.clearRect(0, 0, W, H); const v = 0.003 + kmh / 8000, col = kmh > LIMIT + 1 ? "255,176,32" : "95,227,255";
    for (const s of SS) { const pz = s.z; s.z -= v; if (s.z <= 0.02) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; continue; } const x = W / 2 + s.x / s.z * W * 0.43, y = H / 2 + s.y / s.z * H * 0.43, x2 = W / 2 + s.x / (pz + 0.06) * W * 0.43, y2 = H / 2 + s.y / (pz + 0.06) * H * 0.43; cx.strokeStyle = `rgba(${col},${1 - s.z})`; cx.lineWidth = (1 - s.z) * 3; cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x, y); cx.stroke(); }
  }

  /* ---------- JARVIS (画面だけ。声は ASTRAEA のまま): 右の枠を車両スキャンに。点データは最初の 1 回だけ読む ---------- */
  let jv = false, jcar: any = null, keptN = 0, keptT = 0;
  try { jv = localStorage.getItem("cabin.dhjv") === "1"; } catch { /* 保存できない端末 */ }
  function jvCar() {
    const W = window as any;
    if (!jv || !onNow) { jcar?.stop(); jcar = null; return; }
    if (jcar) return;
    const go = () => { if (jv && onNow && !jcar && W.JVCAR) jcar = W.JVCAR.mount($("dhCar"), { w: 440, h: 340, sc: 88, speed: () => kmh }); };
    if (W.JVCAR) go(); else if (!document.getElementById("jvcarJs")) { const sc = document.createElement("script"); sc.id = "jvcarJs"; sc.src = "/kops/jvcar.js?v=1"; sc.onload = go; document.head.appendChild(sc); } else setTimeout(jvCar, 600);
  }
  function setJv(on: boolean, save = true) {
    jv = on; host.classList.toggle("jv", on); $("dhJvS").textContent = on ? "ON" : "OFF";
    if (save) { try { localStorage.setItem("cabin.dhjv", on ? "1" : "0"); } catch { /* 保存できない端末 */ } }
    jvCar();
  }
  $("dhJvB").onclick = (e: Event) => { e.stopPropagation(); tone(on2(), 0, 0.08, 0.05); tone(on2() * 1.5, 0.08, 0.22, 0.05); setJv(!jv); };
  function on2() { return jv ? 660 : 880; }
  host.querySelectorAll(".vtab b").forEach((b) => { (b as HTMLElement).onclick = (e) => { e.stopPropagation(); const v = (b as HTMLElement).dataset.v; host.querySelectorAll(".vtab b").forEach((x) => x.classList.toggle("on", x === b)); host.classList.toggle("vrad", v === "rad"); host.classList.toggle("vchk", v === "chk"); }; });

  /* ---------- 位置 (スマホ or iPad の GPS) ---------- */
  let lastPan = 0, welcomeShown = false;
  function feed(ll: LL, v: number | null) {
    if (!onNow || !trip) return; carLL = ll; kmh = Math.max(0, v ?? kmh);
    const p = project(ll); if (p.off < 200) prog = Math.max(prog, Math.min(1, p.d / TOT));
    car.setLatLng(ll); const ci = document.getElementById("dhCi"); if (ci && p.off < 200) ci.style.transform = `rotate(${p.hd}deg)`;
    $("dhGps").textContent = `${ll[0].toFixed(4)} N · ${ll[1].toFixed(4)} E`; $("dhHd").textContent = `HDG ${String(Math.round((p.hd + 360) % 360)).padStart(3, "0")}°`;
    const k = Math.max(1, CUM.findIndex((x) => x >= prog * TOT)); done.setLatLngs([...RT.slice(0, k), ll]);
    if (Date.now() - lastPan > 1500) { lastPan = Date.now(); map.panTo(ll, { animate: true, duration: 0.6 }); if (map.getZoom() < 14) map.setZoom(15); }
    const rem = Math.max(0, (1 - prog) * TOT), toEnd = dist(ll, RT[RT.length - 1]), mins = Math.max(0, Math.round(rem / (38 / 3.6) / 60));
    $("dhEta").innerHTML = `${mins}<em>分</em>`; $("dhKm").textContent = `約 ${(rem / 1000).toFixed(1)} km · ${tfm(new Date(Date.now() + mins * 60000))} 着`; $("dhSpd").textContent = String(Math.round(kmh));
    const cd = document.getElementById("dhCdE"); if (cd) cd.textContent = String(mins); const hm = document.getElementById("dhHomeM"); if (hm) hm.textContent = String(mins);
    const br = onBridge(ll); if (br.on && !boosting) boostIn(); if (!br.on && boosting) boostOut();
    if (boosting) { $("dhBP").style.width = `${Math.round(Math.max(0, Math.min(1, br.t)) * 100)}%`; if (br.t > 0.45 && br.t < 0.55 && !said.bm) { said.bm = 1; void say("boostMid"); } }
    host.classList.toggle("over", kmh > LIMIT + 1);
    if (kmh > 3) { keptT++; if (kmh <= LIMIT + 1) keptN++; }
    if (jv) { const sec = Math.round((Date.now() - t0) / 1000); $("dhVS").innerHTML = `${Math.round(kmh)}<em>km/h</em>`; $("dhVK").innerHTML = `${keptT ? Math.round(keptN / keptT * 100) : "--"}<em>%</em>`; $("dhVD").textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; $("dhVH").innerHTML = `${String(Math.round((p.hd + 360) % 360)).padStart(3, "0")}<em>°</em>`; }
    // 速度のひと言 (80 / 100 / 120 km/h を超えて 2 回続いたら。70 未満に落ちて 3 分たてば、また言う)
    const lv = kmh >= 140 ? 140 : kmh >= 120 ? 120 : kmh >= 100 ? 100 : kmh >= 80 ? 80 : 0;
    if (lv > spdLv && Date.now() - t0 > 20000) { if (++spdN >= 2) { spdLv = lv; spdAt = Date.now(); spdN = 0; const ks = dhSpdFor(lv, back); void say(ks[Math.floor(Math.random() * ks.length)]); } } else spdN = 0;
    if (spdLv && kmh < 70 && Date.now() - spdAt > 180000) spdLv = 0;
    // ひと言は 3 分に 1 回くらい (ほかのセリフのあと 40 秒は静かに・同じものは 1 回だけ)
    if (!talking && Date.now() - idleAt > 180000 && Date.now() - quietAt > 40000) {
      const pool = [...DH_IDLE.both, ...(back ? DH_IDLE.back : DH_IDLE.go), ...(back && dawnOut(trip) ? DH_IDLE.dawn : [])].filter((k) => !said[k]);
      if (pool.length) { const k = pool[Math.floor(Math.random() * pool.length)]; said[k] = 1; idleAt = quietAt = Date.now(); void say(k); }
    }
    if (!back) {
      if (trip.placeKey === "kix2" && toEnd < 6000 && toEnd > 3500 && !said.pickT2) { said.pickT2 = 1; quietAt = Date.now(); void say("pickT2"); }
      if (toEnd < 3000 && !said.near) { said.near = 1; void say("near"); }
      if (toEnd < 400 && kmh < 15 && !welcomeShown) { welcomeShown = true; showBoard(); }
    } else if (toEnd < 150 && kmh < 10 && !said.home) { said.home = 1; void say("home"); const id = trip.id; setTimeout(() => { if (trip?.id === id) c.end(id); }, 45000); }
  }

  /* ---------- お出迎えボード → ゲスト乗車 ---------- */
  function showBoard() {
    if (!trip) return; const g = info?.guest || "Guest";
    $("dhWN").textContent = `${g} 様`; $("dhW2").textContent = WEL[trip.lang] ?? WEL.en;
    $("dhW3").textContent = info?.flightNo ? `${info.flightNo} · ${PLACES[trip.placeKey as keyof typeof PLACES]?.name.en ?? "PICK-UP"}` : PLACES[trip.placeKey as keyof typeof PLACES]?.name.en ?? "";
    $("dhWbP").classList.add("on"); tone(660, 0, 0.2, 0.05); tone(990, 0.15, 0.4, 0.05); void say("board");
  }
  $("dhWb").onclick = (e: Event) => { e.stopPropagation(); showBoard(); };
  $("dhWbP").onclick = (e: Event) => { if ((e.target as HTMLElement).id !== "dhBoard") $("dhWbP").classList.remove("on"); };
  $("dhBoard").onclick = (e: Event) => { e.stopPropagation(); if (!trip) return; tone(880, 0, 0.1, 0.06); tone(1320, 0.1, 0.3, 0.06); $("dhBoard").textContent = "…"; c.board(trip.id); };
  host.onclick = (e) => e.stopPropagation();

  let raf = 0, iv: any = null, pl: any = null;
  function loop() { raf = requestAnimationFrame(loop); radar(); stars(); }
  return {
    show(t, r, inf, checkin) {
      const first = !trip || trip.id !== t.id || !onNow;
      trip = t; room = r; info = inf; back = t.dir === "out";
      if (first) {
        onNow = true; host.classList.add("on"); c.stage.classList.add("dh-on"); ensureMap(); said = {}; spdLv = 0; spdN = 0; quietAt = idleAt = Date.now(); prog = 0; boosting = false; welcomeShown = false; checkShown = false; t0 = Date.now(); keptN = keptT = 0; host.classList.remove("boost", "over"); setJv(jv, false);
        $("dhWbP").classList.remove("on"); $("dhBoard").textContent = "🧳 ゲスト乗車"; $("dhWb").style.display = back ? "none" : "";
        const P = PLACES[t.placeKey as keyof typeof PLACES], pll: LL = (P?.ll as LL) ?? t.placeLL ?? CRANE_NEST;
        const rk = back ? `${t.placeKey}_in` : `${t.placeKey}_out`, raw = c.routes[rk];
        setRoute(raw ? raw.map(([x, y]) => [y, x] as LL) : back ? [pll, CRANE_NEST] : [CRANE_NEST, pll]);
        const pn = P?.name.ja ?? t.placeName ?? "迎え先";
        $("dhRoute").textContent = back ? `${pn} → CRANE NEST` : `CRANE NEST → ${pn}`; $("dhEtaL").textContent = back ? "お宿まで あと" : "迎え先まで あと";
        $("dhTag").textContent = back ? "帰り道 · RETURN" : "回送中 · DEADHEAD"; host.classList.toggle("back", back);
        if (back) {
          $("dhDoneS").textContent = `${pn} · ゲストを無事にお送りしました`; $("dhDone").classList.add("on"); setTimeout(() => $("dhDone").classList.remove("on"), 5000);
          void say("done").then(() => say("forgot"));
        } else void say("boot");
        cancelAnimationFrame(raf); loop(); clearInterval(iv); iv = setInterval(renderMission, 15000); clearInterval(pl); void loadPl(); pl = setInterval(() => void loadPl(), 20000);
      }
      renderMission(); void renderCheck(checkin);
      // 便の状況が変わったら知らせる
      const f = info?.flight;
      if (!back && f) {
        if ((/Landed|Arrived/i.test(f.status || "") || f.actual) && !said.landed) once("landed");
        else if (f.delayMin && f.delayMin <= -8) once("early"); else if (f.delayMin && f.delayMin >= 15) once("late");
      }
    },
    feed,
    hide() { if (!onNow) return; onNow = false; trip = null; host.classList.remove("on", "boost", "over"); c.stage.classList.remove("dh-on"); $("dhWbP").classList.remove("on"); cancelAnimationFrame(raf); clearInterval(iv); clearInterval(pl); stopVoice(el); jvCar(); },
    on: () => onNow,
    tripId: () => trip?.id ?? null,
    unlock: () => unlockAudio(el, dhAudio("boot")),
  };
}
