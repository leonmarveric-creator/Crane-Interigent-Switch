import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { STAFF_COOKIE, staffToken } from "./staffAuth";

/**
 * スタッフの Face ID / 指紋ログイン (パスキー) のサーバ用ヘルパ。
 *  - チャレンジは署名付き Cookie に 5 分だけ保存 (DB 不要)
 *  - RP ID / origin はアクセスされたホストから決める (Vercel のドメインでもそのまま動く)
 */
export const RP_NAME = "Xiaobo 助手";
const CHAL_COOKIE = "staff_pk_chal";
const CHAL_TTL_SEC = 300;

const secret = () => process.env.ROOM_SIGNING_SECRET || process.env.ADMIN_SESSION_TOKEN || "insecure-dev-secret-change-me";
const sign = (s: string) => crypto.createHmac("sha256", secret()).update(`staff-pk:${s}`).digest("base64url");

export function rpFromRequest(req: NextRequest): { rpID: string; origin: string } {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost").split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return { rpID: host.replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

/** チャレンジを Cookie に保存 (purpose: "reg" | "auth")。 */
export function setChallenge(res: NextResponse, purpose: "reg" | "auth", challenge: string) {
  const exp = Math.floor(Date.now() / 1000) + CHAL_TTL_SEC;
  const body = `${purpose}.${challenge}.${exp}`;
  res.cookies.set(CHAL_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/api/staff/passkey", maxAge: CHAL_TTL_SEC,
  });
}

/** Cookie のチャレンジを取り出す (期限切れ・改ざん・用途違いなら null)。 */
export function readChallenge(req: NextRequest, purpose: "reg" | "auth"): string | null {
  const v = req.cookies.get(CHAL_COOKIE)?.value;
  if (!v) return null;
  const parts = v.split(".");
  if (parts.length !== 4) return null;
  const [p, challenge, exp, mac] = parts;
  const body = `${p}.${challenge}.${exp}`;
  const good = sign(body);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  if (p !== purpose || Number(exp) < Date.now() / 1000) return null;
  return challenge;
}

export function clearChallenge(res: NextResponse) {
  res.cookies.set(CHAL_COOKIE, "", { path: "/api/staff/passkey", maxAge: 0 });
}

/** パスワードログインと同じスタッフ Cookie (60日) を発行。 */
export function setStaffCookie(res: NextResponse): boolean {
  const token = staffToken();
  if (!token) return false;
  res.cookies.set(STAFF_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return true;
}

/** User-Agent から端末名 (表示用)。 */
export function deviceName(ua: string | null): string {
  const s = ua || "";
  if (/iPhone/.test(s)) return "iPhone";
  if (/iPad/.test(s)) return "iPad";
  if (/Android/.test(s)) return "Android";
  if (/Macintosh/.test(s)) return "Mac";
  if (/Windows/.test(s)) return "Windows";
  return "Device";
}

export const b64u = {
  enc: (u: Uint8Array) => Buffer.from(u).toString("base64url"),
  dec: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
};
