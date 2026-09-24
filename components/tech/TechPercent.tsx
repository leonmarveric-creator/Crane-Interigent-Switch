"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ハイテクなパーセント表示 (読み込み画面・起動演出用)。
 *   角ブラケットの HUD 枠 / 1 桁ずつ入れ替わる数字 (ブラーしながら落ちてくる) /
 *   色収差 (赤・シアンのずれ) + 発光 / 小数 1 桁 / 24 分割のセグメントメーター /
 *   ラベルと状態表示の点滅。
 */
type Props = {
  /** 0〜1 */
  value: number;
  label?: string;
  status?: string;
  className?: string;
};

export default function TechPercent({ value, label = "CORE CHARGE", status = "SYNC", className = "" }: Props) {
  // 値が毎フレーム変わっても数字の「落ちてくる」演出が見えるよう、表示の更新は 180ms ごとにまとめる
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = 180 - (Date.now() - last.current);
    if (wait <= 0) { last.current = Date.now(); setShown(value); return; }
    const id = setTimeout(() => { last.current = Date.now(); setShown(value); }, wait);
    return () => clearTimeout(id);
  }, [value]);
  const v = Math.max(0, Math.min(1, shown)) * 100;
  const whole = Math.min(100, Math.floor(v));
  const dec = whole >= 100 ? 0 : Math.floor((v - whole) * 10);
  const digits = String(whole).padStart(3, "0").split("");
  const SEG = 24;
  const lit = Math.round((v / 100) * SEG);

  return (
    <div className={`tp-root relative select-none px-4 pb-2.5 pt-2 font-mono text-cyan-200 ${className}`} aria-label={`${whole}%`}>
      {/* HUD 枠 (角ブラケット + 上下の細線) */}
      <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-cyan-300/70" />
      <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-cyan-300/70" />
      <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-cyan-300/70" />
      <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-cyan-300/70" />
      <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <span className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      {/* ラベル行 */}
      <div className="flex items-center justify-between gap-6 text-[8px] tracking-[0.3em] text-cyan-300/60">
        <span>{label}</span>
        <span className="flex items-center gap-1 text-emerald-300/80">
          <span className="tp-blink inline-block h-1 w-1 rounded-full bg-emerald-300" /> {status}
        </span>
      </div>

      {/* 数字 */}
      <div className="mt-0.5 flex items-end justify-center">
        {digits.map((d, i) => (
          <span key={i} className="relative inline-block w-[0.62em] overflow-hidden text-center text-[44px] font-light leading-none">
            {/* 数字が変わると key が変わって「落ちてくる」アニメーション */}
            <span key={`${i}-${d}`} className={`tp-digit inline-block ${i === 0 && d === "0" && whole < 100 ? "text-cyan-300/25" : ""}`}>{d}</span>
          </span>
        ))}
        <span className="mb-1.5 ml-0.5 text-[16px] font-light text-cyan-300/80">.{dec}</span>
        <span className="mb-1.5 ml-1 text-[15px] text-cyan-300/70">%</span>
      </div>

      {/* セグメントメーター */}
      <div className="mt-1 flex gap-[3px]">
        {Array.from({ length: SEG }, (_, i) => (
          <span key={i}
            className={`h-1.5 flex-1 skew-x-[-20deg] ${i < lit ? (i === lit - 1 ? "tp-blink bg-cyan-100" : "bg-cyan-300/85") : "bg-cyan-300/10"}`}
            style={i < lit ? { boxShadow: "0 0 6px rgba(34,211,238,0.8)" } : undefined} />
        ))}
      </div>
    </div>
  );
}
