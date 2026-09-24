/**
 * Dream Fade モード (眠りにつくための 30 分フェード)。
 *   開始時: 和風ライト以外の灯り (メインライト / ギャラクシー / ネスト) を消し、和風ライトだけを暖色で点ける。
 *   30 分かけて和風ライトを少しずつ暗くし、後半は色も夕焼けのような赤みの暖色へ移す。
 *   30 分後に和風ライトを消灯して終了。途中で他の灯りを操作したらフェードは止まる。
 *
 *   Cron (wake-alarm と同じ 1〜2 分毎) が経過時間から「今あるべき段階」を計算して反映する。
 *   Cron の間隔が多少ずれても、経過時間から計算するので最後は必ず予定どおりに消灯する。
 *   ※ テストから直接読み込むので、このファイルは相対 import をしない。
 */

export const DREAM_FADE_MS = 30 * 60 * 1000;
/** 段階の数 (2 分ごとに 1 段階) */
export const DREAM_FADE_STEPS = 15;
/** 開始時の明るさ (%) と色温度 (K) */
export const DREAM_FADE_START = { brightness: 60, kelvin: 2700 } as const;

export type DreamFadeTarget =
  | { step: number; done: false; brightness: number; color: { kind: "temp"; kelvin: number } | { kind: "rgb"; rgb: string } }
  | { step: number; done: true };

/**
 * 経過時間から、今あるべき段階を返す。
 *  明るさは「最初は早め・最後はゆっくり」下げる (人の目は暗いほど変化に敏感なため)。
 *  色は前半は電球色 (2700K)、後半は赤みの強い暖色 (眠りのホルモンを抑えにくい色) へ。
 */
export function dreamFadeTarget(elapsedMs: number): DreamFadeTarget {
  const e = Math.max(0, elapsedMs);
  if (e >= DREAM_FADE_MS) return { step: DREAM_FADE_STEPS + 1, done: true };
  return dreamFadeAtStep(Math.min(DREAM_FADE_STEPS, Math.floor((e / DREAM_FADE_MS) * DREAM_FADE_STEPS) + 1));
}

/** 段階番号 (1〜STEPS、STEPS+1 = 消灯) の明るさと色 */
export function dreamFadeAtStep(step: number): DreamFadeTarget {
  if (step > DREAM_FADE_STEPS) return { step: DREAM_FADE_STEPS + 1, done: true };
  const p = step / (DREAM_FADE_STEPS + 1); // 0〜1 (最後の段階でも 0 にはしない)
  const brightness = Math.max(1, Math.round(DREAM_FADE_START.brightness * Math.pow(1 - p, 2)));
  const color = p < 0.5
    ? { kind: "temp" as const, kelvin: DREAM_FADE_START.kelvin }
    : p < 0.75
      ? { kind: "rgb" as const, rgb: "255:120:30" } // 夕焼けのオレンジ
      : { kind: "rgb" as const, rgb: "255:70:10" }; // 赤みの強い残り火
  return { step, done: false, brightness, color };
}

/** 前の段階から色が変わるか (変わるときだけ色の命令を送り、API 呼び出しを減らす) */
export function dreamFadeColorChanged(prevStep: number, next: DreamFadeTarget): boolean {
  if (next.done) return false;
  if (prevStep <= 0) return next.color.kind !== "temp"; // 開始時は 2700K で点灯済み
  const prev = dreamFadeAtStep(prevStep);
  return prev.done || JSON.stringify(prev.color) !== JSON.stringify(next.color);
}
