/**
 * SwitchBot の Webhook (状態の変化の知らせ) を受けるための決まりごと。
 *   受け口: /api/switchbot/webhook/<token>。SwitchBot の知らせには署名が無いので、URL の token (サーバーの秘密から作る) で見分ける。
 *   知らせは「状態の表示」にだけ使う (機器の操作や鍵には使わない)。
 */
import crypto from "crypto";

export function webhookToken(): string | null {
  const k = process.env.SWITCHBOT_SECRET || process.env.ADMIN_SESSION_TOKEN;
  if (!k) return null;
  return crypto.createHmac("sha256", k).update("cn-switchbot-webhook-v1").digest("hex").slice(0, 32);
}
export function tokenOk(t: string | null | undefined): boolean {
  const w = webhookToken(); if (!w || !t || t.length !== w.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(w)); } catch { return false; }
}
export const webhookUrl = (origin: string) => { const t = webhookToken(); return t ? `${origin.replace(/\/$/, "")}/api/switchbot/webhook/${t}` : null; };

export interface HookRow { device_id: string; device_type: string | null; power: string | null; brightness: number | null; extra: Record<string, unknown> | null; updated_at: string }
/** 知らせの中身 → device_state の 1 行 (読めなければ null) */
export function parseHook(b: any, now = Date.now()): HookRow | null {
  const c = b?.context; if (!c || typeof c !== "object") return null;
  const id = String(c.deviceMac ?? c.deviceId ?? "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (id.length < 8 || id.length > 20) return null;
  const pw = typeof c.powerState === "string" ? c.powerState.toUpperCase() : null;
  const power = pw === "ON" || pw === "OFF" ? pw : null;
  const br = Number(c.brightness);
  const extra: Record<string, unknown> = {};
  for (const k of ["colorTemperature", "color", "temperature", "humidity", "lockState", "battery", "mode"]) { const v = c[k]; if (typeof v === "number" || (typeof v === "string" && v.length < 40)) extra[k] = v; }
  const ts = Number(c.timeOfSample);
  return {
    device_id: id, device_type: typeof c.deviceType === "string" ? c.deviceType.slice(0, 40) : null, power,
    brightness: Number.isFinite(br) ? Math.round(br) : null,
    extra: Object.keys(extra).length ? extra : null,
    updated_at: new Date(Number.isFinite(ts) && Math.abs(ts - now) < 86400e3 ? ts : now).toISOString(),
  };
}
