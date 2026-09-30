/**
 * Crane Nest のシステム (別の Supabase) の「お見送りの送迎予約 + パスポート登録」を読む (サーバ専用・読むだけ)。
 *   環境変数: CRANENEST_SUPABASE_URL / CRANENEST_SUPABASE_SERVICE_KEY (無ければ何もしない)
 *   紐づけ: ① 予約つき QR の合言葉 (reservations.guest_token = transfer_requests.reservation_token)
 *           ② 無ければ「お部屋 (漢字) + 送迎の日 = チェックアウト日」
 *   お部屋: Crane Nest の名前 (春咏・夏凉・秋灯・冬宵・松・竹・梅・林・荷) の最初の漢字 ⇔ こちらのお部屋の漢字。
 *           名前を変える前の番号 (105〜109) も読めるようにする。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.CRANENEST_SUPABASE_URL || "";
const KEY = process.env.CRANENEST_SUPABASE_SERVICE_KEY || "";
/** ゲストがパスポート登録・送迎予約をするページ (Crane Nest のシステム) */
export const CRANENEST_APP_URL = (process.env.CRANENEST_APP_URL || "https://crane-nest-cmn2.vercel.app").replace(/\/$/, "");
export const craneNestOn = () => !!(URL_ && KEY);
let cli: SupabaseClient | null = null;
function cn(): SupabaseClient | null {
  if (!craneNestOn()) return null;
  if (!cli) cli = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return cli;
}

/** 予約つき QR のリンク (合言葉 = こちらの予約の guest_token) */
export const checkinLinkFor = (guestToken: string) => `${CRANENEST_APP_URL}/?r=${encodeURIComponent(guestToken)}`;

/** 名前を変える前の番号 → 漢字 */
const LEGACY: Record<string, string> = { "105": "松", "106": "竹", "107": "林", "108": "梅", "109": "荷" };
/** Crane Nest のお部屋の名前 → 漢字 1 文字 (春咏 → 春) */
export function cnRoomKanji(name: string | null | undefined): string | null {
  const s = String(name ?? "").trim(); if (!s) return null;
  if (LEGACY[s]) return LEGACY[s];
  const m = s.match(/[㐀-鿿]/); return m ? m[0] : null;
}

export interface CnDrop {
  id: string; status: string;
  date: string | null;               // 送迎の日 (YYYY-MM-DD)
  dest: string | null;               // 行き先 (関西国際空港・JR日根野駅 など)
  terminal: string | null;           // "1" | "2"
  intent: "nankai" | "airport" | null; // りんくうタウン: 南海に乗る / 空港へ
  flightAt: string | null;           // 便の時刻 (ISO)
  departAt: string | null;           // 出発したい時刻 ("HH:MM")
  pax: number; large: number; small: number; special: number;
  names: string[];                   // パスポートの名前 (代表者が先)
  linked: "token" | "room";          // どう紐づいたか
}

const jstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);

/**
 * こちらの予約に Crane Nest の送迎予約を紐づけて返す (予約 ID → 送迎予約)。
 *   rs: { id, roomKanji, checkOut, token } の配列。設定が無い・読めないときは空。
 */
export async function loadCraneNestDrops(rs: { id: string; roomKanji: string | null; checkOut: string; token: string | null }[]): Promise<Record<string, CnDrop>> {
  const c = cn(); if (!c || !rs.length) return {};
  try {
    const dates = rs.map((r) => jstDate(r.checkOut)).sort();
    const from = new Date(Date.parse(dates[0]) - 86400e3).toISOString().slice(0, 10), to = dates[dates.length - 1];
    const tokens = rs.map((r) => r.token).filter(Boolean) as string[];
    // 日付の範囲に入るもの + 合言葉つきのもの
    const sel = "*";
    const [byDate, byTok] = await Promise.all([
      c.from("transfer_requests").select(sel).gte("transfer_date", from).lte("transfer_date", to).neq("status", "cancelled").order("created_at", { ascending: false }),
      tokens.length ? c.from("transfer_requests").select(sel).in("reservation_token", tokens).neq("status", "cancelled").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    const rows = new Map<string, any>();
    for (const r of [...((byTok as any).error ? [] : (byTok as any).data ?? []), ...(byDate.error ? [] : byDate.data ?? [])]) rows.set(r.id, r);
    if (!rows.size) return {};
    const list = [...rows.values()];
    const ids = list.map((r) => r.id), destIds = [...new Set(list.map((r) => r.destination_id).filter(Boolean))];
    const [dq, lq] = await Promise.all([
      destIds.length ? c.from("destinations").select("id, name").in("id", destIds) : Promise.resolve({ data: [] as any[] }),
      c.from("transfer_request_guests").select("transfer_request_id, guest_id, is_primary").in("transfer_request_id", ids),
    ]);
    const destName = new Map<string, string>(((dq as any).data ?? []).map((d: any) => [d.id, d.name]));
    const links = ((lq as any).error ? [] : (lq as any).data ?? []) as any[];
    const guestIds = [...new Set([...list.map((r) => r.guest_id), ...links.map((l) => l.guest_id)].filter(Boolean))];
    const gq = guestIds.length ? await c.from("guests").select("id, full_name").in("id", guestIds) : { data: [] as any[] };
    const gName = new Map<string, string>(((gq as any).data ?? []).map((g: any) => [g.id, g.full_name]));
    const toDrop = (r: any, how: CnDrop["linked"]): CnDrop => {
      const ls = links.filter((l) => l.transfer_request_id === r.id).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      const names = [...new Set([r.guest_id, ...ls.map((l) => l.guest_id)].map((g) => gName.get(g)).filter(Boolean) as string[])];
      return {
        id: r.id, status: String(r.status ?? "pending"), date: r.transfer_date ?? null, dest: destName.get(r.destination_id) ?? null,
        terminal: r.terminal ?? null, intent: r.rinku_route_intent === "nankai" || r.rinku_route_intent === "airport" ? r.rinku_route_intent : null,
        flightAt: r.flight_time ?? null, departAt: r.preferred_departure_time ?? null,
        pax: Number(r.passenger_count) || 1, large: Number(r.luggage_large) || 0, small: Number(r.luggage_small) || 0, special: Number(r.luggage_special) || 0,
        names, linked: how,
      };
    };
    const out: Record<string, CnDrop> = {};
    const used = new Set<string>();
    // ① 合言葉 (確実)
    for (const r of rs) {
      if (!r.token) continue;
      const hit = list.find((x) => x.reservation_token && x.reservation_token === r.token);
      if (hit) { out[r.id] = toDrop(hit, "token"); used.add(hit.id); }
    }
    // ② お部屋 + チェックアウト日 (合言葉の無い登録だけ)
    for (const r of rs) {
      if (out[r.id] || !r.roomKanji) continue;
      const d = jstDate(r.checkOut);
      const hit = list.find((x) => !used.has(x.id) && !x.reservation_token && x.transfer_date === d && cnRoomKanji(x.room_number) === r.roomKanji);
      if (hit) { out[r.id] = toDrop(hit, "room"); used.add(hit.id); }
    }
    return out;
  } catch { return {}; }
}
