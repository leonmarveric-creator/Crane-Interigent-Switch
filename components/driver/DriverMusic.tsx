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
import { driverAddTrack, driverDeleteTrack, driverReorderTracks, driverTrackUploadUrl, driverUpdateTrack } from "@/app/driver/actions";

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
        album: "HIROSHI DRIVE", artwork: [{ src: "/driver/icon.png", sizes: "512x512", type: "image/png" }],
      });
    } catch { /* ignore */ }
  }, [track, li, lyrOnCar, lrc]);
  const api = {
    tracks, setTracks, cur, list, track, playing, pos, dur, lrc, li, lyrOnCar, saved,
    play() { sfx.prime(); prime(); const a = el(); if (!track) { toast(t("この言語の曲はまだありません。設定から追加できます。")); return; } if (!a.src) void load(track, true); else { route(); setLevel(0.05); a.play().then(() => fadeTo(vol.current, 1500)).catch(() => {}); } },
    pause() { el().pause(); },
    toggle() { playing ? api.pause() : api.play(); },
    next() { setCur((c) => ({ ...c, i: list.length ? (c.i + 1) % list.length : 0 })); },
    prev() { const a = el(); if (a.currentTime > 3) a.currentTime = 0; else setCur((c) => ({ ...c, i: list.length ? (c.i - 1 + list.length) % list.length : 0 })); },
    pick(i: number) { prime(); setCur((c) => ({ ...c, i })); if (!playing) setTimeout(() => api.play(), 50); },
    setPlaylist(p: "in" | "out", l: MLang, play = false) { if (play) prime(); lastId.current = null; setCur({ p, l, i: 0 }); if (play) setTimeout(() => { route(); el().play().catch(() => {}); }, 120); },
    startWith(p: "in" | "out", l: MLang) { lastId.current = null; const L = tracks.filter((x) => x.purpose === p && x.lang === l); setCur({ p, l, i: 0 }); if (L.length) { const tr = L.sort((a, b) => a.sort - b.sort)[0]; lastId.current = tr.id; void load(tr, true); } },
    /** アンドロイドの声の間は音楽を 20% に (声が終わったらゆっくり戻す) */
    /** タップの中で呼ぶ (あとで自動で流すときのため) */
    prime,
    duck(on: boolean) { if (!playing) return; fadeTo(on ? vol.current * 0.2 : vol.current, on ? 300 : 900); },
    fadeOut() { if (!playing) return; fadeTo(0, 3500, () => { el().pause(); setLevel(vol.current); }); },
    seek(s: number) { el().currentTime = Math.max(0, s); },
    setLyrOnCar(v: boolean) { setLyrOnCar(v); try { localStorage.setItem("drvLyrCar", v ? "1" : "0"); } catch { /* ignore */ } },
    /** 全部の曲をこの端末に保存 */
    async saveOffline(onProgress: (d: number, n: number) => void) {
      if (!("caches" in window)) { toast(t("このブラウザは保存に対応していません")); return; }
      const c = await caches.open(CACHE); const urls = tracks.map((x) => x.url); let d = 0;
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
  return api;
}
export type Music = ReturnType<typeof useDriverMusic>;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** ホームのプレイヤー */
export function MusicPlayer({ m, t, onOpen, onArrive }: { m: Music; t: T; onOpen: () => void; onArrive: () => void }) {
  const L = m.lrc, i = m.li;
  return (
    <div className={`mplayer ${m.playing ? "on" : ""}`}>
      <button className="mpl-top" onClick={() => { sfx.blip(); onOpen(); }}>
        <span className="mchip">{m.cur.p === "in" ? "🛬 " + t("お迎え") : "🛫 " + t("お見送り")}・{MLANGS[m.cur.l]}</span>
        <span className="mhint">{t("プレイリストを変える")} ›</span>
      </button>
      <div className="mpl-row">
        <div className={`mart ${m.cur.p}`}>{m.cur.p === "in" ? "🌆" : "🌅"}</div>
        <div className="nm"><b>{m.track?.title ?? t("曲がありません")}</b><small>{m.track ? `${m.track.artist || "Crane Nest"}・${m.cur.i + 1} / ${m.list.length}` : t("設定から曲を追加してください")}</small></div>
        <div className="eq"><i /><i /><i /></div>
      </div>
      <div className={`mlyr ${L.length ? "has" : ""}`}>
        <p>{L[i - 1]?.s ?? ""}</p>
        <p key={i} className="now">{L.length ? (L[i]?.s ?? "♪") : t("歌詞なし")}</p>
        <p>{L[i + 1]?.s ?? ""}</p>
      </div>
      <div className="mbar"><i style={{ width: `${m.dur ? (m.pos / m.dur) * 100 : 0}%` }} /></div>
      <div className="mtime"><span>{fmt(m.pos)}</span><span>{fmt(m.dur)}</span></div>
      <div className="mctl">
        <button onClick={() => { sfx.blip(); m.prev(); }}>⏮</button>
        <button className="pp" onClick={() => { sfx.blip(); m.toggle(); }}>{m.playing ? "⏸" : "▶"}</button>
        <button onClick={() => { sfx.blip(); m.next(); }}>⏭</button>
        <button onClick={onArrive} title="arrive">🏁</button>
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
  const [p, setP] = useState<"in" | "out">("in");
  const [l, setL] = useState<MLang>(autoLang.in);
  const [busy, setBusy] = useState("");
  const [ly, setLy] = useState<DriverTrack | null>(null);
  const [prog, setProg] = useState<string>("");
  const L = m.tracks.filter((x) => x.purpose === p && x.lang === l).sort((a, b) => a.sort - b.sort);
  const count = (pp: string, ll: string) => m.tracks.filter((x) => x.purpose === pp && x.lang === ll).length;
  const upd = (id: string, patch: Partial<DriverTrack>) => m.setTracks((ts) => ts.map((x) => (x.id === id ? { ...x, ...patch } : x)));

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
      const r = await driverAddTrack({ purpose: p, lang: l, title, path: u.path });
      if (!r.ok) { toast(t("アップロードできませんでした") + "：" + why(r.error)); continue; }
      m.setTracks((ts) => [...ts, { id: r.id, purpose: p, lang: l, title, artist: null, url: r.url, lrc: null, sort: L.length + added }]);
      added++;
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
      <div className="segsw small">
        {(["in", "out"] as const).map((x) => <button key={x} className={p === x ? "on" : ""} onClick={() => { sfx.tick(); setP(x); setL(autoLang[x]); }}>{x === "in" ? "🛬 " + t("お迎え用") : "🛫 " + t("お見送り用")}</button>)}
      </div>
      <div className="mlangs">
        {(Object.keys(MLANGS) as MLang[]).map((x) => <button key={x} className={l === x ? "on" : ""} onClick={() => { sfx.tick(); setL(x); }}>{MLANGS[x]}<em>{count(p, x)}</em></button>)}
      </div>
      {L.length ? L.map((tr, i) => (
        <div className="fedit" key={tr.id}>
          <input defaultValue={tr.title} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tr.title) { upd(tr.id, { title: v }); void driverUpdateTrack(tr.id, { title: v }); } }} />
          <button className={`lyb ${tr.lrc ? "has" : ""}`} onClick={() => { sfx.blip(); setLy(tr); }}>{tr.lrc ? "✓" + t("歌詞") : "＋" + t("歌詞")}</button>
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
      {ly && <LyricsSheet tr={ly} t={t} toast={toast} onClose={() => setLy(null)} onSave={(lrc) => { upd(ly.id, { lrc }); setLy((x) => (x ? { ...x, lrc } : x)); void driverUpdateTrack(ly.id, { lrc }).then((r) => { if (!r.ok) toast(t("歌詞を保存できませんでした") + "：" + r.error.slice(0, 60)); }); }} />}
    </div>
  );
}

/** 歌詞を付ける (LRC ファイル / 曲を流して作る / タイミング調整) */
function LyricsSheet({ tr, t, toast, onClose, onSave }: { tr: DriverTrack; t: T; toast: (s: string) => void; onClose: () => void; onSave: (lrc: string | null) => void }) {
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
