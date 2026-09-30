"use client";

/** 車内 iPad のトイレ・お部屋の鍵のガイドを、スマホでそのまま流す (最初にタップしてから始める: スマホは音を出すのにタップが必要) */
import { useEffect, useRef, useState } from "react";
import { createToilet, type Toilet as _T } from "@/components/cabin/cabinToilet";
import { createLock, type LockGuide as _L } from "@/components/cabin/cabinLock";
import { createGuide } from "@/components/cabin/cabinGuide";
import type { GLang } from "@/lib/cabinGeo";

const T: Record<GLang, { go: string; sub: string; back: string }> = {
  ja: { go: "説明を始める", sub: "音が出ます · ASTRAEA の声（英語）と日本語の字幕", back: "‹ もどる" },
  en: { go: "Start the guide", sub: "Sound on · voice by ASTRAEA", back: "‹ Back" },
  zh: { go: "开始说明", sub: "请打开声音 · ASTRAEA 英语语音 + 中文字幕", back: "‹ 返回" },
  ko: { go: "안내 시작", sub: "소리를 켜 주세요 · ASTRAEA 영어 음성 + 한국어 자막", back: "‹ 돌아가기" },
};

export default function NfcPlay({ k, lang, back }: { k: "toilet" | "lock" | "room" | "ent"; lang: GLang; back: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const g = useRef<{ start(): void; stop(): void; on(): boolean; unlock(): void } | null>(null);
  const [started, setStarted] = useState(false);
  const startedR = useRef(false);
  useEffect(() => {
    const st = stage.current!; let acx: AudioContext | null = null;
    const ac = () => { try { acx = acx || new ((window as any).AudioContext || (window as any).webkitAudioContext)(); void acx!.resume(); return acx; } catch { return null; } };
    if (k === "room" || k === "ent") {
      // 入り方ガイド (夏のお部屋 / エントランス)。暗証番号・鍵の QR は出さない (誰でも開けるページのため)
      const gd = createGuide({ root: st, stage: st, lang: () => lang, code: () => null, keyUrl: () => null, roomUrl: () => null, ac, duck: () => {}, busy: () => false,
        room: () => ({ guide: k === "room" ? "natsu" : null, code: null, name: "" }) });
      g.current = { start: () => gd.start(k === "room" ? "room" : "ent"), stop: () => gd.stop(), on: () => gd.on(), unlock: () => gd.unlock() };
    } else g.current = k === "lock"
      ? createLock({ stage: st, lang: () => lang, ac, duck: () => {}, room: () => ({ code: null, name: "" }) })
      : createToilet({ stage: st, lang: () => lang, ac, duck: () => {} });
    const fit = () => { const port = innerHeight > innerWidth * 1.05; st.classList.toggle("port", port); const W = port ? 820 : 1180, H = port ? 1180 : 820; st.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`; };
    fit(); addEventListener("resize", fit);
    // 最後まで流れて閉じたら、元のページへ
    const mo = new MutationObserver(() => { if (startedR.current && !g.current?.on()) location.href = back; });
    mo.observe(st, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => { removeEventListener("resize", fit); mo.disconnect(); g.current?.stop(); };
  }, [k, lang, back]);
  const go = () => { g.current?.unlock(); startedR.current = true; setStarted(true); setTimeout(() => g.current?.start(), 60); };
  const t = T[lang];
  return (
    <div className="cab">
      <div className="stage" ref={stage} />
      {!started && (
        <div onClick={go} style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "radial-gradient(ellipse at 50% 40%,#0f2446,#02050d 70%)", color: "#fff", textAlign: "center", padding: 24 }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", border: "2px solid #7fd4ff", display: "grid", placeItems: "center", fontSize: 44, boxShadow: "0 0 30px rgba(127,212,255,.5)" }}>▶</div>
          <b style={{ fontSize: 24 }}>{t.go}</b><small style={{ color: "#9fb6d6", fontSize: 14 }}>{t.sub}</small>
          <a href={back} onClick={(e) => e.stopPropagation()} style={{ marginTop: 20, color: "#9fd6ff", fontSize: 15 }}>{t.back}</a>
        </div>
      )}
      {started && <a href={back} style={{ position: "fixed", left: 12, top: "max(12px, env(safe-area-inset-top))", zIndex: 9000, padding: "8px 14px", borderRadius: 999, background: "rgba(7,13,24,.85)", border: "1px solid rgba(127,212,255,.4)", color: "#dff0ff", fontSize: 14, textDecoration: "none" }}>{t.back}</a>}
    </div>
  );
}
