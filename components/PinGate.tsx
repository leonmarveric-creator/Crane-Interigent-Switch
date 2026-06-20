"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Loader2, Globe } from "lucide-react";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import { primeVoice } from "@/lib/sfx";

const PIN_LEN = 4;

export default function PinGate({
  roomSlug, roomName, initialLang,
}: { roomSlug: string; roomName: string; initialLang: Lang }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const [digits, setDigits] = useState<string[]>(Array(PIN_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [locked, setLocked] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const onChange = (i: number, v: string) => {
    if (locked) return;
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setErr(false);
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
      router.refresh(); // セッション発行後、パネル表示へ
    } else {
      if (res.status === 429) setLocked(true); // ロックアウト
      else setErr(true);
      setDigits(Array(PIN_LEN).fill(""));
      refs.current[0]?.focus();
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05060a] text-white flex items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04]
          [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)]
          [background-size:44px_44px]" />
      </div>

      {/* 言語切替 */}
      <div className="absolute right-5 top-6 z-20">
        <button onClick={() => setLangOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs backdrop-blur-md">
          <Globe className="h-4 w-4 text-cyan-300" /> {LANG_LABEL[lang]}
        </button>
        {langOpen && (
          <ul className="absolute right-0 mt-2 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c14]/90 backdrop-blur-xl">
            {LANGS.map((l) => (
              <li key={l}>
                <button onClick={() => { setLang(l); setLangOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm ${l === lang ? "text-cyan-300 bg-cyan-500/10" : "text-white/70"}`}>
                  {LANG_LABEL[l]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-sm rounded-3xl border border-cyan-400/25 bg-white/5 p-8 text-center
          backdrop-blur-xl shadow-[0_0_60px_-20px_rgba(34,211,238,0.7)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10">
          <Lock className="h-7 w-7 text-cyan-300" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-medium tracking-wide">{roomName}</h1>
        <p className="mt-2 text-sm text-white/50">{t.pinPrompt}</p>

        <div className="mt-6 flex justify-center gap-3">
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
              className={`h-16 w-12 rounded-2xl border bg-black/40 text-center text-2xl font-mono
                focus:outline-none disabled:opacity-40
                ${locked ? "border-amber-500/60" : err ? "border-rose-500/60" : "border-white/15 focus:border-cyan-400/60"}`}
            />
          ))}
        </div>

        <div className="mt-4 h-5">
          {busy && <Loader2 className="mx-auto h-4 w-4 animate-spin text-cyan-300" />}
          {locked && <p className="text-xs text-amber-400">{t.pinLocked}</p>}
          {err && !locked && <p className="text-xs text-rose-400">{t.wrongPin}</p>}
        </div>
      </motion.div>
    </main>
  );
}
