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
}

// 認証は PIN認証で発行されたセッションCookie (same-origin fetch で自動送信)
async function callDevice(roomSlug: string, action: DeviceAction) {
  const res = await fetch(`/api/devices/${roomSlug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return res.ok;
}

export default function ControlPanel({
  roomSlug, roomName, checkOut, initialLang,
}: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05060a] text-white">
      {/* 背景: ダークネイビーのオーロラ */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04]
          [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)]
          [background-size:44px_44px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-8">
        {/* ヘッダー: 部屋名 + 言語切替 */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">
              {t.welcome.toUpperCase()}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide">{roomName}</h1>
            <p className="mt-1 text-xs text-white/40">
              {t.checkout}: {new Date(checkOut).toLocaleString(lang, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                timeZone: "Asia/Tokyo",
              })}
            </p>
          </div>
          <LangSwitch lang={lang} setLang={setLang} />
        </header>

        {/* スマートロック (主役) */}
        <LockCard roomSlug={roomSlug} t={t} />

        {/* デバイスグリッド */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <ToggleCard
            roomSlug={roomSlug}
            icon={Snowflake} label={t.ac} accent="cyan"
            onAction={"ac_on"} offAction={"ac_off"} t={t}
          />
          <ToggleCard
            roomSlug={roomSlug}
            icon={Lightbulb} label={t.light} accent="amber"
            onAction={"light_on"} offAction={"light_off"} t={t}
          />
        </div>

        {/* 光目覚まし */}
        <WakeCard roomSlug={roomSlug} checkOut={checkOut} t={t} lang={lang} />
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
/* スマートロック カード (波紋 + サイバー解錠エフェクト)                */
/* ------------------------------------------------------------------ */
function LockCard({ roomSlug, t }: { roomSlug: string; t: typeof T["en"] }) {
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ripple, setRipple] = useState(0);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setRipple((r) => r + 1);
    const next = !unlocked;
    const ok = await callDevice(roomSlug, next ? "unlock" : "lock");
    if (ok) setUnlocked(next);
    setBusy(false);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ok ? 30 : [20, 40, 20]);
  }, [busy, unlocked, roomSlug]);

  const Icon = unlocked ? LockKeyholeOpen : LockKeyhole;

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.97 }}
      className={`relative flex flex-col items-center overflow-hidden rounded-[2rem]
        border bg-white/[0.04] px-6 py-10 backdrop-blur-2xl transition-colors
        ${unlocked
          ? "border-emerald-400/40 shadow-[0_0_70px_-20px_rgba(16,185,129,0.8)]"
          : "border-cyan-400/30 shadow-[0_0_60px_-22px_rgba(34,211,238,0.7)]"}`}
    >
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

      <motion.div
        animate={busy ? { rotate: [0, -8, 8, 0] } : {}}
        transition={{ duration: 0.5 }}
        className={`relative mb-4 flex h-24 w-24 items-center justify-center rounded-full
          border ${unlocked ? "border-emerald-400/50 bg-emerald-400/10" : "border-cyan-400/40 bg-cyan-400/10"}`}
      >
        {busy ? (
          <Loader2 className={`h-10 w-10 animate-spin ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} />
        ) : (
          <Icon className={`h-11 w-11 ${unlocked ? "text-emerald-300" : "text-cyan-300"}`} strokeWidth={1.5} />
        )}
      </motion.div>

      <span className={`text-lg font-medium tracking-wide ${unlocked ? "text-emerald-300" : "text-cyan-200"}`}>
        {busy ? t.sending : unlocked ? t.unlocked : t.locked}
      </span>
      <span className="mt-1 font-mono text-[10px] tracking-[0.3em] text-white/30">
        {unlocked ? "TAP TO LOCK" : "TAP TO UNLOCK"}
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* ON/OFF トグルカード (エアコン / 照明)                                */
/* ------------------------------------------------------------------ */
function ToggleCard({
  roomSlug, icon: Icon, label, accent, onAction, offAction, t,
}: {
  roomSlug: string;
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
    const ok = await callDevice(roomSlug, next ? onAction : offAction);
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
      <motion.div
        animate={{ scale: on ? 1.05 : 1, opacity: on ? 1 : 0.5 }}
        className={`flex h-14 w-14 items-center justify-center rounded-2xl
          ${on ? `${palette.border} bg-white/5` : "border border-white/10"}`}
      >
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
