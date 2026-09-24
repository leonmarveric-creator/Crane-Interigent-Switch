/**
 * お母さん用画面 (/staff) 専用の読み込みアニメーション。
 *  - あたたかいベージュの背景に、お母さんのアイコンがふわふわ
 *  - まわりを花びらがゆっくり舞い、「今天也辛苦了」
 *  CSS アニメだけなので軽い (JS 不要)。
 */
const PETALS = [
  { e: "🌸", x: 12, d: 0, s: 22, t: 5.5 },
  { e: "🌼", x: 28, d: 1.2, s: 18, t: 6.5 },
  { e: "🌸", x: 46, d: 2.4, s: 16, t: 5 },
  { e: "✨", x: 64, d: 0.6, s: 18, t: 6 },
  { e: "🌷", x: 80, d: 1.8, s: 20, t: 7 },
  { e: "🌸", x: 90, d: 3, s: 16, t: 5.5 },
  { e: "💮", x: 6, d: 3.6, s: 18, t: 6.5 },
  { e: "🌸", x: 56, d: 4.2, s: 20, t: 6 },
];

export default function StaffLoading() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff6e6] via-[#f6efe2] to-[#fde9ec] text-[#3b3228]">
      <style>{`
        @keyframes xbFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes xbGlow { 0%,100% { transform: scale(1); opacity: .55 } 50% { transform: scale(1.12); opacity: .9 } }
        @keyframes xbFall { 0% { transform: translate(0,-10vh) rotate(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translate(30px,110vh) rotate(320deg); opacity: 0 } }
        @keyframes xbDot { 0%,80%,100% { transform: scale(.6); opacity: .35 } 40% { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .xb-anim { animation: none !important } }
      `}</style>

      {/* 舞う花びら */}
      {PETALS.map((p, i) => (
        <span key={i} aria-hidden className="xb-anim pointer-events-none absolute top-0"
          style={{ left: `${p.x}%`, fontSize: p.s, opacity: 0, animation: `xbFall ${p.t}s linear ${p.d}s infinite` }}>
          {p.e}
        </span>
      ))}

      {/* アイコン */}
      <div className="relative">
        <span aria-hidden className="xb-anim absolute -inset-5 rounded-[44px] bg-[#ffd6de] blur-xl"
          style={{ animation: "xbGlow 2.4s ease-in-out infinite" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/staff/icon.png?v=2" alt="" width={136} height={136}
          className="xb-anim relative h-[136px] w-[136px] rounded-[34px] shadow-[0_18px_40px_-18px_rgba(59,50,40,0.6)] ring-4 ring-white"
          style={{ animation: "xbFloat 2.4s ease-in-out infinite" }} />
      </div>

      <h1 className="mt-8 text-[26px] font-bold tracking-wide">Xiaobo 助手</h1>
      <p className="mt-1 text-base text-[#7a6d5c]">今天也辛苦了 🌸</p>

      {/* 読み込み中の点 */}
      <div className="mt-6 flex gap-2" aria-label="loading">
        {[0, 1, 2].map((i) => (
          <span key={i} className="xb-anim h-3 w-3 rounded-full bg-[#f08b7a]"
            style={{ animation: `xbDot 1.2s ease-in-out ${i * 0.16}s infinite` }} />
        ))}
      </div>
    </main>
  );
}
