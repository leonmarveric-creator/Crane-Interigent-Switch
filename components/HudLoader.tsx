"use client";

/**
 * アイアンマン風 全画面ローディング (Next.js の loading.tsx 用)。
 * アークリアクター + 回転リング + データストリーム。CSSアニメのみで軽量。
 */
const SPIN: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

export default function HudLoader({ label = "LOADING SYSTEMS" }: { label?: string }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#04060c] text-white">
      {/* 背景 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-drift absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="anim-grid absolute inset-0
          [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)]
          [background-size:44px_44px]" />
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
      </div>

      {/* HUDコーナー */}
      <div className="pointer-events-none fixed inset-0">
        <span className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-cyan-300/40" />
        <span className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-cyan-300/40" />
        <span className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-cyan-300/40" />
        <span className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-cyan-300/40" />
      </div>

      {/* アークリアクター */}
      <div className="relative mb-8 h-36 w-36">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <g className="anim-spin-slow" style={{ ...SPIN, animationDuration: "6s" }}>
            <circle cx="100" cy="100" r="92" fill="none" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 7" />
          </g>
          <g className="anim-spin-rev" style={{ ...SPIN, animationDuration: "4s" }}>
            <circle cx="100" cy="100" r="74" fill="none" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2.5"
              strokeDasharray="60 240" strokeLinecap="round" />
            <circle cx="100" cy="100" r="74" fill="none" stroke="#fbbf24" strokeOpacity="0.6" strokeWidth="2.5"
              strokeDasharray="24 296" strokeDashoffset="-150" strokeLinecap="round" />
          </g>
          <g className="anim-spin-slow" style={{ ...SPIN, animationDuration: "3s" }}>
            <circle cx="100" cy="100" r="56" fill="none" stroke="#67e8f9" strokeOpacity="0.8" strokeWidth="3"
              strokeDasharray="30 322" strokeLinecap="round" />
          </g>
          {/* 目盛り */}
          <g className="anim-spin-rev" style={{ ...SPIN, animationDuration: "12s" }}>
            {[...Array(36)].map((_, i) => (
              <line key={i} x1="100" y1="12" x2="100" y2={i % 3 === 0 ? "20" : "16"}
                stroke="#22d3ee" strokeOpacity={i % 3 === 0 ? 0.45 : 0.2} strokeWidth="1"
                transform={`rotate(${(i / 36) * 360} 100 100)`} />
            ))}
          </g>
        </svg>
        {/* 鼓動するコア */}
        <div className="anim-core absolute inset-0 m-auto h-14 w-14 rounded-full bg-cyan-400/40 blur-md" style={SPIN} />
        <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/10">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-100 shadow-[0_0_20px_5px_rgba(34,211,238,0.85)]" />
        </div>
      </div>

      {/* ラベル + 走るドット */}
      <p className="anim-flicker font-mono text-[11px] tracking-[0.35em] text-cyan-300/85">{label}</p>
      <div className="mt-5 h-0.5 w-52 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
          style={{ animation: "streamX 1.4s ease-in-out infinite" }} />
      </div>
      <p className="mt-4 font-mono text-[9px] tracking-[0.3em] text-white/25">STAND BY</p>
    </main>
  );
}
