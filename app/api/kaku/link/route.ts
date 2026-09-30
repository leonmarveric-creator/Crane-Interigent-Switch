import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * K-OPS: スマホ (操作パネル) ⇔ iPad (ミッション画面) のつなぎ。
 *   POST {op:"open"}                        … iPad: 4 けたの番号を作る
 *   POST {op:"put", code, role:"d"|"c", state} … 自分の状態を置く
 *   POST {op:"cmd", code, cmd, args}         … スマホ → iPad の命令
 *   GET  ?code=&since=                       … 相手の状態と、since より新しい命令
 *   GET  ?op=latest                          … いちばん最近動いている iPad の番号 (スマホが自動でつなぐ)
 */
export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const setup = (m?: string) => /kaku_link/.test(m || "");
const okCode = (s: unknown) => typeof s === "string" && /^\d{4}$/.test(s);

export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const q = req.nextUrl.searchParams;
  if (q.get("op") === "latest") {
    const { data, error } = await supabaseAdmin.from("kaku_link").select("code,updated_at").gte("updated_at", new Date(Date.now() - 15 * 60e3).toISOString()).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return J({ ok: false, error: setup(error.message) ? "SETUP" : error.message });
    return J({ ok: true, code: (data as any)?.code ?? null });
  }
  const code = q.get("code"); if (!okCode(code)) return J({ ok: false, error: "BAD" });
  const since = Math.max(0, Number(q.get("since")) || 0);
  const [row, cmds] = await Promise.all([
    supabaseAdmin.from("kaku_link").select("dstate,cstate,updated_at").eq("code", code).maybeSingle(),
    q.get("role") === "d" ? supabaseAdmin.from("kaku_link_cmd").select("id,cmd,args").eq("code", code).gt("id", since).order("id").limit(50) : Promise.resolve({ data: [], error: null }),
  ]);
  if (row.error) return J({ ok: false, error: setup(row.error.message) ? "SETUP" : row.error.message });
  if (!row.data) return J({ ok: false, error: "NOCODE" });
  return J({ ok: true, d: (row.data as any).dstate, c: (row.data as any).cstate, cmds: (cmds as any).data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const b = await req.json().catch(() => ({} as any));
  if (b.op === "open") {
    // 古いものを片付ける
    await supabaseAdmin.from("kaku_link_cmd").delete().lt("at", new Date(Date.now() - 86400e3).toISOString());
    const want = okCode(b.code) ? b.code : null;
    for (let i = 0; i < 8; i++) {
      const code = want && i === 0 ? want : String(1000 + Math.floor(Math.random() * 9000));
      const { error } = await supabaseAdmin.from("kaku_link").upsert({ code, dstate: { stage: "stby" }, updated_at: new Date().toISOString() }, { onConflict: "code" });
      if (error) return J({ ok: false, error: setup(error.message) ? "SETUP" : error.message });
      const { data: last } = await supabaseAdmin.from("kaku_link_cmd").select("id").eq("code", code).order("id", { ascending: false }).limit(1).maybeSingle();
      return J({ ok: true, code, since: (last as any)?.id ?? 0 });
    }
  }
  if (!okCode(b.code)) return J({ ok: false, error: "BAD" });
  if (b.op === "put") {
    const col = b.role === "c" ? "cstate" : "dstate";
    const st = JSON.stringify(b.state ?? null); if (st.length > 20000) return J({ ok: false, error: "BIG" });
    const { error } = await supabaseAdmin.from("kaku_link").update({ [col]: b.state ?? null, updated_at: new Date().toISOString() }).eq("code", b.code);
    return J(error ? { ok: false, error: setup(error.message) ? "SETUP" : error.message } : { ok: true });
  }
  if (b.op === "cmd") {
    const cmd = String(b.cmd || "").slice(0, 40); if (!/^[a-z0-9_]+$/i.test(cmd)) return J({ ok: false, error: "BAD" });
    const { error } = await supabaseAdmin.from("kaku_link_cmd").insert({ code: b.code, cmd, args: b.args ?? null });
    return J(error ? { ok: false, error: setup(error.message) ? "SETUP" : error.message } : { ok: true });
  }
  return J({ ok: false, error: "BAD" });
}
