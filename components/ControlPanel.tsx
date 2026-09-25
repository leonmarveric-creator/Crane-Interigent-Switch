"use client";

import { rememberLang } from "@/lib/langCookie";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LockKeyhole, LockKeyholeOpen, Snowflake, Lightbulb, LampFloor, Sliders, RotateCcw, ChevronRight,
  AlarmClock, Check, Loader2, Globe, Volume2, VolumeX, Home, LogOut, PowerOff, Sparkles, Radio, Moon, MoonStar,
  Sun, Sunrise, Flame, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
} from "lucide-react";
import { GX, T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import EntranceKeyButton from "@/components/EntranceKeyButton";
import { callDevice, type DeviceAction } from "@/lib/deviceClient";
import type { WakeLightMode } from "@/lib/wakePrewake";
import { blip, powerUp, powerDown, error as sfxError, speak, speakOneOf, primeVoice, charge, sweep, setMuted as sfxSetMuted, navTick, keyTick, confirm as sfxConfirm, galaxyOn, galaxyOff, hoverTick, startAmbient, stopAmbient, toggleServo, systemChord, dataBurst, reticleLock, bootStage } from "@/lib/sfx";
import ArcReactorX from "@/components/tech/ArcReactorX";
import TechPercent from "@/components/tech/TechPercent";
import TechButton from "@/components/tech/TechButton";
import VoiceMic, { useVoiceAction } from "@/components/tech/VoiceMic";
import type { VoiceAction } from "@/lib/voiceCommand";
import { TouchReticle, GalaxyLaunch, LockShield, NetworkField, PerspectiveFloor, LightStreaks, TelemetryHud } from "@/components/tech/TechFX";

interface Props {
  guestName?: string | null;
  entranceHref?: string | null;
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
  hasNest?: boolean; // NESTモード (藤編みボールランプ) 対応の部屋
  hasWafu?: boolean; // 和風ライト(行灯) 対応の部屋
  /** 起動の声: astralis = 「ASTRALIS system online」 / jarvis = 従来の J.A.R.V.I.S 系 */
  bootVoice?: "astralis" | "jarvis";
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

/** 六角形グリッドの背景タイル */
const HEX_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><path d='M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L28 97' fill='none' stroke='%2322d3ee' stroke-width='0.6'/></svg>\")";

/**
 * 奥行き (パララックス): スマホの傾き (Android など許可不要な端末) / 指やマウスの位置で
 * main 要素に CSS 変数 --px / --py (-1〜1) をセットする。再描画なしで軽い。
 */
function useParallax(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", Math.max(-1, Math.min(1, x)).toFixed(3));
        el.style.setProperty("--py", Math.max(-1, Math.min(1, y)).toFixed(3));
      });
    };
    const onMove = (e: PointerEvent) => set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      set(e.gamma / 30, (e.beta - 45) / 30);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [ref]);
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


export default function ControlPanel({
  roomSlug, roomName, checkOut, initialLang, admin, imageUrl, lat, lng, radiusM, hasGalaxy, hasNest, hasWafu, guestName, entranceHref, bootVoice = "astralis",
}: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [muted, setMuted] = useState(false);
  const [galaxyActive, setGalaxyActive] = useState(false); // 星空オーバーレイ表示
  const [galaxyLaunch, setGalaxyLaunch] = useState(0); // ギャラクシー起動演出
  // 起動演出 (ゲスト時のみ): この端末でこの部屋を初めて開いたときだけフル演出 (約2.6秒)。
  // 2回目以降は 0.5 秒の短い起動 (リアクターが光って ONLINE) ですぐ操作できるようにする。
  const [booting, setBooting] = useState<"pending" | "full" | "quick" | null>(admin ? null : "pending");
  useEffect(() => {
    if (admin) return;
    const key = `techBooted:${roomSlug}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setBooting(seen ? "quick" : "full");
  }, [admin, roomSlug]);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const geoCache = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const [ambientOn, setAmbientOn] = useState(false); // アークリアクターのハム (opt-in)
  const weather = useWeather(lat, lng);
  const t = T[lang];
  const mainRef = useRef<HTMLElement | null>(null);
  const reactorRef = useRef<HTMLDivElement | null>(null);
  useParallax(mainRef);

  // アンビエントハムのON/OFF (ミュート時は自動停止)。
  const toggleAmbient = () => setAmbientOn((v) => {
    const n = !v;
    if (n) { primeVoice(); startAmbient(); } else stopAmbient();
    return n;
  });
  // アンマウント時とタブ非表示時はハムを止める。
  useEffect(() => {
    const onVis = () => { if (document.hidden) stopAmbient(); else if (ambientOn && !muted) startAmbient(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stopAmbient(); };
  }, [ambientOn, muted]);

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
    if (n) setAmbientOn(false); // ミュートしたらハムも止める
    else setTimeout(navTick, 0); // ミュート解除時に確認音
    return n;
  });

  return (
    <main ref={mainRef} className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white">

      {/* ギャラクシーモード起動の特別演出 */}
      <GalaxyLaunch trigger={galaxyLaunch} />
      {/* 音声コントロール: 右下に浮かぶマイクボタン + 初回だけの案内 */}
      <VoiceMic lang={lang} roomSlug={roomSlug} lat={lat} lng={lng} caps={{ hasGalaxy, hasNest, hasWafu }} texts={{
        fab: t.voiceFab, tipTitle: t.voiceTipTitle, tipBody: t.voiceTipBody,
        listening: t.voiceListening, retry: t.voiceRetry, denied: t.voiceDenied, why: t.voiceWhy, examples: t.voiceExamples,
        label: (a) => voiceLabel(a, t),
        q: { wifi: t.qWifi, checkout: t.qCheckout, entrance: t.qEntrance, room: t.qRoom, ssid: t.qSsid, password: t.qPassword, none: t.qNone, copy: t.qCopy, copied: t.qCopied, loading: t.qLoading,
          weather: t.qWeather, today: t.qToday, tomorrow: t.qTomorrow, rain: t.qRain, umbrellaYes: t.qUmbrellaYes, umbrellaMaybe: t.qUmbrellaMaybe, umbrellaNo: t.qUmbrellaNo,
          nearby: t.qNearby, store: t.qStore, station: t.qStation, laundry: t.qLaundry, openMap: t.qOpenMap,
          emergency: t.qEmergency, police: t.qPolice, ambulance: t.qAmbulance, host: t.qHost, emergencyNote: t.qEmergencyNote },
      }} />

      {/* 触れた位置にミニマルな照準 */}
      <TouchReticle containerRef={mainRef} />

      {/* 起動シーケンス */}
      <AnimatePresence>
        {booting === "pending" && <div key="boot-pending" className="fixed inset-0 z-[70] bg-[#04060c]" />}
        {booting === "full" && <BootSequence key="boot-full" onDone={() => setBooting(null)} roomName={roomName} voice={bootVoice} />}
        {booting === "quick" && <QuickBoot key="boot-quick" onDone={() => setBooting(null)} roomName={roomName} />}
      </AnimatePresence>

      {/* 背景: 動くオーロラ + 走査線 + グリッド (スマホの傾き / 指の位置で少し動く = 奥行き) */}
      <div className="pointer-events-none absolute inset-0"
        style={{ transform: "translate3d(calc(var(--px, 0) * -14px), calc(var(--py, 0) * -14px), 0)", transition: "transform 0.25s ease-out" }}>
        {/* 3D の床グリッド / 粒子のネットワーク / 光のすじ */}
        <PerspectiveFloor />
        <NetworkField />
        <LightStreaks />
        {/* 六角形グリッド (ゆっくり流れる) */}
        <div className="anim-hexdrift absolute inset-[-40px] opacity-[0.07]" style={{ backgroundImage: HEX_BG }} />
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
        <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] opacity-[0.07]"
          style={{ transform: "translate(-50%, -50%) translate3d(calc(var(--px, 0) * 22px), calc(var(--py, 0) * 22px), 0)" }}>
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

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-28 pt-8">
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
          <div className="flex items-start gap-3">
            <div ref={reactorRef} className="-ml-1 -mt-1"><ArcReactorX size={52} active={ambientOn} /></div>
            <div>
            {guestName ? (
              <p className="text-[13px] font-semibold tracking-wide text-cyan-200/90">{GX[lang].welcomeName(guestName)}</p>
            ) : (
              <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">{t.welcome.toUpperCase()}</p>
            )}
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
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleAmbient}
              onPointerEnter={hoverTick}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md active:scale-95
                ${ambientOn ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200 [box-shadow:0_0_14px_rgba(34,211,238,0.5)]" : "border-white/10 bg-white/5 text-white/40"}`}
              aria-label="ambient reactor hum">
              <Radio className={`h-4 w-4 ${ambientOn ? "anim-breathe" : ""}`} />
            </button>
            <button onClick={toggleMute}
              onPointerEnter={hoverTick}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-300 backdrop-blur-md active:scale-95"
              aria-label="sound">
              {muted ? <VolumeX className="h-4 w-4 text-white/40" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <LangSwitch lang={lang} setLang={setLang} />
          </div>
        </motion.header>

        {/* 外出 (全部OFF): 出かける時にすぐ押せるよう鍵の上に置く */}
        <motion.div className="mb-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <SceneButtons part="away" roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t} hasWafu={hasWafu} onGalaxyState={setGalaxyActive} />
        </motion.div>

        {/* スマートロック (いちばん最初に使うので、部屋名のすぐ下) */}
        <motion.div className="mb-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <LockCard roomSlug={roomSlug} t={t} admin={admin} guard={guardCommand} />
        </motion.div>

        {/* 常に動く HUD (レーダー + ゲージ) */}
        {!admin && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.105 }}>
            <TelemetryHud temp={weather?.temp ?? null} checkOut={checkOut}
              devices={["LOCK", "LIGHT", "AIR", ...(hasWafu ? ["WAFU"] : []), ...(hasGalaxy ? ["GALAXY"] : []), ...(hasNest ? ["NEST"] : [])]} />
          </motion.div>
        )}

        {entranceHref && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="mb-4">
            <EntranceKeyButton href={entranceHref} lang={lang} variant="tech" />
          </motion.div>
        )}

        {/* モード (ノーマル / 快適 / ギャラクシー / ネスト / 和み): スクロールしなくても目に入る位置 */}
        <motion.div className="mb-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.115 }}>
          <ModeGrid roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t}
            hasGalaxy={hasGalaxy} hasNest={hasNest} hasWafu={hasWafu} onGalaxyState={setGalaxyActive}
            onGalaxyLaunch={() => setGalaxyLaunch((n) => n + 1)}
            />
        </motion.div>

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
          <SceneButtons part="rest" roomSlug={roomSlug} admin={admin} guard={guardCommand} t={t} hasWafu={hasWafu} onGalaxyState={setGalaxyActive} />
        </motion.div>

        {/* 光目覚まし (スクロールせず見えるよう上部に配置) */}
        <motion.div className="mt-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <WakeCard roomSlug={roomSlug} checkOut={checkOut} t={t} lang={lang} admin={admin} hasWafu={hasWafu} />
        </motion.div>

        {/* デバイスグリッド */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
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
                  onClick={() => { setLang(l); rememberLang(l); setOpen(false); navTick(); }}
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
/** 2回目以降の短い起動 (約0.5秒): リアクターが一瞬光って「SYSTEMS ONLINE」→ すぐ操作画面へ */
function QuickBoot({ onDone, roomName }: { onDone: () => void; roomName: string }) {
  // onDone は親の再描画のたびに新しくなるので ref で持ち、音は 1 回だけ鳴らす
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    systemChord(); // フル演出の最後と同じ到達和音 (新しい音は足さない)
    const id = setTimeout(() => doneRef.current(), 520);
    return () => clearTimeout(id);
  }, []);
  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.3 }}
      onClick={onDone}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#04060c]">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
        <ArcReactorX size={130} active progress={1} />
      </motion.div>
      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.25 }}
        className="mt-4 font-mono text-[11px] tracking-[0.3em] text-cyan-200">
        <span className="text-emerald-400">›</span> SYSTEMS ONLINE · {roomName.toUpperCase()}
      </motion.p>
      <div className="anim-bootflash-quick pointer-events-none absolute inset-0 bg-cyan-50" />
    </motion.div>
  );
}

/** 起動の声のバリエーション (毎回ランダムに 1 つ)。name は起動画面の「○○ ····· READY」に出す名前 */
const BOOT_LINES: Record<"astralis" | "jarvis", { say: string; name: string }[]> = {
  astralis: [
    { say: "ASTRALIS system online", name: "ASTRALIS" },
    { say: "CELESTIAL link established", name: "CELESTIAL" },
    { say: "CELESTIAL core online", name: "CELESTIAL" },
    { say: "CELESTIAL system online. Welcome back.", name: "CELESTIAL" },
    { say: "CELESTIAL. All systems online.", name: "CELESTIAL" },
  ],
  jarvis: [
    { say: "All systems online", name: "J.A.R.V.I.S" },
    { say: "Good evening. Systems online", name: "J.A.R.V.I.S" },
    { say: "J.A.R.V.I.S online", name: "J.A.R.V.I.S" },
  ],
};

function BootSequence({ onDone, roomName, voice = "astralis" }: { onDone: () => void; roomName: string; voice?: "astralis" | "jarvis" }) {
  // 起動ごとに声を 1 つ選ぶ (再描画では変わらない)
  const [line] = useState(() => { const l = BOOT_LINES[voice]; return l[Math.floor(Math.random() * l.length)]; });
  // 充電ゲージ 0 → 1 (2.4 秒)
  const [charged, setCharged] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const x = Math.min(1, (now - t0) / 2400);
      setCharged(1 - Math.pow(1 - x, 3));
      if (x < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // onDone は親 (操作画面) の再描画のたびに新しい関数になる。
  // これを依存にすると、天気の読み込みなどで再描画されるたびに起動音と音声がもう一度鳴って重なるので、ref で持つ。
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    charge(); // 起動チャージ音
    // 起動の声 (管理画面で切り替え): ASTRALIS / CELESTIAL の 5 種類 か 従来の J.A.R.V.I.S 系 3 種類からランダム。
    // iOSではジェスチャー外のため鳴らない場合あり
    speak(line.say);
    // 各ターミナル行の出現に同期した段階ビープ (行表示は delay 0.25 + i*0.4)
    const beeps = [0, 1, 2, 3, 4].map((i) =>
      setTimeout(() => bootStage(i), 250 + i * 400)
    );
    // "SECURE LINK" 確立時のデータ転送音
    const link = setTimeout(() => dataBurst(), 1050);
    // ルーム識別 (ターゲットロック) の照準音
    const lock = setTimeout(() => reticleLock(), 1650);
    // 起動完了の到達和音
    const chord = setTimeout(() => systemChord(), 2300);
    const id = setTimeout(() => doneRef.current(), 2600);
    return () => {
      clearTimeout(id); clearTimeout(chord); clearTimeout(link); clearTimeout(lock);
      beeps.forEach(clearTimeout);
    };
  }, []);

  const lines = [
    "INITIALIZING SYSTEM",
    "ARC REACTOR ·········· ONLINE",
    "SECURE LINK ·········· ESTABLISHED",
    `ROOM · ${roomName.toUpperCase()}`,
    `${line.name} ·········· READY`,
  ];

  return (
    <motion.div
      exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.5 }}
      onClick={onDone}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#04060c] px-8">
      {/* アークリアクター (充電ゲージが満ちていく) */}
      <div className="mb-6">
        <ArcReactorX size={190} active progress={charged} />
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

      {/* 充電率 (HUD 表示) */}
      <TechPercent value={charged} label="SYSTEM CHARGE" status={charged >= 1 ? "ONLINE" : "SYNC"} className="mt-5 w-60" />
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

      {/* ホログラフィックなデータ列 (背景に降る微細なコード) */}
      {[...Array(6)].map((_, i) => (
        <div key={i}
          className="anim-datafall absolute top-0 font-mono text-[9px] leading-[1.15] tracking-[0.15em] text-cyan-300/25"
          style={{
            left: `${8 + i * 16}%`,
            animationDuration: `${9 + (i % 4) * 3}s`,
            animationDelay: `${i * 1.7}s`,
            writingMode: "vertical-rl",
          }}>
          {["01001", "1100101", "A7F3", "0xE1", "10110", "SYS", "9F2C", "01"][i % 8]}
          {["1010", "0x4D", "READY", "0110", "C3", "10011", "0xB", "SYNC"][(i + 3) % 8]}
        </div>
      ))}

      {/* 画面をゆっくり横断する水平走査ビーム */}
      <div className="anim-hscan absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.55), transparent)" }} />
    </div>
  );
}

/** アイアンマン風 角カットパネル (エッジを光が周回)。 */
function HudPanel({
  tone = "cyan", active = false, onClick, contentClassName = "", small = false, className = "", children,
}: {
  tone?: keyof typeof TONES; active?: boolean; onClick?: () => void;
  contentClassName?: string; small?: boolean; className?: string; children: React.ReactNode;
}) {
  const c = TONES[tone];
  const clip = small ? "clip-bevel-sm" : "clip-bevel";
  const reduce = useReducedMotion();
  const scanDelay = useMemo(() => 0.05 + Math.random() * 0.3, []);
  return (
    <motion.div
      onClick={onClick} whileTap={onClick ? { scale: 0.97 } : undefined}
      onPointerEnter={onClick ? hoverTick : undefined}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      className={`${clip} relative ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={active ? { filter: `drop-shadow(0 0 22px ${c.light})` } : undefined}>
      {/* 静的エッジ */}
      <span className={`${clip} pointer-events-none absolute inset-0`} style={{ background: c.edge }} />
      {/* 周回する光 */}
      <span className={`${clip} anim-spin-slow pointer-events-none absolute inset-0`}
        style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${active ? c.light : "rgba(160,180,230,0.5)"} 16deg, transparent 72deg)` }} />
      {/* 内側パネル */}
      <span className={`${clip} pointer-events-none absolute inset-[1.5px] bg-[#070a12]/95 backdrop-blur-2xl`} />
      {/* ホログラム: 細い走査線 + ときどき表面を走る光 */}
      <span className={`${clip} pointer-events-none absolute inset-[1.5px] opacity-40`}
        style={{ background: "repeating-linear-gradient(0deg, rgba(160,230,255,0.05) 0 1px, transparent 1px 3px)" }} />
      <span className={`${clip} pointer-events-none absolute inset-[1.5px] overflow-hidden`}>
        <span className="tb-sheen absolute inset-y-0 -left-1/2 w-1/3"
          style={{ background: `linear-gradient(100deg, transparent, ${c.light.replace("0.95", "0.12")}, transparent)`, animationDelay: `${scanDelay * 10}s` }} />
      </span>
      {/* 出現時: レーザーが上から走って中身を描き出す (ホログラム投影風) */}
      {!reduce && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 z-10 h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${c.light}, transparent)`, boxShadow: `0 0 12px ${c.light}` }}
          initial={{ top: "0%", opacity: 0 }} animate={{ top: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.7, delay: scanDelay, ease: "easeInOut" }} />
      )}
      <motion.span className={`relative flex ${contentClassName}`}
        initial={reduce ? false : { clipPath: "inset(0 0 100% 0)", opacity: 0.4 }}
        animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
        transition={{ duration: 0.7, delay: scanDelay, ease: "easeInOut" }}>
        {children}
      </motion.span>
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
/* モード選択 (ノーマル / 快適 / ギャラクシー / ネスト / 和み)           */
/*   ノーマル = ほかのモードからメインライトだけ点灯の状態に戻す          */
/* ------------------------------------------------------------------ */
/** 音声コマンドの確認表示 (例: 「ギャラクシーモード オン」) */
function voiceLabel(a: VoiceAction, t: typeof T["en"]): string {
  switch (a) {
    case "normal": return t.normalMode;
    case "welcome": return t.comfortMode;
    case "welcome_cozy": return t.cozyMode;
    case "galaxy_on": return `${t.galaxy} ${t.on}`;
    case "galaxy_off": return `${t.galaxy} ${t.off}`;
    case "nest_on": return `${t.nest} ${t.on}`;
    case "nest_off": return `${t.nest} ${t.off}`;
    case "wafu_on": return `${t.wafu} ${t.on}`;
    case "wafu_off": return `${t.wafu} ${t.off}`;
    case "ac_on": return `${t.ac} ${t.on}`;
    case "ac_off": return `${t.ac} ${t.off}`;
    case "light_on": return `${t.light} ${t.on}`;
    case "light_off": return `${t.light} ${t.off}`;
    case "good_night": return t.goodNightMode;
    case "away": return t.awayMode;
    case "dream_fade": return t.dreamMode;
  }
}

/**
 * 横長のモードカードの背景アニメーション (SVG + CSS だけで軽い)。ON と OFF で見え方が変わる。
 *  ギャラクシー: OFF = まばらな星 / ON = 星がまたたき、渦巻く星雲がゆっくり回り、流れ星が走る
 *  ネスト:       OFF = 藤編みの模様がうっすら / ON = 編み目の奥から暖かい光が呼吸するように灯る
 *  Dream Fade:   OFF = 小さな月 / ON = 夕焼けから夜空へゆっくり移る空と、光る月・漂う光の粒
 *  和み:         OFF = 行灯の輪郭 / ON = 行灯の灯りがやわらかく揺らぐ
 */
function ModeScene({ k, on }: { k: "galaxy" | "nest" | "cozy" | "dream"; on: boolean }) {
  const stars = (n: number, seed: number) => Array.from({ length: n }, (_, j) => ({
    x: (j * 37 + seed * 11) % 100, y: (j * 53 + seed * 7) % 100, s: 1 + ((j * 13) % 3) * 0.6, d: 1.8 + (j % 5) * 0.6, dl: (j % 7) * 0.35,
  }));
  if (k === "galaxy") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-[1.5px] overflow-hidden">
        {on && (
          <span className="absolute left-[45%] top-1/2 flex h-0 w-0 items-center justify-center">
            <span className="mc-spin block h-[260px] w-[260px] shrink-0 rounded-full"
              style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(167,139,250,0.55) 40deg, transparent 100deg, rgba(56,189,248,0.4) 160deg, transparent 220deg, rgba(244,114,182,0.45) 290deg, transparent 360deg)", filter: "blur(14px)" }} />
          </span>
        )}
        {stars(on ? 26 : 9, 3).map((p, j) => (
          <span key={j} className="absolute rounded-full bg-white"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: on ? undefined : 0.35,
              animation: on ? `twinkle ${p.d}s ease-in-out ${p.dl}s infinite` : undefined, boxShadow: on ? "0 0 6px rgba(255,255,255,0.9)" : undefined }} />
        ))}
        {on && <span className="mc-shoot absolute left-[70%] top-[18%] h-px w-16 rotate-[-18deg] bg-gradient-to-l from-white to-transparent" />}
      </span>
    );
  }
  if (k === "nest") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-[1.5px] overflow-hidden">
        {on && <span className="mc-breathe absolute left-[20%] top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.45), rgba(251,146,60,0.15) 45%, transparent 70%)" }} />}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 200 60">
          {Array.from({ length: 14 }, (_, j) => (
            <g key={j} stroke="rgba(251,191,36,1)" strokeOpacity={on ? 0.22 : 0.08} strokeWidth="0.6" fill="none">
              <path d={`M${j * 16 - 20} 0 Q ${j * 16} 30 ${j * 16 - 20} 60`} />
              <path d={`M${j * 16 + 20} 0 Q ${j * 16} 30 ${j * 16 + 20} 60`} />
            </g>
          ))}
        </svg>
      </span>
    );
  }
  if (k === "dream") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-[1.5px] overflow-hidden">
        {on && <span className="mc-dusk absolute inset-0 opacity-60"
          style={{ backgroundImage: "linear-gradient(180deg, rgba(251,146,60,0.35), rgba(190,24,93,0.25) 30%, rgba(76,29,149,0.35) 60%, rgba(2,6,23,0.2) 100%)", backgroundSize: "100% 300%" }} />}
        <span className={`absolute right-[30%] top-1/2 h-7 w-7 -translate-y-1/2 rounded-full ${on ? "mc-moon" : ""}`}
          style={{ boxShadow: on ? "inset -7px -2px 0 0 rgba(254,243,199,0.95), 0 0 18px rgba(254,243,199,0.35)" : "inset -6px -2px 0 0 rgba(254,243,199,0.25)" }} />
        {on && stars(10, 9).map((p, j) => (
          <span key={j} className="mc-float absolute rounded-full bg-amber-100"
            style={{ left: `${p.x}%`, top: `${40 + (p.y % 60)}%`, width: 2, height: 2, animationDelay: `${p.dl * 2}s`, animationDuration: `${6 + p.d}s` }} />
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden className="pointer-events-none absolute inset-[1.5px] overflow-hidden">
      {on && <span className="mc-flicker absolute left-[20%] top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,113,133,0.35), rgba(251,146,60,0.12) 50%, transparent 70%)" }} />}
    </span>
  );
}

/** 「ギャラクシーモード」→ ["ギャラクシー", "モード"] (狭いタイルでは語の区切りで改行するため) */
function splitModeLabel(label: string): [string, string] {
  const m = label.match(/^(.*?)(\s*(?:モード|Mode|模式|모드))$/);
  return m && m[1] ? [m[1], m[2]] : [label, ""];
}
/** OFF ボタンの色 (モードの枠と同じ色) */
const OFF_STYLE: Record<string, string> = {
  cyan: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
  violet: "border-violet-300/40 bg-violet-400/15 text-violet-100",
  amber: "border-amber-300/40 bg-amber-400/15 text-amber-100",
  rose: "border-rose-300/40 bg-rose-400/15 text-rose-100",
};

type ModeKey = "normal" | "welcome" | "galaxy" | "nest" | "cozy" | "dream";
type BusyKey = ModeKey | "galaxyOff" | "nestOff" | "wafuOff";
/** 下に OFF ボタンを付けるモード (和み・Dream Fade の OFF は和風ライトを消す) */
type OffKey = "galaxy" | "nest" | "cozy" | "dream";
function ModeGrid({
  roomSlug, admin, guard, t, hasGalaxy, hasNest, hasWafu, onGalaxyState, onGalaxyLaunch,
}: {
  roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>; t: typeof T["en"];
  hasGalaxy?: boolean; hasNest?: boolean; hasWafu?: boolean; onGalaxyState?: (on: boolean) => void;
  onGalaxyLaunch?: () => void;
}) {
  const [active, setActive] = useState<ModeKey | null>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [fx, setFx] = useState<{ n: number; k: ModeKey } | null>(null);
  // Dream Fade の開始時刻 (残り時間の表示用。この端末で押したときだけ分かる)
  const dreamKey = `dreamStart:${roomSlug}`;
  const [dreamStart, setDreamStartState] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const setDreamStart = (v: number | null) => {
    setDreamStartState(v);
    try { if (v) localStorage.setItem(dreamKey, String(v)); else localStorage.removeItem(dreamKey); } catch { /* ignore */ }
  };
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(dreamKey));
      if (v && Date.now() - v < 30 * 60 * 1000) { setDreamStartState(v); setActive("dream"); }
    } catch { /* ignore */ }
  }, [dreamKey]);
  useEffect(() => {
    if (!dreamStart) return;
    const id = setInterval(() => {
      setNowTick(Date.now());
      if (Date.now() - dreamStart >= 30 * 60 * 1000) { setDreamStart(null); setActive((a) => (a === "dream" ? null : a)); }
    }, 20000);
    return () => clearInterval(id);
  }, [dreamStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const dreamLeft = dreamStart ? Math.max(0, Math.ceil((dreamStart + 30 * 60 * 1000 - nowTick) / 60000)) : null;
  // Dream Fade の説明: 押したあとにだけ表示し、しばらくすると自動で閉じる (場所を取らない)
  const [dreamInfo, setDreamInfo] = useState(false);
  useEffect(() => {
    if (!dreamInfo) return;
    const id = setTimeout(() => setDreamInfo(false), 20000);
    return () => clearTimeout(id);
  }, [dreamInfo]);

  const modes: { k: ModeKey; action: DeviceAction; tone: keyof typeof TONES; icon: typeof Lightbulb; label: string; desc: string; show: boolean; voice: string[] }[] = [
    { k: "normal", action: "normal", tone: "cyan", icon: Lightbulb, label: `${t.normalMode}${t.modeSuffix}`, desc: t.normalDesc, show: true, voice: ["Welcome home", "Systems set for your return"] },
    { k: "welcome", action: "welcome", tone: "emerald", icon: Home, label: t.comfortMode, desc: t.comfortDesc, show: true, voice: ["Welcome home", "Comfort mode engaged", "Systems set for your return"] },
    { k: "galaxy", action: "galaxy_on", tone: "violet", icon: Sparkles, label: t.galaxy, desc: t.galaxyShort, show: !!hasGalaxy, voice: ["Galaxy mode engaged", "Opening the cosmos", "Enjoy the stars"] },
    { k: "nest", action: "nest_on", tone: "amber", icon: LampFloor, label: t.nest, desc: t.nestShort, show: !!hasNest, voice: ["Nest mode engaged", "Warm light online", "Cozy glow, activated"] },
    { k: "cozy", action: "welcome_cozy", tone: "rose", icon: LampFloor, label: t.cozyMode, desc: t.cozyDesc, show: !!hasWafu, voice: ["Cozy mode engaged", "Setting a warm mood", "Relax and unwind"] },
    { k: "dream", action: "dream_fade", tone: "violet", icon: MoonStar, label: t.dreamMode, desc: t.dreamDesc, show: !!hasWafu, voice: ["Good night", "Lights dimmed", "Rest mode engaged"] },
  ];
  const list = modes.filter((m) => m.show);

  // ON と OFF をほぼ同時に押しても 1 つしか動かないよう、押した瞬間にロックする
  const lock = useRef(false);
  const run = async (m: (typeof modes)[number]) => {
    if (busy || lock.current) return;
    lock.current = true;
    try { await runInner(m); } finally { lock.current = false; }
  };
  const runInner = async (m: (typeof modes)[number]) => {
    primeVoice();
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(m.k); setFx({ n: Date.now(), k: m.k });
    const ok = await callDevice(roomSlug, m.action, admin);
    if (ok) {
      setActive(m.k);
      if (m.k === "dream") { setDreamStart(Date.now()); setNowTick(Date.now()); } else setDreamStart(null);
      onGalaxyState?.(m.k === "galaxy");
      if (m.k === "galaxy") { galaxyOn(); onGalaxyLaunch?.(); } else if (m.k === "nest") toggleServo(true); else if (m.k === "dream") powerDown(); else powerUp();
      if (m.k === "dream") setDreamInfo(true);
      speakOneOf(m.voice);
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? [15, 25, 40] : [20, 40, 20]);
  };

  // ギャラクシー / ネストだけを止める小さな OFF ボタン (効果音・音声は以前のカードと同じ)
  const stop = async (k: OffKey) => {
    if (busy || lock.current) return;
    lock.current = true;
    try { await stopInner(k); } finally { lock.current = false; }
  };
  const stopInner = async (k: OffKey) => {
    const key: BusyKey = k === "galaxy" ? "galaxyOff" : k === "nest" ? "nestOff" : "wafuOff";
    primeVoice();
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(key);
    const action: DeviceAction = k === "galaxy" ? "galaxy_off" : k === "nest" ? "nest_off" : "wafu_off";
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) {
      setActive((a) => (a === k || ((k === "cozy" || k === "dream") && (a === "cozy" || a === "dream")) ? null : a));
      if (k === "cozy" || k === "dream") setDreamStart(null);
      if (k === "galaxy") {
        onGalaxyState?.(false);
        galaxyOff();
        speakOneOf(["Returning to Earth", "Galaxy mode off", "Goodnight, stargazer"]);
      } else if (k === "nest") {
        toggleServo(false);
        speakOneOf(["Nest mode off", "Warm light standby", "Dimming the glow"]);
      } else {
        // 和み / Dream Fade の OFF = 和風ライトを消す (和風ライトの OFF と同じ音)
        powerDown();
        speakOneOf([`${t.wafu} offline`, "Ambient lighting off"]);
      }
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? [15, 25, 40] : [20, 40, 20]);
  };

  // 音声コマンド: ボタンを押したときと同じ処理を呼ぶ
  useVoiceAction((a) => {
    if (a === "galaxy_off" && hasGalaxy) return void stop("galaxy");
    if (a === "nest_off" && hasNest) return void stop("nest");
    const m = list.find((x) => x.action === a);
    if (m) void run(m);
  });

  const ICON_COLOR: Record<string, string> = { cyan: "text-cyan-300", emerald: "text-emerald-300", violet: "text-violet-300", amber: "text-amber-300", rose: "text-rose-300" };
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1 font-mono text-[9px] tracking-[0.3em] text-cyan-300/60">
        <span className="h-px w-4 bg-cyan-300/40" /> MODE · {t.modeSelect}
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/30 to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {list.map((m, i) => {
          const on = active === m.k;
          const Icon = m.icon;
          const offKey: OffKey | null = m.k === "galaxy" || m.k === "nest" || m.k === "cozy" || m.k === "dream" ? m.k : null;
          // ON/OFF のあるモードは横幅いっぱいの特別なカードにする (ノーマル / 快適 は 2 列のまま)
          const wide = offKey !== null || (list.filter((x) => x.k === "normal" || x.k === "welcome").length % 2 === 1 && !offKey);
          const [head, suffix] = splitModeLabel(m.label);
          const tileBody = (
            <>
              <span className={`relative flex shrink-0 items-center justify-center rounded-full border ${offKey ? "h-11 w-11" : "h-9 w-9"} ${on ? "border-white/40 bg-white/10" : "border-white/10 bg-black/30"}`}>
                {busy === m.k
                  ? <Loader2 className={`h-[18px] w-[18px] animate-spin ${ICON_COLOR[m.tone]}`} />
                  : <Icon className={`h-[18px] w-[18px] ${ICON_COLOR[m.tone]}`} strokeWidth={1.7} />}
                {on && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />}
              </span>
              <span className="relative min-w-0 flex-1">
                {/* 「ギャラクシー」「モード」の間でだけ改行する */}
                <span className={`block font-semibold leading-tight ${offKey ? "text-[15px]" : "text-[13px]"} ${on ? "text-white" : "text-white/85"}`}>
                  <span className="inline-block">{head}</span>{suffix && <span className="inline-block">{suffix}</span>}
                </span>
                <span className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight text-white/50 ${offKey ? "text-[11px]" : "text-[10px]"}`}>
                  {m.desc}
                  {/* 状態: 実行中 / 待機中 (Dream Fade は残り時間) */}
                  {offKey && (
                    <span className={`rounded-full border px-1.5 py-px font-mono text-[8.5px] tracking-[0.16em] ${on ? OFF_STYLE[m.tone] : "border-white/10 text-white/30"}`}>
                      {on ? (m.k === "dream" && dreamLeft !== null ? `${dreamLeft} MIN` : "ACTIVE") : "STANDBY"}
                    </span>
                  )}
                </span>
              </span>
            </>
          );
          return (
            <div key={m.k} className={wide ? "col-span-2" : "h-full"}>
              {/* OFF があるモードは、ON と OFF を同じ枠 (同じ色) の中に上下で分けて置く。
                  ON / OFF は別々のボタンで、間に仕切りと余白があるので同時に押しにくい。 */}
              <HudPanel tone={m.tone} active={on} small onClick={offKey ? undefined : () => run(m)} className="h-full"
                contentClassName={offKey ? "h-full items-stretch" : "h-full items-center gap-2.5 px-3 py-3"}>
                <CommandFX trigger={fx?.k === m.k ? fx.n : 0} tone={m.tone} />
                {/* モードごとの背景アニメーション (ON と OFF で変わる) */}
                {offKey && <ModeScene k={offKey} on={on} />}
                {offKey ? (
                  <>
                    <button type="button" onClick={() => run(m)} aria-label={m.label}
                      className="relative flex min-h-[68px] flex-1 items-center gap-3 px-3.5 py-3 text-left transition active:bg-white/[0.05]">
                      {tileBody}
                    </button>
                    <span aria-hidden className="relative my-3 w-px" style={{ background: TONES[m.tone].edge }} />
                    <button type="button" aria-label={`${m.label} OFF`} onClick={() => stop(offKey)} disabled={!!busy}
                      className={`relative my-2.5 ml-2.5 mr-2.5 flex w-[74px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border font-mono text-[11px] tracking-[0.2em] transition active:scale-[0.96] disabled:opacity-50 ${OFF_STYLE[m.tone]}`}>
                      {busy === (offKey === "galaxy" ? "galaxyOff" : offKey === "nest" ? "nestOff" : "wafuOff")
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <PowerOff className="h-4 w-4" strokeWidth={1.8} />}
                      OFF
                    </button>
                  </>
                ) : tileBody}
              </HudPanel>
            </div>
          );
        })}
      </div>
      {/* Dream Fade の説明: 何が起こるか */}
      <AnimatePresence initial={false}>
        {dreamInfo && hasWafu && (
          <motion.div key="dream-info" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="clip-bevel-sm relative mt-2.5 border border-violet-300/30 bg-violet-500/[0.07] px-3.5 py-3">
              <p className="mb-1.5 text-[12px] font-semibold text-violet-100">{t.dreamStarted}</p>
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-violet-200">
                <MoonStar className="h-3.5 w-3.5" strokeWidth={1.8} /> {t.dreamInfoTitle}
              </p>
              <ol className="mt-1.5 space-y-1">
                {t.dreamSteps.map((x, i) => (
                  <li key={i} className="flex gap-2 text-[11.5px] leading-snug text-white/75">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-violet-300/50 font-mono text-[9px] text-violet-200">{i + 1}</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[10.5px] leading-snug text-white/45">{t.dreamNote}</p>
              <button type="button" onClick={() => setDreamInfo(false)} aria-label="close"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white/40 active:bg-white/10">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* シーンボタン: 快適モード / おやすみ / 和み / 外出OFF                   */
/* ------------------------------------------------------------------ */
type SceneAction = "welcome" | "welcome_cozy" | "wafu_off" | "good_night" | "away";
function SceneButtons({
  part = "all", roomSlug, admin, guard, t, hasWafu, onGalaxyState,
}: {
  /** away = 外出ボタンだけ / rest = おやすみ・和風ライトオフだけ / all = 全部 */
  part?: "all" | "away" | "rest";
  roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>;
  t: typeof T["en"]; hasWafu?: boolean; onGalaxyState?: (on: boolean) => void;
}) {
  const [busy, setBusy] = useState<SceneAction | null>(null);
  const [fx, setFx] = useState<{ n: number; a: SceneAction } | null>(null);

  const run = async (a: SceneAction) => {
    if (busy) return;
    primeVoice(); // タップ内で音声を解放
    if (guard && !(await guard())) return;
    blip(); sweep(); setBusy(a); setFx((p) => ({ n: (p?.n ?? 0) + 1, a }));
    const ok = await callDevice(roomSlug, a, admin);
    if (ok) {
      if (a === "away" || a === "good_night" || a === "welcome_cozy") onGalaxyState?.(false);
      (a === "away" || a === "good_night" || a === "wafu_off" ? powerDown : powerUp)();
      speakOneOf(a === "away"
        ? ["Goodbye", "Powering down", "Have a safe trip"]
        : a === "good_night"
        ? ["Good night", "Lights dimmed", "Rest mode engaged"]
        : a === "wafu_off"
        ? [`${t.wafu} offline`, "Japanese lamp off", "Ambient lighting off"]
        : a === "welcome_cozy"
        ? ["Cozy mode engaged", "Setting a warm mood", "Relax and unwind"]
        : ["Welcome home", "Comfort mode engaged", "Systems set for your return"]);
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 25 : [20, 40, 20]);
  };

  // 音声コマンド (このブロックに表示中のボタンだけ反応)
  useVoiceAction((a) => {
    if (a === "away" && part !== "rest") void run("away");
    if (a === "good_night" && part !== "away") void run("good_night");
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {part !== "away" && (<>
        <div className={hasWafu ? "" : "col-span-2"}>
        <HudPanel tone="cyan" onClick={() => run("good_night")} small
          contentClassName="items-center justify-center gap-2 px-4 py-4">
          <Corners tone="cyan" />
          <CommandFX trigger={fx?.a === "good_night" ? fx.n : 0} tone="cyan" />
          {busy === "good_night"
            ? <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
            : <Moon className="h-5 w-5 text-cyan-300" strokeWidth={1.7} />}
          <span className="text-sm text-cyan-200">{t.goodNightMode}</span>
        </HudPanel>
        </div>
        {hasWafu && (
          <HudPanel tone="rose" onClick={() => run("wafu_off")} small
            contentClassName="items-center justify-center gap-2 px-4 py-4">
            <Corners tone="rose" />
            <CommandFX trigger={fx?.a === "wafu_off" ? fx.n : 0} tone="rose" />
            {busy === "wafu_off"
              ? <Loader2 className="h-5 w-5 animate-spin text-rose-200/80" />
              : <PowerOff className="h-5 w-5 text-rose-200/80" strokeWidth={1.7} />}
            <span className="text-sm text-rose-200/90">{t.wafu} {t.off}</span>
          </HudPanel>
        )}
        </>)}
        {/* 外出ボタン (ハイテクUIでは鍵の上に単独で表示) */}
        {part !== "rest" && (
        <div className="order-first col-span-2">
          <HudPanel tone="violet" onClick={() => run("away")} small
            contentClassName="items-center justify-center gap-2.5 px-4 py-3">
            <Corners tone="cyan" />
            <CommandFX trigger={fx?.a === "away" ? fx.n : 0} tone="violet" />
            {busy === "away"
              ? <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
              : <LogOut className="h-5 w-5 text-violet-300" strokeWidth={1.7} />}
            <span className="text-sm text-violet-200">{t.awayMode}</span>
          </HudPanel>
        </div>
        )}
      </div>
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
  const [shield, setShield] = useState<{ n: number; mode: "unlock" | "lock" }>({ n: 0, mode: "lock" });

  const run = useCallback(async (action: "unlock" | "lock") => {
    if (busy) return;
    primeVoice(); // タップの瞬間に音声を解放 (iOSで後続のspeakを鳴らす)
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(action); setResult(null); setRipple((r) => r + 1); setFx((f) => f + 1);
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) {
      setLast(action);
      setShield((s) => ({ n: s.n + 1, mode: action }));
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
      contentClassName="flex-col overflow-hidden px-4 py-3.5">
      <Corners tone={unlocked ? "emerald" : "cyan"} />
      <CommandFX trigger={fx} tone={unlocked ? "emerald" : "cyan"} />
      <LockShield trigger={shield.n} mode={shield.mode} top="50%" caption={false} />

      {/* 上段 (コンパクト): 鍵アイコン + 状態 */}
      <div className="relative mb-2.5 flex items-center gap-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full">
            <circle cx="20" cy="20" r="18" fill="none" stroke={unlocked ? "#34d399" : "#22d3ee"} strokeOpacity="0.3" strokeWidth="1" />
            <circle cx="20" cy="20" r="18" fill="none" stroke={unlocked ? "#34d399" : "#22d3ee"} strokeWidth="2" strokeDasharray="20 93" strokeLinecap="round"
              className={busy ? "anim-spin-rev" : "anim-spin-slow"} style={{ ...SPIN, animationDuration: busy ? "0.9s" : "6s" }} />
          </svg>
          <AnimatePresence>
            <motion.span key={ripple} initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`pointer-events-none absolute inset-1 rounded-full ${unlocked ? "bg-emerald-400/30" : "bg-cyan-400/30"}`} />
          </AnimatePresence>
          {busy
            ? <Loader2 className={`relative h-4 w-4 animate-spin ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} />
            : <Icon className={`relative h-[18px] w-[18px] ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} strokeWidth={1.7} />}
        </span>
        <p className="font-mono text-[9px] tracking-[0.3em] text-cyan-300/60">DOOR LOCK</p>
        <span className={`ml-auto h-5 text-sm font-medium tracking-wide
          ${result === false ? "text-rose-300" : unlocked ? "text-emerald-300" : "text-cyan-200"}`}>
          {statusText}
        </span>
      </div>

      {/* 解錠 / 施錠 ボタン (ホログラム調・コンパクト) */}
      <div className="relative grid w-full grid-cols-2 gap-2.5">
        <TechButton tone="emerald" icon={LockKeyholeOpen} label={t.unlock} sub="OPEN" size="sm"
          busy={busy === "unlock"} disabled={!!busy && busy !== "unlock"} onClick={() => run("unlock")} />
        <TechButton tone="cyan" icon={LockKeyhole} label={t.lock} sub="SECURE" size="sm"
          busy={busy === "lock"} disabled={!!busy && busy !== "lock"} onClick={() => run("lock")} />
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
    primeVoice();
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(which); setFx((f) => f + 1);
    const ok = await callDevice(roomSlug, which === "on" ? onAction : offAction, admin);
    if (ok) {
      setLast(which); toggleServo(which === "on"); (which === "on" ? powerUp : powerDown)();
      speakOneOf(which === "on"
        ? [`${label} online`, `${label} engaged`, `${label} activated`]
        : [`${label} offline`, `${label} standby`, `${label} deactivated`]);
    } else sfxError();
    setBusy(null);
    if (navigator.vibrate) navigator.vibrate(which === "on" ? 22 : 16);
  };

  useVoiceAction((a) => {
    if (a === onAction) void send("on");
    else if (a === offAction) void send("off");
  });

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
        <motion.button whileTap={{ scale: 0.95 }} onHoverStart={hoverTick} onClick={() => send("on")} disabled={!!busy}
          className={`clip-bevel-sm flex items-center justify-center gap-1 border py-2.5 text-xs disabled:opacity-50
            ${accent === "cyan" ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
              : accent === "rose" ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
              : "border-amber-400/50 bg-amber-500/15 text-amber-200"}`}>
          {busy === "on" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t.on.toUpperCase()}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onHoverStart={hoverTick} onClick={() => send("off")} disabled={!!busy}
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
    primeVoice();
    if (guard && !(await guard())) return;
    blip(); sweep();
    setBusy(which); setFx((f) => f + 1);
    // 管理者がONにするときは既定の暖色(2700K/100%)で点灯。
    const action = which === "on" ? (admin ? "wafu_on_warm" : "wafu_on")
      : which === "off" ? "wafu_off" : "wafu_warm";
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) {
      if (which === "on") { setLast("on"); powerUp(); speakOneOf([`${t.wafu} online`, "Ambient lighting engaged", "Warm glow activated"]); }
      else if (which === "off") { setLast("off"); powerDown(); speakOneOf([`${t.wafu} offline`, "Ambient lighting off"]); }
      else { blip(); speakOneOf(["Restoring warm tone", "Warm preset applied"]); }
    } else sfxError();
    setBusy(null);
    if (navigator.vibrate) navigator.vibrate(which === "off" ? 16 : 22);
  };

  useVoiceAction((a) => {
    if (a === "wafu_on") void send("on");
    else if (a === "wafu_off") void send("off");
  });

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
          <p className="mt-1 text-[10px] text-violet-200/60">{t.galaxyAutoOff}</p>
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

/* ------------------------------------------------------------------ */
/* NESTモード: 藤編みボールランプ (対応部屋のみ・単体ON/OFF)             */
/* ------------------------------------------------------------------ */
function NestCard({
  roomSlug, admin, guard, t,
}: {
  roomSlug: string; admin?: boolean; guard?: () => Promise<boolean>;
  t: typeof T["en"];
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
    const ok = await callDevice(roomSlug, which === "on" ? "nest_on" : "nest_off", admin);
    if (ok) {
      setLast(which); toggleServo(which === "on");
      speakOneOf(which === "on"
        ? ["Nest mode engaged", "Warm light online", "Cozy glow, activated"]
        : ["Nest mode off", "Warm light standby", "Dimming the glow"]);
    } else sfxError();
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? [15, 25, 40] : [20, 40, 20]);
  };

  return (
    <HudPanel tone="amber" active={on} contentClassName="flex-col items-center overflow-hidden px-6 py-7">
      <Corners tone={on ? "amber" : "cyan"} />
      <CommandFX trigger={fx} tone="amber" />

      {/* カード内の暖色グロー (常時ゆらめく) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-nebula absolute -left-8 -top-10 h-40 w-40 rounded-full bg-amber-500/15 blur-2xl" />
        <div className="anim-nebula absolute -bottom-12 -right-6 h-40 w-40 rounded-full bg-orange-500/15 blur-2xl" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative flex w-full items-center gap-4">
        {/* 藤編みボール: 交差する織り目のリング */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className={`pointer-events-none absolute inset-[-8px] ${on ? "anim-spin-slow" : ""}`} style={SPIN}>
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <ellipse key={deg} cx="50" cy="50" rx="42" ry="15" fill="none"
                stroke="#fbbf24" strokeOpacity={on ? 0.5 : 0.2} strokeWidth="0.8"
                transform={`rotate(${deg} 50 50)`} />
            ))}
          </svg>
          <motion.div animate={{ scale: on ? [1, 1.1, 1] : 1, opacity: on ? 1 : 0.55 }}
            transition={on ? { repeat: Infinity, duration: 2.6 } : {}}
            className={`flex h-12 w-12 items-center justify-center rounded-full border
              ${on ? "border-amber-400/70 bg-amber-500/20 shadow-[0_0_30px_-4px_rgba(251,191,36,0.9)]" : "border-amber-400/30 bg-amber-500/10"}`}>
            <LampFloor className={`h-6 w-6 ${on ? "text-amber-200" : "text-amber-300/60"}`} strokeWidth={1.5} />
          </motion.div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] tracking-[0.3em] text-amber-300/70">NEST MODE</p>
          <p className={`mt-0.5 text-sm font-medium ${on ? "text-amber-100" : "text-amber-200/90"}`}>{t.nest}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/40">{t.nestDesc}</p>
        </div>
      </div>

      {/* ON / OFF */}
      <div className="relative mt-4 grid w-full grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.96 }} onHoverStart={hoverTick} onClick={() => send("on")} disabled={!!busy}
          className="clip-bevel-sm flex items-center justify-center gap-2 border border-amber-400/50
            bg-amber-500/15 py-3 text-sm text-amber-200 active:bg-amber-500/30 disabled:opacity-50">
          {busy === "on" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LampFloor className="h-4 w-4" />}
          {t.on.toUpperCase()}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onHoverStart={hoverTick} onClick={() => send("off")} disabled={!!busy}
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
  roomSlug, checkOut, t, lang, admin, hasWafu,
}: {
  roomSlug: string; checkOut: string; t: typeof T["en"]; lang: Lang; admin?: boolean; hasWafu?: boolean;
}) {
  const [time, setTime] = useState("07:00");
  const [mode, setMode] = useState<WakeLightMode>("flame_on");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");
  const [err, setErr] = useState<string | null>(null);

  const selectMode = (nextMode: WakeLightMode, label: string) => {
    navTick();
    speak(label);
    setMode(nextMode);
    setState("idle");
  };

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
          ? { roomSlug, fireAtIso: fire.toISOString(), mode }
          : { fireAtIso: fire.toISOString(), mode }),
      });
      if (res.ok) { setState("set"); sfxConfirm(); }
      else {
        sfxError();
        const j = await res.json().catch(() => ({} as any));
        setErr(j?.error === "OUT_OF_STAY" ? "チェックアウト前の時刻にしてください / Set a time before check-out"
          : j?.error === "SAVE_FAILED" && admin && j?.detail ? `SAVE_FAILED: ${j.detail}`
          : j?.error || `ERR ${res.status}`);
        setState("idle");
      }
    } catch (e: any) {
      setErr(e?.message || "network error"); setState("idle");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
      <HudPanel tone="violet" contentClassName="flex-col px-4 py-3">
        {/* 1 行目: タイトル + 光のタイプ (小さな切り替え) */}
        <div className="flex items-center gap-2">
          <AlarmClock className="h-4 w-4 shrink-0 text-violet-300" strokeWidth={1.6} />
          <span className="text-[13px] text-violet-200">{t.wakeLight}</span>
          <div className="ml-auto flex gap-1" role="radiogroup" aria-label={t.wakeLight}>
            <button type="button" aria-pressed={mode === "flame_on"} onClick={() => selectMode("flame_on", t.wakeFlameName)}
              className={`clip-bevel-sm flex items-center gap-1 border px-2 py-1 text-[10.5px] font-semibold ${mode === "flame_on" ? "border-amber-300/55 bg-amber-300/14 text-amber-100" : "border-white/10 bg-black/25 text-white/50"}`}>
              <Flame className="h-3.5 w-3.5" strokeWidth={1.6} /> {t.wakeFlameName}
            </button>
            <button type="button" aria-pressed={mode === "horizon_rise"} disabled={!hasWafu} onClick={() => selectMode("horizon_rise", t.wakeHorizonName)}
              className={`clip-bevel-sm flex items-center gap-1 border px-2 py-1 text-[10.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${mode === "horizon_rise" ? "border-violet-300/60 bg-violet-300/16 text-violet-100" : "border-white/10 bg-black/25 text-white/50"}`}>
              <Sunrise className="h-3.5 w-3.5" strokeWidth={1.6} /> {t.wakeHorizonName}
            </button>
          </div>
        </div>

        {/* 2 行目: 時刻 + セット */}
        <div className="mt-2.5 flex items-center gap-2">
          <input type="time" value={time}
            onChange={(e) => { setTime(e.target.value); setState("idle"); }}
            className="clip-bevel-sm min-w-0 flex-1 border border-white/10 bg-black/50 px-3 py-2
              text-center font-mono text-xl tracking-widest text-violet-100
              [color-scheme:dark] focus:border-violet-400/60 focus:outline-none" />
          <motion.button whileTap={{ scale: 0.94 }} onClick={submit} disabled={state === "busy"}
            className="clip-bevel-sm flex h-11 shrink-0 items-center gap-1.5 border border-violet-400/50
              bg-violet-500/15 px-4 text-sm text-violet-200 active:bg-violet-500/30">
            {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === "set" && <Check className="h-4 w-4 text-emerald-300" />}
            {state === "set" ? t.alarmSet : t.setAlarm}
          </motion.button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-violet-100/55">
          {mode === "horizon_rise" ? t.wakeHorizonDescription : t.wakeFlameDescription}
          {!hasWafu && <span className="ml-1 text-amber-200/55">{t.wakeHorizonUnavailable}</span>}
        </p>
        {err && <p className="mt-1 text-center text-[11px] text-rose-300">{err}</p>}
      </HudPanel>
    </motion.div>
  );
}
