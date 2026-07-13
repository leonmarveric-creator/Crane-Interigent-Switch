"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, LampFloor, Power, PowerOff, RotateCcw, Loader2, Sun, Moon, BookOpen, Sparkles } from "lucide-react";
import { T, type Lang } from "@/lib/i18n";
import { callDevice } from "@/lib/deviceClient";

/** hex ("#rrggbb") → "R:G:B" (SwitchBot setColor 形式)。 */
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return "255:255:255";
  return `${parseInt(m[1], 16)}:${parseInt(m[2], 16)}:${parseInt(m[3], 16)}`;
}

/**
 * 和風ライトの詳細設定ページ (ゲスト/管理共通)。
 * 明るさ・色温度・フルカラー・プリセットを操作。操作画面へ戻るリンク付き。
 */
export default function WafuDetail({
  roomSlug, lang, admin,
}: { roomSlug: string; lang: Lang; admin?: boolean }) {
  const t = T[lang];
  const backHref = admin ? `/admin/test/${roomSlug}?lang=${lang}` : `/room/${roomSlug}?lang=${lang}`;

  const [brightness, setBrightness] = useState(100);
  const [kelvin, setKelvin] = useState(2700);
  const [hex, setHex] = useState("#ffb060");
  const [busy, setBusy] = useState<string | null>(null);

  const send = async (key: string, action: Parameters<typeof callDevice>[1], value?: string) => {
    setBusy(key);
    await callDevice(roomSlug, action, admin, value);
    setBusy(null);
  };

  // プリセット: 色温度→明るさ を順に送信。
  const preset = async (key: string, k: number, b: number) => {
    setBusy(key);
    await callDevice(roomSlug, "wafu_temp", admin, String(k));
    await callDevice(roomSlug, "wafu_brightness", admin, String(b));
    setKelvin(k); setBrightness(b);
    setBusy(null);
  };

  return (
    <main className="min-h-[100dvh] bg-[#05070d] px-5 py-6 text-white">
      <div className="mx-auto max-w-md">
        {/* ヘッダー: 戻る */}
        <header className="mb-6 flex items-center gap-3">
          <a href={backHref}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> {t.wafuBack}
          </a>
        </header>

        <div className="mb-6 flex items-center gap-2 text-rose-200">
          <LampFloor className="h-6 w-6" strokeWidth={1.6} />
          <div>
            <h1 className="text-lg font-medium">{t.wafu}</h1>
            <p className="text-[11px] text-white/40">{t.wafuDetails}</p>
          </div>
        </div>

        {/* ON / OFF */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <button onClick={() => send("on", "wafu_on")} disabled={!!busy}
            className="clip-bevel-sm flex items-center justify-center gap-2 border border-rose-400/50 bg-rose-500/15 py-3 text-sm text-rose-200 disabled:opacity-50">
            {busy === "on" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} {t.on.toUpperCase()}
          </button>
          <button onClick={() => send("off", "wafu_off")} disabled={!!busy}
            className="clip-bevel-sm flex items-center justify-center gap-2 border border-white/15 bg-white/5 py-3 text-sm text-white/60 disabled:opacity-50">
            {busy === "off" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />} {t.off.toUpperCase()}
          </button>
        </div>

        {/* プリセット */}
        <section className="mb-6">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">{t.presets}</p>
          <div className="grid grid-cols-2 gap-3">
            <PresetBtn label={t.presetRelax} icon={Sparkles} busy={busy === "relax"} onClick={() => preset("relax", 2700, 30)} />
            <PresetBtn label={t.presetRead} icon={BookOpen} busy={busy === "read"} onClick={() => preset("read", 4000, 100)} />
            <PresetBtn label={t.presetSleep} icon={Moon} busy={busy === "sleep"} onClick={() => preset("sleep", 2700, 5)} />
            <PresetBtn label={t.wafuWarmReset} icon={RotateCcw} busy={busy === "warm"} onClick={() => send("warm", "wafu_warm")} />
          </div>
        </section>

        {/* 明るさ */}
        <section className="clip-bevel mb-4 border border-white/10 bg-[#0b0f1a]/80 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-white/70"><Sun className="h-4 w-4 text-amber-300" /> {t.brightness}</span>
            <span className="tabular-nums text-white/50">{brightness}%</span>
          </div>
          <input type="range" min={1} max={100} value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onPointerUp={() => send("brightness", "wafu_brightness", String(brightness))}
            className="w-full accent-amber-400" />
        </section>

        {/* 色温度 */}
        <section className="clip-bevel mb-4 border border-white/10 bg-[#0b0f1a]/80 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-white/70">{t.colorTemp}</span>
            <span className="tabular-nums text-white/50">{kelvin}K</span>
          </div>
          <input type="range" min={2700} max={6500} step={100} value={kelvin}
            onChange={(e) => setKelvin(Number(e.target.value))}
            onPointerUp={() => send("temp", "wafu_temp", String(kelvin))}
            className="w-full"
            style={{ accentColor: "#fcd9a8" }} />
          <div className="mt-1 flex justify-between text-[10px] text-white/35">
            <span>{t.warmWhite}</span><span>{t.coolWhite}</span>
          </div>
        </section>

        {/* フルカラー */}
        <section className="clip-bevel mb-6 border border-white/10 bg-[#0b0f1a]/80 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-white/70">{t.color}</span>
            <span className="font-mono text-[11px] text-white/40">{hex.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={hex}
              onChange={(e) => setHex(e.target.value)}
              onBlur={() => send("color", "wafu_color", hexToRgb(hex))}
              className="h-12 w-16 cursor-pointer rounded-lg border border-white/15 bg-transparent" />
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => send("color", "wafu_color", hexToRgb(hex))} disabled={!!busy}
              className="clip-bevel-sm flex-1 border border-rose-400/50 bg-rose-500/15 py-3 text-sm text-rose-200 disabled:opacity-50">
              {busy === "color" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t.color}
            </motion.button>
          </div>
        </section>
      </div>
    </main>
  );
}

function PresetBtn({ label, icon: Icon, busy, onClick }: {
  label: string; icon: typeof Sun; busy: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={busy}
      className="clip-bevel-sm flex items-center justify-center gap-2 border border-white/12 bg-white/[0.04] py-3 text-xs text-white/70 hover:border-rose-400/40 hover:text-rose-100 disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
    </button>
  );
}
