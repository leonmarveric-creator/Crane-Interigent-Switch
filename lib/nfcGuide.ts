/**
 * NFC シール / QR から開くゲスト用ガイド (/g/[部屋])。ゲストの 4 桁で確認してから見られる (lib/nfcGate.ts)。
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
import { CO_T, checkoutWindow, coTime } from "@/lib/checkoutText";
import type { GuideCheckout } from "@/lib/nfcGate";

export interface NfcData {
  room: { kanji: string; en: string } | null; /** 部屋のイラスト (無ければ漢字を出す) */ icon: string | null; slug: string | null; knob: boolean; natsu: boolean; roomKey: string | null; entKey: string | null; trip: string; ck: string;
  /** 手動で開けるための暗証番号 (本人確認が済んだゲストにだけ入れる) */
  codes: { ent: string | null; room: string | null } | null;
  /** チェックアウトのボタン (チェックアウト日の朝 6 時から・本人確認済みのゲストだけ) */
  co: { open: boolean; done: string | null; time: string; href: string; T: typeof CO_T } | null;
  G: { LOCK_T: typeof LOCK_T; TOILET_T: typeof TOILET_T };
  /** ホーム画面のアイコン (春・夏・秋・冬の部屋はその季節、ほかは今の季節) と名前 */
  home: { icon: string; title: string };
}

type Season = "spring" | "summer" | "autumn" | "winter";
const ROOM_SEASON: Record<string, Season> = { "春": "spring", "夏": "summer", "秋": "autumn", "冬": "winter" };
/** 今の季節 (日本時間の月: 3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬) */
export function seasonNow(ms = Date.now()): Season {
  const m = new Date(ms + 9 * 3600e3).getUTCMonth() + 1;
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
}
export const homeIconFor = (kanji: string | null | undefined, ms = Date.now()) =>
  `/nfc/home/${(kanji && ROOM_SEASON[kanji]) || seasonNow(ms)}`;

export async function nfcData(key: string, codes: { ent: string | null; room: string | null } | null = null, co: GuideCheckout | null = null): Promise<NfcData> {
  const out: NfcData = { room: null, icon: null, slug: null, knob: false, natsu: false, roomKey: null, entKey: null, trip: "none", ck: CHECKIN_DEFAULT_URL, codes, co: null, G: { LOCK_T, TOILET_T }, home: { icon: homeIconFor(null), title: "Crane Nest" } };
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
    if (co) {
      const w = checkoutWindow(co.checkOut, Date.now());
      if (co.done || w.open) out.co = { open: w.open, done: co.done, time: coTime(co.checkOut), href: `/checkout/${encodeURIComponent(hit.raw.slug)}?via=concierge`, T: CO_T };
    }
    out.home = { icon: homeIconFor(hit.c.kanji), title: `Crane Nest ${hit.c.kanji}` };
    out.room = { kanji: hit.c.kanji, en: hit.c.en || "" }; out.icon = (await roomIcon(String(hit.raw.id), hit.c.kanji)).url; out.slug = String(hit.raw.slug); out.roomKey = `/room/${encodeURIComponent(hit.raw.slug)}`;
    { const e = entOf(hit.c.building || hit.raw.building || "Crane Nest"); out.entKey = e ? `/key/${encodeURIComponent(e.slug)}` : out.entKey; } out.knob = hasRoomLock(hit.raw.slug); out.natsu = roomGuideOf(hit.raw.slug) === "natsu";
    // チェックアウト済みなら、お部屋・エントランスの鍵の入口は出さない
    if (co?.done) { out.roomKey = null; out.entKey = null; }
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
  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const head = `<link rel="apple-touch-icon" href="${esc(d.home.icon)}-180.png"><link rel="icon" type="image/png" sizes="192x192" href="${esc(d.home.icon)}-192.png">`
    + `<meta name="apple-mobile-web-app-title" content="${esc(d.home.title)}"><meta name="application-name" content="${esc(d.home.title)}">`
    + `<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`;
  return NFC_HTML.replace("<!--HOME-->", head).replace("__DATA__", JSON.stringify(d).replace(/</g, "\\u003c"));
}
