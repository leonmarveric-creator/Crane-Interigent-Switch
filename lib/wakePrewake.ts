export const PREWAKE_WINDOW_MS = 10 * 60 * 1000;
export const PREWAKE_BRIGHTNESS_STEPS = [15, 35, 55, 75, 100] as const;
export const WAFU_AUTO_OFF_DELAY_MS = 5 * 60 * 1000;
export const WAKE_LIGHT_MODES = ["flame_on", "horizon_rise"] as const;

export type WakeLightMode = (typeof WAKE_LIGHT_MODES)[number];

export type WafuPrewakeStep = {
  step: number;
  brightness: number;
};

export function isWakeLightMode(value: unknown): value is WakeLightMode {
  return typeof value === "string" && WAKE_LIGHT_MODES.some((mode) => mode === value);
}

export function getWafuAutoOffAtMs(fireAtMs: number): number {
  return fireAtMs + WAFU_AUTO_OFF_DELAY_MS;
}

export function getWafuPrewakeStep(
  nowMs: number,
  fireAtMs: number,
  currentStep = 0,
): WafuPrewakeStep | null {
  if (!Number.isFinite(nowMs) || !Number.isFinite(fireAtMs)) return null;

  const startMs = fireAtMs - PREWAKE_WINDOW_MS;
  if (nowMs < startMs || nowMs >= fireAtMs) return null;

  const slotMs = PREWAKE_WINDOW_MS / PREWAKE_BRIGHTNESS_STEPS.length;
  const index = Math.min(
    PREWAKE_BRIGHTNESS_STEPS.length - 1,
    Math.max(0, Math.floor((nowMs - startMs) / slotMs)),
  );
  const step = index + 1;
  if (step <= currentStep) return null;

  return { step, brightness: PREWAKE_BRIGHTNESS_STEPS[index] };
}
