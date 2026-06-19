import { NextRequest, NextResponse } from "next/server";

/**
 * /admin 配下を保護。ログインCookieが無ければ /admin/login へリダイレクト。
 * (ゲストの /room は対象外)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("admin_session")?.value;
    if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
