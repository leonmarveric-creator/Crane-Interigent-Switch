"use client";

/**
 * 「🧳 チェックアウトする」の帯 (お部屋の操作画面: ハイテク・和風・マジカル 共通)。
 *   チェックアウト日の朝 6 時 (日本時間) から、チェックアウトの時刻まで出す。
 *   押すと /checkout/[部屋] (忘れ物の確認 → 同意 → 電源 OFF) へ。管理のテスト表示ではいつも出す (電源は切らない)。
 */
import { useEffect, useState } from "react";
import { CO_T, checkoutWindow, coLang, coTime } from "@/lib/checkoutText";

type Variant = "tech" | "wafu" | "magic";

const STYLE: Record<Variant, { box: string; title: string; sub: string; arrow: string }> = {
  tech: {
    box: "border-amber-300/80 bg-gradient-to-r from-amber-900/50 to-[#140d04]/80 [box-shadow:0_0_18px_-4px_rgba(255,179,71,0.55)]",
    title: "text-amber-100", sub: "text-amber-200/75", arrow: "text-amber-200",
  },
  wafu: {
    box: "border-[1.5px] border-[#b5533b] bg-[#fff6f0]",
    title: "text-[#8c3a26]", sub: "text-[#8c3a26]/75", arrow: "text-[#b5533b]",
  },
  magic: {
    box: "border-[#e9c97a] bg-gradient-to-r from-[#4a3410]/80 to-[#2a1a3a]/80 [box-shadow:0_0_18px_-4px_rgba(233,201,122,0.55)]",
    title: "text-[#ffe9b0]", sub: "text-[#ffe9b0]/75", arrow: "text-[#e9c97a]",
  },
};

export default function CheckoutBanner({ roomSlug, checkOut, lang, admin, variant, className = "" }: {
  roomSlug: string; checkOut: string; lang: string; admin?: boolean; variant: Variant; className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);
  const open = admin || checkoutWindow(checkOut, now).open;
  if (!open) return null;

  const L = coLang(lang), t = CO_T[L], s = STYLE[variant];
  const q = encodeURIComponent(roomSlug);
  const href = admin ? `/checkout/${q}?demo=1&lang=${L}` : `/checkout/${q}?via=room&lang=${L}`;
  return (
    <a href={href}
      className={`anim-co-pulse flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left no-underline active:scale-[0.99] ${s.box} ${className}`}>
      <span className="text-[26px] leading-none">🧳</span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[15px] font-bold ${s.title}`}>{t.btn}</b>
        <small className={`mt-0.5 block text-[11.5px] leading-snug ${s.sub}`}>
          {admin ? t.demo : `${t.btnTime.replace("{T}", coTime(checkOut))} · ${t.btnHint}`}
        </small>
      </span>
      <span className={`text-xl ${s.arrow}`}>›</span>
    </a>
  );
}
