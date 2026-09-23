import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isStaff } from "@/lib/staffAuth";

export const runtime = "nodejs";

/** 登録した Face ID / 指紋を削除 (端末をなくしたとき等)。 body: { id } */
export async function DELETE(req: NextRequest) {
  if (!isStaff()) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  const { error } = await supabaseAdmin.from("staff_passkeys").delete().eq("id", id);
  return NextResponse.json({ ok: !error });
}
