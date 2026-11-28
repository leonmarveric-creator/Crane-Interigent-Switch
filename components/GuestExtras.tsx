"use client";

// =========================================================
// お部屋の操作画面 (ハイテク・和風・マジカル) に出す 2 つ:
//  ① あなた専用のコンシェルジュのリンク (表示・コピー・自分に送る)。チェックアウトまで 4 桁なしで開ける
//  ② ウェルカム映像 (画面の雰囲気に合わせて: ハイテク = 地球儀 / 和風 = 墨と円相 / マジカル = 魔法陣と巻物)
//     和風・マジカルは、はじめて開いたときに 1 回だけ自動で出す (ハイテクは起動の演出があるのでボタンだけ)
// =========================================================
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type GuestWc = { nm: string; cc: string | null; np: number };
type Variant = "tech" | "wafu" | "magic";

const T: Record<string, { h: string; s: string; c: string; cd: string; sh: string; n: string; wc: Record<Variant, string> }> = {
  ja: { h: "あなた専用のコンシェルジュ", s: "鍵・お部屋・地図・送迎がここから開けます", c: "リンクをコピー", cd: "コピーしました", sh: "自分に送る", n: "メモ・LINE・WhatsApp などに貼って保存してください。チェックアウトまで番号なしで開けます。同行者以外には送らないでください。", wc: { tech: "WELCOME 映像を見る", wafu: "歓迎の映像を見る", magic: "魔法の歓迎を見る" } },
  en: { h: "Your personal concierge link", s: "Keys, room, map and transfers — all in one place", c: "Copy link", cd: "Copied", sh: "Send to myself", n: "Paste it into Notes, WhatsApp, LINE etc. It opens without a code until checkout — share only with your travel group.", wc: { tech: "Watch your WELCOME", wafu: "Watch your welcome", magic: "Watch your magical welcome" } },
  zh: { h: "您的专属礼宾链接", s: "钥匙、房间、地图、接送都在这里", c: "复制链接", cd: "已复制", sh: "发给自己", n: "请粘贴到备忘录、微信、WhatsApp 等保存。退房前无需密码即可打开，请只发给同行的人。", wc: { tech: "观看欢迎影像", wafu: "观看欢迎影像", magic: "观看魔法欢迎" } },
  ko: { h: "나만의 컨시어지 링크", s: "열쇠·객실·지도·송영을 여기서 열 수 있어요", c: "링크 복사", cd: "복사됨", sh: "나에게 보내기", n: "메모·카카오톡·WhatsApp 등에 붙여 넣어 저장하세요. 체크아웃까지 번호 없이 열립니다. 일행 외에는 보내지 마세요.", wc: { tech: "WELCOME 영상 보기", wafu: "환영 영상 보기", magic: "마법의 환영 보기" } },
};
const PAGE: Record<Variant, string> = { tech: "welcome", wafu: "welcome-wafu", magic: "welcome-magic" };
const ICON: Record<Variant, string> = { tech: "🌏", wafu: "🏮", magic: "✨" };

/* 画質は端末で自動: iPad・パソコン = 標準 / スマホ = 軽量 / 古い・メモリの少ないスマホ = 超軽量 */
function hq(): string {
  const ua = navigator.userAgent, pad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), phone = /iPhone|Android.+Mobile/.test(ua);
  if (!phone) return pad || !/Android/.test(ua) ? "std" : "lite";
  const mem = (navigator as any).deviceMemory || 0, cpu = navigator.hardwareConcurrency || 0;
  return (mem && mem <= 3) || (cpu && cpu <= 2) ? "ul" : "lite";
}

const STY: Record<Variant, { box: string; title: string; sub: string; input: string; btn: string; btn2: string; note: string; wcb: string }> = {
  tech: {
    box: "rounded-2xl border border-cyan-400/30 bg-slate-950/60 p-4 backdrop-blur", title: "text-sm font-semibold text-cyan-100", sub: "text-[11px] text-cyan-200/60",
    input: "border-cyan-400/30 bg-black/40 text-cyan-100", btn: "border-cyan-300/60 bg-cyan-400/15 text-cyan-50", btn2: "border-cyan-300/30 bg-transparent text-cyan-100", note: "text-cyan-100/55",
    wcb: "border-cyan-300/50 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-50 shadow-[0_0_24px_rgba(72,200,255,.25)]",
  },
  wafu: {
    box: "rounded-lg border border-[#d6cfbb] bg-[#fffdf8] p-4", title: "text-sm font-semibold text-[#2c2a26]", sub: "text-[11px] text-[#8a8274]",
    input: "border-[#d6cfbb] bg-[#f7f2e7] text-[#2c2a26]", btn: "border-[#2c2a26] bg-[#2c2a26] text-[#fbf6ea]", btn2: "border-[#bdb39d] bg-white text-[#2c2a26]", note: "text-[#8a8274]",
    wcb: "border-[#c43a26]/60 bg-[#fffdf8] text-[#8a2a1a]",
  },
  magic: {
    box: "rounded-2xl border border-[#d8bf86]/40 bg-[#120f2e]/80 p-4 backdrop-blur", title: "text-sm font-semibold text-[#ffe7b3]", sub: "text-[11px] text-[#d8bf86]/70",
    input: "border-[#d8bf86]/40 bg-black/30 text-[#f8ecd1]", btn: "border-[#f5d07a]/70 bg-[#f5d07a]/20 text-[#fff3d6]", btn2: "border-[#d8bf86]/35 bg-transparent text-[#f8ecd1]", note: "text-[#d8bf86]/65",
    wcb: "border-[#f5d07a]/60 bg-gradient-to-r from-[#3a2a6e]/80 to-[#1a1240]/80 text-[#ffe7b3] shadow-[0_0_24px_rgba(245,208,122,.25)]",
  },
};

export default function GuestExtras({ variant, lang, link, wc, season, admin, className = "" }: {
  variant: Variant; lang: string; link?: string | null; wc?: GuestWc | null; season?: string | null; admin?: boolean; className?: string;
}) {
  const t = T[lang] ?? T.en, s = STY[variant];
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (link) setUrl(link.startsWith("http") ? link : location.origin + link);
    setCanShare(typeof navigator !== "undefined" && !!(navigator as any).share);
  }, [link]);

  const play = () => {
    if (!wc) return;
    const q = new URLSearchParams({ nm: wc.nm, np: String(wc.np || 1), l: lang === "zh-TW" ? "zh" : lang, tap: "1", q: hq() });
    if (wc.cc) q.set("cc", wc.cc);
    if (season) q.set("s", season);
    setSrc(`/cabin/air/${PAGE[variant]}.html?${q}`);
    setOpen(true);
  };
  // 和風・マジカル: はじめて開いたときに 1 回だけ自動で
  useEffect(() => {
    if (!wc || variant === "tech") return;
    const auto = admin ? new URLSearchParams(location.search).get("wc") === "1" : true;
    if (!auto) return;
    const k = `cnwc-${variant}-${wc.nm}`;
    try { if (!admin && localStorage.getItem(k)) return; } catch { /* 保存できない端末でも一度は出す */ }
    const id = setTimeout(() => { try { localStorage.setItem(k, "1"); } catch { /* */ } play(); }, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wc?.nm, variant]);

  const copy = async () => {
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    try { await navigator.clipboard.writeText(url); ok(); }
    catch {
      const i = document.getElementById(`gx-url-${variant}`) as HTMLInputElement | null;
      if (i) { i.focus(); i.select(); try { i.setSelectionRange(0, 9999); document.execCommand("copy"); ok(); } catch { /* 長押しでコピーしてもらう */ } }
    }
  };
  const share = () => { (navigator as any).share?.({ title: "Crane Nest", url }).catch(() => {}); };

  if (!link && !wc) return null;
  return (
    <div className={className}>
      {wc && (
        <button type="button" onClick={play}
          className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold active:scale-[.99] ${s.wcb}`}>
          <span className="text-lg">{ICON[variant]}</span>{t.wc[variant]}
        </button>
      )}
      {link && (
        <div className={s.box}>
          <p className={s.title}>🔗 {t.h}</p>
          <p className={`mt-0.5 ${s.sub}`}>{t.s}</p>
          <input id={`gx-url-${variant}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()}
            className={`mt-2.5 w-full rounded-lg border px-2.5 py-2 font-mono text-[12px] outline-none ${s.input}`} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy} className={`flex-1 rounded-lg border px-2 py-2.5 text-[13px] font-semibold ${s.btn}`}>
              {copied ? `✅ ${t.cd}` : `📋 ${t.c}`}
            </button>
            {canShare && (
              <button type="button" onClick={share} className={`flex-1 rounded-lg border px-2 py-2.5 text-[13px] font-semibold ${s.btn2}`}>📤 {t.sh}</button>
            )}
          </div>
          <p className={`mt-2 text-[11px] leading-relaxed ${s.note}`}>{t.n}</p>
        </div>
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[2147483646] bg-black">
          <iframe src={src} allow="autoplay" className="absolute inset-0 h-full w-full border-0" title="welcome" />
          <button type="button" onClick={() => setOpen(false)} aria-label="close"
            className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 h-11 w-11 rounded-full border border-white/40 bg-black/50 text-lg text-white">✕</button>
        </div>,
        document.body,
      )}
    </div>
  );
}
