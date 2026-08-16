"use client";

// =========================================================
// UIモード切替（通常UI ⇄ 軽量モード）
//   PIN認証後（管理テストでは即時）に、まずどちらのUIで操作するか選ぶ。
//   選択は端末に記憶（localStorage）。各UIから相互に切り替え可能。
//   ・通常UI = 既存の ControlPanel（リッチ演出）
//   ・軽量モード = LiteControlPanel（静止画・最小構成）
// =========================================================
import { useEffect, useState } from "react";
import { PanelsTopLeft, Zap, Sparkles } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";
import LiteControlPanel from "@/components/LiteControlPanel";
import { type Lang } from "@/lib/i18n";

type Mode = "select" | "normal" | "lite";
const STORE_KEY = "craneUiMode";

export interface RoomModeSwitchProps {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean;
  imageUrl?: string | null;   // 通常UI用（動画/画像）
  posterUrl?: string | null;  // 軽量用（静止ポスター）
  lat?: number | null;
  lng?: number | null;
  radiusM?: number | null;
  hasGalaxy?: boolean;
  hasNest?: boolean;
  hasWafu?: boolean;
}

const SEL: Record<Lang, {
  heading: string; sub: string;
  normalTitle: string; normalDesc: string;
  liteTitle: string; liteDesc: string;
  remember: string;
}> = {
  ja: {
    heading: "操作画面を選択",
    sub: "端末に合わせて選べます（あとでいつでも切り替え可能）",
    normalTitle: "通常UI", normalDesc: "リッチな演出・アニメーション（高スペック向け）",
    liteTitle: "軽量モード", liteDesc: "静止画・軽快動作（低スペック/カクつく端末向け）",
    remember: "この選択はこの端末に記憶されます",
  },
  en: {
    heading: "Choose your interface",
    sub: "Pick what suits your device — switch anytime",
    normalTitle: "Full UI", normalDesc: "Rich visuals & animations (high-spec devices)",
    liteTitle: "Lite mode", liteDesc: "Static image, snappy (low-spec / laggy devices)",
    remember: "Your choice is remembered on this device",
  },
  zh: {
    heading: "选择操作界面",
    sub: "按设备选择（之后可随时切换）",
    normalTitle: "完整界面", normalDesc: "丰富动效与动画（高配设备）",
    liteTitle: "轻量模式", liteDesc: "静态图片、流畅（低配/卡顿设备）",
    remember: "此选择将记忆在本设备",
  },
  ko: {
    heading: "조작 화면 선택",
    sub: "기기에 맞게 선택하세요 (언제든 전환 가능)",
    normalTitle: "전체 UI", normalDesc: "풍부한 연출·애니메이션 (고사양 기기)",
    liteTitle: "라이트 모드", liteDesc: "정지 이미지·가벼운 동작 (저사양/버벅이는 기기)",
    remember: "이 선택은 이 기기에 저장됩니다",
  },
};

export default function RoomModeSwitch(props: RoomModeSwitchProps) {
  const { initialLang, posterUrl, imageUrl } = props;
  const [mode, setMode] = useState<Mode | null>(null); // null=読込中（ちらつき防止）

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* noop */ }
    setMode(saved === "normal" || saved === "lite" ? saved : "select");
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
      <main className="relative min-h-dvh overflow-hidden bg-[#05070d] text-white">
        <div className="pointer-events-none fixed inset-0">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover opacity-25"
              onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070d]/80 to-[#05070d]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-400/70">{props.roomName}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{s.heading}</h1>
          <p className="mt-1 text-sm text-white/50">{s.sub}</p>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => choose("normal")}
              className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-left transition active:scale-[0.99] active:bg-cyan-400/20"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-cyan-100">{s.normalTitle}</span>
                <span className="block text-xs text-white/55">{s.normalDesc}</span>
              </span>
            </button>

            <button
              onClick={() => choose("lite")}
              className="flex w-full items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4 text-left transition active:scale-[0.99] active:bg-violet-400/20"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-400/10 text-violet-200">
                <Zap className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-violet-100">{s.liteTitle}</span>
                <span className="block text-xs text-white/55">{s.liteDesc}</span>
              </span>
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/35">{s.remember}</p>
        </div>
      </main>
    );
  }

  // ---- 軽量モード ----
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
        onSwitchMode={() => choose("normal")}
      />
    );
  }

  // ---- 通常UI（既存 ControlPanel）＋ 軽量へ切り替える浮動ボタン ----
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
      />
      <button
        onClick={() => choose("lite")}
        className="fixed left-3 top-3 z-[60] flex items-center gap-1 rounded-full border border-violet-400/40 bg-[#0b1020]/80 px-3 py-1.5 text-xs font-semibold text-violet-200 backdrop-blur active:bg-violet-500/20"
        title={SEL[initialLang]?.liteTitle ?? "Lite"}
      >
        <Zap className="h-3.5 w-3.5" /> {SEL[initialLang]?.liteTitle ?? "Lite"}
      </button>
    </>
  );
}
