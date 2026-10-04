/**
 * 旅の記念 (サーバ専用): GUEST BOARD の招待くじ / Crane Journey ART / Crane Nest Records / Cheers Around the World。
 *   テーブル: keepsake_invites / keepsake_orders / keepsake_examples / keepsake_settings (migration_keepsake.sql)
 *   写真・完成品: Storage の非公開バケット "keepsake" (ページには期限つきのリンクだけを渡す)
 */
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const KS_BUCKET = "keepsake";
export const KS_GIFTS = ["art", "rec", "card"] as const;
export type KsGift = (typeof KS_GIFTS)[number];
export type KsKind = "art" | "rec" | "cheers";
export const KS_VALID_DAYS = 30;
const LINK_SEC = 3600;

export interface KsInvite {
  id: string; resId: string; token: string; gifts: KsGift[]; name: string | null; lang: string | null; room: string | null;
  status: "invited" | "drawn"; drawnAt: string | null; cardGivenAt: string | null; expiresAt: string; createdAt: string;
}
export interface KsFile { path: string; name: string; type: string }
export interface KsOrder {
  id: string; inviteId: string; kind: KsKind; payload: Record<string, any>; photoPath: string | null;
  status: "new" | "done"; results: KsFile[]; link: string | null; createdAt: string; deliveredAt: string | null;
}
export interface KsSettings { cheersOn: boolean; cheersPrice: string; cheersNote: string }

export const ksMissing = (e: any) => !!e && /keepsake_|schema cache|does not exist|PGRST205|42P01/i.test(String(e.message || e.code || ""));
export const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s);
export const isKsToken = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(s);
export const newKsToken = () => crypto.randomBytes(15).toString("base64url");
export const cleanGifts = (v: unknown): KsGift[] => KS_GIFTS.filter((g) => Array.isArray(v) && v.includes(g));

export function toInvite(r: any): KsInvite {
  return {
    id: r.id, resId: r.reservation_id, token: r.token, gifts: cleanGifts(r.gifts), name: r.guest_name ?? null, lang: r.lang ?? null, room: r.room_kanji ?? null,
    status: r.status === "drawn" ? "drawn" : "invited", drawnAt: r.drawn_at ?? null, cardGivenAt: r.card_given_at ?? null, expiresAt: r.expires_at, createdAt: r.created_at,
  };
}
export function toOrder(r: any): KsOrder {
  const res = Array.isArray(r.result_paths) ? r.result_paths.filter((x: any) => x && typeof x.path === "string").map((x: any) => ({ path: String(x.path), name: String(x.name || "file"), type: String(x.type || "") })) : [];
  return {
    id: r.id, inviteId: r.invite_id, kind: r.kind, payload: r.payload && typeof r.payload === "object" ? r.payload : {}, photoPath: r.photo_path ?? null,
    status: r.status === "done" ? "done" : "new", results: res, link: r.result_link ?? null, createdAt: r.created_at, deliveredAt: r.delivered_at ?? null,
  };
}

/** 期限つきのリンク (1 時間)。読めなければ null */
export async function ksLink(path: string | null | undefined, sec = LINK_SEC): Promise<string | null> {
  if (!path) return null;
  try { const { data } = await supabaseAdmin.storage.from(KS_BUCKET).createSignedUrl(path, sec); return data?.signedUrl ?? null; } catch { return null; }
}
export async function ksLinks(paths: string[], sec = LINK_SEC): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const list = [...new Set(paths.filter(Boolean))]; if (!list.length) return out;
  try {
    const { data } = await supabaseAdmin.storage.from(KS_BUCKET).createSignedUrls(list, sec);
    for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  } catch { /* 読めなければ空 */ }
  return out;
}

export async function ksSettings(): Promise<KsSettings> {
  try {
    const { data } = await supabaseAdmin.from("keepsake_settings").select("*").eq("id", 1).maybeSingle();
    return { cheersOn: data?.cheers_on === true, cheersPrice: String(data?.cheers_price || ""), cheersNote: String(data?.cheers_note || "") };
  } catch { return { cheersOn: false, cheersPrice: "", cheersNote: "" }; }
}

export async function ksExamples(): Promise<{ id: string; before: string; after: string; caption: string }[]> {
  const { data, error } = await supabaseAdmin.from("keepsake_examples").select("*").order("sort").order("created_at");
  if (error || !data?.length) return [];
  const links = await ksLinks(data.flatMap((e: any) => [e.before_path, e.after_path]));
  return data.filter((e: any) => links[e.before_path] && links[e.after_path]).map((e: any) => ({ id: e.id, before: links[e.before_path], after: links[e.after_path], caption: String(e.caption || "") }));
}

/** ゲストのページ (合言葉) → 招待。期限切れ・無ければ null */
export async function inviteByToken(token: string): Promise<{ inv: KsInvite | null; expired: boolean }> {
  if (!isKsToken(token)) return { inv: null, expired: false };
  const { data, error } = await supabaseAdmin.from("keepsake_invites").select("*").eq("token", token).maybeSingle();
  if (error || !data) return { inv: null, expired: false };
  const inv = toInvite(data);
  if (Date.parse(inv.expiresAt) < Date.now()) return { inv: null, expired: true };
  return { inv, expired: false };
}

/** 送迎中の予約に、まだ引いていない招待があるか (車内 iPad 用) */
export async function pendingInviteFor(resId: string | null | undefined): Promise<{ token: string; name: string | null; card: boolean } | null> {
  if (!isUuid(resId)) return null;
  try {
    const { data, error } = await supabaseAdmin.from("keepsake_invites").select("token, guest_name, gifts, status, expires_at").eq("reservation_id", resId).maybeSingle();
    if (error || !data || data.status !== "invited" || Date.parse(data.expires_at) < Date.now()) return null;
    return { token: data.token, name: data.guest_name ?? null, card: cleanGifts(data.gifts).includes("card") };
  } catch { return null; }
}

/** 予約 ID → 招待 (K-OPS・GUEST BOARD の印) */
export async function invitesFor(resIds: string[]): Promise<Record<string, KsInvite>> {
  const out: Record<string, KsInvite> = {};
  if (!resIds.length) return out;
  try {
    const { data, error } = await supabaseAdmin.from("keepsake_invites").select("*").in("reservation_id", resIds);
    if (!error) for (const r of data ?? []) out[r.reservation_id] = toInvite(r);
  } catch { /* SQL がまだ */ }
  return out;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "video/mp4": "mp4", "video/quicktime": "mov", "application/pdf": "pdf" };
export const ksExt = (type: string, name = "") => EXT[type] || (name.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "bin").toLowerCase();
export const ksTypeOk = (type: string) => /^(image|audio|video)\//.test(type) || type === "application/pdf";

/** サーバ経由のアップロード (4MB まで。大きいファイルは署名つきリンクで直接) */
export async function ksUpload(path: string, file: Blob, type: string): Promise<string | null> {
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(KS_BUCKET).upload(path, buf, { contentType: type || "application/octet-stream", upsert: true });
  return error ? error.message : null;
}
