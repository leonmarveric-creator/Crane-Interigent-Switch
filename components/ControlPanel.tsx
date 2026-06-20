"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LockKeyhole, LockKeyholeOpen, Snowflake, Lightbulb,
  AlarmClock, Check, Loader2, Globe, Volume2, VolumeX,
} from "lucide-react";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import { blip, powerUp, powerDown, error as sfxError, setMuted as sfxSetMuted } from "@/lib/sfx";

type DeviceAction =
  | "unlock" | "lock" | "ac_on" | "ac_off" | "light_on" | "light_off";

interface Props {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean; // 管理画面テストモード (PIN不要・admin認証で操作)
  imageUrl?: string | null; // 部屋アート
}

// guest: PIN認証セッションCookie / admin: 管理者Cookieでテスト操作
async function callDevice(roomSlug: string, action: DeviceAction, admin?: boolean) {
  const res = await fetch(admin ? "/api/admin/test-device" : `/api/devices/${roomSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(admin ? { roomSlug, action } : { action }),
  });
  return res.ok;
}

export default function ControlPanel({
  roomSlug, roomName, checkOut, initialLang, admin, imageUrl,
}: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [muted, setMuted] = useState(false);
  const [booting, setBooting] = useState(!admin); // ゲスト時のみ起動演出
  const t = T[lang];

  useEffect(() => {
    const saved = localStorage.getItem("guestMuted");
    if (saved === "1") setMuted(true);
  }, []);
  useEffect(() => { sfxSetMuted(muted); }, [muted]);
  const toggleMute = () => setMuted((m) => { const n = !m; localStorage.setItem("guestMuted", n ? "1" : "0"); return n; });

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white">
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
        {/* 走査線 */}
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
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

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-8">
        {/* HUDステータスバー */}
        <HudStatusBar />

        {/* 部屋アート (ヒーロー・小さめ正方形・中央) */}
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="relative mb-5 flex justify-center">
            {/* 回転リング */}
            <div className="anim-spin-slow pointer-events-none absolute h-52 w-52 rounded-full
              [background:conic-gradient(from_0deg,transparent,rgba(34,211,238,0.5),transparent_40%)] blur-md sm:h-60 sm:w-60" />
            <img src={imageUrl} alt={roomName}
              className="relative aspect-square w-40 rounded-3xl border border-cyan-300/30 object-cover
                shadow-[0_0_60px_-12px_rgba(34,211,238,0.8)] sm:w-48"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
            <h1 className="mt-1 text-2xl font-semibold tracking-wide">{roomName}</h1>
            {admin ? (
              <a href="/admin" className="mt-1 inline-block text-xs text-violet-300/80">
                ⓘ TEST MODE · ← 管理画面へ戻る
              </a>
            ) : (
              <p className="mt-1 text-xs text-white/40">
                {t.checkout}: {new Date(checkOut).toLocaleString(lang, {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  timeZone: "Asia/Tokyo",
                })}
              </p>
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

        {/* スマートロック (主役) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <LockCard roomSlug={roomSlug} t={t} admin={admin} />
        </motion.div>

        {/* デバイスグリッド */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
          className="mt-5 grid grid-cols-2 gap-4">
          <ToggleCard
            roomSlug={roomSlug} admin={admin}
            icon={Snowflake} label={t.ac} accent="cyan"
            onAction={"ac_on"} offAction={"ac_off"} t={t}
          />
          <ToggleCard
            roomSlug={roomSlug} admin={admin}
            icon={Lightbulb} label={t.light} accent="amber"
            onAction={"light_on"} offAction={"light_off"} t={t}
          />
        </motion.div>

        {/* 光目覚まし (テストモードでは非表示: アラームはゲストセッション前提) */}
        {!admin && <WakeCard roomSlug={roomSlug} checkOut={checkOut} t={t} lang={lang} />}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* 言語スイッチ                                                         */
/* ------------------------------------------------------------------ */
function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
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
                  onClick={() => { setLang(l); setOpen(false); }}
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
    () => [...Array(18)].map(() => ({
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
            <span className="text-emerald-400">›</span> {l}
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
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* HUDステータスバー (テレメトリ風)                                     */
/* ------------------------------------------------------------------ */
function HudStatusBar() {
  const [hex, setHex] = useState("0x0000");
  useEffect(() => {
    const id = setInterval(
      () => setHex("0x" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0").toUpperCase()),
      650
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div className="anim-flicker mb-4 flex items-center justify-between rounded-full border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-1.5 font-mono text-[9px] tracking-[0.25em] text-cyan-300/70">
      <span className="flex items-center gap-1.5">
        <span className="anim-breathe inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> SYS ONLINE
      </span>
      <span className="hidden tracking-[0.3em] text-cyan-300/50 sm:inline">J.A.R.V.I.S</span>
      <span className="flex items-center gap-2">
        <span className="flex items-end gap-0.5">
          {[3, 5, 4, 6, 5].map((h, i) => (
            <span key={i} className="anim-breathe inline-block w-0.5 bg-cyan-400/70"
              style={{ height: h, animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
        <span className="text-cyan-300/60">{hex}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD部品: ターゲットブラケット / 同心円ダイヤル                        */
/* ------------------------------------------------------------------ */
function Corners({ tone = "cyan" }: { tone?: "cyan" | "amber" | "emerald" }) {
  const c = tone === "amber" ? "border-amber-300/60" : tone === "emerald" ? "border-emerald-300/60" : "border-cyan-300/55";
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
} as const;

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
/* スマートロック カード (波紋 + サイバー解錠エフェクト)                */
/* ------------------------------------------------------------------ */
function LockCard({ roomSlug, t, admin }: { roomSlug: string; t: typeof T["en"]; admin?: boolean }) {
  // 状態取得はしない (API節約)。押したコマンドをそのまま送る明示式。
  const [last, setLast] = useState<"unlock" | "lock" | null>(null);
  const [busy, setBusy] = useState<"unlock" | "lock" | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [ripple, setRipple] = useState(0);

  const run = useCallback(async (action: "unlock" | "lock") => {
    if (busy) return;
    blip();
    setBusy(action); setResult(null); setRipple((r) => r + 1);
    const ok = await callDevice(roomSlug, action, admin);
    if (ok) { setLast(action); (action === "unlock" ? powerUp : powerDown)(); }
    else sfxError();
    setResult(ok);
    setBusy(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 30 : [20, 40, 20]);
    setTimeout(() => setResult(null), 1900);
  }, [busy, roomSlug, admin]);

  const unlocked = last === "unlock";
  const Icon = unlocked ? LockKeyholeOpen : LockKeyhole;
  const statusText = busy ? t.sending
    : result === true ? (last === "unlock" ? t.unlocked : t.locked)
    : result === false ? t.failed : "";

  return (
    <HudPanel tone={unlocked ? "emerald" : "cyan"} active
      contentClassName="flex-col items-center overflow-hidden px-6 py-10">
      <Corners tone={unlocked ? "emerald" : "cyan"} />
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
  roomSlug, icon: Icon, label, accent, onAction, offAction, t, admin,
}: {
  roomSlug: string; admin?: boolean;
  icon: typeof Snowflake; label: string; accent: "cyan" | "amber";
  onAction: DeviceAction; offAction: DeviceAction; t: typeof T["en"];
}) {
  // 明示式: 押したON/OFFをそのまま送る (状態のズレなし)
  const [last, setLast] = useState<"on" | "off" | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const on = last === "on";

  const palette = accent === "cyan"
    ? { text: "text-cyan-300", glow: "rgba(34,211,238,0.6)", dot: "bg-cyan-400", hx: "bg-cyan-400/30" }
    : { text: "text-amber-300", glow: "rgba(251,191,36,0.6)", dot: "bg-amber-400", hx: "bg-amber-400/30" };

  const send = async (which: "on" | "off") => {
    if (busy) return;
    blip();
    setBusy(which);
    const ok = await callDevice(roomSlug, which === "on" ? onAction : offAction, admin);
    if (ok) setLast(which);
    setBusy(null);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  return (
    <HudPanel tone={accent} active={on} small
      contentClassName="flex-col items-center gap-3 px-4 py-6">
      <Corners tone={accent} />
      {/* 六角形アイコンフレーム */}
      <motion.div
        animate={{ scale: on ? 1.05 : 1, opacity: on ? 1 : 0.6 }}
        className="relative flex h-14 w-14 items-center justify-center">
        <svg viewBox="0 0 100 100" className="anim-spin-rev pointer-events-none absolute inset-[-9px]" style={SPIN}>
          {[...Array(24)].map((_, i) => (
            <line key={i} x1="50" y1="4" x2="50" y2={i % 3 === 0 ? "10" : "8"}
              stroke={accent === "cyan" ? "#22d3ee" : "#fbbf24"} strokeOpacity={on ? 0.55 : 0.25}
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
            ${accent === "cyan" ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200" : "border-amber-400/50 bg-amber-500/15 text-amber-200"}`}>
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
/* 光目覚まし カード (タイムピッカー)                                   */
/* ------------------------------------------------------------------ */
function WakeCard({
  roomSlug, checkOut, t, lang,
}: {
  roomSlug: string; checkOut: string; t: typeof T["en"]; lang: Lang;
}) {
  const [time, setTime] = useState("07:00");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");

  const submit = async () => {
    setState("busy");
    // 次に来る該当時刻(JST)を計算
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const fire = new Date(now);
    fire.setHours(h, m, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);

    const res = await fetch(`/api/alarms/${roomSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fireAtIso: fire.toISOString() }),
    });
    setState(res.ok ? "set" : "idle");
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
      </HudPanel>
    </motion.div>
  );
}
