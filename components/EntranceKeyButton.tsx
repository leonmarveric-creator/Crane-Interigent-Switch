"use client";

// 部屋の操作画面 → エントランスの鍵画面 (/key/[entrance]) への導線。3つのUIの見た目に合わせる。
//   Link + 先読み (prefetch) で、押すとすぐ切り替わる。押した瞬間にくるくるを出す。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, ChevronRight, Loader2 } from "lucide-react";
import { GX, type Lang } from "@/lib/i18n";

export default function EntranceKeyButton({
  href, lang, variant,
}: { href: string; lang: Lang; variant: "tech" | "wafu" | "magic" }) {
  const g = GX[lang] ?? GX.en;
  const url = `${href}${href.includes("?") ? "&" : "?"}lang=${lang}`;
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  useEffect(() => { try { router.prefetch(url); } catch { /* noop */ } }, [router, url]);
  const cls =
    variant === "tech"
      ? "border-amber-300/40 bg-amber-400/10 text-amber-100 shadow-[0_0_22px_-8px_rgba(251,191,36,0.6)]"
      : variant === "wafu"
      ? "border-[#d8cfbb] bg-[#fffdf8] text-[#2c2a26] shadow-[0_14px_30px_-24px_rgba(44,42,38,0.45)]"
      : "border-[#d8bf86]/50 bg-[#1a1622]/85 text-[#ffe7b3] shadow-[0_14px_30px_-20px_rgba(0,0,0,0.7)]";
  const icon =
    variant === "tech" ? "bg-amber-400/20 text-amber-200"
    : variant === "wafu" ? "bg-[#f5c542] text-[#0b2f6e]"
    : "bg-[#f5c26b]/20 text-[#ffe7b3]";
  const sub = variant === "wafu" ? "text-[#6d685d]" : variant === "tech" ? "text-amber-100/55" : "text-[#f8ecd1]/60";
  return (
    <Link href={url} prefetch onClick={() => setOpening(true)}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${cls}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${icon}`}>
        {opening ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{g.entranceKey}</span>
        <span className={`block truncate text-[11px] ${sub}`}>{g.entranceKeySub}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 opacity-60" />
    </Link>
  );
}
