/**
 * NFC シール / QR から開くゲスト用ガイド (/g/[部屋])。ログインなしで見られる。
 *   部屋: rooms.slug (例 haru) か漢字 (春)。"lounge" などそれ以外は共用スペース用 (鍵のガイドなし)
 *   出発の日 (チェックアウトが今日・明日) の予約があって、Crane Nest の送迎予約が りんくう / 空港 なら、空港までの行き方を出す
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toCabinRoom } from "@/lib/cabinData";
import { loadReservations } from "@/lib/driverData";
import { loadCraneNestDrops, checkinLinkFor } from "@/lib/craneNest";
import { hasRoomLock, LOCK_T } from "@/lib/cabinLock";
import { TOILET_T } from "@/lib/cabinToilet";
import { CHECKIN_DEFAULT_URL, roomGuideOf } from "@/lib/cabinAiTalk";
import { jstDay } from "@/lib/driverLogic";
import { NFC_HTML } from "@/lib/nfcPage";
import { roomIcon } from "@/lib/roomIcon";

export interface NfcData {
  room: { kanji: string; en: string } | null; /** 部屋のイラスト (無ければ漢字を出す) */ icon: string | null; slug: string | null; knob: boolean; natsu: boolean; roomKey: string | null; entKey: string | null; trip: string; ck: string;
  /** 手動で開けるための暗証番号 (本人確認が済んだゲストにだけ入れる) */
  codes: { ent: string | null; room: string | null } | null;
  G: { LOCK_T: typeof LOCK_T; TOILET_T: typeof TOILET_T };
}

export async function nfcData(key: string, codes: { ent: string | null; room: string | null } | null = null): Promise<NfcData> {
  const out: NfcData = { room: null, icon: null, slug: null, knob: false, natsu: false, roomKey: null, entKey: null, trip: "none", ck: CHECKIN_DEFAULT_URL, codes, G: { LOCK_T, TOILET_T } };
  const k = decodeURIComponent(key || "").trim().toLowerCase();
  try {
    const [{ data }, entQ] = await Promise.all([
      supabaseAdmin.from("rooms").select("*").eq("is_active", true),
      supabaseAdmin.from("entrances").select("slug, building").eq("is_active", true).order("slug").then((r) => r, () => ({ data: null } as any)),
    ]);
    const ents = ((entQ as any)?.data ?? []) as any[];
    // スマートキー: エントランス (共用スペースは Crane Nest の棟、部屋はその部屋の棟)
    const entOf = (b: string) => ents.find((e) => (e.building || "Crane Nest") === b) ?? ents[0] ?? null;
    { const e0 = entOf("Crane Nest"); if (e0) out.entKey = `/key/${encodeURIComponent(e0.slug)}`; }
    const rooms = ((data ?? []) as any[]).map((r) => ({ raw: r, c: toCabinRoom(r) }));
    const hit = rooms.find((r) => String(r.raw.slug || "").toLowerCase() === k || r.c.kanji === k || r.c.slug === k);
    if (!hit) return out;
    out.room = { kanji: hit.c.kanji, en: hit.c.en || "" }; out.icon = (await roomIcon(String(hit.raw.id), hit.c.kanji)).url; out.slug = String(hit.raw.slug); out.roomKey = `/room/${encodeURIComponent(hit.raw.slug)}`;
    { const e = entOf(hit.c.building || hit.raw.building || "Crane Nest"); out.entKey = e ? `/key/${encodeURIComponent(e.slug)}` : out.entKey; } out.knob = hasRoomLock(hit.raw.slug); out.natsu = roomGuideOf(hit.raw.slug) === "natsu";
    const now = Date.now(), today = jstDay(now), tomorrow = jstDay(now + 86400e3);
    const { res, tokens } = await loadReservations(now - 2 * 86400e3, now + 2 * 86400e3);
    const mine = res.filter((r) => r.roomId === hit.raw.id);
    // 今いる予約 → その予約のチェックインページ
    const cur = mine.find((r) => Date.parse(r.checkIn) - 12 * 3600e3 <= now && Date.parse(r.checkOut) >= now) ?? null;
    if (cur && tokens[cur.id]) out.ck = checkinLinkFor(tokens[cur.id]);
    // 出発の日 (今日・明日チェックアウト) → 送迎予約の行き先で空港の案内
    const leave = mine.find((r) => jstDay(r.checkOut) === today || jstDay(r.checkOut) === tomorrow);
    if (leave) {
      const drops = await loadCraneNestDrops([{ id: leave.id, roomKanji: hit.c.kanji, checkOut: leave.checkOut, token: tokens[leave.id] ?? null }]).catch(() => ({} as Record<string, any>));
      const d = (drops as any)[leave.id];
      const dest = String(d?.dest || ""), t = String(d?.terminal || "") === "2" ? "t2" : "t1";
      if (d && /りんくう|臨空|rinku/i.test(dest) && d.intent !== "nankai") out.trip = `rinku-${t}`;
      else if (d && /空港|kix|kansai/i.test(dest)) out.trip = `air-${t}`;
    }
  } catch { /* 読めなくてもページは出す */ }
  return out;
}

export function nfcHtml(d: NfcData): string {
  return NFC_HTML.replace("__DATA__", JSON.stringify(d).replace(/</g, "\\u003c"));
}
