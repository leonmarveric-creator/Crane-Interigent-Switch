/** 鍵画面へ切り替えるときに、すぐ出す読み込み画面 (青い鍵のテーマ)。 */
export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#0b2f6e] via-[#1253b8] to-[#eef3fb]">
      <div className="relative h-24 w-24">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white shadow-xl">
          <svg viewBox="0 0 24 24" className="h-11 w-11 text-[#0b2f6e]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
          </svg>
        </span>
      </div>
      <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-white/85">SMART KEY</p>
    </main>
  );
}
