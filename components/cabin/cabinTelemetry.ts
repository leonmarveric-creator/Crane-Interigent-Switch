/**
 * 右側の枠「ASTRAEA · TELEMETRY」(前は近くのおすすめ)。本物のデータだけを JARVIS 風に出す:
 *   HEADING  … 進んでいる向き (GPS の動きから) を回る羅針盤で
 *   SECTOR   … いまいる場所 (関空島 / スカイゲートブリッジ / りんくう / 日根野 / 泉佐野) と緯度・経度
 *   VELOCITY … 速さの線グラフ (最近 90 回) と最高・平均・走った距離
 *   SOLAR    … 日の入り (夜は日の出) までのカウントダウン (泉佐野の緯度経度から計算)
 *   TIME     … 日本時間と、ゲストの国の時間 (言語から: 中文 = UTC+8 / 한국어 = 日本と同じ)
 * 1 秒に 1 回、文字と小さな SVG を書き換えるだけ (スマホでも軽い)。画面が裏にあるとき (__CAB_BG) は止める
 */
import type { GLang, LL } from "@/lib/cabinGeo";
import { CRANE_NEST, PLACES, dist } from "@/lib/cabinGeo";

const rad = Math.PI / 180;
/** 日の出・日の入り (suncalc と同じ計算)。ms (UTC) */
export function sunTimes(ms: number, lat: number, lng: number): { rise: number; set: number } {
  const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397, J0 = 0.0009;
  const d = ms / dayMs - 0.5 + J1970 - J2000, lw = rad * -lng, phi = rad * lat;
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const transit = (x: number) => J2000 + x + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const Jnoon = transit(ds);
  const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const Jset = transit(J0 + (w + lw) / (2 * Math.PI) + n), Jrise = Jnoon - (Jset - Jnoon);
  const toMs = (j: number) => (j + 0.5 - J1970) * dayMs;
  return { rise: toMs(Jrise), set: toMs(Jset) };
}
const bearing = (a: LL, b: LL) => {
  const f1 = a[0] * rad, f2 = b[0] * rad, dl = (b[1] - a[1]) * rad;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / rad + 360) % 360;
};
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (ms: number, off: number) => { const t = new Date(ms + off * 3600e3); return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`; };
const tminus = (s: number) => { s = Math.max(0, Math.round(s)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

const SUB: Record<GLang, { head: string; sector: string; vel: string; sun: [string, string]; time: string; km: string }> = {
  ja: { head: "進行方向", sector: "現在地", vel: "速度の記録", sun: ["日の入りまで", "日の出まで"], time: "時刻の同期", km: "走行" },
  zh: { head: "行驶方向", sector: "当前位置", vel: "速度记录", sun: ["距日落", "距日出"], time: "时间同步", km: "已行驶" },
  en: { head: "Heading", sector: "Position", vel: "Speed trace", sun: ["Until sunset", "Until sunrise"], time: "Time sync", km: "Driven" },
  ko: { head: "진행 방향", sector: "현재 위치", vel: "속도 기록", sun: ["일몰까지", "일출까지"], time: "시간 동기화", km: "주행" },
};
/** ゲストの国の時間 (言語から分かるときだけ)。中文は中国・台湾・香港 = UTC+8、한국어は日本と同じ */
const HOME: Partial<Record<GLang, [string, number]>> = { zh: ["CST", 8], ko: ["KST", 9] };

export interface Telemetry { mount(): void; reset(): void; feed(ll: LL, kmh: number | null, bridge: boolean): void }

export function createTelemetry(c: { el: () => HTMLElement | null; head: () => HTMLElement | null; lang: () => GLang; on: () => boolean }): Telemetry {
  let last: LL | null = null, head: number | null = null, km = 0, sp: number[] = [], max = 0, sum = 0, cnt = 0, pos: LL = CRANE_NEST, onBridge = false;
  function sector(): [string, string] {
    if (onBridge) return ["SKY GATE BRIDGE", "34.4N · 3.75 km · OVER SEA"];
    if (dist(pos, CRANE_NEST) < 700) return ["CRANE NEST", "HOME BASE"];
    if (dist(pos, PLACES.kix.ll) < 2600 || pos[1] < 135.262) return ["KANSAI AIRPORT ISLAND", "KIX · OFFSHORE"];
    if (dist(pos, PLACES.rinku.ll) < 1300) return ["RINKU TOWN", "GATE TOWER SECTOR"];
    if (dist(pos, PLACES.hineno.ll) < 1000) return ["HINENO", "JR STATION SECTOR"];
    return ["IZUMISANO", "OSAKA · SENSHU"];
  }
  function mount() {
    const el = c.el(); if (!el) return;
    const h = c.head(); if (h) h.textContent = "ASTRAEA · TELEMETRY";
    el.classList.add("tm");
    el.innerHTML = `<div class="tmr"><svg class="tmc" viewBox="-20 -20 40 40"><circle r="17" class="r1"/><circle r="12" class="r2"/><g class="tk">${Array.from({ length: 12 }, (_, i) => `<line y1="-17" y2="${i % 3 ? -15 : -13}" transform="rotate(${i * 30})"/>`).join("")}</g><text y="-8.5" class="n">N</text><g class="nd"><path d="M0,-13 L3,2 L0,-1 L-3,2Z"/></g></svg><span><small class="k">HEADING · <i data-t="head"></i></small><b data-t="hd">--</b></span></div>
<div class="tmr"><span class="ic">◎</span><span><small class="k">SECTOR · <i data-t="sector"></i></small><b data-t="sec">--</b><em data-t="ll">--</em></span></div>
<div class="tmr"><svg class="tms" viewBox="0 0 90 26" preserveAspectRatio="none"><polyline points=""/></svg><span><small class="k">VELOCITY · <i data-t="vel"></i></small><b data-t="v">--</b><em data-t="vs">--</em></span></div>
<div class="tmr"><span class="ic sun">☀</span><span><small class="k">SOLAR · <i data-t="sun"></i></small><b data-t="sn">--</b><em data-t="tm">--</em></span></div>`;
    draw();
  }
  const q = (k: string) => c.el()?.querySelector<HTMLElement>(`[data-t="${k}"]`);
  const put = (k: string, v: string) => { const x = q(k); if (x && x.textContent !== v) x.textContent = v; };
  function draw() {
    const el = c.el(); if (!el || !el.classList.contains("tm") || !c.on()) return;
    const L = SUB[c.lang()] ?? SUB.en, now = Date.now();
    put("head", L.head); put("sector", L.sector); put("vel", L.vel);
    // 向き
    if (head != null) { put("hd", `${DIRS[Math.round(head / 45) % 8]} ${String(Math.round(head)).padStart(3, "0")}°`); const nd = el.querySelector<SVGGElement>(".nd"); if (nd) nd.setAttribute("transform", `rotate(${head.toFixed(1)})`); }
    // 場所
    const [s1, s2] = sector(); put("sec", s1);
    put("ll", `${pos[0].toFixed(4)}N ${pos[1].toFixed(4)}E · ${s2}`);
    // 速さ
    const cur = sp.length ? sp[sp.length - 1] : 0;
    put("v", `${Math.round(cur)} km/h`); put("vs", `MAX ${Math.round(max)} · AVG ${cnt ? Math.round(sum / cnt) : 0} · ${L.km} ${km.toFixed(1)} km`);
    const pl = el.querySelector<SVGPolylineElement>(".tms polyline");
    if (pl && sp.length > 1) { const top = Math.max(60, max); pl.setAttribute("points", sp.map((v, i) => `${(i / 89) * 90},${(25 - (v / top) * 23).toFixed(1)}`).join(" ")); }
    // 日の入り・日の出
    const st = sunTimes(now, CRANE_NEST[0], CRANE_NEST[1]);
    let nextSet = st.set, nextRise = st.rise; if (now > st.rise) nextRise = sunTimes(now + 864e5, CRANE_NEST[0], CRANE_NEST[1]).rise;
    const day = now >= st.rise && now < st.set;
    put("sun", day ? L.sun[0] : L.sun[1]);
    put("sn", `T-${tminus(((day ? nextSet : nextRise) - now) / 1000)}`);
    const H = HOME[c.lang()];
    put("tm", `${day ? "SUNSET" : "SUNRISE"} ${hm(day ? nextSet : nextRise, 9)} · JST ${hm(now, 9)}${H ? (H[1] === 9 ? ` = ${H[0]}` : ` · ${H[0]} ${hm(now, H[1])}`) : ` · UTC ${hm(now, 0)}`}`);
    const sun = el.querySelector<HTMLElement>(".sun"); if (sun) sun.textContent = day ? "☀" : "☾";
  }
  setInterval(() => { if (!(window as any).__CAB_BG) draw(); }, 1000);
  return {
    mount,
    reset() { last = null; head = null; km = 0; sp = []; max = 0; sum = 0; cnt = 0; onBridge = false; },
    feed(ll, kmh, bridge) {
      pos = ll; onBridge = bridge;
      if (last) { const m = dist(last, ll); if (m > 8) { head = bearing(last, ll); km += m / 1000; last = ll; } } else last = ll;
      if (kmh != null && isFinite(kmh)) { const v = Math.max(0, Math.min(200, kmh)); sp.push(v); if (sp.length > 90) sp.shift(); max = Math.max(max, v); if (v > 3) { sum += v; cnt++; } }
    },
  };
}
