"use client";

/**
 * 音声コントロール (ハイテクUI)。
 *   マイクボタンを押している間だけ、スマホのブラウザ音声認識で聞き取る (無料・録音は保存しない)。
 *   短くタップした場合は、話し終わると自動で止まる。
 *   聞き取った言葉を parseVoiceCommand で既存ボタンの操作に変換し、
 *   window イベント (VOICE_EVENT) で各ボタンに伝える → 各ボタンが自分の処理 (効果音・音声も同じ) を実行する。
 *   ボタンは画面右下に浮かぶ丸いマイク。初回だけ使い方の吹き出しを出す (OK で以後は出さない)。
 *   鍵は対象外。ブラウザが音声認識に対応していなければボタン自体を出さない。
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic } from "lucide-react";
import { parseVoiceCommand, speechLangCode, type VoiceAction, type VoiceRoomCaps } from "@/lib/voiceCommand";
import { primeVoice } from "@/lib/sfx";

export const VOICE_EVENT = "crane-voice-command";
const TIP_KEY = "voiceTipSeen";

/** 各ボタン側で使う: 音声コマンドを受け取る */
export function useVoiceAction(handler: (a: VoiceAction) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<VoiceAction>).detail);
    window.addEventListener(VOICE_EVENT, fn);
    return () => window.removeEventListener(VOICE_EVENT, fn);
  }, []);
}

type Texts = {
  fab: string; tipTitle: string; tipBody: string; listening: string; retry: string; denied: string; why: string; examples: string[];
  label: (a: VoiceAction) => string;
};

type Phase = "idle" | "listening" | "done" | "error";

function getRecognition(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function VoiceMic({ lang, caps, texts }: { lang: string; caps: VoiceRoomCaps; texts: Texts }) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [msg, setMsg] = useState("");
  const rec = useRef<any>(null);
  const pressAt = useRef(0);
  const finals = useRef<string[]>([]);
  const heardRef = useRef("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSupported(!!getRecognition()); }, []);
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ignore */ } }, []);

  const hideLater = (ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPhase("idle"), ms);
  };

  const finish = () => {
    const cands = finals.current.length ? finals.current : heardRef.current ? [heardRef.current] : [];
    const action = parseVoiceCommand(cands, caps);
    if (action) {
      setMsg(texts.label(action));
      setPhase("done");
      window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: action }));
      if (navigator.vibrate) navigator.vibrate(18);
      hideLater(2200);
    } else {
      setMsg(texts.retry);
      setPhase("error");
      hideLater(3200);
    }
  };

  const start = () => {
    const R = getRecognition();
    if (!R || phase === "listening") return;
    primeVoice(); // タップ中に音声再生を解放 (結果が出たあと各ボタンの音声が鳴るように)
    if (hideTimer.current) clearTimeout(hideTimer.current);
    finals.current = []; heardRef.current = ""; setHeard(""); setMsg("");
    const r = new R();
    r.lang = speechLangCode(lang);
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    r.onresult = (e: any) => {
      let interim = "";
      const f: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) for (let j = 0; j < res.length; j++) f.push(res[j].transcript);
        else interim += res[0].transcript;
      }
      if (f.length) finals.current = f;
      heardRef.current = f[0] ?? interim;
      setHeard(heardRef.current);
    };
    r.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setMsg(texts.denied); setPhase("error"); hideLater(4500);
        rec.current = null;
      }
    };
    r.onend = () => {
      if (rec.current !== r) return; // エラーで終了済み
      rec.current = null;
      finish();
    };
    rec.current = r;
    pressAt.current = Date.now();
    setPhase("listening");
    if (navigator.vibrate) navigator.vibrate(12);
    try { r.start(); } catch { rec.current = null; setPhase("idle"); }
  };

  // 押し続けて離したら聞き取り終了 / 短いタップなら話し終わりで自動終了
  const release = () => {
    if (!rec.current) return;
    if (Date.now() - pressAt.current > 450) { try { rec.current.stop(); } catch { /* ignore */ } }
  };

  // 初回だけの案内 (この端末で一度 OK を押したら二度と出さない)
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (!supported) return;
    let seen = false;
    try { seen = localStorage.getItem(TIP_KEY) === "1"; } catch { /* ignore */ }
    if (seen) return;
    const id = setTimeout(() => setTip(true), 2500);
    return () => clearTimeout(id);
  }, [supported]);
  const closeTip = () => {
    setTip(false);
    try { localStorage.setItem(TIP_KEY, "1"); } catch { /* ignore */ }
  };

  if (!supported || typeof document === "undefined") return null;

  const listening = phase === "listening";
  return createPortal(
    <>
      {/* 右下に浮かぶマイクボタン (スクロールしても同じ位置) */}
      <div className="fixed bottom-5 right-4 z-[65] flex items-center gap-2 font-sans tracking-normal"
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <span className={`pointer-events-none rounded-full border px-3 py-1.5 text-[12.5px] font-semibold backdrop-blur-md ${listening ? "border-cyan-200/70 bg-cyan-500/30 text-white" : "border-cyan-300/40 bg-[#050a12]/90 text-cyan-50"}`}>
          {listening ? texts.listening : texts.fab}
        </span>
        <button type="button" aria-label={texts.fab}
          onPointerDown={(e) => { e.preventDefault(); if (tip) closeTip(); start(); }}
          onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          className={`vm-fab relative flex h-[62px] w-[62px] shrink-0 select-none items-center justify-center rounded-full border-[1.5px] border-cyan-50/80 text-white [touch-action:none] [-webkit-touch-callout:none] ${listening ? "vm-fab-on scale-110" : ""}`}
          style={{ background: "radial-gradient(circle at 35% 30%, #67e8f9, #0891b2 55%, #083344)", transition: "transform 0.15s" }}>
          {listening && <span className="absolute inset-[-6px] animate-ping rounded-full border-2 border-cyan-200/70" />}
          <Mic className="relative h-7 w-7" strokeWidth={1.9} />
        </button>
      </div>

      {/* 初回だけの案内の吹き出し */}
      <AnimatePresence>
        {tip && phase === "idle" && (
          <motion.div key="voice-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed right-4 z-[65] w-[264px] rounded-2xl border border-cyan-300/55 bg-[#06101b] px-4 py-3 font-sans tracking-normal shadow-[0_0_24px_rgba(34,211,238,0.3)]"
            style={{ bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 78px)" }}>
            <p className="text-[14px] font-bold text-cyan-50">{texts.tipTitle}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-cyan-50/75">{texts.tipBody}</p>
            <button type="button" onClick={closeTip} className="mt-1.5 block w-full text-right text-[13px] font-semibold text-cyan-300">OK</button>
            <span className="absolute -bottom-[7px] right-[26px] h-3 w-3 rotate-45 border-b border-r border-cyan-300/55 bg-[#06101b]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 聞き取りパネル (body 直下なので親の文字スタイルや transform の影響を受けない) */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div key="voice-panel"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
            style={{ bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 80px)" }}>
            <div className="w-full max-w-sm rounded-2xl font-sans tracking-normal border border-cyan-300/30 bg-[#050a12]/95 px-4 py-3 text-center shadow-[0_0_30px_rgba(34,211,238,0.25)] backdrop-blur-xl">
              {listening ? (
                <>
                  <div className="flex h-6 items-center justify-center gap-[3px]">
                    {Array.from({ length: 13 }, (_, i) => (
                      <span key={i} className="w-[3px] rounded-full bg-cyan-300"
                        style={{ height: 6, animation: `voiceBar 0.9s ease-in-out ${(i % 7) * 0.08}s infinite` }} />
                    ))}
                  </div>
                  <p className="mt-1 font-mono text-[9px] tracking-[0.3em] text-cyan-300/70">{texts.listening}</p>
                  <p className="mt-1 min-h-[20px] text-[15px] text-white">{heard || "…"}</p>
                  {!heard && (
                    <p className="mt-1 text-[10.5px] leading-snug text-white/45">
                      {texts.examples.map((x) => `「${x}」`).join(" ")}<br />{texts.why}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {heard && <p className="text-[12px] text-white/50">“{heard}”</p>}
                  <p className={`mt-0.5 text-[15px] font-semibold ${phase === "done" ? "text-emerald-300" : "text-amber-200"}`}>{msg}</p>
                  {phase === "error" && <p className="mt-1 text-[10.5px] text-white/45">{texts.examples.map((x) => `「${x}」`).join(" ")}</p>}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
