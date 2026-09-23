import { NextRequest, NextResponse } from "next/server";

/**
 * /admin 配下を保護。ログインCookieが無ければ /admin/login へリダイレクト。
 * /staff 配下 (スタッフ画面) も同様にログインを要求。
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
  // スタッフ画面: Cookie が無ければログインへ (中身の検証はページ側で行う)
  // (画像などの静的ファイル /staff/xiaobo.jpg・/staff/icon.png はログイン画面でも使うので除外)
  const isStaticFile = /\.(?:jpg|jpeg|png|webp|svg|ico|webmanifest)$/i.test(pathname);
  if (pathname.startsWith("/staff") && pathname !== "/staff/login" && !isStaticFile) {
    const staff = req.cookies.get("staff_session")?.value;
    const admin = req.cookies.get("admin_session")?.value;
    if (!staff && !(admin && admin === process.env.ADMIN_SESSION_TOKEN)) {
      const url = req.nextUrl.clone();
      url.pathname = "/staff/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/staff/:path*", "/staff"] };
