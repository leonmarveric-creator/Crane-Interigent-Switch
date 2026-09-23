import crypto from "crypto";
import { cookies } from "next/headers";
import { isAdmin } from "./adminAuth";

/**
 * スタッフ画面 (/staff) の認証。
 *  - パスワードは環境変数 STAFF_PASSWORD (管理画面の ADMIN_PASSWORD とは別)
 *  - Cookie にはパスワードから作った署名だけを保存 (パスワードを変えると全員ログアウト)
 *  - 管理者としてログイン済みなら、スタッフ画面もそのまま見られる
 */
export const STAFF_COOKIE = "staff_session";

export function staffToken(): string | null {
  const pw = process.env.STAFF_PASSWORD;
  if (!pw) return null;
  const secret = process.env.ROOM_SIGNING_SECRET || process.env.ADMIN_SESSION_TOKEN || "insecure-dev-secret-change-me";
  return crypto.createHmac("sha256", secret).update(`staff:${pw}`).digest("base64url");
}

export function isStaff(): boolean {
  if (isAdmin()) return true;
  const t = staffToken();
  const c = cookies().get(STAFF_COOKIE)?.value;
  if (!t || !c) return false;
  try { return crypto.timingSafeEqual(Buffer.from(c), Buffer.from(t)); } catch { return false; }
}

export function requireStaff() {
  if (!isStaff()) throw new Error("UNAUTHORIZED");
}
