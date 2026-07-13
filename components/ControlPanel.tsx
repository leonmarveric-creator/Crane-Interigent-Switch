"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LockKeyhole, LockKeyholeOpen, Snowflake, Lightbulb, LampFloor, Sliders, RotateCcw, ChevronRight,
  AlarmClock, Check, Loader2, Globe, Volume2, VolumeX, Home, LogOut, Sparkles,
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
} from "lucide-react";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import { callDevice, type DeviceAction } from "@/lib/deviceClient";
import { blip, powerUp, powerDown, error as sfxError, speakOneOf, primeVoice, charge, sweep, setMuted as sfxSetMuted, navTick, keyTick, confirm as sfxConfirm, galaxyOn, galaxyOff } from "@/lib/sfx";

interface Props {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean; // 管理画面テストモード (PIN不要・admin認証で操作)
  imageUrl?: string | null; // 部屋アート
  lat?: number | null; // ジオフェンス: 建物の緯度
  lng?: number | null; // ジオフェンス: 建物の経度
  radiusM?: number | null; // 許可半径(m)
  hasGalaxy?: boolean; // ギャラクシーモード (プラネタリウム) 対応の部屋
  hasWafu?: boolean; // 和風ライト(行灯) 対応の部屋
}

// メディアURLが動画か判定 (拡張子ベース)
function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(url);
}

/**
 * 部屋アートのヒーロー表示。動画URLなら<video>でループ再生、それ以外は<img>。
 * 軽量化のため: muted/loop/playsInline、画面非表示時は停止、reduced-motionでは静止画優先。
 * 読み込み失敗時はヒーロー枠を隠す。
 */
function HeroMedia({ url, alt }: { url: string; alt: string }) {
  const reduce = useReducedMotion();
  const vref = useRef<HTMLVideoElement>(null);
  const video = isVideoUrl(url) && !reduce;

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const onVis = () => { if (document.hidden) v.pause(); else v.play().catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [url]);

  const hide = (el: HTMLElement | null) => {
    const w = el?.closest(".hero-wrap") as HTMLElement | null;
    if (w) w.style.display = "none";
  };

  if (video) {
    return (
      <video ref={vref} src={url} className="anim-kenburns h-full w-full object-cover"
        autoPlay loop muted playsInline preload="metadata"
        onError={(e) => hide(e.currentTarget)} />
    );
  }
  // reduced-motion かつ動画URL の場合も、最初のフレームを静止表示
  if (isVideoUrl(url)) {
    return (
      <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata"
        onError={(e) => hide(e.currentTarget)} />
    );
  }
  return (
    <img src={url} alt={alt} className="anim-kenburns h-full w-full object-cover"
      onError={(e) => hide(e.currentTarget)} />
  );
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


export default function ControlPanel({
  roomSlug, roomName, checkOut, initialLang, admin, imageUrl, lat, lng, radiusM, hasGalaxy, hasWafu,
}: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [muted, setMuted] = useState(false);
  const [galaxyActive, setGalaxyActive] = useState(false); // 星空オーバーレイ表示
  const [booting, setBooting] = useState(!admin); // ゲスト時のみ起動演出
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const geoCache = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const [taps, setTaps] = useState<{ id: number; x: number; y: number }[]>([]);
  const weather = useWeather(lat, lng);
  const t = T[lang];

  // タップ位置に照準リング
  const onTap = (e: React.PointerEvent) => {
    const id = Date.now() + Math.random();
    setTaps((r) => [...r.slice(-5), { id, x: e.clientX, y: e.clientY }]);
    setTimeout(() => setTaps((r) => r.filter((p) => p.id !== id)), 700);
  };

  // 位置制限は「座標あり かつ 半径>0」のときだけ有効。
  // 半径0でも座標は残せるので、天気(useWeather)はそのまま表示される(分離)。
  const geoEnabled = !admin && typeof lat === "number" && typeof lng === "number" && (radiusM ?? 0) > 0;

  // 操作ガード: 範囲外/未許可ならブロック
  const guardCommand = useCallback(async (): Promise<boolean> => {
    if (!geoEnabled) return true;
    let p = geoCache.current;
    if (!p || Date.now() - p.t > 180000) { // 3分キャッシュ
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }));
        p = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
        geoCache.current = p;
      } catch (e: any) {
        const msg = e?.code === 1 ? t.locPermission : t.locUnavailable;
        setGeoMsg(msg); sfxError(); setTimeout(() => setGeoMsg(null), 4500);
        return false;
      }
    }
    const d = haversine(p.lat, p.lng, lat as number, lng as number);
    if (d > (radiusM ?? 150)) {
      setGeoMsg(t.locTooFar); sfxError(); setTimeout(() => setGeoMsg(null), 4500);
      return false;
    }
    return true;
  }, [geoEnabled, lat, lng, radiusM, t]);

  useEffect(() => {
    const saved = localStorage.getItem("guestMuted");
    if (saved === "1") setMuted(true);
  }, []);
  useEffect(() => { sfxSetMuted(muted); }, [muted]);
  const toggleMute = () => setMuted((m) => {
    const n = !m; localStorage.setItem("guestMuted", n ? "1" : "0");
    if (!n) setTimeout(navTick, 0); // ミュート解除時に確認音
    return n;
  });

  return (
    <main onPointerDown={onTap} className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white">
      {/* タップ照準リング */}
      <div className="pointer-events-none fixed inset-0 z-40">
        <AnimatePresence>
          {taps.map((p) => (
            <motion.span key={p.id}
              initial={{ opacity: 0.7, scale: 0 }} animate={{ opacity: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ left: p.x, top: p.y }}
              className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/70
                [box-shadow:0_0_14px_rgba(34,211,238,0.6)]" />
          ))}
        </AnimatePresence>
      </div>

      {/* 起動シーケンス */}
      <AnimatePresence>
        {booting && <BootSequence onDone={() => setBooting(false)} roomName={roomName} />}
      </AnimatePresence>

      {/* 背景: 動くオーロラ + 走査線 + グリッド */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-drift absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan-400/30 blur-[110px]" />
        <div className="anim-drift2 absolute top-1/4 -right-24 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-[110px]" />
        <div className="anim-drift absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-emerald-400/25 blur-[110px]" />
        <div className="anim-drift2 absolute top-1/2 left-1/2 h-72 w-72 rounded-full bg-sky-400/20 blur-[120px]" />
        {/* グリッド (脈動) */}
        <div className="anim-grid absolute inset-0
          [background-image:linear-gradient(#38bdf8_1px,transparent_1px),linear-gradient(90deg,#38bdf8_1px,transparent_1px)]
          [background-size:42px_42px]" />
        {/* 走査線 (縦 + 横) */}
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
        <div className="anim-scanx absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
        {/* 巨大HUDレティクル (薄め) */}
        <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="200" cy="200" r="190" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="2 10" />
            <circle cx="200" cy="200" r="150" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="40 30" />
          </g>
          <g className="anim-spin-rev" style={SPIN}>
            <circle cx="200" cy="200" r="120" fill="none" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="60 200" />
          </g>
        </svg>
        {/* 回路トレース (光が流れる) */}
        <svg viewBox="0 0 400 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-[0.18]">
          <path d="M-5 90 H90 L120 120 V250 H40" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 9" className="anim-dash" />
          <path d="M405 200 H320 L290 230 V420 H360" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 9" className="anim-dash" style={{ animationDelay: "1.5s" }} />
          <path d="M-5 620 H110 L140 590 V470" fill="none" stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 9" className="anim-dash" style={{ animationDelay: "0.8s" }} />
        </svg>
        {/* 浮遊する光の粒子 */}
        <Particles />
        {/* サイドのデータストリーム */}
        <SideTelemetry side="left" />
        <SideTelemetry side="right" />
      </div>

      {/* ジオフェンス警告バナー */}
      <AnimatePresence>
        {geoMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-4 top-4 z-40 mx-auto max-w-sm rounded-2xl border border-rose-400/50
              bg-rose-500/20 px-4 py-3 text-center text-sm text-rose-100 backdrop-blur-xl">
            📍 {geoMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 天気連動の背景 */}
      {weather && <WeatherFX code={weather.code} />}

      {/* ギャラクシーモード: 全画面星空オーバーレイ */}
      <AnimatePresence>
        {galaxyActive && <GalaxyOverlay />}
      </AnimatePresence>

      {/* 全画面HUDフレーム (ヘルメットHUD風) */}
      <HudFrame />

      {/* アンビエント: ビネット・漂うレティクル・グリッチ */}
      <AmbientFX />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-8">
        {/* HUDステータスバー */}
        <HudStatusBar />

        {/* 天気 */}
        {weather && <Weather data={weather} />}

        {/* 部屋アート (ヒーロー・小さめ正方形・中央) */}
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="hero-wrap relative mb-5 flex justify-center">
            {/* 回転リング */}
            <div className="anim-spin-slow pointer-events-none absolute h-52 w-52 rounded-full
              [background:conic-gradient(from_0deg,transparent,rgba(34,211,238,0.5),transparent_40%)] blur-md sm:h-60 sm:w-60" />
            {/* ホログラム投影フレーム */}
            <div className="relative aspect-square w-40 overflow-hidden rounded-3xl border border-cyan-300/30
              shadow-[0_0_60px_-12px_rgba(34,211,238,0.8)] sm:w-48">
              <HeroMedia url={imageUrl} alt={roomName} />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 opacity-25 [background:repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(0,0,0,0.35)_3px)]" />
                <div className="anim-holoscan absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-cyan-200/30 to-transparent" />
                <div className="anim-flicker absolute inset-0 bg-cyan-400/[0.06] mix-blend-screen" />
                <Corners tone="cyan" />
              </div>
            </div>
          </motion.div>
        )}

        {/* ヘッダー: 部屋名 + 言語切替 */}
        <motion.header
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5 flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">
              {t.welcome.toUpperCase()}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide"><DecodeText text={roomName} /></h1>
            {admin ? (
              <a href="/admin" className="mt-1 inline-block text-xs text-violet-300/80">
                ⓘ TEST MODE · ← 管理画面へ戻る
              </a>
            ) : (
              <>
                <p className="mt-1 text-xs text-white/40">
                  {t.checkout}: {new Date(checkOut).toLocaleString(lang, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  })}
                </p>
                <CheckoutCountdown checkOut={checkOut} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-300 backdrop-blur-md active:scale-95"
              aria-label="sound">
              {muted ? <VolumeX className="h-4 w-4 text-white/40" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <LangSwitch lang={lang} setLang={setLang} />
          </div>
        </motion.header>

        {/* 位置制限の常設案内 (有効な部屋のみ) */}
        {geoEnabled && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }}
            className="mb-4 flex items-center justify-center gap-1.5 rounded-full border border-cyan-400/20
              bg-cyan-400/[0.06] px-3 py-1.5 text-center text-[11px] text-cyan-200/70">
            📍 {t.locTooFar}
          </motion.p>
        )}

        {/* シーン: 快適モード / 外出 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <SceneButtons roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t} hasWafu={hasWafu} />
        </motion.div>

        {/* スマートロック (主役) */}
        <motion.div className="mt-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <LockCard roomSlug={roomSlug} t={t} admin={admin} guard={guardCommand} />
        </motion.div>

        {/* デバイスグリッド */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="mt-5 grid grid-cols-2 gap-4">
          <ToggleCard
            roomSlug={roomSlug} admin={admin} guard={guardCommand}
            icon={Snowflake} label={t.ac} accent="cyan"
            onAction={"ac_on"} offAction={"ac_off"} t={t}
          />
          <ToggleCard
            roomSlug={roomSlug} admin={admin} guard={guardCommand}
            icon={Lightbulb} label={t.light} accent="amber"
            onAction={"light_on"} offAction={"light_off"} t={t}
          />
          {hasWafu && (
            <WafuCard roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t} />
          )}
        </motion.div>

        {/* ギャラクシーモード (プラネタリウム対応の部屋のみ) */}
        {hasGalaxy && (
          <motion.div className="mt-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GalaxyCard roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t}
              onState={setGalaxyActive} />
          </motion.div>
        )}

        {/* 光目覚まし (テストページでもホストが設定・動作確認できる) */}
        <WakeCard roomSlug={roomSlug} checkOut={checkOut} t={t} lang={lang} admin={admin} />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* チェックアウトまでのカウントダウン (T-hh:mm:ss)                       */
/* ------------------------------------------------------------------ */
function CheckoutCountdown({ checkOut }: { checkOut: string }) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const target = new Date(checkOut).getTime();
    const tick = () => {
      const d = target - Date.now();
      if (d <= 0) { setLeft("00:00:00"); return; }
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkOut]);
  if (!left) return null;
  return (
    <p className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-cyan-400/60">
      T-{left}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* デコードテキスト: 文字がスクランブルから確定していく (起動演出)       */
/* ------------------------------------------------------------------ */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/";
function DecodeText({ text }: { text: string }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    let frame = 0;
    const total = 22; // 約0.9秒で確定
    const id = setInterval(() => {
      frame++;
      const fixed = Math.floor((frame / total) * text.length);
      setOut(
        text.split("").map((ch, i) =>
          i < fixed || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ).join("")
      );
      if (frame >= total) { setOut(text); clearInterval(id); }
    }, 40);
    return () => clearInterval(id);
  }, [text]);
  return <span>{out}</span>;
}

/* ------------------------------------------------------------------ */
/* 言語スイッチ                                                         */
/* ------------------------------------------------------------------ */
function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => { keyTick(); setOpen((o) => !o); }}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5
          px-3 py-2 text-xs backdrop-blur-md active:scale-95 transition"
      >
        <Globe className="h-4 w-4 text-cyan-300" />
        {LANG_LABEL[lang]}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 z-20 mt-2 w-32 overflow-hidden rounded-2xl
              border border-white/10 bg-[#0a0c14]/90 backdrop-blur-xl"
          >
            {LANGS.map((l) => (
              <li key={l}>
                <button
                  onClick={() => { setLang(l); setOpen(false); navTick(); }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition
                    ${l === lang ? "text-cyan-300 bg-cyan-500/10" : "text-white/70 hover:bg-white/5"}`}
                >
                  {LANG_LABEL[l]}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* アンビエント演出: 粒子 / サイドデータ                                */
/* ------------------------------------------------------------------ */
function Particles() {
  const motes = useMemo(
    () => [...Array(26)].map(() => ({
      left: Math.random() * 100,
      dur: 6 + Math.random() * 9,
      delay: Math.random() * 9,
      size: 1 + Math.random() * 2,
      amber: Math.random() > 0.8,
    })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <span key={i} className="absolute rounded-full"
          style={{
            left: `${m.left}%`, bottom: -12, width: m.size, height: m.size,
            background: m.amber ? "rgba(251,191,36,0.8)" : "rgba(34,211,238,0.75)",
            boxShadow: m.amber ? "0 0 6px rgba(251,191,36,0.9)" : "0 0 6px rgba(34,211,238,0.9)",
            animation: `rise ${m.dur}s linear ${m.delay}s infinite`,
          }} />
      ))}
    </div>
  );
}

function SideTelemetry({ side }: { side: "left" | "right" }) {
  const rows = useMemo(
    () => [...Array(48)].map(() => Math.floor(Math.random() * 65536).toString(16).padStart(4, "0").toUpperCase()),
    []
  );
  return (
    <div className={`pointer-events-none absolute top-0 ${side === "left" ? "left-0.5" : "right-0.5"} hidden h-full w-9 overflow-hidden opacity-25 sm:block`}>
      <div className="anim-stream font-mono text-[7px] leading-[1.7] tracking-wider text-cyan-300/70">
        {rows.concat(rows).map((r, i) => (
          <div key={i} className={i % 7 === 0 ? "text-emerald-300/70" : ""}>{r}</div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 起動シーケンス (JARVIS ブート)                                       */
/* ------------------------------------------------------------------ */
function BootSequence({ onDone, roomName }: { onDone: () => void; roomName: string }) {
  useEffect(() => {
    charge(); // 起動チャージ音
    speakOneOf(["All systems online", "Good evening. Systems online", "J.A.R.V.I.S online"]); // iOSではジェスチャー外のため鳴らない場合あり
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [onDone]);

  const lines = [
    "INITIALIZING SYSTEM",
    "ARC REACTOR ·········· ONLINE",
    "SECURE LINK ·········· ESTABLISHED",
    `ROOM · ${roomName.toUpperCase()}`,
    "J.A.R.V.I.S ·········· READY",
  ];

  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.5 }}
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#04060c] px-8">
      {/* アークリアクター */}
      <div className="relative mb-9 h-40 w-40">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="100" cy="100" r="92" fill="none" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 7" />
          </g>
          <g className="anim-spin-rev" style={SPIN}>
            <circle cx="100" cy="100" r="74" fill="none" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="50 250" strokeLinecap="round" />
            <circle cx="100" cy="100" r="74" fill="none" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="20 300" strokeDashoffset="-150" strokeLinecap="round" />
          </g>
          {/* 充電リング: 0→全周へ満ちる */}
          <circle cx="100" cy="100" r="75" fill="none" stroke="#67e8f9" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="471" className="anim-charge" style={{ ...SPIN, transform: "rotate(-90deg)" }} />
        </svg>
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.3 }}
          className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-cyan-400/40 blur-md" />
        <div className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/10">
          <span className="h-3 w-3 rounded-full bg-cyan-100 shadow-[0_0_22px_5px_rgba(34,211,238,0.85)]" />
        </div>
      </div>

      {/* ターミナル行 */}
      <div className="min-h-[110px] font-mono text-[11px] tracking-[0.22em] text-cyan-300/85">
        {lines.map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.4 }} className="my-1 flex items-center gap-2">
            <span className="text-emerald-400">›</span>
            <span className={i === 3 ? "anim-textglitch text-cyan-100" : ""}>{l}</span>
          </motion.p>
        ))}
      </div>

      {/* プログレスバー */}
      <div className="mt-7 h-0.5 w-56 overflow-hidden rounded-full bg-white/10">
        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
          className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400" />
      </div>
      <p className="mt-3 font-mono text-[9px] tracking-[0.3em] text-white/30">TAP TO SKIP</p>

      {/* 起動完了の白フラッシュ */}
      <div className="anim-bootflash pointer-events-none absolute inset-0 bg-cyan-50" />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 天気 (Open-Meteo・キー不要)                                          */
/* ------------------------------------------------------------------ */
function wIcon(code: number) {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}
type WeatherData = { temp: number; code: number };
function useWeather(lat?: number | null, lng?: number | null): WeatherData | null {
  const [w, setW] = useState<WeatherData | null>(null);
  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    let on = true;
    const load = async () => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`);
        const j = await r.json();
        if (on && j?.current) setW({ temp: Math.round(j.current.temperature_2m), code: j.current.weather_code });
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { on = false; clearInterval(id); };
  }, [lat, lng]);
  return w;
}
function Weather({ data }: { data: WeatherData }) {
  const Icon = wIcon(data.code);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="mb-4 flex items-center justify-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-1.5 text-xs text-cyan-200/80">
      <Icon className="anim-breathe h-4 w-4 text-cyan-300" />
      <span className="font-mono text-sm">{data.temp}°C</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 天気連動の背景 (雨・雪・晴れ)                                        */
/* ------------------------------------------------------------------ */
function WeatherFX({ code }: { code: number }) {
  const kind = code === 0 || code === 1 ? "clear"
    : code >= 71 && code <= 77 ? "snow"
    : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 ? "rain"
    : "cloud";

  const drops = useMemo(
    () => [...Array(kind === "rain" ? 60 : kind === "snow" ? 40 : 0)].map(() => ({
      left: Math.random() * 100,
      dur: kind === "rain" ? 0.6 + Math.random() * 0.6 : 4 + Math.random() * 5,
      delay: Math.random() * 3,
      size: kind === "snow" ? 2 + Math.random() * 3 : 0,
    })),
    [kind]
  );

  if (kind === "clear") {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-breathe absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/15 blur-[100px]" />
      </div>
    );
  }
  if (kind === "cloud") return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d, i) =>
        kind === "rain" ? (
          <span key={i} className="absolute top-0 w-px bg-gradient-to-b from-cyan-200/50 to-transparent"
            style={{ left: `${d.left}%`, height: 14, animation: `rainfall ${d.dur}s linear ${d.delay}s infinite` }} />
        ) : (
          <span key={i} className="absolute top-0 rounded-full bg-white/70"
            style={{ left: `${d.left}%`, width: d.size, height: d.size, animation: `snowfall ${d.dur}s linear ${d.delay}s infinite` }} />
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 全画面HUDフレーム (ヘルメットHUD)                                    */
/* ------------------------------------------------------------------ */
function HudFrame() {
  const corner = "pointer-events-none absolute h-7 w-7 border-cyan-300/40";
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* コーナーブラケット */}
      <span className={`${corner} left-3 top-3 border-l-2 border-t-2`} />
      <span className={`${corner} right-3 top-3 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-3 left-3 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-3 right-3 border-b-2 border-r-2`} />
      {/* 上下のティックライン */}
      <div className="absolute inset-x-14 top-3.5 h-[3px] opacity-30
        [background:repeating-linear-gradient(90deg,#22d3ee_0,#22d3ee_1px,transparent_1px,transparent_9px)]" />
      <div className="absolute inset-x-14 bottom-3.5 h-[3px] opacity-30
        [background:repeating-linear-gradient(90deg,#22d3ee_0,#22d3ee_1px,transparent_1px,transparent_9px)]" />
      {/* 隅の小ゲージ */}
      <svg viewBox="0 0 60 60" className="absolute bottom-6 right-6 h-10 w-10 opacity-40">
        <g className="anim-spin-slow" style={SPIN}>
          <circle cx="30" cy="30" r="26" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 5" />
        </g>
        <g className="anim-spin-rev" style={SPIN}>
          <circle cx="30" cy="30" r="18" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="20 60" />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUDステータスバー (テレメトリ風)                                     */
/* ------------------------------------------------------------------ */
function HudStatusBar() {
  const [hex, setHex] = useState("0x0000");
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      setHex("0x" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0").toUpperCase());
      setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="anim-flicker mb-4 flex items-center justify-between rounded-full border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-1.5 font-mono text-[9px] tracking-[0.25em] text-cyan-300/70">
      <span className="flex items-center gap-1.5">
        <span className="anim-breathe inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> SYS ONLINE
      </span>
      <span className="tracking-[0.2em] text-cyan-200/80">{clock}</span>
      <span className="flex items-center gap-2">
        {/* EKG心電図波形 */}
        <svg viewBox="0 0 60 14" className="h-3.5 w-14 overflow-visible">
          <path d="M0 7 H10 L14 7 L17 2 L20 12 L23 7 H34 L38 7 L41 3 L44 11 L47 7 H60"
            fill="none" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"
            strokeDasharray="90 30" className="anim-ekg" opacity="0.8" />
        </svg>
        <span className="hidden text-cyan-300/60 sm:inline">{hex}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD部品: ターゲットブラケット / 同心円ダイヤル                        */
/* ------------------------------------------------------------------ */
function Corners({ tone = "cyan" }: { tone?: "cyan" | "amber" | "emerald" | "rose" }) {
  const c = tone === "amber" ? "border-amber-300/60" : tone === "emerald" ? "border-emerald-300/60" : tone === "rose" ? "border-rose-300/60" : "border-cyan-300/55";
  const base = "pointer-events-none absolute h-3.5 w-3.5";
  return (
    <>
      <span className={`${base} left-2.5 top-2.5 border-l border-t ${c}`} />
      <span className={`${base} right-2.5 top-2.5 border-r border-t ${c}`} />
      <span className={`${base} bottom-2.5 left-2.5 border-b border-l ${c}`} />
      <span className={`${base} bottom-2.5 right-2.5 border-b border-r ${c}`} />
    </>
  );
}

const SPIN: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

const TONES = {
  cyan: { edge: "rgba(34,211,238,0.25)", light: "rgba(34,211,238,0.95)" },
  amber: { edge: "rgba(251,191,36,0.25)", light: "rgba(251,191,36,0.95)" },
  emerald: { edge: "rgba(16,185,129,0.25)", light: "rgba(16,185,129,0.95)" },
  violet: { edge: "rgba(167,139,250,0.25)", light: "rgba(167,139,250,0.95)" },
  rose: { edge: "rgba(251,113,133,0.25)", light: "rgba(251,113,133,0.95)" },
} as const;

/* ------------------------------------------------------------------ */
/* コマンド発動エフェクト (操作の瞬間に走る光の掃引 + フラッシュ + リング) */
/* ------------------------------------------------------------------ */
function CommandFX({ trigger, tone }: { trigger: number; tone: keyof typeof TONES }) {
  const c = TONES[tone].light;
  // trigger が変わったら短時間だけ表示し、その後エフェクトごと取り外す (残像防止)
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 800);
    return () => clearTimeout(id);
  }, [trigger]);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* フラッシュ */}
      <motion.div key={`f${trigger}`}
        initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 45%, ${c}, transparent 62%)`, mixBlendMode: "screen" }} />
      {/* 水平スイープ光 */}
      <motion.div key={`s${trigger}`}
        initial={{ x: "-130%" }} animate={{ x: "130%" }} transition={{ duration: 0.65, ease: "easeInOut" }}
        className="absolute inset-y-0 w-1/3"
        style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)`, opacity: 0.5 }} />
      {/* 拡張リング */}
      <motion.span key={`r${trigger}`}
        initial={{ scale: 0.3, opacity: 0.85 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute left-1/2 top-[42%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: c }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* アンビエントHUD: ビネット / 漂うレティクル / まれなグリッチ          */
/* ------------------------------------------------------------------ */
function AmbientFX() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5]">
      {/* 端を締めるビネット(脈動) */}
      <div className="anim-vignette absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.55) 100%)" }} />
      {/* 漂うターゲットレティクル */}
      <div className="anim-roam absolute left-[14%] top-[22%] opacity-30">
        <svg viewBox="0 0 80 80" className="h-16 w-16">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="40" cy="40" r="30" fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="2 8" />
          </g>
          <circle cx="40" cy="40" r="3" fill="none" stroke="#fbbf24" strokeWidth="1" />
          <line x1="40" y1="6" x2="40" y2="16" stroke="#22d3ee" strokeWidth="0.8" />
          <line x1="40" y1="64" x2="40" y2="74" stroke="#22d3ee" strokeWidth="0.8" />
          <line x1="6" y1="40" x2="16" y2="40" stroke="#22d3ee" strokeWidth="0.8" />
          <line x1="64" y1="40" x2="74" y2="40" stroke="#22d3ee" strokeWidth="0.8" />
        </svg>
      </div>
      <div className="anim-roam absolute right-[12%] bottom-[26%] opacity-20" style={{ animationDelay: "8s" }}>
        <svg viewBox="0 0 60 60" className="h-12 w-12">
          <g className="anim-spin-rev" style={SPIN}>
            <rect x="10" y="10" width="40" height="40" fill="none" stroke="#a78bfa" strokeWidth="0.7" strokeDasharray="3 6" />
          </g>
        </svg>
      </div>
      {/* まれに走るRGBグリッチ */}
      <div className="anim-glitch absolute inset-0 mix-blend-screen"
        style={{ background: "repeating-linear-gradient(0deg, rgba(34,211,238,0.10) 0, rgba(34,211,238,0.10) 1px, transparent 2px, transparent 4px)" }} />
    </div>
  );
}

/** アイアンマン風 角カットパネル (エッジを光が周回)。 */
function HudPanel({
  tone = "cyan", active = false, onClick, contentClassName = "", small = false, children,
}: {
  tone?: keyof typeof TONES; active?: boolean; onClick?: () => void;
  contentClassName?: string; small?: boolean; children: React.ReactNode;
}) {
  const c = TONES[tone];
  const clip = small ? "clip-bevel-sm" : "clip-bevel";
  return (
    <motion.div
      onClick={onClick} whileTap={onClick ? { scale: 0.97 } : undefined}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      className={`${clip} relative ${onClick ? "cursor-pointer" : ""}`}
      style={active ? { filter: `drop-shadow(0 0 22px ${c.light})` } : undefined}>
      {/* 静的エッジ */}
      <span className={`${clip} pointer-events-none absolute inset-0`} style={{ background: c.edge }} />
      {/* 周回する光 */}
      <span className={`${clip} anim-spin-slow pointer-events-none absolute inset-0`}
        style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${active ? c.light : "rgba(160,180,230,0.5)"} 16deg, transparent 72deg)` }} />
      {/* 内側パネル */}
      <span className={`${clip} pointer-events-none absolute inset-[1.5px] bg-[#070a12]/95 backdrop-blur-2xl`} />
      <span className={`relative flex ${contentClassName}`}>{children}</span>
    </motion.div>
  );
}

function HudRings({ unlocked, busy }: { unlocked: boolean; busy: boolean }) {
  const s = unlocked ? "#34d399" : "#22d3ee";
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2">
      {/* 放射スポーク (低速回転) */}
      <g className="anim-spin-slow" style={SPIN}>
        {[...Array(48)].map((_, i) => {
          const long = i % 4 === 0;
          return (
            <line key={i} x1="100" y1={long ? 8 : 11} x2="100" y2={long ? 17 : 15}
              stroke={s} strokeOpacity={long ? 0.45 : 0.22} strokeWidth="1"
              transform={`rotate(${(i / 48) * 360} 100 100)`} />
          );
        })}
        <circle cx="100" cy="100" r="94" fill="none" stroke={s} strokeOpacity="0.18" strokeWidth="0.6" />
      </g>
      {/* 中周: 分割アーク (逆回転) + ゴールド差し色 */}
      <g className={busy ? "anim-spin-rev" : "anim-spin-slow"} style={SPIN}>
        <circle cx="100" cy="100" r="78" fill="none" stroke={s} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="58 250" strokeLinecap="round" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="#fbbf24" strokeOpacity="0.65" strokeWidth="2" strokeDasharray="22 312" strokeDashoffset="-150" strokeLinecap="round" />
      </g>
      {/* レーダースイープ (扇形・回転) */}
      <g className="anim-spin-rev" style={SPIN}>
        <path d="M100 100 L100 34 A66 66 0 0 1 153 62 Z" fill={s} fillOpacity="0.07" />
      </g>
      {/* 内周 + 鼓動コア */}
      <circle cx="100" cy="100" r="62" fill="none" stroke={s} strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="100" cy="100" r="26" fill={s} fillOpacity="0.07" className="anim-core" style={SPIN} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* シーンボタン: 快適モード / 外出全OFF                                 */
/* ------------------------------------------------------------------ */
type SceneAction = "welcome" | "welcome_cozy" | "away";
function SceneButtons({
  roomSlug, admin, guard, t, hasWafu,
}: { roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>; t: typeof T["en"]; hasWafu?: boolean }) {
  const [busy, setBusy] = useState<SceneAction | null>(null);
  const [fx, setFx] = useState<{ n: number; a: SceneAction } | null>(null);

  const run = async (a: SceneAction) => {
    if (busy) return;
    primeVoice(); // タップ内で音声を解放
    if (guard && !(await guard())) return;
    blip(); sweep(); setBusy(a); setFx((p) => ({ n: (p?.n ?? 0) + 1, a }));
    const ok = await callDevice(roomSlug, a, admin);
    if (ok) {
      (a === "away" ? powerDown : powerUp)();
      speakOneOf(a === "away"
        ? ["Goodbye", "Powering down", "Have a safe trip"]
        : a === "welcome_cozy"
        ? ["Cozy mode engaged", "Setting a warm mood", "Relax and unwind"]
        : ["Welcome home", "Comfort mode engaged", "Systems set for your return"]);
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 25 : [20, 40, 20]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <HudPanel tone="emerald" active onClick={() => run("welcome")} small
          contentClassName="flex-col items-center gap-2 px-4 py-5">
          <Corners tone="emerald" />
          <CommandFX trigger={fx?.a === "welcome" ? fx.n : 0} tone="emerald" />
          {busy === "welcome"
            ? <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
            : <Home className="h-6 w-6 text-emerald-300" strokeWidth={1.7} />}
          <span className="text-sm text-emerald-200">{t.comfortMode}</span>
        </HudPanel>
        <HudPanel tone="violet" onClick={() => run("away")} small
          contentClassName="flex-col items-center gap-2 px-4 py-5">
          <Corners tone="emerald" />
          <CommandFX trigger={fx?.a === "away" ? fx.n : 0} tone="violet" />
          {busy === "away"
            ? <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
            : <LogOut className="h-6 w-6 text-violet-300" strokeWidth={1.7} />}
          <span className="text-sm text-violet-200">{t.awayMode}</span>
        </HudPanel>
      </div>
      {hasWafu && (
        <HudPanel tone="rose" onClick={() => run("welcome_cozy")} small
          contentClassName="items-center justify-center gap-2 px-4 py-4">
          <Corners tone="rose" />
          <CommandFX trigger={fx?.a === "welcome_cozy" ? fx.n : 0} tone="rose" />
          {busy === "welcome_cozy"
            ? <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
            : <LampFloor className="h-5 w-5 text-rose-300" strokeWidth={1.7} />}
          <span className="text-sm text-rose-200">{t.cozyMode}</span>
        </HudPanel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* スマートロック カード (波紋 + サイバー解錠エフェクト)                */
/* ------------------------------------------------------------------ */
function LockCard({ roomSlug, t, admin, guard }: { roomSlug: string; t: typeof T["en"]; admin?: boolean; guard?: () => Promise<boolean> }) {
  // 状態取得はしない (API節約)。押したコマンドをそのまま送る明示式。
  const [last, setLast] = useState<"unlock" | "lock" | null>(null);
  const [busy, setBusy] = useState<"unlock" | "lock" | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [ripple, setRipple] = useState(0);
  const [fx, setFx] = useState(0);

  const run = useCallback(async (action: "unlock" | "lock") => {
    if (busy) return;
    primeVoice(); // タップの瞬間に音声を解放 (iOSで後続のspeakを鳴らす)
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(action); setResult(null); setRipple((r) => r + 1); setFx((f) => f + 1);
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) {
      setLast(action);
      (action === "unlock" ? powerUp : powerDown)();
      speakOneOf(action === "unlock"
        ? ["Door unlocked", "Access granted", "Welcome in"]
        : ["Door secured", "Locked and secured", "Lockdown engaged"]);
    } else sfxError();
    setResult(ok);
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 30 : [20, 40, 20]);
    setTimeout(() => setResult(null), 1900);
  }, [busy, roomSlug, admin, guard]);

  const unlocked = last === "unlock";
  const Icon = unlocked ? LockKeyholeOpen : LockKeyhole;
  const statusText = busy ? t.sending
    : result === true ? (last === "unlock" ? t.unlocked : t.locked)
    : result === false ? t.failed : "";

  return (
    <HudPanel tone={unlocked ? "emerald" : "cyan"} active
      contentClassName="flex-col items-center overflow-hidden px-6 py-10">
      <Corners tone={unlocked ? "emerald" : "cyan"} />
      <CommandFX trigger={fx} tone={unlocked ? "emerald" : "cyan"} />
      <HudRings unlocked={unlocked} busy={!!busy} />

      {/* 波紋 + スパーク (操作時) */}
      <AnimatePresence>
        <motion.span key={ripple}
          initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`pointer-events-none absolute h-32 w-32 rounded-full ${unlocked ? "bg-emerald-400/30" : "bg-cyan-400/30"}`} />
      </AnimatePresence>
      <div className="pointer-events-none absolute left-1/2 top-[38%]">
        {ripple > 0 && [...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <motion.span key={`${ripple}-${i}`}
              initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: Math.cos(a) * 80, y: Math.sin(a) * 80, scale: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className={`absolute h-1 w-1 rounded-full ${unlocked ? "bg-emerald-300" : "bg-cyan-300"}`} />
          );
        })}
      </div>

      {/* 中央アイコン (最後の操作を反映する目安) */}
      <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
        <motion.div
          animate={busy ? { rotate: [0, -8, 8, 0] } : {}} transition={{ duration: 0.5 }}
          className={`anim-breathe relative flex h-20 w-20 items-center justify-center rounded-full border
            ${unlocked ? "border-emerald-400/60 bg-emerald-400/10" : "border-cyan-400/50 bg-cyan-400/10"}`}>
          {busy
            ? <Loader2 className={`h-9 w-9 animate-spin ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} />
            : <Icon className={`h-10 w-10 ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} strokeWidth={1.5} />}
        </motion.div>
      </div>

      {/* ステータス (操作結果を一時表示) */}
      <span className={`relative h-5 text-sm font-medium tracking-wide
        ${result === false ? "text-rose-300" : unlocked ? "text-emerald-300" : "text-cyan-200"}`}>
        {statusText}
      </span>

      {/* 解錠 / 施錠 ボタン */}
      <div className="relative mt-4 grid w-full grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => run("unlock")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-2 border border-emerald-400/50
            bg-emerald-500/15 py-3.5 text-sm text-emerald-200 active:bg-emerald-500/30 disabled:opacity-50">
          {busy === "unlock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyholeOpen className="h-4 w-4" />}
          {t.unlock}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => run("lock")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-2 border border-cyan-400/50
            bg-cyan-500/15 py-3.5 text-sm text-cyan-200 active:bg-cyan-500/30 disabled:opacity-50">
          {busy === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {t.lock}
        </motion.button>
      </div>
    </HudPanel>
  );
}

/* ------------------------------------------------------------------ */
/* ON/OFF トグルカード (エアコン / 照明)                                */
/* ------------------------------------------------------------------ */
function ToggleCard({
  roomSlug, icon: Icon, label, accent, onAction, offAction, t, admin, guard,
}: {
  roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>;
  icon: typeof Snowflake; label: string; accent: "cyan" | "amber" | "rose";
  onAction: DeviceAction; offAction: DeviceAction; t: typeof T["en"];
}) {
  // 明示式: 押したON/OFFをそのまま送る (状態のズレなし)
  const [last, setLast] = useState<"on" | "off" | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [fx, setFx] = useState(0);
  const on = last === "on";

  const palette = accent === "cyan"
    ? { text: "text-cyan-300", glow: "rgba(34,211,238,0.6)", dot: "bg-cyan-400", hx: "bg-cyan-400/30", stroke: "#22d3ee" }
    : accent === "rose"
    ? { text: "text-rose-300", glow: "rgba(251,113,133,0.6)", dot: "bg-rose-400", hx: "bg-rose-400/30", stroke: "#fb7185" }
    : { text: "text-amber-300", glow: "rgba(251,191,36,0.6)", dot: "bg-amber-400", hx: "bg-amber-400/30", stroke: "#fbbf24" };

  const send = async (which: "on" | "off") => {
    if (busy) return;
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(which); setFx((f) => f + 1);
    const ok = await callDevice(roomSlug, which === "on" ? onAction : offAction, admin);
    if (ok) { setLast(which); (which === "on" ? powerUp : powerDown)(); }
    else sfxError();
    setBusy(null);
    if (navigator.vibrate) navigator.vibrate(which === "on" ? 22 : 16);
  };

  return (
    <HudPanel tone={accent} active={on} small
      contentClassName="flex-col items-center gap-3 px-4 py-6">
      <Corners tone={accent} />
      <CommandFX trigger={fx} tone={accent} />
      {/* 六角形アイコンフレーム */}
      <motion.div
        animate={{ scale: on ? 1.05 : 1, opacity: on ? 1 : 0.6 }}
        className="relative flex h-14 w-14 items-center justify-center">
        <svg viewBox="0 0 100 100" className="anim-spin-rev pointer-events-none absolute inset-[-9px]" style={SPIN}>
          {[...Array(24)].map((_, i) => (
            <line key={i} x1="50" y1="4" x2="50" y2={i % 3 === 0 ? "10" : "8"}
              stroke={palette.stroke} strokeOpacity={on ? 0.55 : 0.25}
              strokeWidth="1" transform={`rotate(${(i / 24) * 360} 50 50)`} />
          ))}
        </svg>
        {on && <span className="anim-spin-slow pointer-events-none absolute inset-0"
          style={{ background: `conic-gradient(from 0deg, transparent, ${palette.glow}, transparent 55%)`, clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)" }} />}
        <span className={`clip-hex absolute inset-0 ${on ? palette.hx : "bg-white/10"}`} />
        <span className="clip-hex absolute inset-[1.5px] bg-[#0b1018]" />
        <Icon className={`relative h-6 w-6 ${on ? palette.text : "text-white/40"}`} strokeWidth={1.6} />
      </motion.div>

      <span className={`text-sm ${on ? palette.text : "text-white/60"}`}>{label}</span>

      {/* ON / OFF ボタン */}
      <div className="grid w-full grid-cols-2 gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("on")} disabled={!!busy}
          className={`clip-bevel-sm flex items-center justify-center gap-1 border py-2.5 text-xs disabled:opacity-50
            ${accent === "cyan" ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
              : accent === "rose" ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
              : "border-amber-400/50 bg-amber-500/15 text-amber-200"}`}>
          {busy === "on" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t.on.toUpperCase()}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("off")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-1 border border-white/15 bg-white/5 py-2.5 text-xs text-white/60 disabled:opacity-50">
          {busy === "off" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t.off.toUpperCase()}
        </motion.button>
      </div>
    </HudPanel>
  );
}

/* ------------------------------------------------------------------ */
/* 和風ライト: ON/OFF + 詳細ページへの導線 (詳細は別ページ)             */
/* ------------------------------------------------------------------ */
function WafuCard({
  roomSlug, admin, guard, t,
}: { roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>; t: typeof T["en"] }) {
  const [last, setLast] = useState<"on" | "off" | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | "warm" | null>(null);
  const [fx, setFx] = useState(0);
  const on = last === "on";
  const detailHref = admin ? `/admin/test/${roomSlug}/light` : `/room/${roomSlug}/light`;

  const send = async (which: "on" | "off" | "warm") => {
    if (busy) return;
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(which); setFx((f) => f + 1);
    // 管理者がONにするときは既定の暖色(2700K/100%)で点灯。
    const action = which === "on" ? (admin ? "wafu_on_warm" : "wafu_on")
      : which === "off" ? "wafu_off" : "wafu_warm";
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) {
      if (which === "on") { setLast("on"); powerUp(); }
      else if (which === "off") { setLast("off"); powerDown(); }
      else blip();
    } else sfxError();
    setBusy(null);
    if (navigator.vibrate) navigator.vibrate(which === "off" ? 16 : 22);
  };

  return (
    <HudPanel tone="rose" active={on} small
      contentClassName="flex-col items-center gap-3 px-4 py-6">
      <Corners tone="rose" />
      <CommandFX trigger={fx} tone="rose" />
      <motion.div
        animate={{ scale: on ? 1.05 : 1, opacity: on ? 1 : 0.6 }}
        className="relative flex h-14 w-14 items-center justify-center">
        <span className={`clip-hex absolute inset-0 ${on ? "bg-rose-400/30" : "bg-white/10"}`} />
        <span className="clip-hex absolute inset-[1.5px] bg-[#0b1018]" />
        <LampFloor className={`relative h-6 w-6 ${on ? "text-rose-300" : "text-white/40"}`} strokeWidth={1.6} />
      </motion.div>

      <span className={`text-sm ${on ? "text-rose-300" : "text-white/60"}`}>{t.wafu}</span>

      {/* ON / OFF */}
      <div className="grid w-full grid-cols-2 gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("on")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-1 border border-rose-400/50 bg-rose-500/15 py-2.5 text-xs text-rose-200 disabled:opacity-50">
          {busy === "on" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t.on.toUpperCase()}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("off")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-1 border border-white/15 bg-white/5 py-2.5 text-xs text-white/60 disabled:opacity-50">
          {busy === "off" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t.off.toUpperCase()}
        </motion.button>
      </div>

      {/* 管理者のみ: ワンタップで暖色に戻す */}
      {admin && (
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => send("warm")} disabled={!!busy}
          className="clip-bevel-sm flex w-full items-center justify-center gap-1.5 border border-amber-400/40 bg-amber-500/10 py-2 text-[11px] text-amber-200 disabled:opacity-50">
          {busy === "warm" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {t.wafuWarmReset}
        </motion.button>
      )}

      {/* 詳細設定ページへ */}
      <a href={detailHref}
        className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 pt-3 text-[11px] text-rose-200/80 hover:text-rose-100">
        <Sliders className="h-3.5 w-3.5" /> {t.wafuDetails} <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </HudPanel>
  );
}

/* ------------------------------------------------------------------ */
/* ギャラクシーモード: プラネタリウムプロジェクター (対応部屋のみ)       */
/* ------------------------------------------------------------------ */
function GalaxyCard({
  roomSlug, admin, guard, t, onState,
}: {
  roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>;
  t: typeof T["en"]; onState: (on: boolean) => void;
}) {
  const [last, setLast] = useState<"on" | "off" | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [fx, setFx] = useState(0);
  const on = last === "on";

  const send = async (which: "on" | "off") => {
    if (busy) return;
    primeVoice();
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(which); setFx((f) => f + 1);
    const ok = await callDevice(roomSlug, which === "on" ? "galaxy_on" : "galaxy_off", admin);
    if (ok) {
      setLast(which); onState(which === "on");
      if (which === "on") {
        galaxyOn();
        speakOneOf(["Galaxy mode engaged", "Opening the cosmos", "Enjoy the stars"]);
      } else {
        galaxyOff();
        speakOneOf(["Returning to Earth", "Galaxy mode off", "Goodnight, stargazer"]);
      }
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? [15, 25, 40] : [20, 40, 20]);
  };

  return (
    <HudPanel tone="violet" active={on} contentClassName="flex-col items-center overflow-hidden px-6 py-7">
      <Corners tone={on ? "emerald" : "cyan"} />
      <CommandFX trigger={fx} tone="violet" />

      {/* カード内ミニ星空 (常時ゆらめく) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-nebula absolute -left-8 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="anim-nebula absolute -bottom-12 -right-6 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl" style={{ animationDelay: "4s" }} />
        {[...Array(on ? 22 : 9)].map((_, i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 37 + 13) % 96}%`, top: `${(i * 53 + 9) % 92}%`,
              width: i % 4 === 0 ? 2.5 : 1.5, height: i % 4 === 0 ? 2.5 : 1.5,
              animation: `twinkle ${2 + (i % 5) * 0.8}s ease-in-out ${(i % 7) * 0.5}s infinite`,
              boxShadow: "0 0 6px rgba(255,255,255,0.9)",
            }} />
        ))}
      </div>

      <div className="relative flex w-full items-center gap-4">
        {/* 回転する銀河アイコン */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className={`pointer-events-none absolute inset-[-8px] ${on ? "anim-spin-slow" : ""}`} style={SPIN}>
            <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#a78bfa" strokeOpacity={on ? 0.6 : 0.25} strokeWidth="1" />
            <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#f0abfc" strokeOpacity={on ? 0.4 : 0.15} strokeWidth="0.8"
              transform="rotate(60 50 50)" />
            <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#818cf8" strokeOpacity={on ? 0.4 : 0.15} strokeWidth="0.8"
              transform="rotate(-60 50 50)" />
          </svg>
          <motion.div animate={{ scale: on ? [1, 1.12, 1] : 1, opacity: on ? 1 : 0.55 }}
            transition={on ? { repeat: Infinity, duration: 2.4 } : {}}
            className={`flex h-12 w-12 items-center justify-center rounded-full border
              ${on ? "border-violet-400/70 bg-violet-500/20 shadow-[0_0_30px_-4px_rgba(167,139,250,0.9)]" : "border-violet-400/30 bg-violet-500/10"}`}>
            <Sparkles className={`h-6 w-6 ${on ? "text-violet-200" : "text-violet-300/60"}`} strokeWidth={1.5} />
          </motion.div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] tracking-[0.3em] text-violet-300/70">GALAXY MODE</p>
          <p className={`mt-0.5 text-sm font-medium ${on ? "text-violet-100" : "text-violet-200/90"}`}>{t.galaxy}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/40">{t.galaxyDesc}</p>
        </div>
      </div>

      {/* ON / OFF */}
      <div className="relative mt-4 grid w-full grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => send("on")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-2 border border-violet-400/50
            bg-violet-500/15 py-3 text-sm text-violet-200 active:bg-violet-500/30 disabled:opacity-50">
          {busy === "on" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t.on.toUpperCase()}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => send("off")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-2 border border-white/15
            bg-white/5 py-3 text-sm text-white/60 active:bg-white/10 disabled:opacity-50">
          {busy === "off" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.off.toUpperCase()}
        </motion.button>
      </div>
    </HudPanel>
  );
}

/** ギャラクシーON中の全画面星空 (またたく星 + 流れ星 + 星雲) */
function GalaxyOverlay() {
  const stars = useMemo(
    () => [...Array(70)].map(() => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2.2,
      dur: 1.6 + Math.random() * 3.4,
      delay: Math.random() * 4,
      violet: Math.random() > 0.82,
    })),
    []
  );
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
      className="pointer-events-none fixed inset-0 z-[6] overflow-hidden">
      {/* 深宇宙トーン + 星雲 */}
      <div className="absolute inset-0 bg-[#050214]/55" />
      <div className="anim-nebula absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[90px]" />
      <div className="anim-nebula absolute bottom-[15%] right-[5%] h-80 w-80 rounded-full bg-indigo-600/25 blur-[100px]" style={{ animationDelay: "5s" }} />
      <div className="anim-nebula absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/15 blur-[80px]" style={{ animationDelay: "2.5s" }} />
      {/* またたく星 */}
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full"
          style={{
            left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
            background: s.violet ? "rgba(216,180,254,0.95)" : "rgba(255,255,255,0.92)",
            boxShadow: s.violet ? "0 0 8px rgba(216,180,254,0.9)" : "0 0 6px rgba(255,255,255,0.85)",
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
      ))}
      {/* 流れ星 */}
      {[0, 1].map((i) => (
        <span key={`sh${i}`} className="absolute h-px w-24"
          style={{
            right: i === 0 ? "6%" : "28%", top: i === 0 ? "14%" : "38%",
            background: "linear-gradient(90deg, rgba(255,255,255,0.95), transparent)",
            animation: `shootingStar ${9 + i * 4}s linear ${i * 5.5}s infinite`,
          }} />
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 光目覚まし カード (タイムピッカー)                                   */
/* ------------------------------------------------------------------ */
function WakeCard({
  roomSlug, checkOut, t, lang, admin,
}: {
  roomSlug: string; checkOut: string; t: typeof T["en"]; lang: Lang; admin?: boolean;
}) {
  const [time, setTime] = useState("07:00");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    blip();
    setState("busy"); setErr(null);
    // 次に来る該当時刻(JST固定)を計算。端末のタイムゾーンに依存しない。
    const [h, m] = time.split(":").map(Number);
    const nowMs = Date.now();
    // 現在のJST壁時計の年月日を取得 (JST = UTC+9, サマータイム無し)
    const jstNow = new Date(nowMs + 9 * 3600 * 1000);
    const jY = jstNow.getUTCFullYear();
    const jM = jstNow.getUTCMonth();
    const jD = jstNow.getUTCDate();
    // 「そのJST日の h:m」をUTCの瞬間として算出 (UTC = JST - 9h)
    let fireMs = Date.UTC(jY, jM, jD, h - 9, m, 0, 0);
    if (fireMs <= nowMs) fireMs += 24 * 3600 * 1000; // 過ぎていれば翌日
    const fire = new Date(fireMs);

    try {
      // ゲスト: PIN認証セッション経由 / admin(テストページ): 管理者Cookie経由
      const res = await fetch(admin ? "/api/admin/test-alarm" : `/api/alarms/${roomSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin
          ? { roomSlug, fireAtIso: fire.toISOString() }
          : { fireAtIso: fire.toISOString() }),
      });
      if (res.ok) { setState("set"); sfxConfirm(); }
      else {
        sfxError();
        const j = await res.json().catch(() => ({} as any));
        setErr(j?.error === "OUT_OF_STAY" ? "チェックアウト前の時刻にしてください / Set a time before check-out"
          : j?.error || `ERR ${res.status}`);
        setState("idle");
      }
    } catch (e: any) {
      setErr(e?.message || "network error"); setState("idle");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
      <HudPanel tone="violet" contentClassName="flex-col p-5">
        <div className="flex items-center gap-2.5">
          <AlarmClock className="h-5 w-5 text-violet-300" strokeWidth={1.6} />
          <span className="text-sm text-violet-200">{t.wakeLight}</span>
          <span className="anim-breathe ml-auto inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="time"
            value={time}
            onChange={(e) => { setTime(e.target.value); setState("idle"); }}
            className="clip-bevel-sm flex-1 border border-white/10 bg-black/50 px-4 py-3
              text-center font-mono text-3xl tracking-widest text-violet-100
              [color-scheme:dark] focus:border-violet-400/60 focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={submit}
            disabled={state === "busy"}
            className="clip-bevel-sm flex h-[58px] items-center gap-1.5 border border-violet-400/50
              bg-violet-500/15 px-5 text-sm text-violet-200 active:bg-violet-500/30"
          >
            {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === "set" && <Check className="h-4 w-4 text-emerald-300" />}
            {state === "set" ? t.alarmSet : t.setAlarm}
          </motion.button>
        </div>
        {err && <p className="mt-2 text-center text-[11px] text-rose-300">{err}</p>}
      </HudPanel>
    </motion.div>
  );
}
