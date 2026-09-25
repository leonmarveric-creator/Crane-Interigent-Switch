"use client";

/**
 * 管理画面: ハイテクUI の起動の声を切り替える (ツール → テスト)。
 *   ASTRALIS = 「ASTRALIS system online」 / J.A.R.V.I.S = 従来の 3 種類からランダム
 *   ▶ で試聴できる。保存には migration_boot_voice.sql が必要。
 */
import { useState, useTransition } from "react";
import { Loader2, Play, Check } from "lucide-react";
import { setBootVoice } from "./actions";

type Voice = "astralis" | "jarvis";
const BASE = "/audio/voice/current/";
const OPTIONS: { v: Voice; name: string; lines: string; files: string[] }[] = [
  { v: "astralis", name: "ASTRALIS / CELESTIAL", lines: "ASTRALIS system online / CELESTIAL link established / CELESTIAL core online / CELESTIAL system online. Welcome back. / CELESTIAL. All systems online.（ランダム）", files: [
    "current-natural-voice-65-astralis-system-online.mp3", "current-natural-voice-66-celestial-link-established.mp3", "current-natural-voice-67-celestial-core-online.mp3",
    "current-natural-voice-68-celestial-system-online-welcome-back.mp3", "current-natural-voice-69-celestial-all-systems-online.mp3",
  ] },
  { v: "jarvis", name: "J.A.R.V.I.S", lines: "All systems online / Good evening. Systems online / J.A.R.V.I.S online（ランダム）", files: [
    "current-natural-voice-03-jarvis-online.mp3", "current-natural-voice-01-all-systems-online.mp3", "current-natural-voice-02-good-evening-systems-online.mp3",
  ] },
];

export default function BootVoiceCard({ initial, lang }: { initial: Voice; lang: string }) {
  const [voice, setVoice] = useState<Voice>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ja = lang !== "en";

  const choose = (v: Voice) => {
    if (v === voice) return;
    const prev = voice;
    setVoice(v); setMsg(null);
    start(async () => {
      const r = await setBootVoice(v);
      if (r.ok) setMsg(ja ? "保存しました ✓" : "Saved ✓");
      else { setVoice(prev); setMsg(ja ? "Supabase で migration_boot_voice.sql の実行が必要です" : "Run migration_boot_voice.sql in Supabase"); }
    });
  };
  const play = (files: string[]) => {
    try { void new Audio(BASE + files[Math.floor(Math.random() * files.length)] + "?v=android-2").play(); } catch { /* ignore */ }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">{ja ? "ハイテクUI 起動の声" : "Tech UI boot voice"}</h3>
      <p className="mt-0.5 text-xs text-white/50">{ja ? "ゲストがハイテク画面を開いたときに流れる声です。" : "Played when a guest opens the tech UI."}</p>
      <div className="mt-3 space-y-2">
        {OPTIONS.map((o) => {
          const on = voice === o.v;
          return (
            <div key={o.v} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}>
              <button type="button" onClick={() => choose(o.v)} disabled={pending} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-cyan-300 bg-cyan-400 text-black" : "border-white/30"}`}>
                  {on && (pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />)}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold tracking-wider text-white">{o.name}</span>
                  <span className="block truncate text-[11px] text-white/45">{o.lines}</span>
                </span>
              </button>
              <button type="button" onClick={() => play(o.files)} aria-label="play"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 active:bg-white/10">
                <Play className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p className="mt-2 text-xs text-cyan-200/80">{msg}</p>}
    </section>
  );
}
