"use client";

// =========================================================
// 軽量操作パネル（低スペック端末向け）
//   ・静止ポスター画像の背景のみ（動画/キャンバス/framer-motion なし）
//   ・大きなタップ操作ボタンだけの最小構成。デバイス操作は通常UIと同じ
//     /api/devices/[slug]（ゲスト）/ /api/admin/test-device（管理テスト）を使用。
//   ・多言語（ja/en/zh/ko）は既存 lib/i18n の T を流用。
//   通常UIとの切り替えは onSwitchMode（RoomModeSwitch が制御）。
// =========================================================
import { useState } from "react";
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

function vibe() {
  try {
    (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(12);
  } catch {
    /* noop */
  }
}

type Tone = "emerald" | "cyan" | "amber" | "slate" | "violet" | "rose";
// 少し明るめ（背景を白/塗り強め・文字を明るく）
const TONE: Record<Tone, string> = {
  emerald: "border-emerald-400/50 bg-emerald-400/20 text-emerald-100 active:bg-emerald-400/35",
  cyan: "border-cyan-400/50 bg-cyan-400/20 text-cyan-100 active:bg-cyan-400/35",
  amber: "border-amber-400/50 bg-amber-400/20 text-amber-100 active:bg-amber-400/35",
  slate: "border-white/25 bg-white/10 text-white/90 active:bg-white/20",
  violet: "border-violet-400/50 bg-violet-400/20 text-violet-100 active:bg-violet-400/35",
  rose: "border-rose-400/50 bg-rose-400/20 text-rose-100 active:bg-rose-400/35",
};

// ---- 部屋ごとのアクセント色（名前に合わせた色） ----
const THEME_RGB: Record<string, string> = {
  "room-spring": "249,168,212", // 春詠 桜
  "room-summer": "94,234,212",  // 夏涼 水
  "room-autumn": "251,146,60",  // 秋灯 紅葉
  "room-winter": "147,197,253", // 冬宵 雪
  "room-matsu": "250,204,21",   // 松
  "room-take": "134,239,172",   // 竹
  "room-ume": "251,113,133",    // 梅
  "room-hayashi": "163,230,53", // 林
  "room-ni": "240,171,252",     // 荷 蓮
};
const getRgb = (slug: string): string => THEME_RGB[slug] || "34,211,238";

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
      className={`relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition disabled:opacity-60 ${TONE[tone]}`}
    >
      {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" strokeWidth={1.6} />}
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {res === true && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/80 text-[11px] font-bold text-white">✓</span>
      )}
      {res === false && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-[11px] font-bold text-white">×</span>
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
    <div className="rounded-2xl border border-violet-400/30 bg-violet-400/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-200">
        <AlarmClock className="h-5 w-5" strokeWidth={1.6} /> {t.wakeLight}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(ev) => { setTime(ev.target.value); setState("idle"); }}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center font-mono text-2xl tracking-widest text-violet-100 [color-scheme:dark] focus:border-violet-400/60 focus:outline-none"
        />
        <button
          onClick={() => send(false)}
          disabled={state === "busy"}
          className="flex h-[52px] items-center gap-1.5 rounded-xl border border-violet-400/50 bg-violet-500/15 px-4 text-sm font-semibold text-violet-200 active:bg-violet-500/30 disabled:opacity-60"
        >
          {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
          {state === "set" && <Check className="h-4 w-4 text-emerald-300" />}
          {state === "set" ? t.alarmSet : t.setAlarm}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => send(true)}
          disabled={state === "busy"}
          className="text-[12px] font-semibold text-white/45 underline-offset-2 active:underline disabled:opacity-60"
        >
          {t.clearAlarm}
        </button>
        {err && <p className="text-right text-[11px] text-rose-300">{err}</p>}
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
  const labelStyle = { color: `rgba(${rgb},0.95)` };

  return (
    <main className="min-h-dvh bg-[#0b0f18] text-white">
      {/* ヒーロー: 部屋アートを上部に大きく。背景は単色で見やすく整理。 */}
      <div className="relative h-56 w-full overflow-hidden sm:h-64">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={roomName}
            className="h-full w-full object-cover object-top"
            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {/* 下方向へ単色にフェード（テキストを読みやすく） */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(11,15,24,0.10) 0%, rgba(11,15,24,0.35) 45%, rgba(11,15,24,0.85) 80%, #0b0f18 100%)" }}
        />
        {/* 上部バー: 言語 / 通常UIへ */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <label className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-xs text-white/90 backdrop-blur">
            <Globe className="h-3.5 w-3.5" />
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
              className="flex items-center gap-1 rounded-lg border border-white/20 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur active:bg-white/10"
            >
              <PanelsTopLeft className="h-3.5 w-3.5" /> {e.full}
            </button>
          )}
        </div>
        {/* 下部: バッジ / 部屋名 / チェックアウト */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide"
            style={{ color: accent, borderColor: `rgba(${rgb},0.6)`, background: `rgba(${rgb},0.16)` }}
          >
            {e.lite}
          </span>
          <h1 className="mt-1 truncate text-3xl font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{roomName}</h1>
          {!admin && (
            <p className="mt-0.5 text-[11px] text-white/70">
              {t.checkout}: {new Date(checkOut).toLocaleString(lang, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}
            </p>
          )}
        </div>
      </div>

      {/* 操作エリア: 単色背景で見やすく・整理された配置 */}
      <div className="mx-auto max-w-md px-4 pb-16 pt-5">

        {/* 施錠 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="unlock" label={t.unlock} Icon={LockKeyholeOpen} tone="emerald" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="lock" label={t.lock} Icon={LockKeyhole} tone="cyan" />
        </div>

        {/* エアコン */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>{t.ac}</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="ac_on" label={`${t.ac} ${t.on}`} Icon={Snowflake} tone="amber" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="ac_off" label={`${t.ac} ${t.off}`} Icon={Power} tone="slate" />
        </div>

        {/* 照明 */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>{t.light}</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="light_on" label={`${t.light} ${t.on}`} Icon={Lightbulb} tone="amber" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="light_off" label={`${t.light} ${t.off}`} Icon={Power} tone="slate" />
        </div>

        {/* 追加機器（対応部屋のみ） */}
        {(hasWafu || hasGalaxy || hasNest) && (
          <>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>{e.devices}</p>
            <div className="mb-4 space-y-3">
              {hasWafu && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action={wafuOn} label={`${t.wafu} ${t.on}`} Icon={Lamp} tone="rose" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="wafu_off" label={`${t.wafu} ${t.off}`} Icon={Power} tone="slate" />
                </div>
              )}
              {hasGalaxy && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="galaxy_on" label={`${t.galaxy} ${t.on}`} Icon={Sparkles} tone="violet" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="galaxy_off" label={`${t.galaxy} ${t.off}`} Icon={Power} tone="slate" />
                </div>
              )}
              {hasNest && (
                <div className="grid grid-cols-2 gap-3">
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="nest_on" label={`${t.nest} ${t.on}`} Icon={Moon} tone="amber" />
                  <ActionBtn roomSlug={roomSlug} admin={admin} action="nest_off" label={`${t.nest} ${t.off}`} Icon={Power} tone="slate" />
                </div>
              )}
            </div>
          </>
        )}

        {/* シーン */}
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>{e.scenes}</p>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <ActionBtn roomSlug={roomSlug} admin={admin} action="welcome" label={t.comfortMode} Icon={Home} tone="emerald" />
          <ActionBtn roomSlug={roomSlug} admin={admin} action="away" label={t.awayMode} Icon={Power} tone="slate" />
        </div>

        {/* 光目覚まし */}
        <WakeLite roomSlug={roomSlug} admin={admin} t={t} />
      </div>
    </main>
  );
}
