import crypto from "crypto";

/**
 * ゲストのPIN認証後に発行する署名付きセッション。
 *  - 予約IDと有効期限(=チェックアウト)を埋め込み、HMACで署名
 *  - Cookieに保存。デバイス操作時にこの署名を検証する
 *  - 過去の滞在のセッションは予約IDが現在の予約と一致しないため無効
 */
const secret = () =>
  process.env.ROOM_SIGNING_SECRET ||
  process.env.ADMIN_SESSION_TOKEN ||
  "insecure-dev-secret-change-me";

export const roomCookieName = (slug: string) => `rs_${slug}`;

export function signSession(reservationId: string, expEpochMs: number): string {
  const payload = `${reservationId}.${expEpochMs}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySession(token: string | undefined | null): { reservationId: string } | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [reservationId, expStr] = payload.split(".");
  if (!reservationId || !expStr) return null;
  if (Date.now() > Number(expStr)) return null; // 期限切れ
  return { reservationId };
}
