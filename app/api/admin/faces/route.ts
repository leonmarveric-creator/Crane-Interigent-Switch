import { NextResponse } from "next/server";

/** 管理画面の顔写真は使わないことにした (パスポート写真の読み込みで通信量が多いため)。呼ばれても何も読まない */
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ ok: false, error: "DISABLED" }, { status: 410, headers: { "cache-control": "no-store" } });
}
