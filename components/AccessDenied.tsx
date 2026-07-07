"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { T, type Lang } from "@/lib/i18n";

const SPIN: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

export default function AccessDenied({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0a0508] text-white flex items-center justify-center px-6">
      {/* 赤グリッド + グロー */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-grid absolute inset-0 opacity-[0.07]
          [background-image:linear-gradient(#f43f5e_1px,transparent_1px),linear-gradient(90deg,#f43f5e_1px,transparent_1px)]
          [background-size:40px_40px]" />
        <div className="anim-alert absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-600/30 blur-[120px]" />
        <div className="anim-alert absolute bottom-0 -right-24 h-80 w-80 rounded-full bg-rose-800/25 blur-[110px]" style={{ animationDelay: "0.55s" }} />
        {/* 索敵レーダー */}
        <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="200" cy="200" r="190" fill="none" stroke="#f43f5e" strokeWidth="0.6" strokeDasharray="2 9" />
            <circle cx="200" cy="200" r="140" fill="none" stroke="#f43f5e" strokeWidth="0.6" strokeDasharray="30 24" />
          </g>
          <g className="anim-radar">
            <path d="M200 200 L200 30 A170 170 0 0 1 320 80 Z" fill="#f43f5e" fillOpacity="0.25" />
          </g>
        </svg>
        {/* 全画面の赤走査線 */}
        <div className="anim-glitch absolute inset-0 mix-blend-screen"
          style={{ background: "repeating-linear-gradient(0deg, rgba(244,63,94,0.12) 0, rgba(244,63,94,0.12) 1px, transparent 2px, transparent 4px)" }} />
      </div>

      {/* 上下のハザードストライプ */}
      <div className="anim-hazard pointer-events-none absolute inset-x-0 top-0 h-2.5 opacity-60" />
      <div className="anim-hazard pointer-events-none absolute inset-x-0 bottom-0 h-2.5 opacity-60" />

      {/* HUDコーナー (赤) */}
      <div className="pointer-events-none fixed inset-0">
        <span className="absolute left-3 top-6 h-7 w-7 border-l-2 border-t-2 border-rose-400/50" />
        <span className="absolute right-3 top-6 h-7 w-7 border-r-2 border-t-2 border-rose-400/50" />
        <span className="absolute bottom-6 left-3 h-7 w-7 border-b-2 border-l-2 border-rose-400/50" />
        <span className="absolute bottom-6 right-3 h-7 w-7 border-b-2 border-r-2 border-rose-400/50" />
      </div>

      {/* 警告パネル (角カット) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="clip-bevel relative z-10 w-full max-w-sm"
        style={{ filter: "drop-shadow(0 0 30px rgba(244,63,94,0.5))" }}
      >
        <span className="clip-bevel pointer-events-none absolute inset-0 bg-rose-500/35" />
        <span className="clip-bevel anim-spin-slow pointer-events-none absolute inset-0"
          style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(251,113,133,0.95) 16deg, transparent 72deg)" }} />
        <span className="clip-bevel pointer-events-none absolute inset-[1.5px] bg-[#0d0609]/95 backdrop-blur-2xl" />

        <div className="relative p-8 text-center">
          <span className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t border-rose-400/60" />
          <span className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t border-rose-400/60" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-3.5 w-3.5 border-b border-l border-rose-400/60" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r border-rose-400/60" />

          {/* 回転リング + 警告コア */}
          <div className="relative mx-auto mb-5 h-28 w-28">
            <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
              <g className="anim-spin-rev" style={SPIN}>
                <circle cx="60" cy="60" r="54" fill="none" stroke="#f43f5e" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 7" />
              </g>
              <g className="anim-spin-slow" style={SPIN}>
                <circle cx="60" cy="60" r="44" fill="none" stroke="#f43f5e" strokeOpacity="0.65" strokeWidth="2"
                  strokeDasharray="34 160" strokeLinecap="round" />
              </g>
              <g className="anim-spin-rev" style={SPIN}>
                {[...Array(24)].map((_, i) => (
                  <line key={i} x1="60" y1="8" x2="60" y2={i % 4 === 0 ? "14" : "11"}
                    stroke="#f43f5e" strokeOpacity={i % 4 === 0 ? 0.55 : 0.3} strokeWidth="1"
                    transform={`rotate(${(i / 24) * 360} 60 60)`} />
                ))}
              </g>
            </svg>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="absolute inset-0 m-auto flex h-18 w-18 items-center justify-center rounded-full
                border border-rose-500/60 bg-rose-500/10"
              style={{ height: 72, width: 72 }}
            >
              <ShieldAlert className="h-9 w-9 text-rose-400" strokeWidth={1.5} />
            </motion.div>
          </div>

          <p className="anim-alert font-mono text-[10px] tracking-[0.4em] text-rose-400">
            ⚠ INTRUSION ALERT ⚠
          </p>
          <h1 className="anim-textglitch mt-2 text-2xl font-semibold tracking-wide text-rose-300">
            {t.accessDenied}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {t.accessDeniedDesc}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.3em] text-rose-400/60">
            <span className="anim-breathe inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
            ERR · 403 · TOKEN_INVALID
          </div>
        </div>
      </motion.div>
    </main>
  );
}
