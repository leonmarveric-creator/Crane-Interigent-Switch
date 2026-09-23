"use client";

// =========================================================
// UIモード切替（ハイテク ⇄ 和風 ⇄ マジカル）
//   PIN認証後（管理テストでは即時）に、まずどちらのUIで操作するか選ぶ。
//   選択は端末に記憶（localStorage）。各UIから相互に切り替え可能。
//   ・ハイテク = 既存の ControlPanel（リッチ演出）
//   ・和風 = LiteControlPanel（静止画・最小構成）
//   ・マジカル = MagicalControlPanel（杖と魔法音の演出）
// =========================================================
import { useEffect, useState } from "react";
import { Lamp, PanelsTopLeft, Sparkles } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";
import LiteControlPanel from "@/components/LiteControlPanel";
import MagicalControlPanel from "@/components/MagicalControlPanel";
import { type Lang } from "@/lib/i18n";

type Mode = "select" | "normal" | "lite" | "magic";
const STORE_KEY = "craneUiMode";

export interface RoomModeSwitchProps {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean;
  imageUrl?: string | null;   // ハイテク用（動画/画像）
  posterUrl?: string | null;  // 和風用（静止ポスター）
  lat?: number | null;
  lng?: number | null;
  radiusM?: number | null;
  hasGalaxy?: boolean;
  hasNest?: boolean;
  hasWafu?: boolean;
  /** ゲストが入力した名前 (「ようこそ、◯◯様」) */
  guestName?: string | null;
  /** 同じ棟のエントランス鍵画面 (/key/[slug]) */
  entranceHref?: string | null;
}

const SEL: Record<Lang, {
  heading: string; sub: string;
  normalTitle: string; normalDesc: string;
  liteTitle: string; liteDesc: string;
  magicTitle: string; magicDesc: string;
  remember: string;
}> = {
  ja: {
    heading: "操作画面を選択",
    sub: "雰囲気に合わせて選べます。あとでいつでも切り替え可能です。",
    normalTitle: "ハイテク", normalDesc: "映像とアニメーションを使ったリッチな操作画面",
    liteTitle: "和風", liteDesc: "和紙調の静かな画面。必要な操作だけをすばやく表示",
    magicTitle: "マジカル", magicDesc: "杖の一振りで部屋を操る、魔法世界の操作画面",
    remember: "この選択はこの端末に記憶されます",
  },
  en: {
    heading: "Choose your interface",
    sub: "Pick the mood for this device. You can switch anytime.",
    normalTitle: "Hi-Tech", normalDesc: "Rich animated controls with room visuals",
    liteTitle: "Wafu", liteDesc: "Quiet Japanese-style controls with only the essentials",
    magicTitle: "Magical", magicDesc: "Wand-led controls with spell-like motion and sound",
    remember: "Your choice is remembered on this device",
  },
  zh: {
    heading: "选择操作界面",
    sub: "可按喜好选择，之后可随时切换",
    normalTitle: "高科技", normalDesc: "带影像与动画的丰富操作界面",
    liteTitle: "和风", liteDesc: "安静的和纸风界面，只保留必要操作",
    magicTitle: "魔法", magicDesc: "以魔杖为中心，配合咒语般的动画与声音",
    remember: "此选择将记忆在本设备",
  },
  ko: {
    heading: "조작 화면 선택",
    sub: "분위기에 맞게 선택하세요. 언제든 전환할 수 있습니다.",
    normalTitle: "하이테크", normalDesc: "영상과 애니메이션이 있는 풍부한 조작 화면",
    liteTitle: "와풍", liteDesc: "조용한 일본풍 화면. 필요한 조작만 간결하게 표시",
    magicTitle: "매지컬", magicDesc: "지팡이로 조작하는 듯한 주문과 움직임의 화면",
    remember: "이 선택은 이 기기에 저장됩니다",
  },
};

export default function RoomModeSwitch(props: RoomModeSwitchProps) {
  const { initialLang, posterUrl, imageUrl } = props;
  const [mode, setMode] = useState<Mode | null>(null); // null=読込中（ちらつき防止）

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* noop */ }
    setMode(saved === "normal" || saved === "lite" || saved === "magic" ? saved : "select");
  }, []);

  const choose = (m: Mode) => {
    try { localStorage.setItem(STORE_KEY, m); } catch { /* noop */ }
    setMode(m);
  };

  if (mode === null) {
    return <main className="min-h-dvh bg-[#05070d]" />;
  }

  // ---- 選択画面 ----
  if (mode === "select") {
    const s = SEL[initialLang] ?? SEL.en;
    const preview = posterUrl || imageUrl || null;
    return (
      <main className="relative min-h-dvh overflow-hidden bg-[#f7f4ed] text-[#2c2a26]">
        <div className="pointer-events-none fixed inset-0">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover opacity-[0.18]"
              onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,244,237,0.84)_0%,rgba(247,244,237,0.96)_58%,#f7f4ed_100%)]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6d685d]">{props.roomName}</p>
          <h1 className="mt-1 text-2xl font-semibold">{s.heading}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#6d685d]">{s.sub}</p>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => choose("normal")}
              className="flex w-full items-center gap-3 rounded-lg border border-cyan-300/40 bg-[#07101d] p-4 text-left text-white shadow-[0_14px_30px_-24px_rgba(5,16,29,0.75)] transition active:scale-[0.99] active:bg-[#0d1b2c]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-cyan-100">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-cyan-100">{s.normalTitle}</span>
                <span className="block text-xs leading-relaxed text-white/60">{s.normalDesc}</span>
              </span>
            </button>

            <button
              onClick={() => choose("lite")}
              className="flex w-full items-center gap-3 rounded-lg border border-[#d8cfbb] bg-[#fffdf8]/95 p-4 text-left shadow-[0_14px_30px_-24px_rgba(44,42,38,0.45)] transition active:scale-[0.99] active:bg-[#f3efe6]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#cfc5b0] bg-[#f4efe6] text-[#6d685d]">
                <Lamp className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-[#2c2a26]">{s.liteTitle}</span>
                <span className="block text-xs leading-relaxed text-[#6d685d]">{s.liteDesc}</span>
              </span>
            </button>

            <button
              onClick={() => choose("magic")}
              className="flex w-full items-center gap-3 rounded-lg border border-[#d8bf86]/55 bg-[#111019]/95 p-4 text-left text-[#fff6dd] shadow-[0_14px_30px_-24px_rgba(17,16,25,0.75)] transition active:scale-[0.99] active:bg-[#171520]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d8bf86]/45 bg-[#f5c26b]/12 text-[#ffe7b3]">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-[#ffe7b3]">{s.magicTitle}</span>
                <span className="block text-xs leading-relaxed text-[#f8ecd1]/62">{s.magicDesc}</span>
              </span>
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-[#8a8172]">{s.remember}</p>
        </div>
      </main>
    );
  }

  // ---- 和風 ----
  if (mode === "lite") {
    return (
      <LiteControlPanel
        roomSlug={props.roomSlug}
        roomName={props.roomName}
        checkOut={props.checkOut}
        initialLang={props.initialLang}
        admin={props.admin}
        posterUrl={props.posterUrl}
        hasGalaxy={props.hasGalaxy}
        hasNest={props.hasNest}
        hasWafu={props.hasWafu}
        guestName={props.guestName}
        entranceHref={props.entranceHref}
        onSwitchMode={() => choose("normal")}
      />
    );
  }

  // ---- マジカル ----
  if (mode === "magic") {
    return (
      <MagicalControlPanel
        roomSlug={props.roomSlug}
        roomName={props.roomName}
        checkOut={props.checkOut}
        initialLang={props.initialLang}
        admin={props.admin}
        posterUrl={props.posterUrl}
        hasGalaxy={props.hasGalaxy}
        hasNest={props.hasNest}
        hasWafu={props.hasWafu}
        guestName={props.guestName}
        entranceHref={props.entranceHref}
        onSwitchTech={() => choose("normal")}
        onSwitchWafu={() => choose("lite")}
      />
    );
  }

  // ---- ハイテク（既存 ControlPanel）＋ 和風へ切り替える浮動ボタン ----
  return (
    <>
      <ControlPanel
        roomSlug={props.roomSlug}
        roomName={props.roomName}
        checkOut={props.checkOut}
        initialLang={props.initialLang}
        admin={props.admin}
        imageUrl={props.imageUrl}
        lat={props.lat}
        lng={props.lng}
        radiusM={props.radiusM}
        hasGalaxy={props.hasGalaxy}
        hasNest={props.hasNest}
        hasWafu={props.hasWafu}
        guestName={props.guestName}
        entranceHref={props.entranceHref}
      />
      <div className="fixed left-3 top-3 z-[60] flex items-center gap-1.5">
        <button
          onClick={() => choose("lite")}
          className="flex items-center gap-1 rounded-lg border border-[#d8cfbb]/80 bg-[#fffdf8]/90 px-3 py-1.5 text-xs font-semibold text-[#574f43] shadow-[0_12px_26px_-20px_rgba(0,0,0,0.55)] backdrop-blur active:bg-[#efe9dd]"
          title={SEL[initialLang]?.liteTitle ?? "和風"}
        >
          <Lamp className="h-3.5 w-3.5" /> {SEL[initialLang]?.liteTitle ?? "和風"}
        </button>
        <button
          onClick={() => choose("magic")}
          className="flex items-center gap-1 rounded-lg border border-[#d8bf86]/45 bg-[#111019]/85 px-3 py-1.5 text-xs font-semibold text-[#ffe7b3] shadow-[0_12px_26px_-20px_rgba(0,0,0,0.65)] backdrop-blur active:bg-[#171520]"
          title={SEL[initialLang]?.magicTitle ?? "Magical"}
        >
          <Sparkles className="h-3.5 w-3.5" /> {SEL[initialLang]?.magicTitle ?? "Magical"}
        </button>
      </div>
    </>
  );
}
