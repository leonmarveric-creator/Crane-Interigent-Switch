"use client";

/**
 * 車内の音楽 (お迎え用／お見送り用 × 言語) と歌詞。
 *   ・曲は Supabase Storage。「この端末に保存」でスマホ本体 (Cache Storage) に入れ、次からはそこから再生 (ギガを使わない)
 *   ・歌詞 (LRC) はプレイヤーに 3 行で表示。設定でオンにすると車の「再生中」画面の曲名欄にも出す
 *   ・歌詞を付ける: LRC ファイル / 曲を流して作る / タイミング調整 (1 行ずつ・全体・録り直し)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriverTrack } from "@/lib/driverData";
import { parseLrc, toLrc, lyricIndex, decodeLrcBytes, type LrcLine } from "@/lib/driverLogic";
import { sfx, vib } from "@/lib/driverSfx";
import { driverAddTrack, driverDeleteTrack, driverReorderTracks, driverTrackUploadUrl, driverUpdateTrack, driverCoverUploadUrl, driverSetCover } from "@/app/driver/actions";
import { compressCover, mp3Cover } from "@/lib/driverCover";

export type MLang = "ja" | "en" | "zh" | "ko";
export const MLANGS: Record<MLang, string> = { ja: "日本語", en: "English", zh: "中文", ko: "한국어" };
const CACHE = "driver-music-v1";
type T = (s: string, v?: Record<string, string | number>) => string;

async function cachedUrl(url: string): Promise<string> {
  try {
    if (!("caches" in window)) return url;
    const c = await caches.open(CACHE); const r = await c.match(url);
    if (!r) return url;
    return URL.createObjectURL(await r.blob());
  } catch { return url; }
}

export function useDriverMusic(initial: DriverTrack[], t: T, toast: (s: string) => void, auto: { in: MLang; out: MLang }) {
  const [tracks, setTracks] = useState<DriverTrack[]>(initial);
  const [cur, setCur] = useState<{ p: "in" | "out"; l: MLang; i: number }>({ p: "in", l: auto.in, i: 0 });
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [lyrOnCar, setLyrOnCar] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const audio = useRef<HTMLAudioElement | null>(null);   // 画面がついているとき (Web Audio で音量を下げられる)
  const plain = useRef<HTMLAudioElement | null>(null);   // 画面が消えているとき (iPhone は Web Audio が止まるため)
  const onPlain = useRef(false);
  const graph = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const blobUrl = useRef<string | null>(null);
  const fade = useRef<number>(0);
  const vol = useRef(0.8);
  const level = useRef(0.8); // 今の音量 (0〜1)
  const boost = useRef<{ url: string | null; pos: number; wasPlaying: boolean; bid?: string; at: number } | null>(null); // 高速モード中 (元の曲の位置)
  const switching = useRef(false); // BOOST の曲の入れ替え中 (この間は声で音量を下げない。下げるとフェードが途中で止まって曲が戻らなくなる)
  const boostSafety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duckWanted = useRef(false); // 声が流れている (音楽を小さくしたい)
  /** 曲の入れ替えが終わったら、今の声の状態に合わせた音量へ */
  const settle = () => { switching.current = false; if (!el().paused) fadeTo(duckWanted.current ? vol.current * 0.2 : vol.current, 900); };
  /** 手で曲を選んだときなど: 高速モードをやめる (次の橋でまた BOOST の曲が流れるように) */
  const dropBoost = () => { if (!boost.current) return; boost.current = null; switching.current = false; el().loop = false; if (boostSafety.current) clearTimeout(boostSafety.current); boostSafety.current = null; };

  useEffect(() => { setTracks(initial); }, [initial]);
  useEffect(() => { try { setLyrOnCar(localStorage.getItem("drvLyrCar") === "1"); } catch { /* ignore */ } }, []);
  // 保存済みの曲
  const refreshSaved = useCallback(async () => {
    try { if (!("caches" in window)) return; const c = await caches.open(CACHE); const keys = await c.keys(); setSaved(new Set(keys.map((k) => k.url))); } catch { /* ignore */ }
  }, []);
  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  const list = useMemo(() => tracks.filter((x) => x.purpose === cur.p && x.lang === cur.l).sort((a, b) => a.sort - b.sort), [tracks, cur.p, cur.l]);
  const track = list[cur.i] ?? null;
  const lrc = useMemo<LrcLine[]>(() => parseLrc(track?.lrc), [track?.lrc]);
  const li = lyricIndex(lrc, pos);

  const listeners = useRef<{ ended?: () => void }>({});
  const make = (routed: boolean) => {
    const a = new Audio(); a.preload = "auto";
    if (routed) a.crossOrigin = "anonymous"; // Web Audio に通すため (Supabase は CORS OK)
    const mine = () => el() === a;
    a.addEventListener("timeupdate", () => { if (mine()) setPos(a.currentTime); });
    a.addEventListener("loadedmetadata", () => { if (mine()) setDur(a.duration || 0); });
    a.addEventListener("play", () => { if (mine()) setPlaying(true); });
    a.addEventListener("pause", () => { if (mine()) setPlaying(false); });
    a.addEventListener("ended", () => { if (mine()) listeners.current.ended?.(); });
    return a;
  };
  const main = () => (audio.current ??= make(true));
  const plainEl = () => (plain.current ??= make(false));
  /** 今鳴らしている audio 要素 */
  const el = (): HTMLAudioElement => (onPlain.current ? plainEl() : main());
  /** 音量を変える: Web Audio に通していればゲイン (iPhone でも効く)、そうでなければ volume */
  const setLevel = (v: number) => {
    level.current = Math.max(0, Math.min(1, v));
    if (!onPlain.current && graph.current) { graph.current.gain.gain.value = level.current; main().volume = 1; }
    else el().volume = level.current;
  };
  /** タップの中で呼ぶ: Web Audio をつなぎ (1 回だけ)、2 つの audio 要素を後から鳴らせるようにしておく (iPhone 用) */
  const prime = () => {
    try {
      if (!graph.current) {
        const C = window.AudioContext || (window as any).webkitAudioContext;
        if (C) {
          const ctx: AudioContext = new C(); const gain = ctx.createGain();
          ctx.createMediaElementSource(main()).connect(gain); gain.connect(ctx.destination);
          graph.current = { ctx, gain }; gain.gain.value = level.current;
        }
      }
      if (graph.current && graph.current.ctx.state !== "running") void graph.current.ctx.resume();
    } catch { graph.current = null; }
    for (const x of [main(), plainEl()]) {
      if (x.dataset.primed || x.src) continue;
      x.dataset.primed = "1"; x.muted = true; x.src = "/audio/driver/prep.mp3";
      x.play().then(() => { x.pause(); x.muted = false; }).catch(() => { x.muted = false; });
    }
  };
  /** 再生の前: Web Audio が止まっていたら動かす */
  const route = () => { if (graph.current && graph.current.ctx.state !== "running") void graph.current.ctx.resume(); };
  // 画面が消えたら普通の再生へ、ついたら Web Audio の再生へ (続きの位置から)
  useEffect(() => {
    const swap = () => {
      const m = main(), p = plainEl();
      if (!graph.current) return;
      if (document.visibilityState === "hidden" && !onPlain.current && !m.paused) {
        const at = m.currentTime;
        if (p.src !== m.src) p.src = m.src;
        p.volume = level.current;
        const go = () => { try { p.currentTime = at; } catch { /* ignore */ } p.play().then(() => { onPlain.current = true; m.pause(); }).catch(() => { /* そのまま */ }); };
        if (p.readyState >= 1) go(); else p.addEventListener("loadedmetadata", go, { once: true });
      } else if (document.visibilityState === "visible" && onPlain.current) {
        const at = p.currentTime, wasPlaying = !p.paused;
        const back = () => {
          try { m.currentTime = at; } catch { /* ignore */ }
          onPlain.current = false; graph.current!.gain.gain.value = level.current;
          if (!wasPlaying) { p.pause(); setPlaying(false); return; }
          void graph.current!.ctx.resume();
          m.play().then(() => { p.pause(); setPlaying(true); }).catch(() => { onPlain.current = true; });
        };
        if (m.src !== p.src) { m.src = p.src; m.addEventListener("loadedmetadata", back, { once: true }); } else back();
      }
    };
    document.addEventListener("visibilitychange", swap);
    return () => document.removeEventListener("visibilitychange", swap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeTo = (v: number, ms: number, done?: () => void) => {
    const st = level.current, t0 = performance.now(); const id = ++fade.current;
    const f = (n: number) => { if (id !== fade.current) return; const p = Math.min(1, (n - t0) / ms); setLevel(st + (v - st) * p); if (p < 1) requestAnimationFrame(f); else done?.(); };
    requestAnimationFrame(f);
  };
  const load = useCallback(async (tr: DriverTrack | null, play: boolean) => {
    const a = el();
    if (!tr) { a.pause(); return; }
    if (blobUrl.current) { URL.revokeObjectURL(blobUrl.current); blobUrl.current = null; }
    const src = await cachedUrl(tr.url);
    if (src.startsWith("blob:")) blobUrl.current = src;
    a.src = src; setPos(0);
    if (play) { route(); setLevel(0.05); a.play().then(() => fadeTo(vol.current, 2000)).catch(() => {}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 曲が終わったら次へ
  listeners.current.ended = () => setCur((c) => ({ ...c, i: list.length ? (c.i + 1) % list.length : 0 }));
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (track?.id === lastId.current) return;
    lastId.current = track?.id ?? null;
    void load(track, playing);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  // 車の「再生中」画面 (曲名・歌手・歌詞) と、ハンドルのボタン
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    const line = lyrOnCar && li >= 0 ? lrc[li]?.s : "";
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: line ? `♪ ${line}` : track.title,
        artist: line ? `${track.title} ─ ${track.artist || "Crane Nest"}` : track.artist || "Crane Nest",
        album: "HIROSHI DRIVE",
        artwork: track.cover ? [{ src: track.cover, sizes: "800x800", type: track.cover.endsWith(".webp") ? "image/webp" : "image/jpeg" }] : [{ src: "/driver/icon.png", sizes: "512x512", type: "image/png" }],
      });
    } catch { /* ignore */ }
  }, [track, li, lyrOnCar, lrc]);
  // ハンドル・CarPlay・ロック画面のボタン (再生・一時停止・次・前・10 秒・位置)
  const apiRef = useRef<any>(null);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (k: MediaSessionAction, fn: MediaSessionActionHandler | null) => { try { ms.setActionHandler(k, fn); } catch { /* 未対応 */ } };
    set("play", () => apiRef.current?.play());
    set("pause", () => apiRef.current?.pause());
    set("nexttrack", () => apiRef.current?.next());
    set("previoustrack", () => apiRef.current?.prev());
    set("seekbackward", (d) => apiRef.current?.skip(-(d.seekOffset || 10)));
    set("seekforward", (d) => apiRef.current?.skip(d.seekOffset || 10));
    set("seekto", (d) => { if (typeof d.seekTime === "number") apiRef.current?.seek(d.seekTime); });
  }, []);
  useEffect(() => {
    try { if ("mediaSession" in navigator && dur > 0) navigator.mediaSession.setPositionState({ duration: dur, position: Math.min(pos, dur), playbackRate: 1 }); } catch { /* ignore */ }
  }, [pos, dur]);
  const api = {
    tracks, setTracks, cur, list, track, playing, pos, dur, lrc, li, lyrOnCar, saved,
    play() { sfx.prime(); prime(); const a = el(); if (!track) { toast(t("この言語の曲はまだありません。設定から追加できます。")); return; } if (!a.src) void load(track, true); else { route(); setLevel(0.05); a.play().then(() => fadeTo(vol.current, 1500)).catch(() => {}); } },
    pause() { el().pause(); },
    toggle() { playing ? api.pause() : api.play(); },
    next() { const i = list.length ? (cur.i + 1) % list.length : 0; if (boost.current) return api.pick(i); setCur((c) => ({ ...c, i: list.length ? (c.i + 1) % list.length : 0 })); },
    prev() { if (boost.current) return api.pick(cur.i); const a = el(); if (a.currentTime > 3) a.currentTime = 0; else setCur((c) => ({ ...c, i: list.length ? (c.i - 1 + list.length) % list.length : 0 })); },
    pick(i: number) {
      prime();
      // BOOST の曲の最中に手で選んだ → 高速モードをやめて、選んだ曲をすぐ流す (同じ曲でも読み込み直す)
      if (boost.current) { dropBoost(); const tr = list[i] ?? null; lastId.current = tr?.id ?? null; setCur((c) => ({ ...c, i })); void load(tr, true); return; }
      setCur((c) => ({ ...c, i })); if (!playing) setTimeout(() => api.play(), 50); },
    setPlaylist(p: "in" | "out", l: MLang, play = false) { if (play) prime(); dropBoost(); lastId.current = null; setCur({ p, l, i: 0 }); if (play) setTimeout(() => { route(); el().play().catch(() => {}); }, 120); },
    startWith(p: "in" | "out", l: MLang) { dropBoost(); lastId.current = null; const L = tracks.filter((x) => x.purpose === p && x.lang === l); setCur({ p, l, i: 0 }); if (L.length) { const tr = L.sort((a, b) => a.sort - b.sort)[0]; lastId.current = tr.id; void load(tr, true); } },
    /** アンドロイドの声の間は音楽を 20% に (声が終わったらゆっくり戻す) */
    /** タップの中で呼ぶ (あとで自動で流すときのため) */
    prime,
    duck(on: boolean) { duckWanted.current = on; if (!playing || switching.current) return; fadeTo(on ? vol.current * 0.2 : vol.current, on ? 300 : 900); },
    /** 高速モード (スカイゲートブリッジ): 今の曲を止めて「⚡ BOOST 用」の曲を開始位置から。iPad の点火に合わせて少し待つ */
    boostIn(delayMs = 5000): boolean {
      // 前の BOOST が終わらずに残っていたら (10 分以上前) 片付けてから
      if (boost.current && Date.now() - boost.current.at > 600000) dropBoost();
      const B = tracks.filter((x) => x.purpose === "boost"); if (!B.length || boost.current) return false;
      const tr = B[Math.floor(Math.random() * B.length)]; const a0 = el();
      const me = { url: track?.url ?? null, pos: a0.currentTime, wasPlaying: playing, bid: tr.id, at: Date.now() }; boost.current = me;
      switching.current = true;
      // 今の曲を小さくして止める (フェードの終わりを待たずに時間で)。ブースト開始のセリフに合わせるときは短く
      const outMs = Math.max(250, Math.min(900, delayMs - 50));
      if (playing) { fadeTo(0, outMs); setTimeout(() => { if (boost.current === me && !el().loop) a0.pause(); }, outMs + 20); }
      setTimeout(async () => {
        if (boost.current !== me) return; const a = el(); const src = await cachedUrl(tr.url);
        a.loop = true; a.src = src; const go = () => { try { a.currentTime = tr.startSec || 0; } catch { /* ignore */ } route(); setLevel(0.05); a.play().then(() => fadeTo(duckWanted.current ? vol.current * 0.2 : vol.current, 1500)).catch(() => {}); setTimeout(settle, 1600); };
        if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
      }, Math.max(outMs + 30, delayMs));
      // 念のため: 橋の終わりが分からなくても 8 分で元の曲へ戻す
      if (boostSafety.current) clearTimeout(boostSafety.current);
      boostSafety.current = setTimeout(() => { if (boost.current === me) apiRef.current?.boostOut(); }, 480000);
      return true;
    },
    /** 高速モードが終わったら、元の曲の続きへ */
    boostOut() {
      const b = boost.current; if (!b) return;
      if (boostSafety.current) clearTimeout(boostSafety.current); boostSafety.current = null;
      switching.current = true;
      // フェードは見た目 (音量) だけ。曲の入れ替えは時間で必ず行う (途中で声が入ってフェードが止まっても戻れるように)
      setTimeout(() => fadeTo(0, 1800), 200);
      setTimeout(async () => {
        if (boost.current !== b) return;
        const a = el(); a.pause(); a.loop = false; boost.current = null;
        if (!b.url) { setLevel(vol.current); switching.current = false; return; }
        a.src = await cachedUrl(b.url);
        const go = () => { try { a.currentTime = b.pos; } catch { /* ignore */ } if (b.wasPlaying) { route(); setLevel(0.05); a.play().then(() => fadeTo(duckWanted.current ? vol.current * 0.2 : vol.current, 1500)).catch(() => {}); } else setLevel(vol.current); setTimeout(settle, 1600); };
        if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
      }, 2100);
    },
    /** 車内 iPad に送る「今流れている曲」(歌詞を合わせる用)。止まっていて曲も無ければ null */
    nowPlaying(): { id: string; pos: number; dur: number; on: boolean } | null {
      const a = el(), b = boost.current;
      const id = b?.bid && !a.paused && a.loop ? b.bid : track?.id; if (!id) return null;
      if (a.paused && (a.currentTime || 0) < 1) return null; // まだ流していない (止めて最初に戻した) ときは iPad に出さない
      return { id, pos: a.currentTime || 0, dur: isFinite(a.duration) ? a.duration : 0, on: !a.paused };
    },
    /** 車内 iPad の再生ボタンから (ゲストが押す) */
    remote(c: "toggle" | "next" | "prev" | "seek" | "duck", v: number | null) {
      // 車内 iPad の AI が話す間は音楽を下げる
      if (c === "duck") { if (!playing) return; api.duck(true); setTimeout(() => apiRef.current?.duck(false), Math.max(1, v ?? 10) * 1000); return; }
      if (boost.current) return; // 高速モード中は触らない
      if (c === "toggle") api.toggle(); else if (c === "next") api.next(); else if (c === "prev") api.prev(); else if (c === "seek" && v != null) api.seek(v);
    },
    /** 高速モード (BOOST の曲) の最中か */
    inBoost: () => !!boost.current,
    fadeOut() { if (!playing) return; fadeTo(0, 3500, () => { el().pause(); setLevel(vol.current); }); },
    seek(s: number) { const a = el(); a.currentTime = Math.max(0, Math.min((a.duration || s + 1) - 0.3, s)); setPos(a.currentTime); },
    skip(d: number) { api.seek(el().currentTime + d); },
    setLyrOnCar(v: boolean) { setLyrOnCar(v); try { localStorage.setItem("drvLyrCar", v ? "1" : "0"); } catch { /* ignore */ } },
    /** 全部の曲をこの端末に保存 */
    async saveOffline(onProgress: (d: number, n: number) => void) {
      if (!("caches" in window)) { toast(t("このブラウザは保存に対応していません")); return; }
      const c = await caches.open(CACHE); const urls = tracks.flatMap((x) => [x.url, x.cover].filter(Boolean) as string[]); let d = 0;
      for (const u of urls) {
        try { if (!(await c.match(u))) { const r = await fetch(u, { mode: "cors" }); if (r.ok) await c.put(u, r); } } catch { /* 次へ */ }
        onProgress(++d, urls.length);
      }
      // 消した曲は保存からも消す
      for (const k of await c.keys()) if (!urls.includes(k.url)) await c.delete(k);
      await refreshSaved();
    },
    async clearOffline() { try { await caches.delete(CACHE); } catch { /* ignore */ } await refreshSaved(); },
  };
  apiRef.current = api;
  return api;
}
export type Music = ReturnType<typeof useDriverMusic>;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** カバー画像 (この端末に保存してあればそこから)。なければお迎え用・お見送り用の色の絵 (画像ファイルなし) */
export function CoverArt({ track, p, className }: { track: DriverTrack | null; p: "in" | "out"; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true, blob: string | null = null;
    setSrc(track?.cover ?? null);
    if (track?.cover) void cachedUrl(track.cover).then((u) => { if (!live) { if (u.startsWith("blob:")) URL.revokeObjectURL(u); return; } if (u.startsWith("blob:")) blob = u; setSrc(u); });
    return () => { live = false; if (blob) URL.revokeObjectURL(blob); };
  }, [track?.cover]);
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <div className={`cover ${className ?? ""}`}><img src={src} alt="" onError={() => setSrc(null)} /></div>;
  const [a, b, c] = p === "in" ? ["#1c5fc4", "#6fb6ff", "#ffd199"] : ["#e0621c", "#ffb35c", "#7a3fb8"];
  const id = `cv${p}`;
  return (
    <div className={`cover ${className ?? ""}`}>
      <svg viewBox="0 0 300 300"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset=".6" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient></defs>
        <rect width="300" height="300" fill={`url(#${id})`} /><circle cx="150" cy="160" r="52" fill="#fff" opacity=".85" /><rect y="170" width="300" height="130" fill="#0b1424" opacity=".85" />
        <path d="M150 170 L60 300 L240 300 Z" fill="#1b2638" /><path d="M150 176 L150 300" stroke="#ffe7a8" strokeWidth="5" strokeDasharray="16 18" />
        <text x="20" y="44" fill="#fff" fontSize="22" fontWeight="700" letterSpacing="3" fontFamily="Rajdhani,Helvetica,Arial">{p === "in" ? "WELCOME" : "SEE YOU"}</text>
        <text x="20" y="66" fill="#fff" opacity=".7" fontSize="12" letterSpacing="4" fontFamily="Helvetica,Arial">HIROSHI DRIVE</text></svg>
    </div>
  );
}

/** 進み具合のバー (タップ・ドラッグで好きな位置へ) */
function SeekBar({ m, className }: { m: Music; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
  const pc = drag ?? (m.dur ? m.pos / m.dur : 0);
  return (
    <div ref={ref} className={`seek ${className ?? ""}`}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(at(e)); }}
      onPointerMove={(e) => { if (drag !== null) setDrag(at(e)); }}
      onPointerUp={(e) => { const x = at(e); setDrag(null); if (m.dur) m.seek(x * m.dur); }}
      onPointerCancel={() => setDrag(null)}>
      <i style={{ width: `${pc * 100}%` }} /><b style={{ left: `${pc * 100}%` }} />
    </div>
  );
}

/** 全画面 (アルバムカバー + 歌詞)。iPhone は音楽中に横にすると自動で開き、縦に戻すと閉じる。iPad はボタンで */
export function useMusicFull(m: Music) {
  const [manual, setManual] = useState(false);
  const [phoneLand, setPhoneLand] = useState(false);
  const [closed, setClosed] = useState(false); // 横のまま ✕ で閉じたら、縦に戻すまで出さない
  useEffect(() => {
    const q = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
    const f = () => { setPhoneLand(q.matches); setClosed(false); }; f();
    q.addEventListener?.("change", f);
    return () => q.removeEventListener?.("change", f);
  }, []);
  const open = manual || (phoneLand && m.playing && !closed);
  // 開いている間は画面を消さない
  useEffect(() => {
    if (!open || !("wakeLock" in navigator)) return;
    let lock: any = null, live = true;
    const get = () => (navigator as any).wakeLock.request("screen").then((l: any) => { if (live) lock = l; else l.release(); }).catch(() => {});
    void get();
    const vis = () => { if (document.visibilityState === "visible") void get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; document.removeEventListener("visibilitychange", vis); lock?.release?.().catch?.(() => {}); };
  }, [open]);
  return { open, phoneLand, show: () => setManual(true), hide: () => { setManual(false); setClosed(true); } };
}
export function MusicFull({ m, t, full }: { m: Music; t: T; full: ReturnType<typeof useMusicFull> }) {
  const L = m.lrc, i = m.li;
  const box = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = inner.current?.children[Math.max(0, i)] as HTMLElement | undefined;
    if (inner.current) inner.current.style.transform = p ? `translateY(${-(p.offsetTop + p.offsetHeight / 2)}px)` : "none";
  }, [i, L, full.open]);
  if (!full.open) return null;
  return (
    <div className="mfull" ref={box}><div className="mf-in">
      <div className="mf-blur"><CoverArt track={m.track} p={m.cur.p} /></div>
      <button className="mf-x" onClick={() => { sfx.blip(); full.hide(); }} aria-label="close">✕</button>
      {full.phoneLand ? <div className="mf-tip">{t("スマホを縦にすると元の画面に戻ります")}</div> : null}
      <CoverArt track={m.track} p={m.cur.p} className="mf-cover" />
      <div className="mf-ly">
        {L.length ? (
          <div className="in" ref={inner}>{L.map((l, k) => <p key={k} className={k === i ? "now" : ""} onClick={() => { sfx.tick(); m.seek(l.t); }}>{l.s}</p>)}</div>
        ) : <div className="none">{m.track ? t("歌詞なし") : t("曲がありません")}</div>}
      </div>
      <div className="mf-bot">
        <div className="tt"><b>{m.track?.title ?? "—"}</b><small>{m.track ? `${m.track.artist || "Crane Nest"}・${m.cur.i + 1} / ${m.list.length}` : ""}</small></div>
        <div className="pw"><SeekBar m={m} /><div className="mtime"><span>{fmt(m.pos)}</span><span>{fmt(m.dur)}</span></div></div>
        <div className="ctl">
          <button onClick={() => { sfx.blip(); m.prev(); }}>⏮</button>
          <button onClick={() => m.skip(-10)}>↺<small>10</small></button>
          <button className="pp" onClick={() => { sfx.blip(); m.toggle(); }}>{m.playing ? "⏸" : "▶"}</button>
          <button onClick={() => m.skip(10)}>↻<small>10</small></button>
          <button onClick={() => { sfx.blip(); m.next(); }}>⏭</button>
        </div>
      </div>
    </div></div>
  );
}

/** ホームのプレイヤー */
export function MusicPlayer({ m, t, onOpen, onArrive, onFull }: { m: Music; t: T; onOpen: () => void; onArrive: () => void; onFull: () => void }) {
  const L = m.lrc, i = m.li;
  return (
    <div className={`mplayer ${m.playing ? "on" : ""}`}>
      <div className="mpl-top">
        <button className="mchip" onClick={() => { sfx.blip(); onOpen(); }}>{m.cur.p === "in" ? "🛬 " + t("お迎え") : "🛫 " + t("お見送り")}・{MLANGS[m.cur.l]} ›</button>
        <button className="mbtn" onClick={onArrive} title="arrive">🏁</button>
        <button className="mbtn fs" onClick={() => { sfx.blip(); onFull(); }}>⛶ {t("全画面")}</button>
      </div>
      <div className="mpl-row">
        <CoverArt track={m.track} p={m.cur.p} className="mart" />
        <div className="nm"><b>{m.track?.title ?? t("曲がありません")}</b><small>{m.track ? `${m.track.artist || "Crane Nest"}・${m.cur.i + 1} / ${m.list.length}` : t("設定から曲を追加してください")}</small></div>
        <div className="eq"><i /><i /><i /></div>
      </div>
      <div className={`mlyr ${L.length ? "has" : ""}`}>
        <p>{L[i - 1]?.s ?? ""}</p>
        <p key={i} className="now">{L.length ? (L[i]?.s ?? "♪") : t("歌詞なし")}</p>
        <p>{L[i + 1]?.s ?? ""}</p>
      </div>
      <SeekBar m={m} className="mbar" />
      <div className="mtime"><span>{fmt(m.pos)}</span><span>{fmt(m.dur)}</span></div>
      <div className="mctl five">
        <button onClick={() => { sfx.blip(); m.prev(); }}>⏮</button>
        <button onClick={() => m.skip(-10)}>↺<small>10</small></button>
        <button className="pp" onClick={() => { sfx.blip(); m.toggle(); }}>{m.playing ? "⏸" : "▶"}</button>
        <button onClick={() => m.skip(10)}>↻<small>10</small></button>
        <button onClick={() => { sfx.blip(); m.next(); }}>⏭</button>
      </div>
    </div>
  );
}

/** プレイリストを選ぶシート */
export function MusicSheet({ m, t, open, onClose, autoLang, autoWho, onAdmin }: { m: Music; t: T; open: boolean; onClose: () => void; autoLang: { in: MLang; out: MLang }; autoWho: { in: string; out: string }; onAdmin: () => void }) {
  const count = (p: string, l: string) => m.tracks.filter((x) => x.purpose === p && x.lang === l).length;
  return (
    <>
      <div className={`sheet-bg ${open ? "show" : ""}`} onClick={onClose} />
      <div className={`sheet ${open ? "show" : ""}`}>
        <h4>🎵 {t("車内の音楽")}</h4>
        <div className="segsw small">
          {(["in", "out"] as const).map((p) => <button key={p} className={m.cur.p === p ? "on" : ""} onClick={() => { sfx.tick(); m.setPlaylist(p, autoLang[p], m.playing); }}>{p === "in" ? "🛬 " + t("お迎え用") : "🛫 " + t("お見送り用")}</button>)}
        </div>
        <div className="mlangs">
          {(Object.keys(MLANGS) as MLang[]).map((l) => <button key={l} className={m.cur.l === l ? "on" : ""} onClick={() => { sfx.tick(); m.setPlaylist(m.cur.p, l, m.playing); }}>{MLANGS[l]}<em>{count(m.cur.p, l)}</em>{autoLang[m.cur.p] === l && <i>{t("自動")}</i>}</button>)}
        </div>
        <p className="mauto">{t("次のゲスト")}: {autoWho[m.cur.p] || "—"} → {MLANGS[autoLang[m.cur.p]]}</p>
        <div className="auto"><button className={`sw ${m.lyrOnCar ? "on" : ""}`} onClick={() => { sfx.blip(); m.setLyrOnCar(!m.lyrOnCar); }} />{t("車の「再生中」画面に歌詞を出す")}</div>
        <div className="mlist">
          {m.list.length ? m.list.map((tr, i) => (
            <button key={tr.id} className={`mrow ${i === m.cur.i ? "on" : ""}`} onClick={() => m.pick(i)}>
              <span className="n">{i === m.cur.i && m.playing ? "▶" : i + 1}</span>
              <span className="t"><b>{tr.title}</b><small>{tr.artist || "Crane Nest"}{m.saved.has(tr.url) ? " ・ " + t("保存済み") : ""}</small></span>
              {tr.lrc ? <span className="ltag">{t("歌詞")}</span> : null}
            </button>
          )) : <p className="note">{t("この言語の曲はまだありません。設定から追加できます。")}</p>}
        </div>
        <button className="linkbtn" onClick={onAdmin}>{t("曲の追加・削除（設定）")} ›</button>
      </div>
    </>
  );
}

/** 設定: 音楽の管理 */
export function MusicAdmin({ m, t, toast, autoLang }: { m: Music; t: T; toast: (s: string) => void; autoLang: { in: MLang; out: MLang } }) {
  const [p, setP] = useState<"in" | "out" | "boost">("in");
  const [l, setL] = useState<MLang>(autoLang.in);
  const [busy, setBusy] = useState("");
  const [ly, setLy] = useState<DriverTrack | null>(null);
  const [prog, setProg] = useState<string>("");
  const L = m.tracks.filter((x) => x.purpose === p && (p === "boost" || x.lang === l)).sort((a, b) => a.sort - b.sort);
  const count = (pp: string, ll: string) => m.tracks.filter((x) => x.purpose === pp && x.lang === ll).length;
  const upd = (id: string, patch: Partial<DriverTrack>) => m.setTracks((ts) => ts.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const [cv, setCv] = useState<DriverTrack | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  /** カバーを 800×800 に縮めてアップロード (元の画像は保存しない) */
  const saveCover = async (trackId: string, img: Blob, quiet = false): Promise<boolean> => {
    const c = await compressCover(img); if (!c) { if (!quiet) toast(t("画像を読み込めませんでした")); return false; }
    const u = await driverCoverUploadUrl(trackId, c.ext); if (!u.ok) { if (!quiet) toast(t("アップロードできませんでした")); return false; }
    const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": c.blob.type, "x-upsert": "false" }, body: c.blob }).catch(() => null);
    if (!put?.ok) { if (!quiet) toast(t("アップロードできませんでした")); return false; }
    const r = await driverSetCover(trackId, u.path);
    if (!r.ok) { if (!quiet) toast(r.error === "SETUP_COVER" ? t("カバーを保存するには、Supabase の SQL（migration_cabin_music.sql）を実行してください") : t("保存できませんでした") + "：" + r.error.slice(0, 60)); return false; }
    upd(trackId, { cover: r.url }); setCv((x) => (x && x.id === trackId ? { ...x, cover: r.url } : x));
    if (!quiet) { sfx.chord(); toast(t("カバーを保存しました（{k}KB）", { k: Math.max(1, Math.round(c.blob.size / 1024)) })); }
    return true;
  };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    // 失敗したときは理由を出す (SQL 未実行・ファイルが大きすぎる など)
    const why = (e: string | number) => {
      const s = String(e);
      if (/bucket|not.?found|does not exist|relation|driver_tracks|schema cache/i.test(s)) return t("先に Supabase の SQL（migration_driver.sql）を実行してください");
      if (/413|too large|exceeded|maximum/i.test(s)) return t("ファイルが大きすぎます（50MB まで）");
      if (/UNAUTHORIZED/.test(s)) return t("ログインし直してください");
      return s.slice(0, 80);
    };
    let added = 0;
    for (const f of Array.from(files)) {
      setBusy(t("アップロード中…") + " " + f.name);
      const u = await driverTrackUploadUrl(f.name);
      if (!u.ok) { toast(t("アップロードできませんでした") + "：" + why(u.error)); continue; }
      const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": f.type || "audio/mpeg", "x-upsert": "false" }, body: f }).catch((e) => String(e));
      if (typeof put === "string" || !put.ok) {
        const detail = typeof put === "string" ? put : `${put.status} ${await put.text().catch(() => "")}`;
        toast(t("アップロードできませんでした") + "：" + why(detail)); continue;
      }
      const title = f.name.replace(/\.[^.]+$/, "");
      const lg: MLang = p === "boost" ? "en" : l;
      const r = await driverAddTrack({ purpose: p, lang: lg, title, path: u.path });
      if (!r.ok) { toast(t("アップロードできませんでした") + "：" + why(p === "boost" ? r.error + " boost" : r.error)); continue; }
      m.setTracks((ts) => [...ts, { id: r.id, purpose: p, lang: lg, title, artist: null, url: r.url, cover: null, lrc: null, sort: L.length + added, startSec: 0 }]);
      added++;
      // MP3 の中にカバー画像があれば自動で付ける
      const art = await mp3Cover(f);
      if (art) { setBusy(t("カバーを付けています…") + " " + f.name); await saveCover(r.id, art, true); }
    }
    setBusy("");
    if (added) { sfx.chord(); toast(t("追加しました")); }
  };
  const move = async (i: number) => {
    if (i <= 0) return;
    const ids = L.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
    m.setTracks((ts) => ts.map((x) => (ids.includes(x.id) ? { ...x, sort: ids.indexOf(x.id) } : x)));
    sfx.tick(); await driverReorderTracks(ids);
  };
  const del = async (tr: DriverTrack) => {
    if (!confirm(t("「{t}」を削除しますか？", { t: tr.title }))) return;
    m.setTracks((ts) => ts.filter((x) => x.id !== tr.id)); sfx.blip(); await driverDeleteTrack(tr.id);
  };
  return (
    <div className="card adm" id="musicAdmin">
      <div className="ctitle">🎵 {t("音楽の管理")}</div>
      <div className="cnote">{t("プレイリストは「お迎え／お見送り」×「言語」ごとにあります。ゲストの国の言語のプレイリストが自動で選ばれます。")}</div>
      <div className="segsw small three">
        {(["in", "out", "boost"] as const).map((x) => <button key={x} className={p === x ? "on" : ""} onClick={() => { sfx.tick(); setP(x); if (x !== "boost") setL(autoLang[x]); }}>{x === "in" ? "🛬 " + t("お迎え用") : x === "out" ? "🛫 " + t("お見送り用") : "⚡ " + t("BOOST用")}</button>)}
      </div>
      {p === "boost" ? <div className="cnote">{t("スカイゲートブリッジの高速モードの間だけ流す曲です（言語は関係なし）。曲ごとに「開始」の位置を決めると、盛り上がるところから流れます。2曲以上あれば毎回ランダムです。")}</div> : (
      <div className="mlangs">
        {(Object.keys(MLANGS) as MLang[]).map((x) => <button key={x} className={l === x ? "on" : ""} onClick={() => { sfx.tick(); setL(x); }}>{MLANGS[x]}<em>{count(p, x)}</em></button>)}
      </div>)}
      {L.length ? L.map((tr, i) => (
        <div className="fedit" key={tr.id}>
          <button className="cvb" onClick={() => { sfx.blip(); setCv(tr); }} aria-label="cover"><CoverArt track={tr} p={tr.purpose === "out" ? "out" : "in"} /></button>
          <input defaultValue={tr.title} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tr.title) { upd(tr.id, { title: v }); void driverUpdateTrack(tr.id, { title: v }); } }} />
          {p === "boost" ? (
            <input className="bst" defaultValue={fmt(tr.startSec)} aria-label={t("開始")} title={t("開始")} onBlur={(e) => {
              const mm = /^(\d+)(?::(\d{1,2}))?$/.exec(e.target.value.trim()); if (!mm) { e.target.value = fmt(tr.startSec); return; }
              const sec = mm[2] != null ? Number(mm[1]) * 60 + Number(mm[2]) : Number(mm[1]);
              e.target.value = fmt(sec); if (sec !== tr.startSec) { upd(tr.id, { startSec: sec }); void driverUpdateTrack(tr.id, { startSec: sec }).then((r) => { if (r.ok) toast(t("開始位置 {t} から流します", { t: fmt(sec) })); }); }
            }} />
          ) : <button className={`lyb ${tr.lrc ? "has" : ""}`} onClick={() => { sfx.blip(); setLy(tr); }}>{tr.lrc ? "✓" + t("歌詞") : "＋" + t("歌詞")}</button>}
          <button onClick={() => move(i)}>↑</button>
          <button className="del" onClick={() => del(tr)}>✕</button>
        </div>
      )) : <p className="note">{t("曲がありません")}</p>}
      <label className="mfile">＋ {t("曲を追加（スマホの音楽ファイル）")}<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" multiple onChange={(e) => { void add(e.target.files); e.target.value = ""; }} /></label>
      {busy && <p className="note">{busy}</p>}
      <div className="offline">
        <div><b>📥 {t("この端末に保存（オフライン）")}</b><small>{t("保存済み {n} / {m} 曲", { n: m.tracks.filter((x) => m.saved.has(x.url)).length, m: m.tracks.length })}</small></div>
        <button onClick={async () => { sfx.blip(); setProg("0%"); await m.saveOffline((d, n) => setProg(`${Math.round((d / Math.max(1, n)) * 100)}%`)); setProg(""); sfx.chord(); toast(t("この端末に保存しました")); }}>{prog || t("保存する")}</button>
      </div>
      <p className="note">{t("Wi-Fi のときに押してください。保存した曲はギガを使わずに再生できます。")} <button className="linkbtn" onClick={() => { void m.clearOffline(); toast(t("保存を消しました")); }}>{t("保存を消す")}</button></p>
      {cv && (
        <>
          <div className="sheet-bg show" onClick={() => setCv(null)} />
          <div className="sheet show">
            <h4>🖼 {t("アルバムカバー")} ─ {cv.title}</h4>
            <div className="cvprev"><CoverArt track={cv} p={cv.purpose === "out" ? "out" : "in"} /></div>
            <p className="note">{t("写真を選ぶと、自動で 800×800 の正方形（真ん中を切り抜き）に縮めて保存します。元の大きい写真は保存しません。")}</p>
            <label className="mfile">{cvBusy ? t("保存中…") : "🖼 " + t("写真を選ぶ")}<input type="file" accept="image/*" disabled={cvBusy} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              setCvBusy(true); await saveCover(cv.id, f); setCvBusy(false);
            }} /></label>
            <div className="acts">
              <button style={{ visibility: cv.cover ? "visible" : "hidden" }} onClick={async () => { const r = await driverSetCover(cv.id, null); if (r.ok) { upd(cv.id, { cover: null }); setCv({ ...cv, cover: null }); toast(t("カバーを外しました")); } }}>{t("カバーを外す")}</button>
              <button className="ok" onClick={() => setCv(null)}>{t("閉じる")}</button>
            </div>
          </div>
        </>
      )}
      {ly && <LyricsSheet tr={ly} t={t} toast={toast} onClose={() => setLy(null)} onSave={(lrc) => { upd(ly.id, { lrc }); setLy((x) => (x ? { ...x, lrc } : x)); void driverUpdateTrack(ly.id, { lrc }).then((r) => { if (!r.ok) toast(t("歌詞を保存できませんでした") + "：" + r.error.slice(0, 60)); }); }} />}
    </div>
  );
}

/** 歌詞を付ける (LRC ファイル / 曲を流して作る / タイミング調整) */
export function LyricsSheet({ tr, t, toast, onClose, onSave }: { tr: DriverTrack; t: T; toast: (s: string) => void; onClose: () => void; onSave: (lrc: string | null) => void }) {
  const [tab, setTab] = useState<"paste" | "file" | "make" | "edit">(tr.lrc ? "edit" : "paste");
  const [paste, setPaste] = useState("");
  const pasted = useMemo(() => parseLrc(paste), [paste]);
  const [lines, setLines] = useState<LrcLine[]>(parseLrc(tr.lrc));
  const [text, setText] = useState("");
  const [mkI, setMkI] = useState(-1);
  const [re, setRe] = useState(-1);
  const pv = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mk = useRef<{ lines: string[]; res: LrcLine[] }>({ lines: [], res: [] });
  const audio = () => { if (!pv.current) pv.current = new Audio(tr.url); return pv.current; };
  const stop = () => { pv.current?.pause(); if (timer.current) clearTimeout(timer.current); };
  useEffect(() => () => stop(), []);
  const playFrom = (s: number, ms = 4000) => { stop(); const a = audio(); a.currentTime = Math.max(0, s); a.play().catch(() => {}); if (ms) timer.current = setTimeout(stop, ms); };
  const commit = (L: LrcLine[]) => { const S = L.slice().sort((a, b) => a.t - b.t); setLines(S); onSave(S.length ? toLrc(S) : null); };
  const shift = (i: number, d: number) => { const L = lines.map((l, k) => (k === i ? { ...l, t: Math.max(0, +(l.t + d).toFixed(2)) } : l)); commit(L); sfx.tick(); };
  const shiftAll = (d: number) => { commit(lines.map((l) => ({ ...l, t: Math.max(0, +(l.t + d).toFixed(2)) }))); sfx.tick(); };
  return (
    <>
      <div className="sheet-bg show" onClick={() => { stop(); onClose(); }} />
      <div className="sheet show">
        <h4>{t("歌詞を付ける")} ─ {tr.title}</h4>
        <div className="segsw small four">
          {(["paste", "file", "make", "edit"] as const).map((x) => <button key={x} className={tab === x ? "on" : ""} onClick={() => { sfx.tick(); stop(); setTab(x); }}>{x === "paste" ? t("貼り付け") : x === "file" ? t("LRC ファイル") : x === "make" ? t("曲を流して作る") : t("タイミング調整")}</button>)}
        </div>
        {tab === "paste" && (
          <div>
            <textarea rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("時間付きの歌詞（[00:12.34]歌詞 の形）をここに貼り付けてください")} />
            {paste.trim() ? (pasted.length ? (
              <div className="lypv">
                <b>✓ {t("{n} 行・{a}〜{b}", { n: pasted.length, a: fmt(pasted[0].t), b: fmt(pasted[pasted.length - 1].t) })}</b>
                <div className="lylist mini">{pasted.slice(0, 4).map((l, i) => <div key={i} className="lyrow"><b className="tm">{fmt(l.t)}</b><span className="tx">{l.s}</span></div>)}{pasted.length > 4 ? <p className="note">… {t("ほか {n} 行", { n: pasted.length - 4 })}</p> : null}</div>
                <button className="btn main" onClick={() => { commit(pasted); sfx.chord(); toast(t("歌詞を付けました（{n} 行）", { n: pasted.length })); setPaste(""); setTab("edit"); }}>💾 {t("この歌詞を保存")}</button>
              </div>
            ) : <p className="note warn">{t("時間（[00:12.34] など）が見つかりません。時間のない歌詞は「曲を流して作る」で付けてください。")}</p>) : null}
          </div>
        )}
        {tab === "edit" && lines.length > 0 && (
          <button className="linkbtn" onClick={() => {
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`[ti:${tr.title}]\n` + toLrc(lines) + "\n"], { type: "text/plain;charset=utf-8" }));
            a.download = `${tr.title.replace(/[\\/:*?"<>|]/g, "_")}.lrc`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          }}>⬇ {t(".lrc をダウンロード")}</button>
        )}
        {tab === "file" && (
          <label className="mfile">📄 {t("LRC ファイルを選ぶ")}<input type="file" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            const L = parseLrc(decodeLrcBytes(await f.arrayBuffer())); if (!L.length) { toast(t("時間付きの歌詞が見つかりませんでした")); return; }
            commit(L); sfx.chord(); toast(t("歌詞を付けました（{n} 行）", { n: L.length })); setTab("edit");
          }} /></label>
        )}
        {tab === "make" && (
          <div>
            <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("歌詞を1行ずつ入れてください")} />
            {mkI < 0 ? (
              <button className="btn" onClick={() => {
                const ls = text.split(/\n/).map((x) => x.trim()).filter(Boolean);
                if (!ls.length) { toast(t("歌詞を入れてください")); return; }
                mk.current = { lines: ls, res: [] }; setMkI(0); playFrom(0, 0);
              }}>▶ {t("曲を流して作り始める")}</button>
            ) : (
              <>
                <button className="btn main tap" onClick={() => {
                  const a = audio(); const k = mkI; mk.current.res.push({ t: +a.currentTime.toFixed(2), s: mk.current.lines[k] }); vib(12);
                  if (k + 1 >= mk.current.lines.length) { stop(); commit(mk.current.res); setMkI(-1); sfx.chord(); toast(t("歌詞を付けました（{n} 行）", { n: mk.current.res.length })); setTab("edit"); }
                  else setMkI(k + 1);
                }}>{t("この行！")}</button>
                <p className="note">{t("次の行")}: {mk.current.lines[mkI]}</p>
              </>
            )}
          </div>
        )}
        {tab === "edit" && (
          <div>
            <div className="lyall"><span>{t("全体をずらす")}</span>{[-0.5, -0.1, 0.1, 0.5].map((d) => <button key={d} onClick={() => shiftAll(d)}>{d > 0 ? "+" : "−"}{Math.abs(d)}{Math.abs(d) === 0.5 ? t("秒") : ""}</button>)}</div>
            <div className="lylist">
              {lines.length ? lines.map((l, i) => (
                <div key={i} className={`lyrow ${re === i ? "re" : ""}`}>
                  <b className="tm">{`${String(Math.floor(l.t / 60)).padStart(2, "0")}:${(l.t % 60).toFixed(1).padStart(4, "0")}`}</b><span className="tx">{l.s}</span>
                  <div className="bt">
                    <button onClick={() => shift(i, -0.1)}>−</button><button onClick={() => shift(i, 0.1)}>＋</button>
                    <button onClick={() => { sfx.blip(); playFrom(l.t - 1.5); }}>▶</button>
                    <button className="rt" onClick={() => {
                      if (re === i) { const L = lines.map((x, k) => (k === i ? { ...x, t: +audio().currentTime.toFixed(2) } : x)); stop(); setRe(-1); commit(L); sfx.chord(); return; }
                      setRe(i); sfx.blip(); playFrom(i > 0 ? lines[i - 1].t : l.t - 4, 0);
                    }}>{re === i ? t("今！") : t("録り直す")}</button>
                  </div>
                </div>
              )) : <p className="note">{t("まだ歌詞がありません。先に「LRC ファイルを選ぶ」か「曲を流して作る」で付けてください。")}</p>}
            </div>
            <p className="note">{t("▶ でその行の少し前から再生して確かめられます。「録り直す」を押すと、その行の少し前から曲が流れるので、歌い始めでもう一度押してください。")}</p>
          </div>
        )}
        <div className="acts">
          <button onClick={() => { if (!lines.length) return; commit([]); toast(t("歌詞を外しました")); }} style={{ visibility: lines.length ? "visible" : "hidden" }}>{t("歌詞を外す")}</button>
          <button className="ok" onClick={() => { stop(); onClose(); }}>{t("閉じる")}</button>
        </div>
      </div>
    </>
  );
}
