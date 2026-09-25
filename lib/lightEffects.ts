/**
 * 隠しコマンドの光の演出 (和風ライト = フルカラー電球)。
 *   SwitchBot はインターネット経由なので、1 回の変化に 0.5 秒ほどかかる。
 *   速い点滅はできないので、数秒ごとにゆっくり色を変える「コマ」の並びとして定義する。
 *   すべて 1 分前後で終わり、最後は電球色に戻す (おみくじ・季節の演出は色を残す)。
 *   ※ テストから直接読み込むので、このファイルは相対 import をしない。
 */
export type LightFx = "party" | "aurora" | "breathe" | "birthday" | "sakura" | "fireworks" | "momiji" | "snow" | "omikuji";
export const LIGHT_FX: LightFx[] = ["party", "aurora", "breathe", "birthday", "sakura", "fireworks", "momiji", "snow", "omikuji"];

/** 1 コマ: rgb か kelvin (色温度) と明るさ */
export type Frame = { rgb?: string; kelvin?: number; brightness?: number };
export type FxPlan = { frames: Frame[]; intervalMs: number; restoreWarm: boolean };

const rainbow = ["255:40:40", "255:140:0", "255:220:0", "60:220:60", "0:200:255", "80:80:255", "190:60:255", "255:60:170"];

/** 演出ごとのコマ。frames[0] は開始時にすぐ反映する。 */
export function fxPlan(fx: LightFx, luckyRgb?: string): FxPlan {
  switch (fx) {
    case "party": return { frames: [...rainbow, ...rainbow.slice(0, 4)].map((rgb) => ({ rgb, brightness: 90 })), intervalMs: 4000, restoreWarm: true };
    case "aurora": return { frames: Array.from({ length: 12 }, (_, i) => ({ rgb: ["60:255:150", "40:200:200", "150:80:255", "90:255:120"][i % 4], brightness: 55 })), intervalMs: 5000, restoreWarm: true };
    // 4 秒で吸って 4 秒で吐く (1 分)
    case "breathe": return { frames: Array.from({ length: 15 }, (_, i) => ({ kelvin: 2700, brightness: i % 2 === 0 ? 80 : 15 })), intervalMs: 4000, restoreWarm: true };
    case "birthday": return { frames: [{ kelvin: 2700, brightness: 100 }, { rgb: "255:170:120", brightness: 90 }, { rgb: "255:120:170", brightness: 90 }, { rgb: "255:200:80", brightness: 90 }, { kelvin: 2700, brightness: 100 }], intervalMs: 4000, restoreWarm: false };
    case "sakura": return { frames: [{ rgb: "255:150:190", brightness: 70 }], intervalMs: 0, restoreWarm: false };
    case "fireworks": return { frames: ["255:60:60", "60:120:255", "255:210:40", "200:60:255", "60:255:140", "255:120:0", "255:80:200", "80:220:255"].map((rgb) => ({ rgb, brightness: 100 })), intervalMs: 3500, restoreWarm: true };
    case "momiji": return { frames: [{ rgb: "255:70:20", brightness: 80 }, { rgb: "255:140:0", brightness: 75 }, { rgb: "230:40:30", brightness: 80 }, { rgb: "255:120:10", brightness: 75 }], intervalMs: 5000, restoreWarm: false };
    case "snow": return { frames: [{ kelvin: 6500, brightness: 45 }], intervalMs: 0, restoreWarm: false };
    case "omikuji": return { frames: [{ rgb: luckyRgb ?? "255:200:80", brightness: 80 }], intervalMs: 0, restoreWarm: false };
  }
}

/** 1 部屋 1 日の光の演出の上限 (SwitchBot の 1 日 10,000 回の上限に余裕を残す)。超えたら画面の演出だけ流す。 */
export const FX_DAILY_LIMIT = 30;

/* ---------------- おみくじ ---------------- */
export type Fortune = { rank: "daikichi" | "chukichi" | "shokichi" | "kichi" | "suekichi"; color: "red" | "gold" | "pink" | "green" | "blue" | "purple" | "orange"; rgb: string };
const RANKS: Fortune["rank"][] = ["daikichi", "daikichi", "chukichi", "chukichi", "shokichi", "kichi", "kichi", "suekichi"];
const COLORS: { color: Fortune["color"]; rgb: string }[] = [
  { color: "red", rgb: "255:40:40" }, { color: "gold", rgb: "255:190:40" }, { color: "pink", rgb: "255:120:180" }, { color: "green", rgb: "60:220:100" },
  { color: "blue", rgb: "40:140:255" }, { color: "purple", rgb: "170:80:255" }, { color: "orange", rgb: "255:130:20" },
];
/** 1 日 1 回の運勢 (同じ部屋・同じ日なら同じ結果。何度引いても変わらない方がおみくじらしい) */
export function drawFortune(seed: string, dayKey: string): Fortune {
  let h = 2166136261;
  for (const ch of `${seed}|${dayKey}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = RANKS[h % RANKS.length];
  const c = COLORS[(h >>> 8) % COLORS.length];
  return { rank: r, color: c.color, rgb: c.rgb };
}

/* ---------------- 1 コマ分の命令 ---------------- */
export type FxCommand = { action: "wafu_on" | "wafu_color" | "wafu_temp" | "wafu_brightness"; value?: string };
/** 光を戻すときの電球色 (少し落ち着いた明るさ) */
export const FX_RESTORE = { kelvin: 2700, brightness: 70 } as const;

/**
 * frame 番目のコマで送る命令。前のコマから変わった値だけ送る (SwitchBot の呼び出し回数を減らす)。
 *   frame 0 は電球を点けてから色と明るさを送る。範囲外なら空。
 */
export function fxFrameCommands(fx: LightFx, frame: number, luckyRgb?: string): FxCommand[] {
  const { frames } = fxPlan(fx, luckyRgb);
  const cur = frames[frame];
  if (!cur) return [];
  const prev = frame > 0 ? frames[frame - 1] : null;
  const out: FxCommand[] = [];
  if (!prev) out.push({ action: "wafu_on" });
  if (cur.rgb && cur.rgb !== prev?.rgb) out.push({ action: "wafu_color", value: cur.rgb });
  if (cur.kelvin && (cur.kelvin !== prev?.kelvin || prev?.rgb)) out.push({ action: "wafu_temp", value: String(cur.kelvin) });
  if (cur.brightness !== undefined && cur.brightness !== prev?.brightness) out.push({ action: "wafu_brightness", value: String(cur.brightness) });
  return out;
}

/** 日本時間の日付 (YYYY-MM-DD)。おみくじと 1 日の上限に使う */
export function jstDayKey(ms = Date.now()): string {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
