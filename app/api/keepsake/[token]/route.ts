import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { inviteByToken, ksSettings, ksUpload } from "@/lib/keepsake";
import { guestOrders } from "@/lib/keepsakeGuest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/**
 * ゲストの記念ページ (/k/<token>) から。合言葉 (token) を知っている人だけ。
 *   POST { op:"draw" }                         くじを引いた
 *   POST multipart op=order kind payload photo 申し込み (ART は写真が必須。1 種類につき 1 回)
 *   GET                                        申し込みの状態・完成品 (期限つきのリンク)
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { inv } = await inviteByToken(params.token);
  if (!inv) return J({ ok: false, error: "NOT_FOUND" }, 404);
  return J({ ok: true, status: inv.status, cardGiven: !!inv.cardGivenAt, orders: await guestOrders(inv.id) });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { inv } = await inviteByToken(params.token);
  if (!inv) return J({ ok: false, error: "NOT_FOUND" }, 404);
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    const b = await req.json().catch(() => ({}));
    if (b.op === "draw") {
      if (inv.status !== "drawn") await supabaseAdmin.from("keepsake_invites").update({ status: "drawn", drawn_at: new Date().toISOString() }).eq("id", inv.id);
      return J({ ok: true });
    }
    return J({ ok: false, error: "OP" }, 400);
  }
  const f = await req.formData().catch(() => null);
  if (!f || f.get("op") !== "order") return J({ ok: false, error: "FORM" }, 400);
  const kind = String(f.get("kind") || "");
  const allowed = kind === "cheers" ? (await ksSettings()).cheersOn : (kind === "art" || kind === "rec") && inv.gifts.includes(kind);
  if (!allowed) return J({ ok: false, error: "NOT_ALLOWED" }, 403);
  const { count } = await supabaseAdmin.from("keepsake_orders").select("id", { count: "exact", head: true }).eq("invite_id", inv.id).eq("kind", kind);
  if (count) return J({ ok: true, orders: await guestOrders(inv.id) }); // 2 回押しても 1 件だけ
  let p: any = {}; try { p = JSON.parse(String(f.get("payload") || "{}")); } catch { /* 空で */ }
  const when = p.when === "start" ? "start" : "end";
  const payload: Record<string, any> =
    kind === "art" ? { when, words: str(p.words, 80), contact: str(p.contact, 120), lang: str(p.lang, 4) }
    : kind === "rec" ? { when, styles: Array.isArray(p.styles) ? p.styles.slice(0, 10).map((s: any) => str(s, 30)) : [], style2: str(p.style2, 80), names: str(p.names, 80), memories: str(p.memories, 600), lyrics: str(p.lyrics, 20), contact: str(p.contact, 120), lang: str(p.lang, 4) }
    : { occasion: str(p.occasion, 40), name: str(p.name, 60), message: str(p.message, 120), contact: str(p.contact, 120), lang: str(p.lang, 4) };
  if (kind === "rec" && !payload.names) return J({ ok: false, error: "NAMES" }, 400);
  if (kind === "cheers" && (!payload.name || !payload.message)) return J({ ok: false, error: "MESSAGE" }, 400);
  const photo = f.get("photo");
  const hasPhoto = photo instanceof Blob && photo.size > 0;
  if (hasPhoto && (!/^image\/(jpeg|png|webp)$/.test((photo as Blob).type) || (photo as Blob).size > 4_000_000)) return J({ ok: false, error: "PHOTO" }, 400);
  if (kind === "art" && !hasPhoto) return J({ ok: false, error: "PHOTO" }, 400);
  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  if (hasPhoto) {
    photoPath = `orders/${id}/photo.jpg`;
    const e = await ksUpload(photoPath, photo as Blob, (photo as Blob).type);
    if (e) return J({ ok: false, error: "UPLOAD" }, 500);
  }
  const { error } = await supabaseAdmin.from("keepsake_orders").insert({ id, invite_id: inv.id, kind, payload, photo_path: photoPath });
  if (error) return J({ ok: false, error: "SAVE" }, 500);
  if (inv.status !== "drawn") await supabaseAdmin.from("keepsake_invites").update({ status: "drawn", drawn_at: new Date().toISOString() }).eq("id", inv.id);
  return J({ ok: true, orders: await guestOrders(inv.id) });
}
