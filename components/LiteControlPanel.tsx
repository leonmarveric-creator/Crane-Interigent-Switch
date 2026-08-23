"use client";

// =========================================================
// 軽量操作パネル（低スペック端末向け）／和風・簡潔テーマ
//   ・静止ポスター画像の背景のみ（動画/キャンバス/framer-motion なし）
//   ・生成りの和紙調UI（背景=和紙色 / 文字=墨 / 差し色=藍・抹茶・朱ほか）
//   ・大きなタップ操作ボタンだけの最小構成。デバイス操作は通常UIと同じ
//     /api/devices/[slug]（ゲスト）/ /api/admin/test-device（管理テスト）を使用。
//   ・多言語（ja/en/zh/ko）は既存 lib/i18n の T を流用。
//   通常UIとの切り替えは onSwitchMode（RoomModeSwitch が制御）。
// =========================================================
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  LockKeyholeOpen, LockKeyhole, Snowflake, Lightbulb, Sparkles, Moon,
  Home, Power, Loader2, Globe, PanelsTopLeft, Lamp, AlarmClock, Check, type LucideIcon,
} from "lucide-react";
import { callDevice, type DeviceAction } from "@/lib/deviceClient";
import { T, LANGS, LANG_LABEL, type Lang } from "@/lib/i18n";

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
  onSwitchMode?: () => void; // 通常UIへ
}

const EXTRA: Record<Lang, { lite: string; full: string; scenes: string; devices: string }> = {
  ja: { lite: "軽量モード", full: "通常UIへ", scenes: "シーン", devices: "機器" },
  en: { lite: "Lite mode", full: "Full UI", scenes: "Scenes", devices: "Devices" },
  zh: { lite: "轻量模式", full: "完整界面", scenes: "场景", devices: "设备" },
  ko: { lite: "라이트 모드", full: "전체 UI", scenes: "장면", devices: "기기" },
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
// 和の差し色（点灯系のみ淡く色付け／オフ・中立は生成りの白札）
const TONE: Record<Tone, string> = {
  matcha:   "border-[#7c8b57]/45 bg-[#7c8b57]/[0.08] text-[#5f6c3e] active:bg-[#7c8b57]/[0.15]",
  ai:       "border-[#3f5d78]/45 bg-[#3f5d78]/[0.07] text-[#33506a] active:bg-[#3f5d78]/[0.14]",
  asagi:    "border-[#59858c]/45 bg-[#59858c]/[0.08] text-[#3f6b71] active:bg-[#59858c]/[0.15]",
  yamabuki: "border-[#c0913a]/45 bg-[#c0913a]/[0.10] text-[#93701f] active:bg-[#c0913a]/[0.17]",
  shu:      "border-[#b5533b]/45 bg-[#b5533b]/[0.08] text-[#96402c] active:bg-[#b5533b]/[0.15]",
  fuji:     "border-[#7a6e9c]/45 bg-[#7a6e9c]/[0.08] text-[#5c5280] active:bg-[#7a6e9c]/[0.15]",
  neutral:  "border-[#e2dccb] bg-[#faf8f2] text-[#6d685d] active:bg-[#efe9dd]",
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
      className={`relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition active:scale-[0.99] disabled:opacity-60 ${TONE[tone]}`}
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

// 光目覚まし（アラーム）— 通常UIと同じエンドポイント/JST計算を軽量に実装
function WakeLite({ roomSlug, admin, t }: { roomSlug: string; admin?: boolean; t: (typeof T)["ja"] }) {
  const [time, setTime] = useState("07:00");
  const [state, setState] = useState<"idle" | "busy" | "set">("idle");
  const [err, setErr] = useState<string | null>(null);

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
            ? { roomSlug, ...(clear ? { clear: true } : { fireAtIso }) }
            : clear
              ? { clear: true }
              : { fireAtIso }
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
    <div className="rounded-2xl border border-[#e2dccb] bg-[#faf8f2] p-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] text-[#5c5280]">
        <AlarmClock className="h-[18px] w-[18px]" strokeWidth={1.5} /> {t.wakeLight}
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="time"
          value={time}
          onChange={(ev) => { setTime(ev.target.value); setState("idle"); }}
          style={{ fontFamily: MINCHO }}
          className="min-w-0 flex-1 rounded-xl border border-[#d6cfbb] bg-[#efe9dd] px-3 py-2.5 text-center text-[26px] tracking-[0.12em] text-[#4a4560] [color-scheme:light] focus:border-[#7a6e9c]/60 focus:outline-none"
        />
        <button
          onClick={() => send(false)}
          disabled={state === "busy"}
          className="flex h-[52px] items-center gap-1.5 rounded-xl border border-[#7a6e9c]/45 bg-[#7a6e9c]/[0.12] px-5 text-[13px] font-semibold text-[#5c5280] active:bg-[#7a6e9c]/[0.2] disabled:opacity-60"
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
    backgroundColor: "#f3efe6",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'%3E%3Cg fill='none' stroke='%23b7ad95' stroke-width='0.6' opacity='0.28'%3E%3Cpath d='M30 0v52M30 52v52M0 26l30 26 30-26M0 78l30-26 30 26M0 26v52M60 26v52M0 26L30 0l30 26M0 78l30 26 30-26'/%3E%3C/g%3E%3C/svg%3E\")",
    backgroundSize: "46px auto",
  };

  // セクション見出し（薄墨文字＋部屋アクセントの罫）
  const SecLabel = ({ children }: { children: ReactNode }) => (
    <p className="mb-2 ml-0.5 mt-5 flex items-center gap-2 text-[11.5px] font-medium tracking-[0.2em] text-[#6d685d]">
      <span className="inline-block h-3 w-[3px] rounded-sm" style={{ background: accent }} />
      {children}
    </p>
  );

  return (
    <main className="min-h-dvh text-[#2c2a26]" style={washiBg}>
      {/* ヒーロー: 部屋アートを上部に。下方向へ和紙色にフェード。 */}
      <div className="relative h-56 w-full overflow-hidden sm:h-60">
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
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(243,239,230,0) 0%, rgba(243,239,230,0.10) 42%, rgba(243,239,230,0.62) 74%, rgba(243,239,230,0.94) 90%, #f3efe6 100%)" }}
        />
        {/* 上部バー: 言語 / 通常UIへ */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3.5">
          <label className="flex items-center gap-1.5 rounded-lg border border-[#d6cfbb]/90 bg-[#faf8f2]/85 px-2.5 py-1.5 text-xs text-[#2c2a26] backdrop-blur">
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
              className="flex items-center gap-1.5 rounded-lg border border-[#d6cfbb]/90 bg-[#faf8f2]/85 px-3 py-1.5 text-xs font-semibold text-[#2c2a26] backdrop-blur active:bg-[#efe9dd]"
            >
              <PanelsTopLeft className="h-3.5 w-3.5 text-[#6d685d]" /> {e.full}
            </button>
          )}
        </div>
        {/* 下部: バッジ / 部屋名 / チェックアウト */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border bg-[#faf8f2]/90 px-3 py-1 text-[10.5px] font-semibold tracking-[0.18em] text-[#6d685d] backdrop-blur"
            style={{ borderColor: `rgba(${rgb},0.5)` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {e.lite}
          </span>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-[0.06em]" style={{ fontFamily: MINCHO }}>{roomName}</h1>
          {!admin && (
            <p className="mt-1 text-[11.5px] text-[#6d685d]">
              {t.checkout}: <span className="text-[#2c2a26]">{new Date(checkOut).toLocaleString(lang, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}</span>
            </p>
          )}
        </div>
      </div>

      {/* 操作エリア */}
      <div className="mx-auto max-w-md px-5 pb-16 pt-2">

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
          <ActionBtn roomSlug={roomSlug} admin={admin} action="away" label={t.awayMode} Icon={Power} tone="neutral" />
        </div>

        {/* 光目覚まし */}
        <div className="mt-5">
          <WakeLite roomSlug={roomSlug} admin={admin} t={t} />
        </div>
      </div>
    </main>
  );
}
