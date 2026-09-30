/**
 * AGENT KAKU (Kaku さん専用のミッション画面) を動かす。
 *   ① 起動 (POWER) → ② ホーム (START / 記録 / フリーミッション / 設定) → ③ ミッション (地図・速度・受信・上空レーダー)
 *   ・ゲスト送迎: 空港・駅へ → ゲスト確認 → 帰還 (ルートは /cabin/routes.json)
 *   ・フリーミッション: 行き先を検索 / ★ / 地図で選ぶ (最大 3 か所) → 順番に回る → 帰還
 *   ・位置はこの端末の GPS。設定の「デモ走行」なら GPS を使わずルートを自動で走る
 *   ・声は ASTRAEA (英語) + 日本語の字幕。話しすぎないよう、ひと言のあとは 3 分あける (案内・警告は別)
 *   Leaflet は先に読み込んでおくこと (window.L)。外の情報は /api/kaku?op=ext を通す。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { KAKU_LINES, kakuAudio, KAKU_TYPES, TYPE_LINE, ARRIVE_LINE, RETURN_LINE } from "@/lib/kakuLines";
import { CRANE_NEST, PLACES, PLACE_KEYS, acModeFor, placeFromText } from "@/lib/cabinGeo";
import { startRemoteVoice, unlockRemoteVoice, type RemoteVoice } from "@/lib/remoteVoice";
import { parseLrc, lyricIndex, type LrcLine } from "@/lib/driverLogic";

type LL = [number, number];
export interface KakuTrack { id: string; title: string; url: string; lrc?: string | null }
export interface KakuPlace { n: string; ll: LL; type?: string | null; fav?: boolean; visits?: number }
export interface KakuState {
  setup: boolean; places: KakuPlace[]; missions: any[]; monthKm: number; monthCount: number; todayCount: number;
  bgm: { boot?: string | null; normal: string | null; cruise: string | null };
  tracks?: Record<string, KakuTrack[]>; tracksSetup?: boolean; lyricsSetup?: boolean;
}
/** 車内 iPad (ゲスト用の画面) と一緒に動かすための情報 (今日の到着・出発の予約) */
export interface KakuRes { id: string; guest: string | null; roomId: string; lang: string; arrive: boolean; pickupPlace: string | null; pickupAt: string | null; terminal: string | null; flightNo: string | null }
export interface KakuCabinInfo { devices: { id: string; name: string }[]; rooms: { id: string; name: string }[]; res: KakuRes[]; missing: boolean }
export interface KakuCabinApi {
  info: KakuCabinInfo;
  start(v: { deviceId: string | null; resId: string | null; dir: "in" | "out"; placeKey: string; placeName: string | null; placeLL: [number, number] | null; roomId: string | null; lang: string; ac: "cool" | "heat" | "none"; phase?: "dead" | "guest" }): Promise<{ ok: boolean; id?: string; error?: string }>;
  pos(id: string, lat: number | null, lng: number | null, kmh: number | null): Promise<{ ok: boolean; active: boolean }>;
  end(id: string): Promise<void>;
  /** お迎え: 回送 → ゲスト乗車 */
  board(id: string): Promise<void>;
}
interface CabLink { deviceId: string | null; resId: string | null; roomId: string | null; lang: string; placeKey: string; dir: "in" | "out"; leg: number }
interface Leg { n: string; ll: LL; pts: LL[]; dur: number; home?: boolean; type?: string; real?: boolean }
interface Mission { kind: "guest" | "free"; name: string; type: string; legs: Leg[]; due: string | null; demo: boolean; cab?: CabLink | null }

const HOME: LL = CRANE_NEST;
const R = 6371000, RAD = Math.PI / 180;
const dd = (a: LL, b: LL) => { const dy = (b[0] - a[0]) * RAD * R, dx = (b[1] - a[1]) * RAD * R * Math.cos(a[0] * RAD); return Math.hypot(dx, dy); };
const pad = (n: number) => String(n).padStart(2, "0");
const tfm = (d: Date) => d.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
const esc = (s: string) => String(s).replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" }[c]!));
const short = (s: string, n = 8) => (s.length > n + 1 ? s.slice(0, n) + "…" : s);
const CHAT_GAP = 180000;   // ひと言のあとは 3 分あける
const RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
/** スカイゲートブリッジ (車内 iPad と同じ判定: 橋の線からの距離) */
const BM: LL = [34.41475, 135.29395], BI: LL = [34.43725, 135.26445];
function onBridge(ll: LL) {
  const x = (p: LL) => [(p[1] - BM[1]) * RAD * R * Math.cos(BM[0] * RAD), (p[0] - BM[0]) * RAD * R];
  const b = x(BI), q = x(ll), L2 = b[0] * b[0] + b[1] * b[1], t = (q[0] * b[0] + q[1] * b[1]) / L2;
  return t > 0 && t < 1 && Math.abs(q[0] * b[1] - q[1] * b[0]) / Math.sqrt(L2) < 300;
}
/** 日の入り (泉佐野) */
function sunset(d: Date, lat = 34.43, lng = 135.24) {
  const r = RAD, days = d.getTime() / 86400000 - 0.5 + 2440588 - 2451545, M = r * (357.5291 + 0.98560028 * days);
  const C = r * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)), L = M + C + r * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(r * 23.4397) * Math.sin(L)), lw = -r * lng, n = Math.round(days - 0.0009 - lw / (2 * Math.PI));
  const w = Math.acos((Math.sin(-0.833 * r) - Math.sin(lat * r) * Math.sin(dec)) / (Math.cos(lat * r) * Math.cos(dec)));
  const a = 0.0009 + (w + lw) / (2 * Math.PI) + n, J = 2451545 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return new Date((J + 0.5 - 2440588) * 86400000);
}
function moon(d: Date) { const p = (((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588) % 1 + 1) % 1; return { age: p * 29.53, n: ["新月", "三日月", "上弦の月", "十三夜", "満月", "寝待月", "下弦の月", "有明月"][Math.round(p * 8) % 8] }; }
const jstHour = () => Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false })) % 24;
const jstDow = () => new Date(Date.now() + 9 * 3600000).getUTCDay();

export interface KakuEngine { destroy(): void; resize(): void }
/** 画面の外 (React) で開くもの: 歌詞を付けるシート (お父さんの画面と同じもの)。save は保存して、失敗ならエラー文を返す */
export interface KakuUi { lyrics?(tr: KakuTrack, save: (lrc: string | null) => Promise<string | null>): void }

export function createKaku(root: HTMLElement, routes: Record<string, [number, number][]>, st0: KakuState, cab: KakuCabinApi, ui: KakuUi = {}): KakuEngine {
  const L = (window as any).L;
  const $ = (id: string): any => root.querySelector("#" + id);
  const stage = $("stage") as HTMLElement;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let S: KakuState = st0, dead = false;
  const timers: any[] = [];
  const every = (ms: number, f: () => void) => { const t = setInterval(f, ms); timers.push(t); return t; };
  const api = (q: string) => fetch("/api/kaku?" + q, { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false }));
  const post = (b: any) => fetch("/api/kaku", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({ ok: false }));
  const ext = async (k: string, q = "") => { const r = await api(`op=ext&k=${k}${q}`); if (!r.ok) throw new Error(r.error || "ext"); return r.data; };
  let cfg = { limit: 80, quiet: false, demo: false, bgm: true, shuffle: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem("kakuCfg") || "{}")); } catch { /* */ }
  const saveCfg = () => { try { localStorage.setItem("kakuCfg", JSON.stringify(cfg)); } catch { /* */ } };

  /** 縦 (1086×1448) / 横 (1448×1086)。端末を回すと自動で切り替わる */
  let land = false;
  function resize() {
    const r = root.getBoundingClientRect(), L2 = r.width > r.height * 1.05;
    if (L2 !== land) { land = L2; stage.classList.toggle("land", land); setTimeout(() => { try { mapRef?.invalidateSize(); if (follow) mapRef?.panTo(curLL()); } catch { /* */ } }, 60); }
    const W = land ? 1448 : 1086, H = land ? 1086 : 1448, s = Math.min(r.width / W, r.height / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  let mapRef: any = null;
  resize();

  /* ---------------- 音 ---------------- */
  let AC: AudioContext | null = null;
  const ac = () => { try { AC = AC || new ((window as any).AudioContext || (window as any).webkitAudioContext)(); void AC!.resume(); } catch { /* */ } return AC; };
  function tone(f: number, t: number, d: number, v: number, type: OscillatorType = "sine") {
    const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, c.currentTime + t); g.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + t + d); o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + d + 0.05);
  }
  function noise(t: number, d: number, v: number, f = 3000) {
    const c = ac(); if (!c) return; const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), g = c.createGain(), h = c.createBiquadFilter(); h.type = "bandpass"; h.frequency.value = f; s.buffer = b;
    g.gain.setValueAtTime(v, c.currentTime + t); g.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + t + d); s.connect(h); h.connect(g); g.connect(c.destination); s.start(c.currentTime + t);
  }
  function whoosh() {
    const c = ac(); if (!c) return; const d = 1.4, b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(300, c.currentTime); f.frequency.exponentialRampToValueAtTime(6000, c.currentTime + 1.1);
    g.gain.setValueAtTime(0.001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 1); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d); s.buffer = b; s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  function boom(t = 0) {
    const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, c.currentTime + t); o.frequency.exponentialRampToValueAtTime(35, c.currentTime + t + 0.8);
    g.gain.setValueAtTime(0.35, c.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 1.2); o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 1.3);
  }

  /* 起動の効果音: 低いうなり → 周波数が駆け上がる → リレーのカチカチ (金属音) → 衝撃音 + 和音 → きらめき */
  function powerUp() {
    const c = ac(); if (!c) return; const t = c.currentTime;
    const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = "sawtooth"; o2.type = "square"; o.frequency.setValueAtTime(38, t); o.frequency.exponentialRampToValueAtTime(420, t + 1.35); o2.frequency.setValueAtTime(19, t); o2.frequency.exponentialRampToValueAtTime(210, t + 1.35);
    f.type = "lowpass"; f.Q.value = 9; f.frequency.setValueAtTime(120, t); f.frequency.exponentialRampToValueAtTime(5200, t + 1.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination); o.start(t); o2.start(t); o.stop(t + 1.6); o2.stop(t + 1.6);
    noise(0, 1.3, 0.04, 2500);
  }
  function relay(i: number) { tone(2400 + i * 260, 0, 0.05, 0.05, "square"); tone(5200 + i * 300, 0.01, 0.12, 0.02, "triangle"); noise(0, 0.02, 0.08, 6000); }
  function impact() {
    boom(0); noise(0, 0.6, 0.14, 900); noise(0.02, 0.25, 0.08, 5000);
    [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => tone(f, 0.05 + i * 0.01, 1.8, 0.035, "sawtooth"));
    [1318.5, 1760, 2217.5, 2637].forEach((f, i) => tone(f, 0.45 + i * 0.09, 0.5, 0.025, "triangle"));
  }

  /* BGM: 起動 / ノーマル / クルーズ。設定で曲をアップしていればそれ、無ければ内蔵 (オリジナル) */
  type BgmMode = "boot" | "normal" | "cruise";
  const MODES: BgmMode[] = ["boot", "normal", "cruise"];
  let bgmRun = false, mode: BgmMode = "boot", step = 0, synT: any = null, duck = 1;
  const BASS = [73.4, 73.4, 87.3, 73.4, 98, 73.4, 87.3, 82.4], ARP = [293.7, 440, 587.3, 440, 349.2, 523.3, 698.5, 523.3];
  /* プレイリスト: モードごとに 1 本の Audio。曲が終わったら次へ (登録順 / シャッフル)。
     クルーズから戻ると、ノーマルは止めたところの続きから */
  const trk: Record<string, HTMLAudioElement> = { boot: new Audio(), normal: new Audio(), cruise: new Audio() };
  const PL: Record<string, { list: KakuTrack[]; order: number[]; i: number }> = { boot: { list: [], order: [], i: 0 }, normal: { list: [], order: [], i: 0 }, cruise: { list: [], order: [], i: 0 } };
  const lists = (): Record<string, KakuTrack[]> => S.tracks ?? { boot: S.bgm.boot ? [{ id: "b", title: "BGM", url: S.bgm.boot }] : [], normal: S.bgm.normal ? [{ id: "n", title: "BGM", url: S.bgm.normal }] : [], cruise: S.bgm.cruise ? [{ id: "c", title: "BGM", url: S.bgm.cruise }] : [] };
  const burl = (): Record<string, string | null> => { const o: Record<string, string | null> = {}; for (const m of MODES) o[m] = PL[m].list.length ? "1" : null; return o; };
  function mkOrder(n: number) { const o = Array.from({ length: n }, (_, i) => i); if (cfg.shuffle) for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
  const cur = (m: string) => { const p = PL[m]; return p.list.length ? p.list[p.order[p.i % p.order.length]] : null; };
  function loadBgm() {
    const L = lists();
    for (const m of MODES) {
      const p = PL[m], nl = L[m] ?? [], same = nl.length === p.list.length && nl.every((t, i) => t.id === p.list[i].id);
      if (same) { p.list = nl; continue; } // 同じ曲 (歌詞だけ変わったときも新しい方を使う)
      const was = cur(m)?.id; p.list = nl; p.order = mkOrder(nl.length); p.i = Math.max(0, p.order.findIndex((k) => nl[k]?.id === was));
      const a = trk[m]; a.loop = nl.length === 1;
      const t = cur(m); if (t) { if (a.src !== t.url) a.src = t.url; } else { a.pause(); a.removeAttribute("src"); }
    }
    showNp();
  }
  function nextTrack(m: string, user = false) {
    const p = PL[m]; if (!p.list.length) return; p.i++; if (p.i >= p.order.length) { p.i = 0; if (cfg.shuffle) p.order = mkOrder(p.list.length); }
    const a = trk[m], t = cur(m)!; a.src = t.url; a.loop = p.list.length === 1;
    if (bgmRun && cfg.bgm && mode === m) { a.volume = user ? 0 : a.volume; a.play().catch(() => {}); fade(a, 0.7 * duck, user ? 600 : 300); }
    showNp();
  }
  MODES.forEach((m) => { const a = trk[m]; a.volume = 0; a.preload = "auto"; a.onended = () => nextTrack(m); a.onerror = () => { if (PL[m].list.length > 1) setTimeout(() => nextTrack(m), 500); }; });
  /** ミッション画面の「曲名 ⏭」 */
  function showNp() {
    const e = root.querySelector("#np") as HTMLElement | null; if (!e) return;
    const t = cur(mode), on = bgmRun && cfg.bgm;
    e.classList.toggle("on", on && mode !== "boot");
    $("npT").textContent = t ? t.title : mode === "cruise" ? "内蔵 BGM · CRUISE" : "内蔵 BGM";
    $("npN").style.visibility = PL[mode].list.length > 1 ? "" : "hidden";
    $("npM").textContent = mode === "cruise" ? "♪ CRUISE" : "♪ NORMAL";
  }
  /* 歌詞 (地図の下に 3 行)。ひとつ前の行も今の行と同じ明るさで残す (車の Bluetooth は音が少し遅れて届くため) */
  const lrcCache = new Map<string, { src: string; L: LrcLine[] }>();
  let lyKey = "";
  function lyTick() {
    const box = root.querySelector("#nly") as HTMLElement | null; if (!box) return;
    const t = cur(mode), a = trk[mode];
    const on = !!(bgmRun && cfg.bgm && mode !== "boot" && t?.lrc && !a.paused);
    box.classList.toggle("on", on); if (!on || !t?.lrc) { lyKey = ""; return; }
    let c = lrcCache.get(t.id); if (!c || c.src !== t.lrc) { c = { src: t.lrc, L: parseLrc(t.lrc) }; lrcCache.set(t.id, c); }
    const L = c.L, i = lyricIndex(L, a.currentTime), key = `${t.id}:${i}`; if (key === lyKey) return; lyKey = key;
    $("ly1").textContent = i > 0 ? L[i - 1]?.s ?? "" : ""; $("ly2").textContent = i >= 0 ? L[i]?.s ?? "" : "♪"; $("ly3").textContent = L[i + 1]?.s ?? "";
    const n = $("ly2") as HTMLElement; n.classList.remove("in"); void n.offsetWidth; n.classList.add("in");
  }
  /* 内蔵 BGM: 起動 = 深いパッドと鼓動 / ノーマル = 緊張感のあるベース / クルーズ = 速いアルペジオ */
  const PAD = [[55, 82.4, 110, 164.8], [49, 73.4, 98, 146.8], [43.7, 65.4, 87.3, 130.8], [49, 73.4, 110, 146.8]];
  function padChord(fs: number[], d: number, v: number) {
    const c = ac(); if (!c) return; const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(300, c.currentTime); f.frequency.linearRampToValueAtTime(1400, c.currentTime + d * 0.5); f.frequency.linearRampToValueAtTime(400, c.currentTime + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(v, c.currentTime + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + d); f.connect(g); g.connect(c.destination);
    for (const fr of fs) for (const dt of [-6, 6]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(); o.stop(c.currentTime + d + 0.1); }
  }
  function synTick() {
    const s = step++ % 16;
    if (mode === "boot") { if (s === 0) padChord(PAD[(step / 16 | 0) % 4], 4.6, 0.028 * duck); if (s === 0 || s === 3) tone(48, 0, 0.35, 0.16 * duck, "sine"); if (s % 4 === 2) noise(0, 0.03, 0.008 * duck, 9000); return; }
    if (mode === "normal") { if (s % 2 === 0) tone(BASS[(s / 2) | 0], 0, 0.22, 0.08 * duck, "sawtooth"); if (s === 4 || s === 12) noise(0, 0.12, 0.045 * duck, 1800); if (s % 4 === 2) noise(0, 0.04, 0.012 * duck, 8000); }
    else { tone(ARP[s % 8] * (s >= 8 ? 1.5 : 1), 0, 0.12, 0.035 * duck, "triangle"); if (s % 4 === 0) tone(73.4, 0, 0.3, 0.09 * duck, "sawtooth"); if (s % 2 === 1) noise(0, 0.03, 0.015 * duck, 9000); if (s === 8) noise(0, 0.2, 0.04 * duck, 1200); }
  }
  function fade(a: HTMLAudioElement, to: number, ms = 1500) {
    const from = a.volume, t0 = performance.now();
    (function f(n: number) { const u = Math.min(1, (n - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * u)); if (u < 1) requestAnimationFrame(f); else if (to === 0) a.pause(); })(t0);
  }
  function applyBgm() {
    const u = burl();
    for (const m of MODES) { const a = trk[m], want = bgmRun && cfg.bgm && m === mode && !!u[m]; if (want) { if (a.paused) a.play().catch(() => {}); fade(a, 0.7 * duck); } else if (!a.paused) fade(a, 0); }
    const syn = bgmRun && cfg.bgm && !u[mode];
    if (syn && !synT) synT = setInterval(synTick, mode === "cruise" ? 110 : mode === "boot" ? 300 : 150); else if (!syn && synT) { clearInterval(synT); synT = null; }
  }
  function setMode(m: BgmMode) { if (mode === m) return; mode = m; if (synT) { clearInterval(synT); synT = null; } applyBgm(); showNp(); }
  function bgm(on: boolean) { bgmRun = on; if (synT) { clearInterval(synT); synT = null; } applyBgm(); showNp(); }
  function setDuck(d: number) { duck = d; for (const m of MODES) if (!trk[m].paused && m === mode) fade(trk[m], 0.7 * d, 400); }

  /* ---------------- 声と字幕 ---------------- */
  const el = new Audio(); let talking = false, endPrev: null | (() => void) = null, lastChat = 0, subT: any = null;
  const dyn: Record<string, string> = {};   // その場で作る字幕 (数字入り)
  let an = null as AnalyserNode | null;
  function hookWave() { try { const c = ac(); if (!c || an) return; const src = c.createMediaElementSource(el); an = c.createAnalyser(); an.fftSize = 256; src.connect(an); an.connect(c.destination); } catch { /* */ } }
  function say(k: string): Promise<void> {
    hookWave(); lastChat = performance.now(); endPrev && endPrev();
    const line = KAKU_LINES[k] || { en: "", ja: "" };
    $("sj").textContent = dyn[k] || line.ja; $("se").textContent = line.en; $("sub").classList.remove("hide"); $("sub").classList.add("talk"); talking = true; setDuck(0.35); clearTimeout(subT);
    return new Promise((ok) => {
      const end = () => { if (endPrev !== end) return ok(); endPrev = null; talking = false; setDuck(1); $("sub").classList.remove("talk"); subT = setTimeout(() => { if (!talking) $("sub").classList.add("hide"); }, 9000); ok(); };
      endPrev = end; el.src = kakuAudio(k); el.onended = end; el.onerror = end; el.play().catch(end); setTimeout(end, 20000);
    });
  }
  /* おしゃべり: 順番待ち。案内・警告 (prio) は先に。場所のひと言は、その区間を過ぎたら捨てる */
  let CQ: { k: string; prio?: boolean; t: number; lg: number }[] = [];
  function chat(k: string, prio = false) { if (cfg.quiet && !prio) return; if (CQ.some((x) => x.k === k)) return; CQ.push({ k, prio, t: performance.now(), lg: leg }); if (CQ.length > 5) { const i = CQ.findIndex((x) => !x.prio); if (i >= 0) CQ.splice(i, 1); } }
  every(500, () => {
    const nw = performance.now();
    CQ = CQ.filter((x) => x.prio || (/^(km5|km1|neardoc)$/.test(x.k) ? x.lg === leg && nw - x.t < 60000 : nw - x.t < 600000));
    if (!CQ.length || talking || rv?.busy()) return;
    const i = CQ.findIndex((x) => x.prio);
    const it = i >= 0 ? CQ.splice(i, 1)[0] : nw - lastChat > CHAT_GAP ? CQ.shift() : null;
    if (it) void say(it.k);
  });
  const show = (id: string) => root.querySelectorAll<HTMLElement>(".sc").forEach((e) => e.classList.toggle("on", e.id === id));
  const ov = (id: string, on: boolean) => $(id).classList.toggle("on", on);
  root.querySelectorAll<HTMLElement>("[data-x]").forEach((b) => (b.onclick = () => ov(b.dataset.x!, false)));

  /* ---------------- ① 起動 ---------------- */
  ["bm", "bs"].forEach((id) => ($(id).innerHTML = "<i></i>".repeat(6)));
  let booted = false;
  $("pw").onclick = async () => {
    if (booted) return; booted = true; ac(); unlockRemoteVoice(); startGps();
    $("pw").classList.add("go"); $("flash").classList.add("go"); $("s1").classList.add("boot");
    powerUp();
    for (let i = 0; i < 6; i++) { await wait(170); $("bm").children[i].classList.add("on"); $("bs").children[i].classList.add("on"); relay(i); }
    await wait(250); impact();
    $("onl").textContent = "ONLINE"; $("onl").style.color = "#3dffa8"; $("scan").classList.add("go"); setMode("boot"); bgm(true);
    await say("boot"); await wait(400); toHome();
  };

  /* ---------------- ② ホーム ---------------- */
  let WXC: number | null = null, RAINY = false;
  function toHome() {
    setMode("boot");
    show("s2"); $("mNo").textContent = pad(S.todayCount + 1); $("tA").textContent = tfm(new Date()); $("tB").textContent = tfm(new Date(Date.now() + 18 * 60000));
    const w = WXC == null ? "" : RAINY ? " ☂ 雨" : WXC <= 1 ? ' <span style="color:#ffd35a">☀</span> 晴れ' : WXC <= 3 ? " ☁ くもり" : WXC >= 71 && WXC <= 77 ? " ❄ 雪" : " ☁ くもり";
    $("wxL").innerHTML = "泉佐野" + w;
  }
  const hr = $("hr");
  (function hl(n: number) { if (dead) return; requestAnimationFrame(hl); const Lg = hr.getTotalLength(), p = hr.getPointAtLength((n / 2600 % 1) * Lg); $("hd").setAttribute("cx", p.x); $("hd").setAttribute("cy", p.y); })(0);
  $("start").onclick = () => { ac(); tone(660, 0, 0.1, 0.05); ov("mc", true); };
  root.querySelectorAll<HTMLElement>("[data-nv]").forEach((b) => (b.onclick = () => { ac(); tone(900, 0, 0.05, 0.04); const v = b.dataset.nv; if (v === "hist") openHist(); if (v === "free") openFree(); if (v === "set") openSet(); }));
  $("mcG").onclick = () => { ov("mc", false); openGuest(); };
  $("mcF").onclick = () => { ov("mc", false); openFree(); };

  /* ゲスト送迎: 予約を選ぶ (今日の到着・出発) → お迎え / お見送り・場所 → 車内 iPad も一緒に動かす
       お迎え: Crane Nest → 迎え先 (iPad なし) → 帰還 (ゲストが乗っている: iPad が送迎画面に)
       お見送り: Crane Nest → 送り先 (ゲストが乗っている: iPad が送迎画面に) → 帰還 */
  const rt = (k: string): LL[] | null => (routes[k] ? routes[k].map(([x, y]) => [y, x] as LL) : null);
  const lenOf = (p: LL[]) => { let s = 0; for (let i = 1; i < p.length; i++) s += dd(p[i - 1], p[i]); return s; };
  const G = { res: null as KakuRes | null, dir: "in" as "in" | "out", place: "kix" as (typeof PLACE_KEYS)[number], ipad: true, dev: null as string | null, roomId: null as string | null, lang: "zh" };
  const LANGS: [string, string][] = [["zh", "中文"], ["en", "EN"], ["ko", "한국어"], ["ja", "日本語"]];
  function openGuest() {
    const inf = cab.info;
    let last: string | null = null; try { last = localStorage.getItem("drvCabDev"); } catch { /* */ }
    G.dev = inf.devices.find((d) => d.id === last)?.id ?? inf.devices[0]?.id ?? null; G.ipad = !!G.dev && !inf.missing;
    const pickRes = (r: KakuRes | null) => {
      G.res = r; G.dir = r ? (r.arrive ? "in" : "out") : G.dir; G.roomId = r?.roomId ?? G.roomId ?? inf.rooms[0]?.id ?? null; G.lang = r?.lang ?? G.lang;
      G.place = (placeFromText(r?.pickupPlace ?? null, r?.terminal ?? null) as any) || (r?.flightNo ? "kix" : G.place);
      if ((G.place as string) === "other") G.place = "kix";
    };
    pickRes(inf.res[0] ?? null);
    const render = () => {
      const room = (id: string | null) => inf.rooms.find((x) => x.id === id)?.name ?? "";
      $("gpl").innerHTML = `
        <div class="gsec">今日の予約</div>
        <div class="gres">${inf.res.map((r, i) => `<button data-r="${i}" class="${G.res?.id === r.id ? "on" : ""}"><b>${r.arrive ? "🛬 到着" : "🛫 出発"} · ${esc(room(r.roomId))}</b><small>${esc(r.guest || "ゲスト")} · ${esc(r.lang.toUpperCase())}${r.pickupAt ? " · " + esc(r.pickupAt) : ""}${r.pickupPlace ? " · " + esc(short(r.pickupPlace, 10)) : ""}</small></button>`).join("")}
          <button data-r="-1" class="${G.res ? "" : "on"}"><b>予約なし</b><small>部屋と言語を選ぶ</small></button></div>
        <div class="gsec">お迎え / お見送り</div>
        <div class="gdir"><button data-d="in" class="${G.dir === "in" ? "on" : ""}">🛬 お迎え (→ Crane Nest)</button><button data-d="out" class="${G.dir === "out" ? "on" : ""}">🛫 お見送り (Crane Nest →)</button></div>
        <div class="gsec">場所</div>
        <div class="gpk">${PLACE_KEYS.map((k) => `<button data-p="${k}" class="${G.place === k ? "on" : ""}">${esc(PLACES[k].name.ja)}</button>`).join("")}</div>
        ${G.res ? "" : `<div class="gsec">お部屋 · 言語</div><div class="gpk">${inf.rooms.map((r) => `<button data-m="${r.id}" class="${G.roomId === r.id ? "on" : ""}">${esc(r.name)}</button>`).join("")}</div>
          <div class="gpk">${LANGS.map(([k, n]) => `<button data-l="${k}" class="${G.lang === k ? "on" : ""}">${n}</button>`).join("")}</div>`}
        <div class="gsec">車内 iPad</div>
        <div class="gpk">${inf.missing || !inf.devices.length ? `<span class="gno">${inf.missing ? "車内 iPad の SQL が未実行です" : "登録された iPad がありません"}</span>` : `<button data-i="1" class="${G.ipad ? "on" : ""}">📺 iPad にも表示する</button>${inf.devices.length > 1 ? inf.devices.map((d) => `<button data-v="${d.id}" class="${G.dev === d.id ? "on" : ""}">${esc(d.name)}</button>`).join("") : ""}`}</div>
        <button class="go2" id="gGo">ミッション開始 ▸</button>`;
      $("gpl").querySelectorAll("[data-r]").forEach((b: HTMLElement) => (b.onclick = () => { const i = Number(b.dataset.r); pickRes(i >= 0 ? inf.res[i] : null); render(); }));
      $("gpl").querySelectorAll("[data-d]").forEach((b: HTMLElement) => (b.onclick = () => { G.dir = b.dataset.d as "in" | "out"; render(); }));
      $("gpl").querySelectorAll("[data-p]").forEach((b: HTMLElement) => (b.onclick = () => { G.place = b.dataset.p as any; render(); }));
      $("gpl").querySelectorAll("[data-m]").forEach((b: HTMLElement) => (b.onclick = () => { G.roomId = b.dataset.m!; render(); }));
      $("gpl").querySelectorAll("[data-l]").forEach((b: HTMLElement) => (b.onclick = () => { G.lang = b.dataset.l!; render(); }));
      $("gpl").querySelectorAll("[data-i]").forEach((b: HTMLElement) => (b.onclick = () => { G.ipad = !G.ipad; render(); }));
      $("gpl").querySelectorAll("[data-v]").forEach((b: HTMLElement) => (b.onclick = () => { G.dev = b.dataset.v!; render(); }));
      $("gGo").onclick = () => {
        ov("gp", false); const k = G.place, P = PLACES[k], d = 38 / 3.6;
        const out = rt(`${k}_out`) || [HOME, P.ll], back = rt(`${k}_in`) || [P.ll, HOME];
        const legs: Leg[] = [{ n: P.name.ja, ll: P.ll as LL, pts: out, dur: lenOf(out) / d, real: true, type: k.startsWith("kix") ? "air" : "err" }, { n: "帰還", ll: HOME, pts: back, dur: lenOf(back) / d, home: true, real: true }];
        const who = G.res?.guest ? `${G.res.guest}さん` : "ゲスト";
        M = { kind: "guest", name: `${P.name.ja} · ${G.dir === "in" ? "お迎え" : "お見送り"}`, type: "guest", due: null, demo: cfg.demo, legs,
          cab: G.ipad && G.dev ? { deviceId: G.dev, resId: G.res?.id ?? null, roomId: G.roomId, lang: G.lang, placeKey: k, dir: G.dir, leg: 0 } : null };
        try { if (G.dev) localStorage.setItem("drvCabDev", G.dev); } catch { /* */ }
        dyn.guestWho = who; startMission();
      };
    };
    render(); ov("gp", true);
  }

  /* 車内 iPad と一緒に動かす: ゲストが乗っている区間だけ、iPad を送迎画面にして位置を 3 秒ごとに送る */
  let cabTrip: string | null = null, cabSend = false;
  async function cabBegin() {
    const c = M.cab; if (!c || cabTrip) return;
    const r = await cab.start({ deviceId: c.deviceId, resId: c.resId, dir: c.dir, placeKey: c.placeKey, placeName: null, placeLL: null, roomId: c.roomId, lang: c.lang, ac: acModeFor(Date.now()), phase: c.dir === "in" ? "dead" : "guest" });
    if (r.ok && r.id) { cabTrip = r.id; cabSend = true; rv?.stop(); rv = startRemoteVoice(r.id, { onStart: () => setDuck(0.35), onEnd: () => setDuck(1) }); flash("📺 iPad ONLINE"); tone(1320, 0, 0.08, 0.05); tone(1760, 0.08, 0.15, 0.04); }
    else flash("iPad に表示できませんでした");
  }
  // 車内 iPad の声もこの端末で鳴らす (到着の案内が終わるまで少し待ってから止める)
  let rv: RemoteVoice | null = null;
  function cabStop(end: boolean) { const id = cabTrip; cabSend = false; const r0 = rv; setTimeout(() => { if (rv === r0) { r0?.stop(); rv = null; } }, end ? 0 : 60000); if (end && id) { cabTrip = null; void cab.end(id); } }
  every(3000, async () => {
    if (!cabTrip || !cabSend) return; const ll = curLL();
    const r = await cab.pos(cabTrip, ll[0], ll[1], Math.round(spd));
    if (r.ok && !r.active) { cabTrip = null; cabSend = false; }
  });
  function flash(t: string) { $("tacq").innerHTML = esc(t); $("tacq").classList.add("on"); setTimeout(() => { $("tacq").classList.remove("on"); $("tacq").innerHTML = 'ACQUIRING SATELLITE<span class="blink">_</span>'; }, 1800); }

  /* ---------------- ミッション記録 ---------------- */
  function openHist() {
    const m = S.missions, kp = m.length ? Math.round(m.reduce((a, x) => a + (x.kept ?? 100), 0) / m.length) : 0;
    $("hsum").innerHTML = `<div><b>${S.monthCount}</b><small>今月の件数</small></div><div><b>${S.monthKm.toFixed(0)}</b><small>今月の KM</small></div><div><b>${m.length ? kp + "%" : "--"}</b><small>順守率</small></div><div><b>${S.todayCount}</b><small>今日</small></div>`;
    $("hsl").innerHTML = S.setup ? `<div class="none">記録を残すには Supabase で migration_kaku.sql を実行してください</div>`
      : m.length ? m.map((x) => `<div><b>${x.kind === "guest" ? "🛬" : "🛰"} ${esc(x.name)}</b><span>${x.rank || "-"}</span><small>${new Date(x.ended_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${Number(x.km).toFixed(1)} km · ${Math.round(x.sec / 60)} 分 · 順守率 ${x.kept ?? "-"}%</small></div>`).join("")
        : `<div class="none">まだ記録がありません</div>`;
    ov("hs", true);
  }

  /* ---------------- 設定 ---------------- */
  function renderSet() {
    const L = lists(), NM: Record<string, string> = { boot: "起動・ホーム", normal: "ノーマル", cruise: "クルーズ" };
    for (const m of MODES) {
      const box = $(`pl_${m}`), arr = L[m] ?? [];
      box.innerHTML = arr.length ? arr.map((t, i) => `<li><span>${i + 1}. ${esc(t.title)}</span>${t.id.startsWith("legacy-") ? "" : `<button class="ly ${t.lrc ? "has" : ""}" data-ly="${m}:${i}">${t.lrc ? "✓ 歌詞" : "＋ 歌詞"}</button>`}<button data-up="${m}:${i}" ${i ? "" : "disabled"}>▲</button><button data-dn="${m}:${i}" ${i < arr.length - 1 ? "" : "disabled"}>▼</button><button class="del" data-del="${m}:${i}">✕</button></li>`).join("") : `<li class="none">内蔵の BGM (${NM[m]})</li>`;
    }
    $("shTg").textContent = cfg.shuffle ? "シャッフル" : "登録順"; $("shTg").classList.toggle("on", cfg.shuffle);
    $("limIn").value = cfg.limit; for (const [id, v] of [["qTg", cfg.quiet], ["dTg", cfg.demo], ["bTg", cfg.bgm]] as [string, boolean][]) { $(id).textContent = v ? "ON" : "OFF"; $(id).classList.toggle("on", v); }
    $("gpsSt").textContent = cfg.demo ? "GPS: デモ走行中は使いません" : gpsOk ? `GPS: OK (±${Math.round(gpsAcc)} m)` : gpsErr ? `GPS: ${gpsErr}` : "GPS: 位置を待っています…";
  }
  function openSet() { renderSet(); $("bgMsg").textContent = S.setup ? "BGM の保存には Supabase で migration_kaku.sql を実行してください" : ""; ov("st", true); }
  $("limIn").onchange = () => { const v = Math.max(30, Math.min(120, Number($("limIn").value) || 80)); cfg.limit = v; saveCfg(); $("limT").textContent = `LIMIT ${v}`; };
  $("qTg").onclick = () => { cfg.quiet = !cfg.quiet; saveCfg(); renderSet(); $("qm").classList.toggle("on", cfg.quiet); if (cfg.quiet) CQ = CQ.filter((x) => x.prio); void say(cfg.quiet ? "quiet_on" : "quiet_off"); };
  $("dTg").onclick = () => { cfg.demo = !cfg.demo; saveCfg(); renderSet(); };
  $("bTg").onclick = () => { cfg.bgm = !cfg.bgm; saveCfg(); renderSet(); applyBgm(); };
  async function upBgm(which: BgmMode, files: File[]) {
    const NM: Record<string, string> = { boot: "起動・ホーム", normal: "ノーマル", cruise: "クルーズ" };
    let ok = 0;
    for (const [k, f] of files.entries()) {
      $("bgMsg").textContent = `アップロード中… (${k + 1}/${files.length}) ${f.name}`;
      const ext = (f.name.split(".").pop() || "mp3").toLowerCase();
      const u = await post({ op: "bgmUrl", which, ext: /^(mp3|m4a|aac|wav)$/.test(ext) ? ext : "mp3" });
      if (!u.ok) { $("bgMsg").textContent = "アップロードできませんでした: " + u.error; return; }
      const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": f.type || "audio/mpeg", "x-upsert": "false" }, body: f }).catch(() => null);
      if (!put || !put.ok) { $("bgMsg").textContent = `アップロードできませんでした: ${f.name}`; continue; }
      const title = f.name.replace(/\.[^.]+$/, "").slice(0, 80);
      const r = await post({ op: "trackAdd", which, path: u.path, title });
      if (!r.ok) { $("bgMsg").textContent = r.error === "SETUP" ? "Supabase で migration_kaku.sql を実行してください (プレイリストの表)" : "保存できませんでした: " + r.error; return; }
      ok++;
    }
    await refresh(); renderSet(); applyBgm(); $("bgMsg").textContent = `✓ ${NM[which]} のプレイリストに ${ok} 曲追加しました`;
  }
  for (const [id, m] of [["upB", "boot"], ["upN", "normal"], ["upC", "cruise"]] as [string, BgmMode][]) {
    $(id).onchange = (e: any) => { const fs = [...(e.target.files || [])] as File[]; if (fs.length) void upBgm(m, fs); e.target.value = ""; };
  }
  $("st").addEventListener("click", async (e: Event) => {
    const b = (e.target as HTMLElement).closest("button"); if (!b) return;
    if (b.dataset.ly) { // 歌詞を付ける (お父さんの画面と同じシート)
      const [m, is] = b.dataset.ly.split(":"), tr = (lists()[m] ?? [])[Number(is)]; if (!tr || !ui.lyrics) return;
      if (S.lyricsSetup) { $("bgMsg").textContent = "歌詞の保存には Supabase で migration_kaku_lyrics.sql を実行してください"; return; }
      tone(900, 0, 0.05, 0.04);
      ui.lyrics({ ...tr }, async (lrc) => {
        const r = await post({ op: "trackLrc", id: tr.id, lrc });
        if (!r.ok) return r.error === "SETUP_LRC" ? "Supabase で migration_kaku_lyrics.sql を実行してください" : r.error === "LEGACY" ? "前にアップした曲には歌詞を付けられません (消して追加し直してください)" : "保存できませんでした: " + (r.error || "");
        for (const k of MODES) for (const x of S.tracks?.[k] ?? []) if (x.id === tr.id) x.lrc = lrc;
        for (const k of MODES) for (const x of PL[k].list) if (x.id === tr.id) x.lrc = lrc;
        lyKey = ""; renderSet(); return null;
      });
      return;
    }
    const d = b.dataset.up || b.dataset.dn || b.dataset.del; if (!d) return;
    const [m, is] = d.split(":"), i = Number(is), arr = [...(lists()[m] ?? [])];
    if (b.dataset.del) {
      if (!confirm2(b)) return;
      const r = await post({ op: "trackDel", id: arr[i].id }); if (!r.ok) { $("bgMsg").textContent = "消せませんでした: " + r.error; return; }
      $("bgMsg").textContent = `「${arr[i].title}」を消しました`;
    } else {
      const j = b.dataset.up ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]];
      const ids = arr.map((t) => t.id).filter((x) => !x.startsWith("legacy-"));
      if (arr.some((t) => t.id.startsWith("legacy-"))) { $("bgMsg").textContent = "前にアップした曲は並べ替えできません (消して追加し直してください)"; return; }
      const r = await post({ op: "trackOrder", ids }); if (!r.ok) { $("bgMsg").textContent = "並べ替えできませんでした: " + r.error; return; }
      if (S.tracks) S.tracks[m] = arr;
    }
    await refresh(); renderSet();
  });
  /** ✕ は 2 回押しで消す (押し間違い防止) */
  function confirm2(b: HTMLElement) { if (b.dataset.sure) return true; b.dataset.sure = "1"; b.textContent = "消す?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "✕"; }, 2500); return false; }
  $("shTg").onclick = () => { cfg.shuffle = !cfg.shuffle; saveCfg(); for (const m of MODES) { const p = PL[m], was = cur(m)?.id; p.order = mkOrder(p.list.length); p.i = Math.max(0, p.order.findIndex((k) => p.list[k]?.id === was)); } renderSet(); };
  $("npN").onclick = (e: Event) => { e.stopPropagation(); tone(1200, 0, 0.05, 0.04); nextTrack(mode, true); };

  /* ---------------- フリーミッションの作成 ---------------- */
  let WP: KakuPlace[] = [], fType = "err";
  const defaults: KakuPlace[] = PLACE_KEYS.map((k) => ({ n: PLACES[k].name.ja, ll: PLACES[k].ll as LL, type: k.startsWith("kix") ? "air" : "err" }));
  const favs = () => { const f = S.places.filter((p) => p.fav); const names = new Set(f.map((p) => p.n)); return [...f, ...S.places.filter((p) => !p.fav && (p.visits ?? 0) >= 2 && !names.has(p.n)).slice(0, 4), ...defaults.filter((d) => !names.has(d.n))].slice(0, 12); };
  let pmap: any = null, pmL: any = null;
  function openFree() {
    WP = []; $("fName").value = ""; $("fQ").value = ""; $("fRes").innerHTML = ""; $("fDue").value = ""; $("fRtb").checked = true; setType("err"); renderFav(); renderWp(); ov("fm", true);
    setTimeout(() => {
      if (!pmap) {
        pmap = L.map($("pmap"), { zoomControl: true, attributionControl: false }).setView(HOME, 10);
        L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(pmap);
        pmL = L.layerGroup().addTo(pmap); L.circleMarker(HOME, { radius: 7, color: "#3dffa8" }).addTo(pmap).bindTooltip("CRANE NEST");
        pmap.on("click", (e: any) => addWp({ n: `地図の地点 ${WP.length + 1}`, ll: [e.latlng.lat, e.latlng.lng] }));
      }
      pmap.invalidateSize(); pmap.setView(HOME, 10);
    }, 60);
  }
  function renderFav() {
    const F = favs();
    $("fFav").innerHTML = F.map((f, i) => `<button data-f="${i}">★ ${esc(f.n)}</button>`).join("");
    $("fFav").querySelectorAll("button").forEach((b: HTMLElement) => (b.onclick = () => { const f = F[Number(b.dataset.f)]; addWp(f); if (WP.length === 1 && f.type && KAKU_TYPES.some(([k]) => k === f.type)) setType(f.type); }));
  }
  function setType(t: string) {
    fType = t; $("fType").innerHTML = KAKU_TYPES.map(([k, n]) => `<button data-t="${k}" class="${k === t ? "on" : ""}">${n}</button>`).join("");
    $("fType").querySelectorAll("button").forEach((b: HTMLElement) => (b.onclick = () => setType(b.dataset.t!)));
  }
  function addWp(p: KakuPlace) { if (WP.length >= 3) { $("fMsg").textContent = "行き先は 3 か所までです"; return; } WP.push({ ...p }); renderWp(); }
  function renderWp() {
    const isFav = (n: string) => S.places.some((p) => p.fav && p.n === n);
    $("fWp").innerHTML = WP.length ? WP.map((w, i) => `<li>${esc(w.n)}<button class="star ${isFav(w.n) ? "on" : ""}" data-s="${i}">★</button><button data-r="${i}">✕</button></li>`).join("") : `<li class="none">まだ行き先がありません</li>`;
    $("fWp").querySelectorAll("[data-r]").forEach((b: HTMLElement) => (b.onclick = () => { WP.splice(Number(b.dataset.r), 1); renderWp(); }));
    $("fWp").querySelectorAll("[data-s]").forEach((b: HTMLElement) => (b.onclick = async () => {
      const w = WP[Number(b.dataset.s)], on = !isFav(w.n);
      const r = await post({ op: "fav", n: w.n, ll: w.ll, type: fType, fav: on });
      if (!r.ok) { $("fMsg").textContent = r.error === "SETUP" ? "★ の保存には migration_kaku.sql が必要です" : "保存できませんでした"; return; }
      const ex = S.places.find((p) => p.n === w.n); if (ex) ex.fav = on; else S.places.push({ n: w.n, ll: w.ll, type: fType, fav: on, visits: 0 });
      renderWp(); renderFav();
    }));
    if (pmL) { pmL.clearLayers(); WP.forEach((w, i) => L.marker(w.ll, { icon: L.divIcon({ className: "", html: `<div style="width:26px;height:26px;border-radius:50%;background:#3dffa8;color:#03140d;font-weight:900;display:flex;align-items:center;justify-content:center;transform:translate(-13px,-13px)">${i + 1}</div>` }) }).addTo(pmL)); }
    $("fMake").disabled = !WP.length; $("fMsg").textContent = "";
  }
  async function search() {
    const q = String($("fQ").value || "").trim(); if (!q) return; $("fRes").innerHTML = `<div style="color:#9cb">検索中…</div>`;
    try {
      const d: any[] = await ext("geo", `&q=${encodeURIComponent(q)}`);
      $("fRes").innerHTML = d.length ? d.map((r: any, i: number) => `<button data-i="${i}">${esc(r.n)}<small>${esc(r.sub || "")}</small></button>`).join("") : `<div style="color:#ffb020">見つかりませんでした。地図で選んでください</div>`;
      $("fRes").querySelectorAll("button").forEach((b: HTMLElement) => (b.onclick = () => { const r = d[Number(b.dataset.i)]; addWp({ n: r.n, ll: r.ll }); $("fRes").innerHTML = ""; pmap?.setView(r.ll, 14); }));
    } catch { $("fRes").innerHTML = `<div style="color:#ffb020">検索できませんでした。★ か地図から選んでください</div>`; }
  }
  $("fGo").onclick = () => void search(); $("fQ").onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter") void search(); };
  /** ルート (OSRM)。取れないときは直線で仮表示 */
  async function route(a: LL, b: LL): Promise<{ pts: LL[]; dur: number; real: boolean }> {
    try { const r = await ext("route", `&alat=${a[0]}&alng=${a[1]}&blat=${b[0]}&blng=${b[1]}`); if (r?.pts?.length > 1) return { pts: r.pts, dur: r.dur, real: true }; } catch { /* */ }
    const pts = Array.from({ length: 41 }, (_, i) => [a[0] + (b[0] - a[0]) * i / 40, a[1] + (b[1] - a[1]) * i / 40] as LL);
    return { pts, dur: dd(a, b) * 1.3 / (40 / 3.6), real: false };
  }
  $("fMake").onclick = async () => {
    if (!WP.length) return; $("fMake").disabled = true; $("fMsg").textContent = "ルートを計算中…";
    const legs: Leg[] = WP.map((w) => ({ n: w.n, ll: w.ll, pts: [], dur: 0, type: fType }));
    if ($("fRtb").checked) legs.push({ n: "帰還", ll: HOME, pts: [], dur: 0, home: true });
    let from: LL = gpsLL && !cfg.demo ? gpsLL : HOME;
    for (const l of legs) { Object.assign(l, await route(from, l.ll)); from = l.ll; }
    const name = String($("fName").value || "").trim().slice(0, 30) || (short(WP[0].n, 12) + (WP.length > 1 ? ` ほか${WP.length - 1}件` : ""));
    M = { kind: "free", name, type: fType, legs, due: $("fDue").value || null, demo: cfg.demo };
    ov("fm", false); $("fMake").disabled = false; $("fMsg").textContent = ""; startMission();
  };

  /* ---------------- ③ ミッション画面の地図 ---------------- */
  let RT: LL[] = [HOME, HOME], CUM: number[] = [0, 0], TOT = 1, KM = 0, BR0 = 0, BR1 = 0, BRKM = 0;
  function calcRT() { CUM = [0]; for (let i = 1; i < RT.length; i++) CUM.push(CUM[i - 1] + dd(RT[i - 1], RT[i])); TOT = Math.max(1, CUM[CUM.length - 1]); KM = TOT / 1000; }
  function at(u: number) {
    const d = u * TOT; let i = 1; while (i < CUM.length - 1 && CUM[i] < d) i++;
    const a = RT[i - 1], b = RT[i], f = (d - CUM[i - 1]) / Math.max(1, CUM[i] - CUM[i - 1]);
    return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as LL, hd: Math.atan2((b[1] - a[1]) * Math.cos(a[0] * RAD), b[0] - a[0]) / RAD };
  }
  /** 今の位置をルートに当てる (ルート上の距離と、ルートからのずれ) */
  function project(p: LL) {
    let best = { d: 0, off: Infinity, hd: 0 };
    const cx = Math.cos(p[0] * RAD);
    for (let i = 1; i < RT.length; i++) {
      const a = RT[i - 1], b = RT[i];
      const ax = (a[1] - p[1]) * RAD * R * cx, ay = (a[0] - p[0]) * RAD * R, bx = (b[1] - p[1]) * RAD * R * cx, by = (b[0] - p[0]) * RAD * R;
      const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / L2));
      const off = Math.hypot(ax + vx * t, ay + vy * t);
      const back = CUM[i - 1] + t * (CUM[i] - CUM[i - 1]) < prog * TOT - 300 ? 60 : 0; // 後ろに戻る当て方は少し嫌う
      if (off + back < best.off) best = { d: CUM[i - 1] + t * (CUM[i] - CUM[i - 1]), off: off + back, hd: Math.atan2(vx, vy) / RAD };
    }
    return best;
  }
  function calcBR() { BR0 = 0; BR1 = 0; for (let k = 0; k <= 1000; k++) if (onBridge(at(k / 1000).ll)) { if (!BR0) BR0 = k / 1000; BR1 = k / 1000; } BRKM = (BR1 - BR0) * KM; }
  const map = L.map($("lmap"), { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false, zoomSnap: 0.25 });
  const TILE: Record<string, string> = { sat: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", line: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png" };
  let tl = L.tileLayer(TILE.sat, { maxZoom: 18 }).addTo(map);
  const rtBg = L.polyline(RT, { color: "#3dffa8", weight: 14, opacity: 0.15 }).addTo(map);
  const rtDone = L.polyline([RT[0]], { color: "#e8fff4", weight: 6, opacity: 0.95 }).addTo(map);
  const rtDash = L.polyline(RT, { color: "#3dffa8", weight: 4, opacity: 0.9, dashArray: "10 10" }).addTo(map);
  const brLine = L.polyline([RT[0], RT[0]], { color: "#3dffa8", weight: 12, opacity: 0, className: "brRt" }).addTo(map);
  const tgM = L.marker(RT[1], { icon: L.divIcon({ className: "", html: '<div class="tgI"><b></b><i></i></div>' }) }).addTo(map);
  const car = L.marker(RT[0], { icon: L.divIcon({ className: "", html: '<div class="carI"><b></b><b></b><i id="carA"></i></div>' }) }).addTo(map);
  map.setView(HOME, 12); mapRef = map;
  function setRoute(pts: LL[]) {
    RT = pts.length > 1 ? pts : [pts[0], pts[0]]; calcRT(); calcBR(); rtBg.setLatLngs(RT); rtDash.setLatLngs(RT); rtDone.setLatLngs([RT[0]]);
    const seg = RT.filter((_p, i) => CUM[i] >= BR0 * TOT - 50 && CUM[i] <= BR1 * TOT + 50); brLine.setLatLngs(seg.length > 1 ? seg : [RT[0], RT[0]]);
    tgM.setLatLng(RT[RT.length - 1]); car.setLatLng(RT[0]);
  }
  $("tsw").onclick = () => { const t = $("tmap").classList.contains("sat") ? "line" : "sat"; $("tmap").classList.toggle("sat", t === "sat"); $("tmap").classList.toggle("line", t === "line"); map.removeLayer(tl); tl = L.tileLayer(TILE[t], { maxZoom: 18 }).addTo(map); };
  let lastPan = 0, follow = false;
  function placeCar(u: number, real?: LL, hd?: number) {
    const a = at(u), ll = real || a.ll; car.setLatLng(ll); const ic = $("carA"); if (ic) ic.style.transform = `rotate(${hd ?? a.hd}deg)`;
    const k = Math.max(1, CUM.findIndex((c) => c >= u * TOT)); rtDone.setLatLngs([...RT.slice(0, k), a.ll]);
    $("tco").textContent = `${ll[0].toFixed(4)}N ${ll[1].toFixed(4)}E`;
    if (follow && performance.now() - lastPan > 250) { lastPan = performance.now(); map.panTo(ll, { animate: true, duration: 0.25, easeLinearity: 1 }); }
  }
  async function lockOn() {
    $("tacq").classList.add("on"); tone(1200, 0, 0.05, 0.03, "square"); await wait(900); $("tacq").innerHTML = "TARGET LOCKED"; tone(880, 0, 0.1, 0.05);
    map.flyTo(curLL(), 16, { duration: 2.2 }); await wait(2300); $("tacq").classList.remove("on"); $("tacq").innerHTML = 'ACQUIRING SATELLITE<span class="blink">_</span>'; follow = true;
  }

  /* ---------------- GPS ---------------- */
  let gpsLL: LL | null = null, gpsKmh = 0, gpsAcc = 999, gpsT = 0, gpsOk = false, gpsErr = "", gpsWatch: number | null = null, prevFix: LL | null = null;
  function startGps() {
    if (gpsWatch != null || !("geolocation" in navigator)) { if (!("geolocation" in navigator)) gpsErr = "この端末は位置が取れません"; return; }
    gpsWatch = navigator.geolocation.watchPosition((p) => {
      const ll: LL = [p.coords.latitude, p.coords.longitude], now = Date.now();
      let kmh = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
      if (kmh == null && gpsLL && gpsT) kmh = dd(gpsLL, ll) / Math.max(0.5, (now - gpsT) / 1000) * 3.6;
      gpsAcc = p.coords.accuracy; gpsOk = true; gpsErr = "";
      if (phase === "drive" && !M.demo && prevFix && gpsAcc < 60) { const step2 = dd(prevFix, ll); if (step2 < 300) dKm += step2 / 1000; }
      if (gpsAcc < 60) prevFix = ll;
      gpsLL = ll; gpsKmh = Math.max(0, Math.min(250, kmh ?? 0)); gpsT = now;
      if (phase === "drive" && !M.demo) onFix(ll);
    }, (e) => { gpsOk = false; gpsErr = e.code === 1 ? "位置の利用が許可されていません (設定 → Safari → 位置情報)" : "位置が取れません"; }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  const curLL = (): LL => (!M.demo && gpsLL ? gpsLL : at(prog).ll);

  /* ---------------- ミッション ---------------- */
  let M: Mission = { kind: "guest", name: "", type: "guest", legs: [], due: null, demo: false }, leg = 0;
  type Phase = "" | "brief" | "drive" | "hold" | "done";
  let phase = "" as Phase, spd = 0, prog = 0, t0 = 0, fr = 0, okf = 0, said: Record<string, number> = {}, lastLim = 0, smoothT = 0;
  let inBr = false, hwT = 0, hwOn = false, crKind: "bridge" | "hwy" = "bridge", offT = 0, lastReroute = 0, stopT = 0;
  let dKmAtStart = -1, startedAt = 0;
  let F: Record<string, number> = {}, MF: Record<string, number> = {}, holdT0 = 0, stops = 0, moving = false, hdHist: number[] = [], dKm = 0, dT = 0, lateSaid = false;
  function renderSteps(active: number) {
    const st = $("steps"), names = M.legs.map((l) => (l.home ? "帰還" : M.kind === "guest" ? `${short(l.n, 7)}へ` : l.n));
    st.style.gridTemplateColumns = `repeat(${names.length},1fr)`;
    st.innerHTML = names.map((n, i) => `<div class="${i < active ? "done" : i === active ? "on" : ""}"><i>${i + 1}</i>${esc(short(n))}</div>`).join("");
  }
  function setLeg(i: number) {
    leg = i; const l = M.legs[i]; setRoute(l.pts); prog = 0; F = {};
    $("tbL").textContent = l.home ? "CRANE NEST" : short(l.n, 6); $("tgt").innerHTML = KM.toFixed(1) + "<small>km</small>"; renderSteps(i);
  }
  function resetHud() {
    phase = "brief"; prog = 0; spd = 0; fr = 0; okf = 0; said = {}; hwT = 0; hwOn = false; lateSaid = false; offT = 0; stopT = 0;
    $("tmr").textContent = "00:00:00"; $("bdg").textContent = "待機中"; $("bdg").classList.add("wait");
    $("authT").textContent = "指紋で出発"; $("authT").style.fontSize = ""; $("fp").style.setProperty("--p", 0); hideReached(); $("done").classList.remove("on");
    $("s3").classList.remove("cruise", "over", "hwy"); inBr = false; setMode("normal"); $("limT").textContent = `LIMIT ${cfg.limit}`;
  }
  function startMission() {
    setMode("normal");
    cabTrip = null; cabSend = false;
    ac(); tone(660, 0, 0.1, 0.05); tone(990, 0.1, 0.2, 0.05); noise(0, 0.3, 0.05, 900);
    $("mT").textContent = M.name; $("mT").style.fontSize = M.name.length > 9 ? "36px" : "";
    $("mS").textContent = `${M.kind === "guest" ? "GUEST PICKUP" : "FREE MISSION"} · ${pad(S.todayCount + 1)}${M.demo ? " · DEMO" : ""}`;
    show("s3"); resetHud(); setLeg(0); follow = false; map.invalidateSize(); map.fitBounds(L.latLngBounds(RT), { padding: [60, 120] });
    const km = M.legs.reduce((a, l) => a + lenOf(l.pts), 0) / 1000, min = Math.round(M.legs.reduce((a, l) => a + l.dur, 0) / 60);
    if (M.kind === "free") dyn.fbrief = `フリーミッションを読み込みました。目的地：${M.legs.filter((l) => !l.home).map((l) => l.n).join("、")}。全行程 ${km.toFixed(1)} km、約 ${min} 分。${M.due ? `目標到着 ${M.due}。` : ""}${M.legs.some((l) => !l.real) ? "（ルートが取れなかったので直線で仮表示）" : ""}ナビは私が、駐車はあなたが。始めますか？`;
    else dyn.gbrief = M.cab?.dir === "out" || /お見送り/.test(M.name) ? `通信が入りました、Kaku。今回の任務：${dyn.guestWho || "ゲスト"}を${M.legs[0].n}まで無事にお送りすること。往復 ${km.toFixed(1)} km。${M.cab ? "車内 iPad も連動します。" : ""}引き受けますか？` : `通信が入りました、Kaku。今回の任務：${M.legs[0].n}で${dyn.guestWho || "ゲスト"}をお迎えし、無事に Crane Nest へ。往復 ${km.toFixed(1)} km。${M.cab ? "車内 iPad も連動します。" : ""}コーヒーは未完了です。引き受けますか？`;
    etaTick(true); setTimeout(() => void say(M.kind === "free" ? "fbrief" : "gbrief"), 700);
  }
  /* 指紋を長押し: 出発 / 次へ / (走行中) ここで到着にする */
  let pressT: any = null, pv = 0;
  $("auth").onpointerdown = (e: PointerEvent) => {
    if (phase !== "brief" && phase !== "hold" && phase !== "drive") return; e.preventDefault(); $("s3").classList.add("pressing"); pv = 0; clearInterval(pressT);
    pressT = setInterval(() => {
      pv += 1 / 30; $("fp").style.setProperty("--p", Math.min(1, pv)); if (Math.random() < 0.4) tone(1400 + pv * 800, 0, 0.03, 0.02, "square");
      if (pv >= 1) { clearInterval(pressT); $("s3").classList.remove("pressing"); if (phase === "hold") void nextLeg(); else if (phase === "brief") void accepted(); else if (phase === "drive") void arrive(); }
    }, 40);
  };
  const cancel = () => { clearInterval(pressT); $("s3").classList.remove("pressing"); if (phase !== "drive") $("fp").style.setProperty("--p", 0); else $("fp").style.setProperty("--p", 1); };
  $("auth").onpointerup = cancel; $("auth").onpointerleave = cancel;
  async function accepted() {
    phase = "drive"; t0 = performance.now(); startedAt = Date.now(); dKmAtStart = dKm; void lockOn(); tone(880, 0, 0.1, 0.06); tone(1320, 0.1, 0.25, 0.05);
    $("bdg").textContent = "進行中"; $("bdg").classList.remove("wait"); $("authT").textContent = "進行中 · 長押しで到着"; $("authT").style.fontSize = "32px";
    wakeLock(true); if (M.cab?.leg === 0) void cabBegin();
    await say("auth"); if (phase !== "drive") return;
    void say(TYPE_LINE[M.type] || "go"); if (M.kind === "free") missionStartChat();
  }
  function missionStartChat() {
    MF = {}; stops = 0; hdHist = [];
    const h = jstHour(), dow = jstDow(), toSS = (sunset(new Date()).getTime() - Date.now()) / 60000;
    const ctx = RAINY ? "rain" : dow === 0 || dow === 6 ? "weekend" : toSS < 40 && toSS > -10 ? "dusk" : h >= 5 && h < 10 ? "morning" : h >= 11 && h < 14 ? "noon" : h >= 19 || h < 4 ? "night" : null;
    if (ctx) chat(ctx);
    const first = M.legs.find((l) => !l.home);
    if (S.todayCount >= 1) { dyn.again = `本日${S.todayCount + 1}件目の任務。今日のKakuは働き者です。`; chat("again"); }
    else if (first) { const c = S.places.find((p) => p.n === first.n)?.visits ?? 0; if (c >= 2) { dyn.regular = `この場所、${c + 1}回目です。常連さんですね。`; chat("regular"); } else if (!c) chat("newdest"); }
  }
  /* 走っている間 (GPS の 1 回ごと) */
  function onFix(ll: LL) {
    const p = project(ll);
    if (p.off < 150) { prog = Math.max(0, Math.min(1, p.d / TOT)); offT = 0; }
    else if (gpsKmh > 5) {
      if (!offT) offT = Date.now();
      if (Date.now() - offT > 20000 && Date.now() - lastReroute > 60000) { lastReroute = Date.now(); void reroute(ll); }
    }
    placeCar(prog, ll, p.off < 150 ? p.hd : undefined);
    const rem = (1 - prog) * TOT, near = dd(ll, M.legs[leg].ll);
    if (near < 60 || (near < 300 && gpsKmh < 5 && stopT && Date.now() - stopT > 15000)) void arrive();
    if (gpsKmh < 5) { if (!stopT) stopT = Date.now(); } else stopT = 0;
    void rem;
  }
  /** 寄り道したら、今の場所から行き先までを引き直す */
  async function reroute(from: LL) {
    const l = M.legs[leg], r = await route(from, l.ll); if (phase !== "drive") return;
    Object.assign(l, { pts: r.pts, dur: r.dur }); setRoute(r.pts); prog = 0; offT = 0;
    $("tacq").innerHTML = "ROUTE UPDATED"; $("tacq").classList.add("on"); tone(880, 0, 0.08, 0.04); setTimeout(() => { $("tacq").classList.remove("on"); $("tacq").innerHTML = 'ACQUIRING SATELLITE<span class="blink">_</span>'; }, 1500);
  }
  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return [s / 3600 | 0, (s / 60 | 0) % 60, s % 60].map(pad).join(":"); };
  /* 毎フレーム: 速度・タイマー・クルーズ・おしゃべり */
  let lt = 0;
  (function frame() {
    if (dead) return; requestAnimationFrame(frame);
    if (phase !== "drive") { lt = 0; return; }
    const nowT = performance.now(), dt = Math.min(0.1, (nowT - (lt || nowT)) / 1000); lt = nowT;
    const want = M.demo ? 72 : gpsKmh; spd += (want - spd) * (M.demo ? 0.02 : 0.12); fr++; if (spd <= cfg.limit + 1) okf++;
    if (M.demo) { const step2 = spd / 3.6 * 10 * dt; prog = Math.min(1, prog + step2 / TOT); dKm += step2 / 1000; placeCar(prog); if (prog >= 1) void arrive(); }
    $("spd").textContent = Math.round(spd); $("gb").style.width = Math.min(100, spd / 1.1) + "%"; $("tmr").textContent = fmt(nowT - t0);
    $("tgt").innerHTML = (KM * (1 - prog)).toFixed(1) + "<small>km</small>";
    const ll = curLL(), br = onBridge(ll);
    if (spd >= 70) hwT = Math.min(6, hwT + dt); else if (spd < 60) hwT = Math.max(0, hwT - dt); if (hwT >= 4) hwOn = true; if (hwT <= 0) hwOn = false;
    const cr = br || hwOn; if (cr !== inBr) { inBr = cr; crKind = br ? "bridge" : "hwy"; if (cr) cruiseIn(); else cruiseOut(); }
    if (br && BR1 > BR0) {
      const u = Math.max(0, Math.min(1, (prog - BR0) / Math.max(0.001, BR1 - BR0))); $("bbF").style.width = u * 100 + "%"; $("bbT").textContent = `${(u * BRKM).toFixed(1)} / ${BRKM.toFixed(1)} km`;
      if (u >= 0.5 && !said.mid) { said.mid = 1; $("mid").textContent = `▲ MIDPOINT · ${(BRKM / 2).toFixed(1)} KM`; $("mid").classList.add("on"); tone(1320, 0, 0.08, 0.05); tone(1760, 0.08, 0.2, 0.04); setTimeout(() => $("mid").classList.remove("on"), 2600); }
    }
    const over = spd > cfg.limit + 1; $("s3").classList.toggle("over", over);
    if (over && !talking && nowT - lastLim > 20000) { lastLim = nowT; void say("limit"); }
    if (br && spd > 60 && spd <= cfg.limit) { smoothT += dt; if (smoothT > 8 && !said.smooth && !talking) { said.smooth = 1; chat("smooth"); } } else smoothT = 0;
    if (spd < 8 && prog > 0.05 && !said.tr && nowT - t0 > 60000) { said.traffic = (said.traffic || 0) + dt; if (said.traffic > 90) { said.tr = 1; chat("traffic"); } }
    etaTick(); if (M.kind === "free") chatTick(dt, ll);
  })();
  function etaTick(force?: boolean) {
    if (!force && performance.now() - ((etaTick as any).t || 0) < 1000) return; (etaTick as any).t = performance.now();
    const l = M.legs[leg]; if (!l) return; const sec = (1 - prog) * l.dur, eta = new Date(Date.now() + sec * 1000);
    let h = `ETA <b>${tfm(eta)}</b>`;
    if (M.due && !l.home) {
      const [hh, mm] = M.due.split(":").map(Number), jst = new Date(Date.now() + 9 * 3600000), due = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), hh, mm) - 9 * 3600000;
      const ok = eta.getTime() <= due; h += `<br>目標 ${M.due} <span class="${ok ? "ok" : "ng"}">${ok ? "✓" : "⚠ 遅れ"}</span>`;
      if (!ok && phase === "drive" && !lateSaid) { lateSaid = true; chat("late", true); }
    }
    $("eta").innerHTML = h;
  }
  function chatTick(_dt: number, ll: LL) {
    const l = M.legs[leg], rem = (1 - prog) * TOT, { hd } = at(prog);
    if (!l.home) {
      if (rem < 5000 && TOT > 7000 && !F.km5) { F.km5 = 1; chat("km5"); }
      if (rem < 2000 && M.type === "doc" && !F.doc && l.type !== "conv") { F.doc = 1; chat("neardoc", true); }
      else if (rem < 1000 && TOT > 2000 && !F.km1) { F.km1 = 1; chat("km1"); }
    }
    if (!MF.osaka && ll[0] > 34.6 && ll[0] < 34.74 && ll[1] > 135.44 && ll[1] < 135.58) { MF.osaka = 1; chat("osaka"); }
    if (!MF.wangan && inBr && crKind === "hwy" && ll[1] < 135.47 && ll[0] > 34.45) { MF.wangan = 1; chat("wangan"); }
    if (spd > 40) { hdHist.push(hd); if (hdHist.length > 1800) hdHist.shift(); if (hdHist.length >= 1800 && !MF.straight && Math.max(...hdHist) - Math.min(...hdHist) < 6) { MF.straight = 1; chat("straight"); } } else hdHist = [];
    if (spd > 20) moving = true; if (moving && spd < 3) { moving = false; stops++; if (stops === 5) chat("redlight"); }
  }
  every(1000, () => {
    if (phase === "drive") dT++;
    if (phase === "hold" && holdT0) { const m = (performance.now() - holdT0) / 60000; if (m >= 30 && !F.w30) { F.w30 = 1; chat("wait30"); } if (m >= 60 && !F.w60) { F.w60 = 1; chat("wait60"); } }
    if (!MF.km500 && S.monthKm < 500 && S.monthKm + dKm >= 500) { MF.km500 = 1; chat("km500"); }
    $("dlKm").textContent = dKm.toFixed(1); $("dlTm").textContent = `${dT / 60 | 0}:${pad(dT % 60)}`;
    if (fr) { const kp = Math.round(100 * okf / fr); $("dlKp").textContent = kp + "%"; $("dlRk").textContent = rank(kp); }
  });
  const rank = (kp: number) => (kp >= 95 ? "A+" : kp >= 85 ? "A" : kp >= 70 ? "B" : "C");

  /* クルーズモード (橋 / 高速) */
  function scramble(e: HTMLElement, txt: string, ms: number) { const C = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#$%&*<>"; const t0b = performance.now(); (function f(n: number) { const u = Math.min(1, (n - t0b) / ms); e.textContent = [...txt].map((ch, i) => (ch === " " || i / txt.length < u ? ch : C[Math.random() * C.length | 0])).join(""); if (u < 1) requestAnimationFrame(f); })(t0b); }
  function cruiseIn() {
    const hw = crKind === "hwy"; $("cinS").textContent = hw ? "EXPRESSWAY · CRUISE CONTROL" : `SKY GATE BRIDGE · ${BRKM.toFixed(1)} KM · OVER OSAKA BAY`; $("s3").classList.toggle("hwy", hw);
    whoosh(); boom(1.05); const ci = $("cin"); ci.classList.remove("go"); void ci.offsetWidth; ci.classList.add("go"); setTimeout(() => scramble($("cinT"), "CRUISE MODE", 900), 250);
    setTimeout(() => { if (!inBr) return; $("s3").classList.add("cruise"); setMode("cruise"); root.querySelectorAll(".brRt").forEach((e) => e.setAttribute("stroke-opacity", hw ? "0" : ".95")); }, 1000);
    if (!said[crKind]) { said[crKind] = 1; setTimeout(() => chat(hw ? "hwy" : "cruise", true), 1400); }
  }
  function cruiseOut() {
    if (crKind === "hwy" && phase === "drive" && M.kind === "free") chat("hwyout");
    $("s3").classList.remove("cruise", "hwy"); setMode("normal"); root.querySelectorAll(".brRt").forEach((e) => e.setAttribute("stroke-opacity", "0"));
    if (phase === "drive" && crKind === "bridge") { $("tacq").innerHTML = "BRIDGE CLEARED"; $("tacq").classList.add("on"); tone(880, 0, 0.1, 0.05); tone(1320, 0.1, 0.3, 0.05); setTimeout(() => { $("tacq").classList.remove("on"); $("tacq").innerHTML = 'ACQUIRING SATELLITE<span class="blink">_</span>'; }, 1800); }
  }
  const cvs = $("stars") as HTMLCanvasElement, cx = cvs.getContext("2d")!, ST = Array.from({ length: 240 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
  (function stars() {
    if (dead) return; requestAnimationFrame(stars); if (!$("s3").classList.contains("cruise")) return; cx.clearRect(0, 0, 1040, 470);
    const v = 0.002 + spd / 9000, col = $("s3").classList.contains("over") ? "255,176,32" : "61,255,168";
    for (const s of ST) { const pz = s.z; s.z -= v; if (s.z <= 0.02) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; continue; } const x = 520 + s.x / s.z * 360, y = 235 + s.y / s.z * 200, x2 = 520 + s.x / (pz + 0.06) * 360, y2 = 235 + s.y / (pz + 0.06) * 200; cx.strokeStyle = `rgba(${col},${1 - s.z})`; cx.lineWidth = (1 - s.z) * 3; cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x, y); cx.stroke(); }
  })();

  /* 到着 → 停車中 → 次へ / 帰還 → 完了 */
  async function arrive() {
    if (phase !== "drive") return; phase = "hold"; spd = 0; $("spd").textContent = "0"; $("gb").style.width = "0"; $("s3").classList.remove("cruise", "over", "hwy"); inBr = false; hwT = 0; hwOn = false; setMode("normal");
    $("tgt").innerHTML = "0.0<small>km</small>"; placeCar(1);
    const l = M.legs[leg];
    // iPad 連動: 迎え先・送り先では送り続ける (回送 / 帰り道も iPad に出す)。Crane Nest に着いたら最後の位置を送って終わり (iPad は自分で待機に戻る)
    if (M.cab && cabTrip && l.home) { const ll = l.ll; void cab.pos(cabTrip, ll[0], ll[1], 0); cabStop(false); }
    if (l.home) { renderSteps(M.legs.length); return done(); }
    renderSteps(leg); $("steps").children[leg].className = "done"; showReached(l);
    const nx = M.legs[leg + 1];
    $("authT").textContent = nx ? `長押しで次へ ▸ ${nx.home ? "帰還" : short(nx.n, 6)}` : "長押しで完了"; $("authT").style.fontSize = "32px"; $("fp").style.setProperty("--p", 0);
    $("bdg").textContent = "停車中"; $("bdg").classList.add("wait"); holdT0 = performance.now();
    await say(M.kind === "guest" ? "arrive" : "farrive");
    if (M.kind === "free" && ARRIVE_LINE[M.type] && l.type !== "conv") chat(ARRIVE_LINE[M.type], true);
  }
  /* TARGET REACHED: 四隅の照準が中心に集まる → リング → 十字線 → 文字が解読される → 進み具合のバー */
  function showReached(l: Leg) {
    const tr = $("tr"); tr.classList.remove("on"); void tr.offsetWidth; tr.classList.add("on");
    const done2 = leg + 1, all = M.legs.length, sec = (performance.now() - t0) / 1000;
    $("trP").style.setProperty("--w", `${Math.round(done2 / all * 100)}%`);
    $("trS").textContent = `${l.ll[0].toFixed(4)}N ${l.ll[1].toFixed(4)}E · T+${fmt(sec * 1000)} · ${(lenOf(l.pts) / 1000).toFixed(1)} KM`;
    $("trPh").textContent = `PHASE ${done2}/${all} COMPLETE`;
    scramble($("trT"), "TARGET REACHED", 900);
    [0, 0.14, 0.26, 0.36, 0.44, 0.5].forEach((t, i) => tone(1100 + i * 180, t, 0.05, 0.05, "square"));
    boom(0.62); tone(440, 0.62, 1.2, 0.05, "sawtooth"); tone(554.4, 0.64, 1.2, 0.04, "sawtooth"); tone(659.3, 0.66, 1.2, 0.04, "sawtooth"); noise(0.62, 0.4, 0.08, 1200);
    map.flyTo(l.ll, 17, { duration: 1.4 });
  }
  function hideReached() { $("tr").classList.remove("on"); }
  async function nextLeg() {
    const nx = M.legs[leg + 1]; if (!nx) return done();
    hideReached(); setLeg(leg + 1);
    if (M.cab && !cabTrip && M.cab.leg === leg) void cabBegin();
    else if (M.cab?.dir === "in" && cabTrip && leg === 1) void cab.board(cabTrip); // 迎え先を出発 = ゲスト乗車
    phase = "drive"; said = {}; lateSaid = false; holdT0 = 0; offT = 0; stopT = 0;
    $("bdg").textContent = "進行中"; $("bdg").classList.remove("wait"); $("authT").textContent = "進行中 · 長押しで到着";
    tone(880, 0, 0.1, 0.06); tone(1320, 0.1, 0.25, 0.05); map.flyTo(curLL(), 16, { duration: 1.2 });
    if (!M.demo && gpsLL) { const p = project(gpsLL); if (p.off > 300) void reroute(gpsLL); }
    if (M.kind === "free") await say("back"); await say(nx.home ? "frtb" : "fnext");
  }
  async function done() {
    phase = "done"; wakeLock(false); M.legs.forEach((_l, i) => $("steps").children[i] && ($("steps").children[i].className = "done"));
    const kp = Math.round(100 * okf / Math.max(1, fr)), sec = (performance.now() - t0) / 1000, km = M.legs.reduce((a, l) => a + lenOf(l.pts), 0) / 1000;
    const drove = M.demo ? km : dKmAtStart >= 0 ? dKm - dKmAtStart : km;
    $("dKm").textContent = drove.toFixed(1); $("dT").textContent = fmt(sec * 1000).slice(sec >= 3600 ? 0 : 3); $("dK").textContent = kp + "%"; $("dG").textContent = rank(kp); $("done").classList.add("on");
    tone(523, 0, 0.2, 0.06); tone(659, 0.15, 0.2, 0.06); tone(784, 0.3, 0.5, 0.06);
    if (!M.demo) {
      void post({ op: "log", name: M.name, kind: M.kind, type: M.type, km: drove, sec, kept: kp, rank: rank(kp), started: startedAt,
        stops: M.legs.filter((l) => !l.home && l.type !== "conv").map((l) => ({ n: l.n, ll: l.ll, type: l.type })) }).then(() => refresh());
    }
    if (M.kind === "free" && RETURN_LINE[M.type]) await say(RETURN_LINE[M.type]);
    await say(kp >= 85 ? "done" : "doneB");
  }
  $("done").onclick = () => { if (phase === "done") { phase = ""; bgm(true); toHome(); } };
  /* 中止 */
  $("abt").onclick = () => { if (phase) ov("cf", true); };
  $("cfN").onclick = () => ov("cf", false);
  $("cfY").onclick = () => { ov("cf", false); phase = ""; cabStop(true); cabTrip = null; wakeLock(false); endPrev && endPrev(); el.pause(); CQ = []; $("s3").classList.remove("cruise", "over", "hwy"); setMode("normal"); toHome(); };

  /* ---------------- 話しかける: あと何分 / コンビニ / 今日の成績 ---------------- */
  $("aEta").onclick = () => {
    if (!M.legs.length || !phase || phase === "done") return; const l = M.legs[leg], rem = (1 - prog) * TOT, sec = (1 - prog) * l.dur, mn = Math.max(1, Math.round(sec / 60));
    dyn.ask_eta = `${l.home ? "Crane Nest" : l.n}まで あと約${mn}分（${(rem / 1000).toFixed(1)}km）。到着予定 ${tfm(new Date(Date.now() + sec * 1000))}。`; tone(1200, 0, 0.05, 0.04); void say("ask_eta");
  };
  $("aSt").onclick = () => {
    const kp = fr ? Math.round(100 * okf / fr) : 100;
    dyn.ask_stats = `本日 ${S.todayCount + (phase && phase !== "done" ? 1 : 0)}件目・${dKm.toFixed(1)}km・運転 ${Math.round(dT / 60)}分。制限速度の順守率 ${kp}%、評価は ${rank(kp)}。今月は ${(S.monthKm + dKm).toFixed(0)}km。`;
    tone(1200, 0, 0.05, 0.04); void say("ask_stats");
  };
  $("aConv").onclick = async () => {
    if (M.kind !== "free" || phase !== "drive") { dyn.ask_none = "コンビニ検索は、フリーミッションの走行中に使えます。"; return void say("ask_none"); }
    tone(1200, 0, 0.05, 0.04); $("tacq").innerHTML = "SCANNING AREA"; $("tacq").classList.add("on"); const cur = curLL();
    let list: KakuPlace[] = [];
    try { list = await ext("conv", `&lat=${cur[0]}&lng=${cur[1]}`); } catch { list = []; }
    list = (list || []).sort((a, b) => dd(cur, a.ll) - dd(cur, b.ll));
    // 進む向きにあるものを優先 (真後ろは避ける)
    const ahead = list.find((c) => project(c.ll).d > prog * TOT - 100) || list[0];
    if (!ahead) { $("tacq").classList.remove("on"); dyn.ask_none = "近くにコンビニが見つかりません。私でも建てられません。"; return void say("ask_none"); }
    const tl2 = M.legs[leg], r1 = await route(cur, ahead.ll), r2 = await route(ahead.ll, tl2.ll);
    Object.assign(tl2, { pts: r2.pts, dur: r2.dur }); M.legs.splice(leg, 0, { n: ahead.n, ll: ahead.ll, type: "conv", ...r1 });
    setLeg(leg); $("tacq").innerHTML = "WAYPOINT ADDED"; setTimeout(() => $("tacq").classList.remove("on"), 1500);
    dyn.ask_conv = `近くのコンビニを発見：${ahead.n}（約${Math.round(dd(cur, ahead.ll))}m）。経由地に追加しました。`; void say("ask_conv");
  };

  /* ---------------- 受信 (為替 / 地震 / 日の入り・月 / ニュース) ---------------- */
  const wv = $("wave") as HTMLCanvasElement, wx = wv.getContext("2d")!, wd = new Uint8Array(128);
  (function wl() {
    if (dead) return; requestAnimationFrame(wl); wx.clearRect(0, 0, 150, 120); if (an) an.getByteTimeDomainData(wd);
    wx.strokeStyle = "#3dffa8"; wx.shadowColor = "#3dffa8"; wx.shadowBlur = 8; wx.lineWidth = 2; wx.beginPath();
    for (let i = 0; i < 50; i++) { const v = an ? Math.abs(wd[(i * 2.5) | 0] - 128) / 128 : 0, h = talking ? Math.max(2, v * 110) : 1.5 + Math.random() * 2, x = 4 + i * 2.9; wx.moveTo(x, 60 - h / 2); wx.lineTo(x, 60 + h / 2); }
    wx.stroke();
  })();
  const CH: { fx: any; eq: any; news: string[] } = { fx: null, eq: null, news: [] }; let chI = 0;
  function decode(e: HTMLElement, txt: string) { const C = "ABCDEF0123456789#$%&*"; const tb = performance.now(); (function f(n: number) { const u = Math.min(1, (n - tb) / 600); e.textContent = [...txt].map((ch, i) => (ch === " " || i / txt.length < u ? ch : C[Math.random() * C.length | 0])).join(""); if (u < 1) requestAnimationFrame(f); })(tb); }
  const SC: Record<number, string> = { 10: "1", 20: "2", 30: "3", 40: "4", 45: "5弱", 50: "5強", 55: "6弱", 60: "6強", 70: "7" };
  function chShow() {
    const box = $("chB"), i = chI++ % 4; $("chN").textContent = `CH ${i + 1}/4`;
    if (i === 0) {
      $("chT").textContent = "FX · 為替 (1 通貨 = 円)"; $("chS").textContent = "open.er-api.com";
      box.innerHTML = CH.fx ? `<div class="fx">${[["TWD", "台湾ドル"], ["HKD", "香港ドル"], ["USD", "米ドル"]].map(([k, n]) => `<b>${k}</b><i>${n}</i><span>${CH.fx[k] ? (1 / CH.fx[k]).toFixed(2) : "--"}</span>`).join("")}</div>` : `<div class="big1">データ取得中…</div>`;
    }
    if (i === 1) {
      $("chT").textContent = "QUAKE · 最新の地震"; $("chS").textContent = "P2P地震情報"; const q = CH.eq;
      box.innerHTML = q ? `<div class="big1" id="dc"></div><div class="sm1">${esc(String(q.time).slice(5, 16))} · M${q.mag ?? "-"} · 最大震度 ${SC[q.max] || "-"}</div>` : `<div class="big1">データ取得中…</div>`;
      if (q) decode($("dc"), q.place);
    }
    if (i === 2) {
      const now = new Date(), ss = sunset(now), mo = moon(now), m = Math.round((ss.getTime() - now.getTime()) / 60000);
      $("chT").textContent = "SKY · 日の入り / 月"; $("chS").textContent = "計算値";
      box.innerHTML = `<div class="big1">日の入り ${tfm(ss)} <span style="color:#3dffa8;font-size:15px">${m > 0 ? `あと ${m / 60 | 0}時間${m % 60}分` : "日没後"}</span></div><div class="big1" style="margin-top:4px">月齢 ${mo.age.toFixed(1)} · ${mo.n}</div>`;
    }
    if (i === 3) {
      $("chT").textContent = "NEWS · ニュース"; $("chS").textContent = "NHK ニュース";
      const n = CH.news.length ? CH.news[(chI / 4 | 0) % CH.news.length] : "";
      box.innerHTML = `<div class="big1" id="dc"></div>`; decode($("dc"), n || "NEWS FEED · STANDBY");
    }
  }
  async function loadFx() { try { CH.fx = await ext("fx"); } catch { /* */ } }
  async function loadNews() { try { CH.news = (await ext("news")) || []; } catch { /* */ } }
  async function loadEq() {
    try {
      const e = await ext("eq"); if (!e) return; CH.eq = e;
      const t = new Date(String(e.time).replace(/\//g, "-").replace(" ", "T") + "+09:00").getTime();
      if (e.max >= 30 && Date.now() - t < 30 * 60000 && !(loadEq as any).shown?.includes(e.time)) { (loadEq as any).shown = [...((loadEq as any).shown || []), e.time]; quake(); }
    } catch { /* */ }
  }
  function quake() {
    const q = CH.eq, E2 = $("eq"); E2.innerHTML = `<b>⚠ EARTHQUAKE</b><span>${esc(q.place)} · 最大震度 ${SC[q.max] || "-"}</span><small>M${q.mag ?? "-"} · ${esc(String(q.time).slice(5, 16))}</small>`;
    E2.classList.add("on"); setTimeout(() => E2.classList.remove("on"), 15000); tone(880, 0, 0.2, 0.08, "square"); tone(880, 0.3, 0.2, 0.08, "square");
  }
  async function loadWx() {
    try {
      const w = await ext("wx"); WXC = w.code; RAINY = RAIN.includes(w.code);
      const ar = "↓↙←↖↑↗→↘"[Math.round((w.dir ?? 0) / 45) % 8];
      $("wind").textContent = w.wind == null ? "BRIDGE WIND --" : `BRIDGE WIND ${ar} ${Number(w.wind).toFixed(1)} m/s${w.wind >= 10 ? " ⚠" : ""}`;
      if ($("s2").classList.contains("on")) toHome();
    } catch { $("wind").textContent = "BRIDGE WIND --"; }
  }
  function link() { const on = navigator.onLine; $("lkD").classList.toggle("off", !on); $("lkT").textContent = on ? "LINK ONLINE" : "LINK OFFLINE"; }
  window.addEventListener("online", link); window.addEventListener("offline", link); link();

  /* ---------------- 上空レーダー (関空から 40 km) ---------------- */
  const KIX: LL = [34.4347, 135.244], RKM = 40; let planes: any[] = [], live = false, sweep = 0;
  function sim() {
    const t = Date.now() / 1000;
    return ([["APJ143", "OKA", 45, 1], ["JAL226", "HND", 200, 1], ["CPA596", "HKG", 300, -1], ["EVA178", "TPE", 250, 1], ["ANA994", "NRT", 110, -1]] as [string, string, number, number][]).map(([c, o, b, dir], k) => {
      const r = (((t / 40 + k * 0.23) % 1) * 2 - 1) * 35 * dir, a = b * RAD;
      return { cs: c, from: o, lat: KIX[0] + Math.cos(a) * r / 111, lng: KIX[1] + Math.sin(a) * r / 91.5, alt: Math.round(Math.abs(r) * 95 + 300), hd: (b + (dir < 0 ? 180 : 0)) % 360, v: Math.round(380 + k * 30) };
    });
  }
  async function loadPl() { try { planes = (await ext("planes")) || []; live = true; } catch { live = false; } }
  const rc = $("rad") as HTMLCanvasElement, rx = rc.getContext("2d")!; let lastList = 0; const seenCs: Record<string, 1> = {};
  (function rl() {
    if (dead) return; requestAnimationFrame(rl); const P = live ? planes : sim(), c0 = 110, c1 = 95, R0 = 86; sweep = (sweep + 0.035) % (Math.PI * 2); rx.clearRect(0, 0, 220, 190);
    rx.strokeStyle = "rgba(61,255,168,.25)"; rx.lineWidth = 1; [1, 0.66, 0.33].forEach((f) => { rx.beginPath(); rx.arc(c0, c1, R0 * f, 0, 7); rx.stroke(); });
    rx.beginPath(); rx.moveTo(c0 - R0, c1); rx.lineTo(c0 + R0, c1); rx.moveTo(c0, c1 - R0); rx.lineTo(c0, c1 + R0); rx.stroke();
    const g = (rx as any).createConicGradient ? (rx as any).createConicGradient(sweep - Math.PI / 2, c0, c1) : null;
    if (g) { g.addColorStop(0, "rgba(61,255,168,.45)"); g.addColorStop(0.12, "rgba(61,255,168,0)"); g.addColorStop(1, "rgba(61,255,168,0)"); rx.fillStyle = g; rx.beginPath(); rx.arc(c0, c1, R0, 0, 7); rx.fill(); }
    rx.fillStyle = "#fff"; rx.font = "bold 9px Menlo,monospace"; rx.fillText("KIX", c0 + 4, c1 - 4); rx.fillRect(c0 - 2, c1 - 2, 4, 4);
    const pxy = (la: number, ln: number) => [c0 + (ln - KIX[1]) * 91.5 / RKM * R0, c1 - (la - KIX[0]) * 111 / RKM * R0] as [number, number];
    const b1 = pxy(BM[0], BM[1]), b2 = pxy(BI[0], BI[1]); rx.strokeStyle = "rgba(95,227,255,.7)"; rx.lineWidth = 2; rx.beginPath(); rx.moveTo(...b1); rx.lineTo(...b2); rx.stroke();
    const me = curLL(), mp = pxy(me[0], me[1]); if (Math.hypot(mp[0] - c0, mp[1] - c1) < R0) { rx.fillStyle = "#ffb020"; rx.beginPath(); rx.arc(mp[0], mp[1], 3, 0, 7); rx.fill(); }
    for (const p of P) {
      const [x, y] = pxy(p.lat, p.lng); if (Math.hypot(x - c0, y - c1) > R0) continue;
      rx.save(); rx.translate(x, y); rx.rotate(p.hd * RAD); rx.fillStyle = "#e8fff4"; rx.shadowColor = "#3dffa8"; rx.shadowBlur = 8; rx.beginPath(); rx.moveTo(0, -6); rx.lineTo(4, 5); rx.lineTo(0, 3); rx.lineTo(-4, 5); rx.fill(); rx.restore();
      rx.fillStyle = "rgba(200,255,230,.85)"; rx.font = "8px Menlo,monospace"; rx.fillText(p.cs, x + 6, y - 2);
    }
    $("radS").textContent = live ? `LIVE · ${P.length} AC` : "SIM"; $("radSrc").textContent = live ? "opensky-network.org" : "※ 取得できないためシミュレーション表示";
    if (performance.now() - lastList > 2000) {
      lastList = performance.now();
      const L2 = P.map((p) => ({ ...p, d: Math.hypot((p.lat - KIX[0]) * 111, (p.lng - KIX[1]) * 91.5) })).filter((p) => p.d < RKM).sort((a, b) => a.d - b.d).slice(0, 3);
      $("fl").innerHTML = L2.map((p) => `<div class="${seenCs[p.cs] ? "" : "nw"}"><b>${esc(p.cs)}</b><span>${p.d.toFixed(1)} km</span><small>${p.from ? esc(p.from) + " · " : ""}高度 ${p.alt.toLocaleString()} m · ${p.v} km/h</small></div>`).join("") || `<div><b>NO CONTACT</b><small>周辺に飛行機はいません</small></div>`;
      L2.forEach((p) => (seenCs[p.cs] = 1));
    }
  })();

  /* ---------------- 画面を消さない (ミッション中) ---------------- */
  let wl2: any = null;
  function wakeLock(on: boolean) { try { if (on && !wl2 && (navigator as any).wakeLock) (navigator as any).wakeLock.request("screen").then((w: any) => (wl2 = w)).catch(() => {}); if (!on && wl2) { wl2.release(); wl2 = null; } } catch { /* */ } }
  const vis = () => { if (document.visibilityState === "visible" && phase && phase !== "done") { wl2 = null; wakeLock(true); } };
  document.addEventListener("visibilitychange", vis);

  async function refresh() { const r = await api(""); if (r.ok) { S = { ...S, ...r }; loadBgm(); } }
  loadBgm(); $("limT").textContent = `LIMIT ${cfg.limit}`; $("qm").classList.toggle("on", cfg.quiet);
  void loadFx(); void loadEq(); void loadPl(); void loadWx(); void loadNews(); chShow();
  every(8000, chShow); every(20000, () => void loadPl()); every(60000, () => void loadEq()); every(600000, () => { void loadWx(); void loadNews(); }); every(3600000, () => void loadFx());
  every(2000, () => { if ($("st").classList.contains("on")) renderSet(); });
  every(200, lyTick);
  const onR = () => resize(); window.addEventListener("resize", onR);

  return {
    resize,
    destroy() {
      dead = true; timers.forEach(clearInterval); clearInterval(pressT); if (synT) clearInterval(synT); el.pause(); Object.values(trk).forEach((a) => a.pause());
      if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch); window.removeEventListener("resize", onR); document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("online", link); window.removeEventListener("offline", link); wakeLock(false); map.remove(); pmap?.remove();
    },
  };
}
