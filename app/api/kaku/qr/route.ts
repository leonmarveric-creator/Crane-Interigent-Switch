import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { isStaff } from "@/lib/staffAuth";

/** K-OPS: iPad に出す「スマホでつなぐ」QR (SVG)。t = 中身 (このサイトの /kaku/ops?link=番号 だけ) */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!isStaff()) return new NextResponse("UNAUTHORIZED", { status: 401 });
  const t = req.nextUrl.searchParams.get("t") || "";
  let u: URL; try { u = new URL(t); } catch { return new NextResponse("BAD", { status: 400 }); }
  if (u.origin !== req.nextUrl.origin || u.pathname !== "/kaku/ops") return new NextResponse("BAD", { status: 400 });
  const svg = await QRCode.toString(u.toString(), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#02140c", light: "#ffffff" } });
  return new NextResponse(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=3600" } });
}
