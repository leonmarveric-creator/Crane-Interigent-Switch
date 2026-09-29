import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * スマホ (HIROSHI DRIVE / AGENT KAKU) が 1 秒ごとに聞きに来る: 「iPad が話したい声はある？」
 *   ?t=送迎の ID &after=最後に鳴らした番号
 *   来たことを voice_seen に残す (5 秒に 1 回だけ書く)。iPad はこれを見て「声はスマホから」にする
 */
export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const t = req.nextUrl.searchParams.get("t"), after = Number(req.nextUrl.searchParams.get("after") || 0);
  if (!isId(t)) return J({ ok: false, error: "BAD" }, 400);
  const nowIso = new Date().toISOString(), old = new Date(Date.now() - 5000).toISOString();
  const [{ data, error }] = await Promise.all([
    supabaseAdmin.from("cabin_trips").select("voice_q, status").eq("id", t).maybeSingle(),
    supabaseAdmin.from("cabin_trips").update({ voice_seen: nowIso }).eq("id", t).eq("status", "active").or(`voice_seen.is.null,voice_seen.lt.${old}`),
  ]);
  if (error) return J({ ok: false, error: /voice_q/.test(error.message) ? "SETUP" : error.message });
  if (!data || (data as any).status !== "active") return J({ ok: true, active: false, items: [] });
  const now = Date.now();
  const items = (Array.isArray((data as any).voice_q) ? (data as any).voice_q : []).filter((x: any) => x && Number(x.n) > after && now - Number(x.n) < 20000);
  return J({ ok: true, active: true, items, now });
}
