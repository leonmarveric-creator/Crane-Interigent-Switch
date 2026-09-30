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

interface RawDrop { raw: any; drop: CnDrop }
/** Crane Nest の送迎予約を読む (送迎の日が from〜to のもの + 合言葉が tokens のもの。キャンセル以外) */
async function fetchDrops(c: SupabaseClient, from: string, to: string, tokens: string[]): Promise<RawDrop[]> {
  const [byDate, byTok] = await Promise.all([
    c.from("transfer_requests").select("*").gte("transfer_date", from).lte("transfer_date", to).neq("status", "cancelled").order("created_at", { ascending: false }),
    tokens.length ? c.from("transfer_requests").select("*").in("reservation_token", tokens).neq("status", "cancelled").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  const rows = new Map<string, any>();
  for (const r of [...((byTok as any).error ? [] : (byTok as any).data ?? []), ...(byDate.error ? [] : byDate.data ?? [])]) rows.set(r.id, r);
  if (!rows.size) return [];
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
  return list.map((r) => {
    const ls = links.filter((l) => l.transfer_request_id === r.id).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    const names = [...new Set([r.guest_id, ...ls.map((l) => l.guest_id)].map((g) => gName.get(g)).filter(Boolean) as string[])];
    return { raw: r, drop: {
      id: r.id, status: String(r.status ?? "pending"), date: r.transfer_date ?? null, dest: destName.get(r.destination_id) ?? null,
      terminal: r.terminal ?? null, intent: r.rinku_route_intent === "nankai" || r.rinku_route_intent === "airport" ? r.rinku_route_intent : null,
      flightAt: r.flight_time ?? null, departAt: r.preferred_departure_time ?? null,
      pax: Number(r.passenger_count) || 1, large: Number(r.luggage_large) || 0, small: Number(r.luggage_small) || 0, special: Number(r.luggage_special) || 0,
      names, linked: "room" as const,
    } };
  });
}

type ResKey = { id: string; roomKanji: string | null; checkOut: string; token: string | null };
/** 送迎予約 ⇔ こちらの予約 (① 合言葉 ② お部屋の漢字 + チェックアウト日)。返り値: 予約 ID → 送迎予約 */
function matchDrops(rs: ResKey[], list: RawDrop[]): Record<string, CnDrop> {
  const out: Record<string, CnDrop> = {};
  const used = new Set<string>();
  for (const r of rs) {
    if (!r.token) continue;
    const hit = list.find((x) => x.raw.reservation_token && x.raw.reservation_token === r.token);
    if (hit) { out[r.id] = { ...hit.drop, linked: "token" }; used.add(hit.raw.id); }
  }
  for (const r of rs) {
    if (out[r.id] || !r.roomKanji) continue;
    const d = jstDate(r.checkOut);
    const hit = list.find((x) => !used.has(x.raw.id) && !x.raw.reservation_token && x.raw.transfer_date === d && cnRoomKanji(x.raw.room_number) === r.roomKanji);
    if (hit) { out[r.id] = { ...hit.drop, linked: "room" }; used.add(hit.raw.id); }
  }
  return out;
}

/**
 * こちらの予約に Crane Nest の送迎予約を紐づけて返す (予約 ID → 送迎予約)。
 *   rs: { id, roomKanji, checkOut, token } の配列。設定が無い・読めないときは空。
 */
export async function loadCraneNestDrops(rs: ResKey[]): Promise<Record<string, CnDrop>> {
  const c = cn(); if (!c || !rs.length) return {};
  try {
    const dates = rs.map((r) => jstDate(r.checkOut)).sort();
    const from = new Date(Date.parse(dates[0]) - 86400e3).toISOString().slice(0, 10), to = dates[dates.length - 1];
    const list = await fetchDrops(c, from, to, rs.map((r) => r.token).filter(Boolean) as string[]);
    return matchDrops(rs, list);
  } catch { return {}; }
}

export interface CnReportRow {
  drop: CnDrop; roomName: string; createdAt: string | null; hasToken: boolean;
  res: { id: string; guest: string | null; room: string; checkIn: string; checkOut: string } | null;
  /** 紐づかなかった理由 */
  why: string | null;
}
/** 確認用: Crane Nest に登録されたお見送り送迎予約の一覧と、どの予約に紐づいたか */
export async function craneNestReport(res: (ResKey & { guest: string | null; room: string; checkIn: string })[], from: string, to: string): Promise<{ on: boolean; error: string | null; rows: CnReportRow[] }> {
  const c = cn(); if (!c) return { on: false, error: null, rows: [] };
  try {
    const list = await fetchDrops(c, from, to, res.map((r) => r.token).filter(Boolean) as string[]);
    const m = matchDrops(res, list);
    const byDrop = new Map<string, (typeof res)[number]>();
    for (const r of res) if (m[r.id]) byDrop.set(m[r.id].id, r);
    const rows: CnReportRow[] = list.map(({ raw, drop }) => {
      const r = byDrop.get(drop.id);
      let why: string | null = null;
      if (!r) {
        const k = cnRoomKanji(raw.room_number);
        if (raw.reservation_token) why = "合言葉に合う予約がありません（期間外・キャンセル）";
        else if (!k) why = `お部屋「${raw.room_number}」がわかりません`;
        else why = `${raw.transfer_date} にチェックアウトする「${k}」の予約がありません`;
      }
      const linked = r ? m[r.id] : drop;
      return { drop: linked, roomName: String(raw.room_number ?? ""), createdAt: raw.created_at ?? null, hasToken: !!raw.reservation_token,
        res: r ? { id: r.id, guest: r.guest, room: r.room, checkIn: r.checkIn, checkOut: r.checkOut } : null, why };
    }).sort((a, b) => String(b.drop.date).localeCompare(String(a.drop.date)));
    return { on: true, error: null, rows };
  } catch (e) { return { on: true, error: String((e as Error)?.message || e), rows: [] }; }
}

/**
 * 送迎予約 (dropId) のゲストのパスポート写真 (代表者が先)。5 分だけ見られるリンクにして返す。
 *   写真は Crane Nest のシステムの Storage (passport-photos)。ページには埋め込まず、ボタンを押したときだけ読む。
 */
export async function craneNestPassportPhotos(dropId: string): Promise<{ on: boolean; photos: { name: string; url: string }[] }> {
  const c = cn(); if (!c) return { on: false, photos: [] };
  if (!/^[0-9a-f-]{36}$/i.test(dropId)) return { on: true, photos: [] };
  const [tq, lq] = await Promise.all([
    c.from("transfer_requests").select("id, guest_id").eq("id", dropId).maybeSingle(),
    c.from("transfer_request_guests").select("guest_id, is_primary").eq("transfer_request_id", dropId),
  ]);
  if (!(tq as any).data) return { on: true, photos: [] };
  const links = (((lq as any).error ? [] : (lq as any).data) ?? []) as any[];
  links.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const ids = [...new Set([(tq as any).data.guest_id, ...links.map((l) => l.guest_id)].filter(Boolean))] as string[];
  if (!ids.length) return { on: true, photos: [] };
  const { data: gs } = await c.from("guests").select("id, full_name, passport_image_url").in("id", ids);
  const byId = new Map<string, any>(((gs ?? []) as any[]).map((g) => [g.id, g]));
  const photos: { name: string; url: string }[] = [];
  for (const id of ids) {
    const g = byId.get(id); const raw = String(g?.passport_image_url || ""); if (!raw) continue;
    // 公開 URL / パスのどちらでも: passport-photos の中のパスを取り出して、期限つきのリンクにする
    const m = raw.match(/\/passport-photos\/([^?#]+)/); const path = m ? decodeURIComponent(m[1]) : /^https?:/.test(raw) ? null : raw.replace(/^\/+/, "");
    let url: string | null = null;
    if (path) { const s = await c.storage.from("passport-photos").createSignedUrl(path, 300); url = s.data?.signedUrl ?? null; }
    if (!url && /^https?:/.test(raw)) url = raw;
    if (url) photos.push({ name: String(g.full_name || ""), url });
  }
  return { on: true, photos };
}
