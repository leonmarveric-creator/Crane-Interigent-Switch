/**
 * 「みんなの声」(サーバー側): 保存・お母さんの画面用の読み込み・承認。
 *   テーブル (migration_guest_cheers.sql) が無くても、チェックアウトは止めない。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CHEER_A, CHEER_B, CHEER_C, cheerIdx, cheerLangFor, cheerText, isCheerCountry, type CheerLang } from "@/lib/cheerText";
import { toCabinRoom } from "@/lib/cabinData";

export interface CheerInput { country?: unknown; a?: unknown; b?: unknown; c?: unknown; free?: unknown }

/** チェックアウトのときに 1 件保存 (同じ予約は 1 件だけ)。選ばなかったゲストも kind = none で残す */
export async function saveCheer(reservationId: string, roomId: string | null, uiLang: string, input: CheerInput | null | undefined): Promise<void> {
  try {
    const i = input ?? {};
    const country = isCheerCountry(i.country) ? String(i.country).toUpperCase() : null;
    const a = cheerIdx(i.a, CHEER_A.length), b = cheerIdx(i.b, CHEER_B.length), c = cheerIdx(i.c, CHEER_C.length);
    const free = String(i.free ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
    const { data: r } = await supabaseAdmin.from("reservations").select("guest_name, entrance_name").eq("id", reservationId).maybeSingle();
    const name = String((r as any)?.guest_name || (r as any)?.entrance_name || "").trim().slice(0, 60) || null;
    await supabaseAdmin.from("guest_cheers").insert({
      reservation_id: reservationId, room_id: roomId, guest_name: name, country,
      lang: cheerLangFor(country, uiLang),
      kind: a == null && b == null && c == null && !free ? "none" : "words",
      a, b, c, free_text: free, free_status: free ? "pending" : "none",
    });
  } catch { /* テーブルが無い・2 回目などは無視 */ }
}

/** お母さんの画面に流す 1 件 */
export interface CheerVoice { id: string; name: string; country: string | null; at: string; room: string | null; kind: "words" | "none"; text: string; zh: string; dir: "ltr" | "rtl"; isNew: boolean }

/** 名前の表示 (大文字だけのパスポート表記は読みやすく) */
const niceName = (s: string | null) => {
  const n = String(s ?? "").trim();
  if (!n) return "Guest";
  return /^[A-Z\s'.-]+$/.test(n) ? n.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase()) : n;
};

export async function loadCheers(limit = 300): Promise<{ voices: CheerVoice[]; setup: boolean }> {
  const { data, error } = await supabaseAdmin.from("guest_cheers")
    .select("id, room_id, created_at, guest_name, country, lang, kind, a, b, c, free_text, free_zh, free_status, seen_at")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) return { voices: [], setup: false };
  const { data: rooms } = await supabaseAdmin.from("rooms").select("*");
  const kanji = new Map(((rooms ?? []) as any[]).map((r) => [r.id, toCabinRoom(r).kanji]));
  const voices: CheerVoice[] = [];
  for (const x of (data ?? []) as any[]) {
    const lang = (x.lang || "en") as CheerLang;
    const p = { a: x.a, b: x.b, c: x.c };
    let text = cheerText(p, lang), zh = lang === "zh" || lang === "zt" ? "" : cheerText(p, "zh");
    // 承認された自由なひとこと (選んだ言葉の後ろに)
    if (x.free_status === "approved" && x.free_text) {
      text = [text, x.free_text].filter(Boolean).join(" ");
      zh = [zh, x.free_zh].filter(Boolean).join("");
    }
    const kind = text ? "words" : "none";
    voices.push({
      id: x.id, name: niceName(x.guest_name), country: x.country ?? null, at: x.created_at, room: kanji.get(x.room_id) ?? null,
      kind, text, zh, dir: lang === "ar" ? "rtl" : "ltr", isNew: !x.seen_at,
    });
  }
  return { voices, setup: true };
}

export async function markCheersSeen(): Promise<void> {
  try { await supabaseAdmin.from("guest_cheers").update({ seen_at: new Date().toISOString() }).is("seen_at", null); } catch { /* ignore */ }
}

/** スタッフ画面用: 声の数と、まだ見ていない数 */
export async function cheerCounts(): Promise<{ total: number; unseen: number } | null> {
  try {
    const [t, u] = await Promise.all([
      supabaseAdmin.from("guest_cheers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("guest_cheers").select("id", { count: "exact", head: true }).is("seen_at", null),
    ]);
    if (t.error) return null;
    return { total: t.count ?? 0, unseen: u.count ?? 0 };
  } catch { return null; }
}

/** 管理画面用: 承認待ちの自由なひとこと */
export async function pendingFreeCheers(): Promise<{ id: string; name: string; country: string | null; at: string; text: string; lang: string }[]> {
  try {
    const { data, error } = await supabaseAdmin.from("guest_cheers").select("id, guest_name, country, created_at, free_text, lang")
      .eq("free_status", "pending").order("created_at", { ascending: false }).limit(50);
    if (error) return [];
    return ((data ?? []) as any[]).map((x) => ({ id: x.id, name: niceName(x.guest_name), country: x.country ?? null, at: x.created_at, text: x.free_text ?? "", lang: x.lang }));
  } catch { return []; }
}
