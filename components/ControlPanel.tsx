"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LockKeyhole, LockKeyholeOpen, Snowflake, Lightbulb,
  AlarmClock, Check, Loader2, Globe,
} from "lucide-react";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";

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
  const t = T[lang];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white">
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
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-8">
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
          <LangSwitch lang={lang} setLang={setLang} />
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

function HudRings({ unlocked, busy }: { unlocked: boolean; busy: boolean }) {
  const s = unlocked ? "#34d399" : "#22d3ee";
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2">
      {/* 外周: 目盛り (低速回転) */}
      <g className="anim-spin-slow" style={SPIN}>
        <circle cx="100" cy="100" r="94" fill="none" stroke={s} strokeOpacity="0.22" strokeWidth="1" strokeDasharray="1.5 7" />
        <circle cx="100" cy="100" r="86" fill="none" stroke={s} strokeOpacity="0.12" strokeWidth="0.6" />
      </g>
      {/* 中周: 分割アーク (逆回転) + ゴールド差し色 */}
      <g className={busy ? "anim-spin-rev" : "anim-spin-slow"} style={SPIN}>
        <circle cx="100" cy="100" r="76" fill="none" stroke={s} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="58 250" strokeLinecap="round" />
        <circle cx="100" cy="100" r="76" fill="none" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="22 308" strokeDashoffset="-150" strokeLinecap="round" />
      </g>
      {/* レーダースイープ (扇形・回転) */}
      <g className="anim-spin-rev" style={SPIN}>
        <path d="M100 100 L100 36 A64 64 0 0 1 150 64 Z" fill={s} fillOpacity="0.06" />
      </g>
      {/* 内周 */}
      <circle cx="100" cy="100" r="62" fill="none" stroke={s} strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* スマートロック カード (波紋 + サイバー解錠エフェクト)                */
/* ------------------------------------------------------------------ */
function LockCard({ roomSlug, t, admin }: { roomSlug: string; t: typeof T["en"]; admin?: boolean }) {
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ripple, setRipple] = useState(0);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setRipple((r) => r + 1);
    const next = !unlocked;
    const ok = await callDevice(roomSlug, next ? "unlock" : "lock", admin);
    if (ok) setUnlocked(next);
    setBusy(false);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 30 : [20, 40, 20]);
  }, [busy, unlocked, roomSlug, admin]);

  const Icon = unlocked ? LockKeyholeOpen : LockKeyhole;

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.97 }}
      className={`relative flex flex-col items-center overflow-hidden rounded-[2rem]
        border bg-white/[0.03] px-6 py-12 backdrop-blur-2xl transition-colors
        ${unlocked
          ? "border-emerald-400/40 shadow-[0_0_80px_-18px_rgba(16,185,129,0.85)]"
          : "border-cyan-400/30 shadow-[0_0_70px_-20px_rgba(34,211,238,0.8)]"}`}
    >
      <Corners tone={unlocked ? "emerald" : "cyan"} />

      {/* JARVIS風 HUDダイヤル */}
      <HudRings unlocked={unlocked} busy={busy} />

      {/* 解錠時の波紋 */}
      <AnimatePresence>
        <motion.span
          key={ripple}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`pointer-events-none absolute h-32 w-32 rounded-full
            ${unlocked ? "bg-emerald-400/30" : "bg-cyan-400/30"}`}
        />
      </AnimatePresence>

      <div className="relative mb-4 flex h-24 w-24 items-center justify-center">
        <motion.div
          animate={busy ? { rotate: [0, -8, 8, 0] } : {}}
          transition={{ duration: 0.5 }}
          className={`anim-breathe relative flex h-24 w-24 items-center justify-center rounded-full border
            ${unlocked ? "border-emerald-400/60 bg-emerald-400/10" : "border-cyan-400/50 bg-cyan-400/10"}`}
        >
          {busy ? (
            <Loader2 className={`h-10 w-10 animate-spin ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} />
          ) : (
            <Icon className={`h-11 w-11 ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} strokeWidth={1.5} />
          )}
        </motion.div>
      </div>

      <span className={`relative text-lg font-medium tracking-wide ${unlocked ? "text-emerald-300" : "text-cyan-200"}`}>
        {busy ? t.sending : unlocked ? t.unlocked : t.locked}
      </span>
      <span className="relative mt-1 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.3em] text-white/40">
        <span className={`anim-breathe inline-block h-1.5 w-1.5 rounded-full ${unlocked ? "bg-emerald-400" : "bg-cyan-400"}`} />
        {unlocked ? "SECURE · TAP TO LOCK" : "STANDBY · TAP TO UNLOCK"}
      </span>
    </motion.button>
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
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const palette = accent === "cyan"
    ? { text: "text-cyan-300", border: "border-cyan-400/40", glow: "rgba(34,211,238,0.6)" }
    : { text: "text-amber-300", border: "border-amber-400/40", glow: "rgba(251,191,36,0.6)" };

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !on;
    const ok = await callDevice(roomSlug, next ? onAction : offAction, admin);
    if (ok) setOn(next);
    setBusy(false);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.95 }}
      className={`relative flex flex-col items-center gap-3 rounded-[1.75rem] border
        bg-white/[0.04] px-4 py-7 backdrop-blur-2xl transition-all
        ${on ? `${palette.border}` : "border-white/8"}`}
      style={on ? { boxShadow: `0 0 50px -18px ${palette.glow}` } : undefined}
    >
      <Corners tone={accent} />
      <motion.div
        animate={{ scale: on ? 1.05 : 1, opacity: on ? 1 : 0.5 }}
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl
          ${on ? `${palette.border} bg-white/5` : "border border-white/10"}`}
      >
        {on && <span className="anim-spin-slow pointer-events-none absolute inset-[-6px] rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent, ${palette.glow}, transparent 50%)` }} />}
        {busy
          ? <Loader2 className={`h-6 w-6 animate-spin ${palette.text}`} />
          : <Icon className={`h-7 w-7 ${on ? palette.text : "text-white/40"}`} strokeWidth={1.6} />}
      </motion.div>
      <span className={`text-sm ${on ? palette.text : "text-white/50"}`}>{label}</span>
      <span className="font-mono text-[10px] tracking-[0.25em] text-white/30">
        {on ? t.on.toUpperCase() : t.off.toUpperCase()}
      </span>
    </motion.button>
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
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-[1.75rem] border border-violet-400/25 bg-white/[0.04] p-5
        backdrop-blur-2xl shadow-[0_0_50px_-22px_rgba(167,139,250,0.7)]"
    >
      <div className="flex items-center gap-2.5">
        <AlarmClock className="h-5 w-5 text-violet-300" strokeWidth={1.6} />
        <span className="text-sm text-violet-200">{t.wakeLight}</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="time"
          value={time}
          onChange={(e) => { setTime(e.target.value); setState("idle"); }}
          className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3
            text-center font-mono text-3xl tracking-widest text-violet-100
            [color-scheme:dark] focus:border-violet-400/60 focus:outline-none"
        />
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={submit}
          disabled={state === "busy"}
          className="flex h-[58px] items-center gap-1.5 rounded-2xl border border-violet-400/50
            bg-violet-500/15 px-5 text-sm text-violet-200 active:bg-violet-500/30"
        >
          {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "set" && <Check className="h-4 w-4 text-emerald-300" />}
          {state === "set" ? t.alarmSet : t.setAlarm}
        </motion.button>
      </div>
    </motion.div>
  );
}
