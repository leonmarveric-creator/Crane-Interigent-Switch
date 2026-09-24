"use client";

/**
 * ハイテク全画面ローディング (Next.js の loading.tsx 用)。
 *   高精細アークリアクター + 充電ゲージ (%) + 起動ログのタイピング +
 *   六角形グリッド / レーダースイープ / グリッチ帯 / HUD コーナーの数値。
 *   重い処理はなく、SVG と CSS アニメが中心。
 */
import { useEffect, useState } from "react";
import ArcReactorX from "@/components/tech/ArcReactorX";
import TechPercent from "@/components/tech/TechPercent";

const LOG = [
  "BOOT SEQUENCE ········ START",
  "CALIBRATING SENSORS ·· OK",
  "ENCRYPTED LINK ······· OK",
  "SYNCING DEVICES ······ OK",
  "RENDERING INTERFACE ·· OK",
];

const HEX_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><path d='M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L28 97' fill='none' stroke='%2322d3ee' stroke-width='0.6'/></svg>\")";

export default function HudLoader({ label = "LOADING SYSTEMS" }: { label?: string }) {
  // 充電ゲージ: 読み込みの長さは分からないので、100% に近づき続ける曲線
  const [p, setP] = useState(0);
  const [lines, setLines] = useState(0);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const s = (now - t0) / 1000;
      setP(1 - Math.exp(-s * 1.1));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // 起動ログ: 1 行ずつタイピング
  useEffect(() => {
    if (lines >= LOG.length) return;
    const full = LOG[lines];
    if (typed.length < full.length) {
      const id = setTimeout(() => setTyped(full.slice(0, typed.length + 2)), 18);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { setLines((n) => n + 1); setTyped(""); }, 160);
    return () => clearTimeout(id);
  }, [lines, typed]);

  const pct = Math.min(99, Math.floor(p * 100));

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#03050b] text-white">
      {/* 背景: 六角形グリッド + オーロラ + 走査線 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-hexdrift absolute inset-0 opacity-[0.10]" style={{ backgroundImage: HEX_BG }} />
        <div className="anim-drift absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="anim-drift2 absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[120px]" />
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
        <div className="anim-glitchband absolute inset-x-0 top-0 h-1.5 bg-cyan-200/60 mix-blend-screen" />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.75)_100%)]" />
      </div>

      {/* HUD コーナー + 数値 */}
      <div className="pointer-events-none fixed inset-0 font-mono text-[8px] tracking-[0.25em] text-cyan-300/45">
        <span className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-cyan-300/50" />
        <span className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-cyan-300/50" />
        <span className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-cyan-300/50" />
        <span className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-cyan-300/50" />
        <span className="absolute left-12 top-4">SYS/CORE {String(pct).padStart(2, "0")}%</span>
        <span className="absolute right-12 top-4">LAT 35.00 · LNG 135.76</span>
        <span className="absolute bottom-4 left-12">PWR {(3.2 + p * 0.8).toFixed(2)} GJ/s</span>
        <span className="absolute bottom-4 right-12">SIGNAL ▮▮▮▮▯</span>
      </div>

      {/* リアクター + レーダースイープ */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="anim-radar pointer-events-none absolute h-[300px] w-[300px] rounded-full opacity-60"
          style={{ background: "conic-gradient(from 0deg, rgba(34,211,238,0.28), transparent 60deg, transparent 360deg)" }} />
        <div className="pointer-events-none absolute h-[300px] w-[300px] rounded-full border border-cyan-300/10" />
        <div className="pointer-events-none absolute h-[240px] w-[240px] rounded-full border border-dashed border-cyan-300/10" />
        <ArcReactorX size={210} active progress={p} />
      </div>

      {/* パーセント (HUD 表示) */}
      <TechPercent value={Math.min(0.999, p)} className="mb-5 w-60" />

      {/* ラベル */}
      <p className="anim-flicker font-mono text-[11px] tracking-[0.35em] text-cyan-300/90">{label}</p>

      {/* 起動ログ */}
      <div className="mt-4 h-[84px] w-64 font-mono text-[9.5px] leading-[1.6] tracking-[0.12em] text-cyan-300/70">
        {LOG.slice(0, lines).map((l, i) => (
          <p key={i}><span className="text-emerald-400">›</span> {l}</p>
        ))}
        {lines < LOG.length && (
          <p><span className="text-emerald-400">›</span> {typed}<span className="anim-breathe text-cyan-100">▌</span></p>
        )}
      </div>

      {/* 走るバー */}
      <div className="mt-2 h-0.5 w-52 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
          style={{ animation: "streamX 1.4s ease-in-out infinite" }} />
      </div>
    </main>
  );
}
