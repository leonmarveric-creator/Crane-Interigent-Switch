"use client";

/**
 * ハイテクUI 用の大きなボタン (解錠 / 施錠 など)。
 *   角を落とした形 / 周回する光のエッジ / 六角形のアイコン台座 (点線リングが回る) /
 *   ラベル + 英字サブラベル / 右端のシェブロン (≫) が流れる / 定期的に光が表面を走る /
 *   押している間は内側が光り、送信中は下端をバーが走る。
 */
import { motion } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";

const TONE = {
  emerald: { c: "#34d399", soft: "rgba(52,211,153,0.16)", edge: "rgba(52,211,153,0.45)", text: "text-emerald-100", sub: "text-emerald-300/70" },
  cyan: { c: "#22d3ee", soft: "rgba(34,211,238,0.14)", edge: "rgba(34,211,238,0.45)", text: "text-cyan-100", sub: "text-cyan-300/70" },
  amber: { c: "#fbbf24", soft: "rgba(251,191,36,0.14)", edge: "rgba(251,191,36,0.45)", text: "text-amber-100", sub: "text-amber-300/70" },
  rose: { c: "#fb7185", soft: "rgba(251,113,133,0.14)", edge: "rgba(251,113,133,0.45)", text: "text-rose-100", sub: "text-rose-300/70" },
  violet: { c: "#a78bfa", soft: "rgba(167,139,250,0.14)", edge: "rgba(167,139,250,0.45)", text: "text-violet-100", sub: "text-violet-300/70" },
} as const;
export type TechTone = keyof typeof TONE;

const HEX = "M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z";

export default function TechButton({
  tone = "cyan", icon: Icon, label, sub, busy = false, active = false, disabled = false, onClick, className = "", layout = "row", big = false, size = "md",
}: {
  tone?: TechTone; icon: LucideIcon;
  label: string; sub?: string; busy?: boolean; active?: boolean; disabled?: boolean;
  onClick?: () => void; className?: string;
  /** row = アイコン・文字・≫ を横並び / stack = 縦並び (2 列のグリッド用) */
  layout?: "row" | "stack";
  /** 大きめ (解錠・施錠など主役のボタン) */
  big?: boolean;
  /** sm = 高さを抑えたコンパクト表示 (横並び・≫ なし) */
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  const stack = layout === "stack";
  const T = TONE[tone];
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled || busy}
      whileTap={{ scale: 0.965 }}
      className={`tb-root group clip-bevel-sm relative w-full overflow-hidden text-left disabled:opacity-60 ${className}`}
      style={active ? { filter: `drop-shadow(0 0 14px ${T.c})` } : undefined}>
      {/* エッジ: 静的 + 周回する光 */}
      <span className="clip-bevel-sm pointer-events-none absolute inset-0" style={{ background: T.edge }} />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="anim-spin-slow aspect-square w-[160%] shrink-0"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${T.c} 18deg, transparent 70deg)`, animationDuration: "5s" }} />
      </span>
      {/* 本体 */}
      <span className="clip-bevel-sm pointer-events-none absolute inset-[1.5px] bg-[#060a12]" />
      <span className="clip-bevel-sm pointer-events-none absolute inset-[1.5px] opacity-60"
        style={{ background: `linear-gradient(135deg, ${T.soft}, transparent 60%), repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,0.025) 6px 7px)` }} />
      {/* 押している間の内側の光 */}
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-100 group-active:opacity-100"
        style={{ background: `radial-gradient(circle at 30% 50%, ${T.soft.replace(/0\.1\d\)/, "0.45)")}, transparent 70%)` }} />
      {/* 定期的に表面を走る光 */}
      <span className="tb-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/3"
        style={{ background: `linear-gradient(100deg, transparent, ${T.c}33, transparent)` }} />

      <span className={`relative flex ${stack ? "flex-col items-center gap-1.5 px-3 py-4 text-center" : sm ? "items-center gap-2.5 px-3 py-2.5" : "items-center gap-3 px-4 py-4"}`}>
        {/* 六角形のアイコン台座 */}
        <span className={`relative flex shrink-0 items-center justify-center ${big ? "h-14 w-14" : sm ? "h-9 w-9" : "h-12 w-12"}`}>
          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full overflow-visible">
            <path d={HEX} fill={T.soft} stroke={T.c} strokeWidth="1.2" />
            <circle cx="20" cy="20" r="19.5" fill="none" stroke={T.c} strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="2 4"
              className="anim-spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center", animationDuration: "8s" }} />
          </svg>
          {busy
            ? <Loader2 className={`relative animate-spin ${sm ? "h-5 w-5" : "h-6 w-6"}`} style={{ color: T.c } as React.CSSProperties} />
            : <span className="relative" style={{ color: T.c }}><Icon className={sm ? "h-[18px] w-[18px]" : "h-6 w-6"} strokeWidth={1.7} /></span>}
        </span>
        {/* ラベル */}
        <span className={stack ? "min-w-0" : "min-w-0 flex-1"}>
          <span className={`block whitespace-nowrap font-semibold leading-tight tracking-wide ${big ? "text-[22px]" : sm ? "text-[16px]" : "text-[17px]"} ${T.text}`}>{label}</span>
          {sub && <span className={`mt-0.5 block font-mono text-[9px] tracking-[0.28em] ${T.sub}`}>{sub}</span>}
        </span>
        {/* シェブロン */}
        <span className={`${stack || sm ? "hidden" : "flex"} shrink-0 font-mono text-sm leading-none`} style={{ color: T.c }} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="tb-chev" style={{ animationDelay: `${i * 0.15}s` }}>›</span>
          ))}
        </span>
      </span>

      {/* 送信中: 下端をバーが走る */}
      {busy && (
        <span className="absolute inset-x-3 bottom-1 h-[2px] overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/3" style={{ background: T.c, animation: "streamX 0.9s ease-in-out infinite" }} />
        </span>
      )}
    </motion.button>
  );
}
