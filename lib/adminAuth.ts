import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

/** 管理者ログイン済みか (Cookie のセッション値が一致するか) */
export function isAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return !!token && token === process.env.ADMIN_SESSION_TOKEN;
}

/** Server Action 内で権限を強制。未ログインなら例外。 */
export function requireAdmin() {
  if (!isAdmin()) throw new Error("UNAUTHORIZED");
}
