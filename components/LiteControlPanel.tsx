"use client";

// =========================================================
// 和風操作パネル（低スペック端末にも軽い）／簡潔・清潔テーマ
//   ・静止ポスター画像の背景のみ（動画/キャンバス/framer-motion なし）
//   ・白い和紙調UI（背景=生成り / 文字=墨 / 差し色=藍・抹茶・朱ほか）
//   ・大きな操作札だけの最小構成。デバイス操作はハイテクUIと同じ
//     /api/devices/[slug]（ゲスト）/ /api/admin/test-device（管理テスト）を使用。
//   ・多言語（ja/en/zh/ko）は既存 lib/i18n の T を流用。
//   ハイテクUIとの切り替えは onSwitchMode（RoomModeSwitch が制御）。
// =========================================================
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  LockKeyholeOpen, LockKeyhole, Snowflake, Lightbulb, Sparkles, Moon,
  Home, Power, Loader2, Globe, PanelsTopLeft, Lamp, AlarmClock, Check, Flame, Sunrise, type LucideIcon,
} from "lucide-react";
import { callDevice, type DeviceAction } from "@/lib/deviceClient";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";
import type { WakeLightMode } from "@/lib/wakePrewake";
import { navTick, setMuted as sfxSetMuted, speak } from "@/lib/sfx";
import AddToHomePrompt from "@/components/AddToHomePrompt";

export interface LiteProps {
  roomSlug: string;
  roomName: string;
  checkOut: string;
  initialLang: Lang;
  admin?: boolean;
  posterUrl?: string | null;
  hasGalaxy?: boolean;
  hasNest?: boolean;
  hasWafu?: boolean;
  onSwitchMode?: () => void; // ハイテクUIへ
}

const EXTRA: Record<Lang, { lite: string; full: string; scenes: string; devices: string }> = {
  ja: { lite: "和風", full: "ハイテクへ", scenes: "シーン", devices: "照明設備" },
  en: { lite: "Wafu", full: "Hi-Tech", scenes: "Scenes", devices: "Lights" },
  zh: { lite: "和风", full: "高科技", scenes: "场景", devices: "照明" },
  ko: { lite: "와풍", full: "하이테크", scenes: "장면", devices: "조명" },
};

// 明朝体（見出し・時刻用）。globals.css で Noto Serif JP を読み込み。
const MINCHO = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

function vibe() {
  try {
    (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(12);
  } catch {
    /* noop */
  }
}

type Tone = "matcha" | "ai" | "asagi" | "yamabuki" | "shu" | "fuji" | "neutral";
// 和の差し色。札自体は白く保ち、左罫だけで機能を見分ける。
const TONE: Record<Tone, { mark: string; text: string }> = {
  matcha:   { mark: "#7c8b57", text: "#53613d" },
  ai:       { mark: "#3f5d78", text: "#344f66" },
  asagi:    { mark: "#59858c", text: "#3f676d" },
  yamabuki: { mark: "#c0913a", text: "#816326" },
  shu:      { mark: "#b5533b", text: "#88402f" },
  fuji:     { mark: "#7a6e9c", text: "#585077" },
  neutral:  { mark: "#b8ae9b", text: "#655f54" },
};

// ---- 部屋ごとのアクセント色（名前に合わせた色） ----
const THEME_RGB: Record<string, string> = {
  "room-spring": "215,120,142", // 春詠 桜
  "room-summer": "58,150,150",  // 夏涼 水
  "room-autumn": "200,110,50",  // 秋灯 紅葉
  "room-winter": "90,130,180",  // 冬宵 雪
  "room-matsu": "170,140,40",   // 松
  "room-take": "90,140,80",     // 竹
  "room-ume": "190,80,100",     // 梅
  "room-hayashi": "110,150,50", // 林
  "room-ni": "150,110,170",     // 荷 蓮
};
const getRgb = (slug: string): string => THEME_RGB[slug] || "63,93,120"; // 既定=藍

function ActionBtn({
  roomSlug, admin, action, value, label, Icon, tone,
}: {
  roomSlug: string;
  admin?: boolean;
  action: DeviceAction;
  value?: string;
  label: string;
  Icon: LucideIcon;
  tone: Tone;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<null | boolean>(null);
  const toneToken = TONE[tone];
  const tileStyle: CSSProperties = {
    borderColor: "#ded6c7",
    color: toneToken.text,
    boxShadow: `inset 3px 0 0 ${toneToken.mark}, 0 10px 24px -22px rgba(44,42,38,0.45)`,
  };
  const run = async () => {
    if (busy) return;
    vibe();
    setBusy(true);
    setRes(null);
    const ok = await callDevice(roomSlug, action, admin, value);
    setBusy(false);
    setRes(ok);
    setTimeout(() => setRes(null), 1600);
  };
  return (
    <button
      onClick={run}
      disabled={busy}
      style={tileStyle}
      className="relative flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-lg border bg-[#fffdf8]/95 p-3 text-center transition active:scale-[0.99] active:bg-[#f3efe6] disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" strokeWidth={1.5} />}
      <span className="text-[13px] font-medium leading-tight tracking-[0.02em]">{label}</span>
      {res === true && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#7c8b57] text-[11px] font-bold text-white">✓</span>
      )}
      {res === false && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#b5533b] text-[11px] font-bold text-white">×</span>
      )}
    </button>
  );
}

// 光目覚まし（アラーム）— ハイテクUIと同じエンドポイント/JST計算を軽量に実装
function WakeLite({ roomSlug, admin, t, hasWafu }: { roomSlug: string; admin?: boolean; t: (typeof T)["ja"]; hasWafu?: boolean }) {
  const [time, setTime] = useState("07:00");
  const [mode, setMode] = useState<WakeLightMode>("flame_on");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");
  const [err, setErr] = useState<string | null>(null);

  const selectMode = (nextMode: WakeLightMode, label: string) => {
    try { sfxSetMuted(localStorage.getItem("guestMuted") === "1"); } catch { /* keep current audio setting */ }
    navTick();
    speak(label);
    setMode(nextMode);
    setState("idle");
  };

  const send = async (clear?: boolean) => {
    vibe();
    setState("busy");
    setErr(null);
    let fireAtIso: string | undefined;
    if (!clear) {
      // JST(UTC+9)固定で「次に来る該当時刻」を計算（端末TZ非依存）
      const [h, m] = time.split(":").map(Number);
      const nowMs = Date.now();
      const jstNow = new Date(nowMs + 9 * 3600 * 1000);
      let fireMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), h - 9, m, 0, 0);
      if (fireMs <= nowMs) fireMs += 24 * 3600 * 1000;
      fireAtIso = new Date(fireMs).toISOString();
    }
    try {
      const res = await fetch(admin ? "/api/admin/test-alarm" : `/api/alarms/${roomSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          admin
            ? { roomSlug, ...(clear ? { clear: true } : { fireAtIso, mode }) }
            : clear
              ? { clear: true }
              : { fireAtIso, mode }
        ),
      });
      if (res.ok) {
        setState(clear ? "idle" : "set");
      } else {
        const j = await res.json().catch(() => ({} as { error?: string }));
        setErr(
          j?.error === "OUT_OF_STAY"
            ? "チェックアウト前の時刻にしてください / Set a time before check-out"
            : j?.error || `ERR ${res.status}`
        );
        setState("idle");
      }
    } catch (e) {
      setErr((e as Error)?.message || "network error");
      setState("idle");
    }
  };

  return (
    <div className="rounded-lg border border-[#ded6c7] bg-[#fffdf8]/95 p-4 shadow-[0_10px_24px_-22px_rgba(44,42,38,0.45)]">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] text-[#5c5280]">
        <AlarmClock className="h-[18px] w-[18px]" strokeWidth={1.5} /> {t.wakeLight}
      </div>
      <div className="mb-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.wakeLight}>
          <button
            type="button"
            aria-pressed={mode === "flame_on"}
            onClick={() => selectMode("flame_on", t.wakeFlameName)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12px] font-semibold transition ${mode === "flame_on" ? "border-[#b98b38]/55 bg-[#f7e8c9] text-[#75561f]" : "border-[#d6cfbb] bg-[#f4efe6] text-[#777064]"}`}
          >
            <Flame className="h-4 w-4" strokeWidth={1.6} />
            {t.wakeFlameName}
          </button>
          <button
            type="button"
            aria-pressed={mode === "horizon_rise"}
            disabled={!hasWafu}
            onClick={() => selectMode("horizon_rise", t.wakeHorizonName)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === "horizon_rise" ? "border-[#8f7dae]/60 bg-[#ebe4f1] text-[#574a70]" : "border-[#d6cfbb] bg-[#f4efe6] text-[#777064]"}`}
          >
            <Sunrise className="h-4 w-4" strokeWidth={1.6} />
            {t.wakeHorizonName}
          </button>
        </div>
        <p className="mt-2 min-h-[34px] text-[11px] leading-relaxed text-[#6d685d]">
          {mode === "horizon_rise" ? t.wakeHorizonDescription : t.wakeFlameDescription}
        </p>
        {!hasWafu && <p className="mt-1 text-[10px] text-[#9b7040]">{t.wakeHorizonUnavailable}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="time"
          value={time}
          onChange={(ev) => { setTime(ev.target.value); setState("idle"); }}
          style={{ fontFamily: MINCHO }}
          className="wafu-time min-w-0 flex-1 rounded-lg border border-[#d6cfbb] bg-[#f4efe6] px-3 py-2.5 text-center text-[24px] tracking-[0.08em] text-[#4a4560] [color-scheme:light] focus:border-[#7a6e9c]/60 focus:outline-none"
        />
        <button
          onClick={() => send(false)}
          disabled={state === "busy"}
          className="flex h-[52px] items-center gap-1.5 rounded-lg border border-[#7a6e9c]/40 bg-[#f8f5ee] px-5 text-[13px] font-semibold text-[#5c5280] active:bg-[#eee8dc] disabled:opacity-60"
        >
          {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "set" && <Check className="h-4 w-4 text-[#5f6c3e]" />}
          {state === "set" ? t.alarmSet : t.setAlarm}
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <button
          onClick={() => send(true)}
          disabled={state === "busy"}
          className="text-[12px] font-medium text-[#9c9689] underline-offset-2 active:underline disabled:opacity-60"
        >
          {t.clearAlarm}
        </button>
        {err && <p className="text-right text-[11px] text-[#b5533b]">{err}</p>}
      </div>
    </div>
  );
}

export default function LiteControlPanel({
  roomSlug, roomName, checkOut, initialLang, admin,
  posterUrl, hasGalaxy, hasNest, hasWafu, onSwitchMode,
}: LiteProps) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = T[lang];
  const e = EXTRA[lang];
  const wafuOn: DeviceAction = admin ? "wafu_on_warm" : "wafu_on";
  const rgb = getRgb(roomSlug);
  const accent = `rgb(${rgb})`;

  // 生成りの和紙テクスチャ（麻の葉を極薄で敷く）
  const washiBg: CSSProperties = {
    backgroundColor: "#f7f4ed",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'%3E%3Cg fill='none' stroke='%23b7ad95' stroke-width='0.55' opacity='0.18'%3E%3Cpath d='M30 0v52M30 52v52M0 26l30 26 30-26M0 78l30-26 30 26M0 26v52M60 26v52M0 26L30 0l30 26M0 78l30 26 30-26'/%3E%3C/g%3E%3C/svg%3E\"), linear-gradient(180deg, #fbfaf6 0%, #f2ece1 100%)",
    backgroundSize: "54px auto, auto",
  };

  // セクション見出し（薄墨文字＋部屋アクセントの罫）
  const SecLabel = ({ children }: { children: ReactNode }) => (
    <p className="mb-2 ml-0.5 mt-5 flex items-center gap-2 text-[11.5px] font-medium tracking-[0.16em] text-[#6d685d]">
      <span className="inline-block h-3 w-[2px] rounded-sm" style={{ background: accent }} />
      {children}
    </p>
  );

  return (
    <main className="min-h-dvh text-[#2c2a26]" style={washiBg}>
      {/* ヒーロー: 部屋アートを上部に。下方向へ和紙色にフェード。 */}
      <div className="relative h-52 w-full overflow-hidden sm:h-56">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={roomName}
            className="h-full w-full object-cover object-top"
            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {/* 和紙色へのフェード（テキストを読みやすく） */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,244,237,0)_0%,rgba(247,244,237,0.18)_45%,rgba(247,244,237,0.78)_82%,#f7f4ed_100%)]" />
        {/* 上部バー: 言語 / ハイテクへ */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3.5">
          <label className="flex items-center gap-1.5 rounded-md border border-[#d6cfbb]/90 bg-[#fffdf8]/90 px-2.5 py-1.5 text-xs text-[#2c2a26] backdrop-blur">
            <Globe className="h-3.5 w-3.5 text-[#6d685d]" />
            <select
              value={lang}
              onChange={(ev) => setLang(ev.target.value as Lang)}
              className="bg-transparent focus:outline-none [&>option]:text-black"
            >
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </label>
          {onSwitchMode && (
            <button
              onClick={onSwitchMode}
              className="flex items-center gap-1.5 rounded-md border border-[#d6cfbb]/90 bg-[#fffdf8]/90 px-3 py-1.5 text-xs font-semibold text-[#2c2a26] backdrop-blur active:bg-[#efe9dd]"
            >
              <PanelsTopLeft className="h-3.5 w-3.5 text-[#6d685d]" /> {e.full}
            </button>
          )}
        </div>
        {/* 下部: バッジ / 部屋名 / チェックアウト */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border bg-[#fffdf8]/90 px-3 py-1 text-[10.5px] font-semibold tracking-[0.18em] text-[#6d685d] backdrop-blur"
            style={{ borderColor: `rgba(${rgb},0.5)` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {e.lite}
          </span>
          <h1 className="mt-2 truncate text-[28px] font-semibold leading-tight tracking-[0.06em]" style={{ fontFamily: MINCHO }}>{roomName}</h1>
          {!admin && (
            <p className="mt-1 text-[11.5px] text-[#6d685d]">
              {t.checkout}: <span className="text-[#2c2a26]">{new Date(checkOut).toLocaleString(lang, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}</span>
            </p>
          )}
        </div>
      </div>

      {/* 操作エリア */}
      <div className="mx-auto max-w-md px-5 pb-16 pt-2">
        {!admin && (
          <div className="mb-4">
            <AddToHomePrompt lang={lang} roomName={roomName} variant="wafu" />
          </div>
        )}

        {/* 施錠 */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="unlock" label={t.unlock} Icon={LockKeyholeOpen} tone="matcha" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="lock" label={t.lock} Icon={LockKeyhole} tone="ai" />
        </div>

        {/* エアコン */}
        <SecLabel>{t.ac}</SecLabel>
        <div className="grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="ac_on" label={`${t.ac} ${t.on}`} Icon={Snowflake} tone="asagi" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="ac_off" label={`${t.ac} ${t.off}`} Icon={Power} tone="neutral" />
        </div>

        {/* 照明 */}
        <SecLabel>{t.light}</SecLabel>
        <div className="grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="light_on" label={`${t.light} ${t.on}`} Icon={Lightbulb} tone="yamabuki" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="light_off" label={`${t.light} ${t.off}`} Icon={Power} tone="neutral" />
        </div>

        {/* 追加機器（対応部屋のみ） */}
        {(hasWafu || hasGalaxy || hasNest) && (
          <>
            <SecLabel>{e.devices}</SecLabel>
            <div className="space-y-3">
              {hasWafu && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action={wafuOn} label={`${t.wafu} ${t.on}`} Icon={Lamp} tone="shu" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="wafu_off" label={`${t.wafu} ${t.off}`} Icon={Power} tone="neutral" />
                </div>
              )}
              {hasGalaxy && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="galaxy_on" label={`${t.galaxy} ${t.on}`} Icon={Sparkles} tone="fuji" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="galaxy_off" label={`${t.galaxy} ${t.off}`} Icon={Power} tone="neutral" />
                </div>
              )}
              {hasNest && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="nest_on" label={`${t.nest} ${t.on}`} Icon={Moon} tone="yamabuki" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="nest_off" label={`${t.nest} ${t.off}`} Icon={Power} tone="neutral" />
                </div>
              )}
            </div>
          </>
        )}

        {/* シーン */}
        <SecLabel>{e.scenes}</SecLabel>
        <div className="grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="welcome" label={t.comfortMode} Icon={Home} tone="matcha" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="good_night" label={t.goodNightMode} Icon={Moon} tone="ai" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="away" label={t.awayMode} Icon={Power} tone="neutral" />
        </div>

        {/* 光目覚まし */}
        <div className="mt-5">
          <WakeLite roomSlug={roomSlug} admin={admin} t={t} hasWafu={hasWafu} />
        </div>
      </div>
    </main>
  );
}
