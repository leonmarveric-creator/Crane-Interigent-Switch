"use client";

/**
 * ハイテク全画面ローディング (Next.js の loading.tsx 用)。
 *   高精細アークリアクター + 充電ゲージ (%) + 起動ログのタイピング +
 *   六角形グリッド / レーダースイープ / グリッチ帯 / HUD コーナーの数値。
 *   重い処理はなく、SVG と CSS アニメが中心。
 *   ローディングの演出が重いと、その裏で読み込んでいるページの準備 (スマホの処理) が遅れるので:
 *   - % の更新は 1 秒に 8 回まで (前は毎コマ = 1 秒 60 回、画面全体を描き直していた)
 *   - ぼかし (blur 120px) の光は、ぼかしを使わない丸いグラデーションに (見た目は同じ・とても軽い)
 *   - 古いスマホ・「動きを減らす」の設定では、回る・流れる動きを止めて文字も一度に出す
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
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const n: any = typeof navigator !== "undefined" ? navigator : {};
    const low = (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (n.deviceMemory && n.deviceMemory <= 2) || matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setLite(!!low);
    const t0 = performance.now();
    const id = setInterval(() => setP(1 - Math.exp(-((performance.now() - t0) / 1000) * 1.1)), low ? 250 : 125);
    return () => clearInterval(id);
  }, []);
  // 起動ログ: 1 行ずつタイピング
  useEffect(() => {
    if (lite) { setLines(LOG.length); return; } // 古いスマホ: 一度に出す
    if (lines >= LOG.length) return;
    const full = LOG[lines];
    if (typed.length < full.length) {
      const id = setTimeout(() => setTyped(full.slice(0, typed.length + 3)), 40);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { setLines((n) => n + 1); setTyped(""); }, 160);
    return () => clearTimeout(id);
  }, [lines, typed, lite]);

  const pct = Math.min(99, Math.floor(p * 100));

  return (
    <main className={`relative flex${lite ? " hud-lite" : ""} min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#03050b] text-white`}>
      {/* 背景: 六角形グリッド + オーロラ + 走査線 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-hexdrift absolute inset-0 opacity-[0.10]" style={{ backgroundImage: HEX_BG }} />
        <div className="anim-drift absolute -top-48 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,.22) 0%, rgba(6,182,212,.08) 35%, transparent 65%)" }} />
        <div className="anim-drift2 absolute bottom-[-12rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full" style={{ background: "radial-gradient(circle, rgba(217,70,239,.16) 0%, rgba(217,70,239,.05) 35%, transparent 65%)" }} />
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
        <div className="anim-glitchband absolute inset-x-0 top-0 h-1.5 bg-cyan-200/40" />
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
