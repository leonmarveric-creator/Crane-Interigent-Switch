"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LockKeyholeOpen, Loader2, Globe, Fingerprint, ShieldAlert } from "lucide-react";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import { primeVoice, access, speak, keyTick, deny, holo } from "@/lib/sfx";

const PIN_LEN = 4;
const SPIN: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

export default function PinGate({
  roomSlug, roomName, initialLang,
}: { roomSlug: string; roomName: string; initialLang: Lang }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const [digits, setDigits] = useState<string[]>(Array(PIN_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(0);
  const [locked, setLocked] = useState(false);
  const [granted, setGranted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // マウント時にホロ展開音 (ジェスチャー前は鳴らない環境もあるが無害)
  useEffect(() => { holo(); }, []);

  const onChange = (i: number, v: string) => {
    if (locked) return;
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setErr(false);
    if (d) keyTick(); // 1桁ごとのホロタイプ音
    if (d && i < PIN_LEN - 1) refs.current[i + 1]?.focus();
    if (next.every((x) => x !== "")) submit(next.join(""));
  };

  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const submit = async (pin: string) => {
    primeVoice(); // タップ操作内で音声を先行起動 (iOSで起動音声を鳴らすため)
    setBusy(true); setErr(false);
    const res = await fetch(`/api/room/${roomSlug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (res.ok) {
      // ACCESS GRANTED 演出 → 少し見せてからパネルへ
      setGranted(true);
      access();
      speak("Access granted. Welcome");
      if (navigator.vibrate) navigator.vibrate([15, 30, 15, 30, 60]);
      setTimeout(() => router.refresh(), 1300);
    } else {
      if (res.status === 429) setLocked(true); // ロックアウト
      else setErr(true);
      deny();
      setShake((s) => s + 1);
      setDigits(Array(PIN_LEN).fill(""));
      refs.current[0]?.focus();
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    }
  };

  const tone = locked ? "amber" : err ? "rose" : "cyan";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white flex items-center justify-center px-6">
      {/* 背景: グロー + グリッド + 走査線 + 粒子 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-drift absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/25 blur-[120px]" />
        <div className="anim-drift2 absolute bottom-0 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[110px]" />
        <div className="anim-grid absolute inset-0
          [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)]
          [background-size:44px_44px]" />
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
        {/* 巨大レティクル */}
        <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 h-[130vmin] w-[130vmin] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="200" cy="200" r="190" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="2 10" />
            <circle cx="200" cy="200" r="150" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="40 30" />
          </g>
          <g className="anim-spin-rev" style={SPIN}>
            <circle cx="200" cy="200" r="120" fill="none" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="60 200" />
          </g>
        </svg>
        <PinParticles />
      </div>

      {/* HUDコーナーフレーム */}
      <div className="pointer-events-none fixed inset-0 z-20">
        <span className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-cyan-300/40" />
        <span className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-cyan-300/40" />
        <span className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-cyan-300/40" />
        <span className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-cyan-300/40" />
        <div className="absolute inset-x-14 top-3.5 h-[3px] opacity-30
          [background:repeating-linear-gradient(90deg,#22d3ee_0,#22d3ee_1px,transparent_1px,transparent_9px)]" />
        <div className="absolute inset-x-14 bottom-3.5 h-[3px] opacity-30
          [background:repeating-linear-gradient(90deg,#22d3ee_0,#22d3ee_1px,transparent_1px,transparent_9px)]" />
      </div>

      {/* 言語切替 */}
      <div className="absolute right-5 top-6 z-30">
        <button onClick={() => { keyTick(); setLangOpen((o) => !o); }}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs backdrop-blur-md active:scale-95">
          <Globe className="h-4 w-4 text-cyan-300" /> {LANG_LABEL[lang]}
        </button>
        {langOpen && (
          <ul className="absolute right-0 mt-2 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c14]/90 backdrop-blur-xl">
            {LANGS.map((l) => (
              <li key={l}>
                <button onClick={() => { setLang(l); setLangOpen(false); keyTick(); }}
                  className={`w-full px-4 py-2.5 text-left text-sm ${l === lang ? "text-cyan-300 bg-cyan-500/10" : "text-white/70"}`}>
                  {LANG_LABEL[l]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* セキュリティ端末パネル (角カット + 周回光) */}
      <motion.div
        key={shake} // エラーごとにシェイクを再生
        initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`clip-bevel relative z-10 w-full max-w-sm ${shake > 0 && err ? "anim-shake" : ""}`}
        style={err ? { filter: "drop-shadow(0 0 26px rgba(244,63,94,0.55))" }
          : { filter: "drop-shadow(0 0 26px rgba(34,211,238,0.35))" }}>
        {/* エッジ */}
        <span className="clip-bevel pointer-events-none absolute inset-0"
          style={{ background: tone === "rose" ? "rgba(244,63,94,0.35)" : tone === "amber" ? "rgba(251,191,36,0.3)" : "rgba(34,211,238,0.25)" }} />
        {/* 周回する光 */}
        <span className="clip-bevel anim-spin-slow pointer-events-none absolute inset-0"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${tone === "rose" ? "rgba(251,113,133,0.9)" : "rgba(34,211,238,0.85)"} 16deg, transparent 72deg)` }} />
        <span className="clip-bevel pointer-events-none absolute inset-[1.5px] bg-[#070a12]/95 backdrop-blur-2xl" />

        <div className="relative p-8 text-center">
          {/* コーナーブラケット */}
          <span className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t border-cyan-300/50" />
          <span className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t border-cyan-300/50" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-3.5 w-3.5 border-b border-l border-cyan-300/50" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r border-cyan-300/50" />

          {/* 回転リング + ロックコア */}
          <div className="relative mx-auto mb-5 h-28 w-28">
            <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
              <g className="anim-spin-slow" style={SPIN}>
                <circle cx="60" cy="60" r="55" fill="none"
                  stroke={err ? "#fb7185" : "#22d3ee"} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 7" />
              </g>
              <g className={busy ? "anim-spin-rev" : "anim-spin-slow"} style={{ ...SPIN, animationDuration: busy ? "3s" : undefined }}>
                <circle cx="60" cy="60" r="44" fill="none"
                  stroke={err ? "#fb7185" : "#22d3ee"} strokeOpacity="0.6" strokeWidth="2"
                  strokeDasharray="34 160" strokeLinecap="round" />
                <circle cx="60" cy="60" r="44" fill="none" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="2"
                  strokeDasharray="14 262" strokeDashoffset="-100" strokeLinecap="round" />
              </g>
              {/* 目盛りスポーク */}
              <g className="anim-spin-rev" style={SPIN}>
                {[...Array(24)].map((_, i) => (
                  <line key={i} x1="60" y1="8" x2="60" y2={i % 4 === 0 ? "14" : "11"}
                    stroke={err ? "#fb7185" : "#22d3ee"} strokeOpacity={i % 4 === 0 ? 0.5 : 0.25} strokeWidth="1"
                    transform={`rotate(${(i / 24) * 360} 60 60)`} />
                ))}
              </g>
            </svg>
            <div className={`anim-breathe absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border
              ${err ? "border-rose-400/60 bg-rose-400/10" : locked ? "border-amber-400/60 bg-amber-400/10" : "border-cyan-400/50 bg-cyan-400/10"}`}>
              {busy
                ? <Fingerprint className="h-7 w-7 animate-pulse text-cyan-300" strokeWidth={1.5} />
                : locked
                  ? <ShieldAlert className="h-7 w-7 text-amber-300" strokeWidth={1.5} />
                  : <Lock className={`h-7 w-7 ${err ? "text-rose-300" : "text-cyan-300"}`} strokeWidth={1.5} />}
            </div>
          </div>

          {/* ヘッダー */}
          <p className="font-mono text-[10px] tracking-[0.35em] text-cyan-400/70">
            SECURITY CLEARANCE
          </p>
          <h1 className="mt-1.5 text-xl font-medium tracking-wide">{roomName}</h1>
          <p className="mt-2 text-sm text-white/50">{t.pinPrompt}</p>

          {/* PIN 入力 (スキャンビーム付き) */}
          <div className="relative mt-6">
            {busy && (
              <div className="pointer-events-none absolute inset-x-0 -inset-y-1 overflow-hidden">
                <div className="anim-scanbeam h-1/3 w-full bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent" />
              </div>
            )}
            <div className="flex justify-center gap-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  value={d}
                  onChange={(e) => onChange(i, e.target.value)}
                  onKeyDown={(e) => onKey(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  autoFocus={i === 0}
                  disabled={locked}
                  className={`clip-bevel-sm h-16 w-12 border bg-black/50 text-center font-mono text-2xl text-cyan-100
                    focus:outline-none disabled:opacity-40 ${d ? "anim-digitpop" : ""}
                    ${locked ? "border-amber-500/60" : err ? "border-rose-500/60" : d ? "border-cyan-400/70 bg-cyan-400/[0.08]" : "border-white/15 focus:border-cyan-400/60"}`}
                />
              ))}
            </div>
          </div>

          {/* ステータス行 */}
          <div className="mt-4 h-5 font-mono text-[11px] tracking-[0.25em]">
            {busy && <span className="text-cyan-300/90 animate-pulse">VERIFYING…</span>}
            {locked && <span className="text-amber-400">{t.pinLocked}</span>}
            {err && !locked && !busy && <span className="anim-alert text-rose-400">ACCESS DENIED · {t.wrongPin}</span>}
          </div>
        </div>
      </motion.div>

      {/* エラー時の赤グリッチフラッシュ */}
      <AnimatePresence>
        {err && (
          <motion.div key={`g${shake}`}
            initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none fixed inset-0 z-20 mix-blend-screen"
            style={{ background: "repeating-linear-gradient(0deg, rgba(244,63,94,0.25) 0, rgba(244,63,94,0.25) 2px, transparent 3px, transparent 6px)" }} />
        )}
      </AnimatePresence>

      {/* ACCESS GRANTED 遷移演出 */}
      <AnimatePresence>
        {granted && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#04060c]/85 backdrop-blur-sm">
            {/* 多重に広がる同心リング */}
            {[0, 0.12, 0.24].map((dl, i) => (
              <motion.div key={i}
                initial={{ opacity: 0.7, scale: 0 }} animate={{ opacity: 0, scale: 3.4 + i * 0.6 }}
                transition={{ duration: 1, delay: dl, ease: "easeOut" }}
                className="absolute h-40 w-40 rounded-full border-2 border-emerald-300/70" />
            ))}
            {/* 横に走る光 */}
            <motion.div initial={{ x: "-120%" }} animate={{ x: "120%" }} transition={{ duration: 0.7, ease: "easeInOut" }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent" />
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-400/10
                shadow-[0_0_50px_-6px_rgba(16,185,129,0.9)]">
              <LockKeyholeOpen className="h-8 w-8 text-emerald-300" strokeWidth={1.5} />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="mt-5 font-mono text-sm tracking-[0.35em] text-emerald-300">
              ACCESS GRANTED
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-2 font-mono text-[10px] tracking-[0.3em] text-emerald-300/50">
              INITIALIZING CONTROL SYSTEMS…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* 浮遊する光の粒子 (PIN画面用・軽量) */
function PinParticles() {
  const motes = useMemo(
    () => [...Array(16)].map(() => ({
      left: Math.random() * 100,
      dur: 6 + Math.random() * 9,
      delay: Math.random() * 9,
      size: 1 + Math.random() * 2,
    })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <span key={i} className="absolute rounded-full"
          style={{
            left: `${m.left}%`, bottom: -12, width: m.size, height: m.size,
            background: "rgba(34,211,238,0.75)", boxShadow: "0 0 6px rgba(34,211,238,0.9)",
            animation: `rise ${m.dur}s linear ${m.delay}s infinite`,
          }} />
      ))}
    </div>
  );
}
