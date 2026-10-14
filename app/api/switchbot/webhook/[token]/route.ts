import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseHook, tokenOk } from "@/lib/switchbotWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SwitchBot から「機器の状態が変わった」知らせ (Webhook) を受ける → device_state に 1 台 1 行で残す。
 * 管理画面の LIVE (建物の今の状態) が使う。表示だけに使い、機器の操作には使わない。
 * URL の token が合わないものは捨てる (SwitchBot の知らせには署名が無いため)。
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!tokenOk(params.token)) return NextResponse.json({ ok: false }, { status: 404 });
  const b = await req.json().catch(() => null);
  const row = parseHook(b);
  // 読めない知らせも 200 を返す (SwitchBot が何度も送り直さないように)
  if (!row) return NextResponse.json({ ok: true, skip: 1 });
  const { error } = await supabaseAdmin.from("device_state").upsert(row, { onConflict: "device_id" });
  return NextResponse.json({ ok: !error, ...(error && /device_state/.test(error.message) ? { error: "SETUP" } : {}) });
}
