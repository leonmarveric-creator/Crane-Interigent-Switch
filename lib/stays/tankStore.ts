// =========================================================
// し尿タンク — サーバサイドのデータアクセス層（サーバ専用）※ Switch版
//
//   ★ 方式: 「予約リストから自動計算（ハイブリッド）」
//     現在水量は 2つの予約ソースを統合して毎回再計算する:
//       1) 自社/手動予約 … public.reservations の source='manual'
//            （Switch本体の予約テーブル。人数列が無いため既定人数で計算）
//       2) Airbnb予約   … stays_ext_reservations（予約メール解析の取り込み結果。人数付き）
//     いずれも「泊まった夜」に展開し、前回汲み取り日〜今日より前の“過ぎた夜”のみ加算。
//     → キャンセルは再計算で自然に消え、未来の予約は現在値を膨らませない。
//
//     ※ source='ical' の予約は Airbnb と二重計上になるためタンク計算から除外する
//        （iCalは施錠/アラーム制御用として lib/syncIcal.ts が従来どおり利用）。
//        Airbnbの人数は Gmail 取り込み（stays_ext_reservations）側で検知する。
//
//   stays_tank_logs は「スタッフの手動補正(override)」専用。指定日だけ自動値を上書き。
//
//   DBアクセスは Switch の方針に合わせ service_role (supabaseAdmin) で行う。
//   SUPABASE_URL 未設定時はインメモリ・モックへ自動フォールバックする。
//   ※ このファイルは API Route からのみ import すること（クライアントには載せない）。
// =========================================================
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DailyLog,
  ReservationLite,
  TankState,
  TANK_DEFAULTS,
  mergeNightly,
  nightlyGuests,
  sumLiters,
} from "./tank";
import type { ParsedReservation } from "./airbnbEmail";

const TANK_ID = 1; // シングルトン（自社ゲストハウス1棟）

// 便槽の「今日」「過ぎた夜」は日本時間(JST=UTC+9)基準で判定する。
// （サーバはUTCで動くため、そのままだと日本の夜遅くに日付が1日ずれる）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function today(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return new Date(Date.now() + JST_OFFSET_MS - n * 86400000).toISOString().slice(0, 10);
}
// timestamptz(ISO) → JSTの日付(YYYY-MM-DD)。予約は check_in/out が timestamptz のため変換する。
function toJstDate(ts: string): string {
  return new Date(new Date(ts).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// supabaseAdmin が本番設定済みか（service_role）。
function supabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// 人数列を持たない自社/手動予約に充てる既定人数（安全側の想定値）。
// Airbnbメールで人数が取れなかった予約にも同じ既定を使う。
function defaultGuests(): number {
  const n = Number(process.env.TANK_DEFAULT_GUESTS ?? process.env.AIRBNB_DEFAULT_GUESTS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

// 外部予約(ParsedReservation相当) → ReservationLite。日付が無ければ計算不能なので除外。
function extToLite(ext: {
  guests: number | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
}): ReservationLite | null {
  if (!ext.check_in || !ext.check_out) return null;
  return {
    check_in: ext.check_in,
    check_out: ext.check_out,
    guests: ext.guests == null ? defaultGuests() : ext.guests,
    status: ext.status,
  };
}

// ---------------------------------------------------------
// インメモリ・モック（Supabase未設定時のデモ用）
// ---------------------------------------------------------
interface MockExt {
  source: string;
  code: string;
  guests: number | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  email_id?: string;
  raw_subject?: string;
}
interface MockDB {
  capacityLiters: number;
  litersPerGuestPerDay: number;
  lastEmptiedDate: string;
  alerted: boolean;
  updatedAt: string;
  bookings: ReservationLite[]; // 自社/手動予約(source='manual'相当)
  ext: MockExt[]; // Airbnb等の外部予約
  overrides: Record<string, number>;
}
function seedMock(): MockDB {
  return {
    capacityLiters: TANK_DEFAULTS.capacityLiters,
    litersPerGuestPerDay: TANK_DEFAULTS.litersPerGuestPerDay,
    lastEmptiedDate: daysAgo(6),
    alerted: false,
    updatedAt: new Date().toISOString(),
    // 自社/手動予約（public.reservations source='manual' 相当。人数は既定値で計算）
    bookings: [
      { check_in: daysAgo(5), check_out: daysAgo(3), guests: defaultGuests(), status: "completed" },
      { check_in: daysAgo(2), check_out: daysAgo(1), guests: defaultGuests(), status: "active" },
      { check_in: daysAgo(3), check_out: daysAgo(1), guests: 6, status: "cancelled" }, // 除外
    ],
    // Airbnb予約（メール取り込み相当。人数はメールから検知）
    ext: [
      { source: "airbnb", code: "HMDEMO0001", guests: 3, check_in: daysAgo(4), check_out: daysAgo(2), status: "confirmed" },
      { source: "airbnb", code: "HMDEMO0002", guests: 2, check_in: daysAgo(2), check_out: daysAgo(1), status: "cancelled" }, // 除外
      { source: "airbnb", code: "HMDEMO0003", guests: 4, check_in: daysAgo(-1), check_out: daysAgo(-3), status: "confirmed" }, // 未来
    ],
    overrides: {},
  };
}
const g = globalThis as unknown as { __tankMockDB?: MockDB };
function mock(): MockDB {
  if (!g.__tankMockDB) g.__tankMockDB = seedMock();
  return g.__tankMockDB;
}

// ---------------------------------------------------------
// 2ソースを統合した予約リストを取得（check_out > sinceDate のもの）
// ---------------------------------------------------------
async function getReservations(sinceDate: string): Promise<ReservationLite[]> {
  if (!supabaseConfigured()) {
    const m = mock();
    const own = m.bookings.filter((b) => b.check_out > sinceDate);
    const ext = m.ext
      .map(extToLite)
      .filter((r): r is ReservationLite => !!r && r.check_out > sinceDate);
    return [...own, ...ext];
  }

  const out: ReservationLite[] = [];
  const sinceIso = new Date(sinceDate + "T00:00:00Z").toISOString();
  try {
    // 自社/手動予約のみ（iCalはAirbnb取り込みと二重計上になるため除外）。
    // check_in/out は timestamptz → JSTの日付へ変換して夜次展開に渡す。
    const { data: own } = await supabaseAdmin
      .from("reservations")
      .select("check_in, check_out, status, source")
      .eq("source", "manual")
      .gt("check_out", sinceIso);
    for (const r of (own as any[]) || []) {
      out.push({
        check_in: toJstDate(r.check_in),
        check_out: toJstDate(r.check_out),
        guests: defaultGuests(),
        status: r.status,
      });
    }
  } catch {
    /* noop */
  }
  try {
    const { data: ext } = await supabaseAdmin
      .from("stays_ext_reservations")
      .select("check_in, check_out, guests, status")
      .gt("check_out", sinceDate);
    for (const r of (ext as any[]) || []) {
      const lite = extToLite(r);
      if (lite) out.push(lite);
    }
  } catch {
    /* noop */
  }
  return out;
}

// state メタ（容量・前回汲み取り日・通知フラグ）取得
async function getMeta() {
  if (!supabaseConfigured()) {
    const m = mock();
    return {
      capacityLiters: m.capacityLiters,
      litersPerGuestPerDay: m.litersPerGuestPerDay,
      lastEmptiedDate: m.lastEmptiedDate,
      alerted: m.alerted,
      updatedAt: m.updatedAt,
    };
  }
  try {
    const { data: state } = await supabaseAdmin
      .from("stays_tank_state")
      .select("*")
      .eq("id", TANK_ID)
      .maybeSingle();
    return {
      capacityLiters: Number((state as any)?.capacity_liters ?? TANK_DEFAULTS.capacityLiters),
      litersPerGuestPerDay: Number((state as any)?.liters_per_guest ?? TANK_DEFAULTS.litersPerGuestPerDay),
      lastEmptiedDate: (state as any)?.last_emptied_date ?? today(),
      alerted: !!(state as any)?.alerted,
      updatedAt: (state as any)?.updated_at ?? new Date().toISOString(),
    };
  } catch {
    return {
      capacityLiters: TANK_DEFAULTS.capacityLiters,
      litersPerGuestPerDay: TANK_DEFAULTS.litersPerGuestPerDay,
      lastEmptiedDate: today(),
      alerted: false,
      updatedAt: new Date().toISOString(),
    };
  }
}

// 手動補正(override)取得
async function getOverrides(sinceDate: string): Promise<Record<string, number>> {
  if (!supabaseConfigured()) return { ...mock().overrides };
  try {
    const { data } = await supabaseAdmin
      .from("stays_tank_logs")
      .select("date, guests")
      .gte("date", sinceDate);
    const ov: Record<string, number> = {};
    for (const o of (data as any[]) || []) ov[o.date] = Number(o.guests);
    return ov;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------
// 公開API：状態の取得（純粋な再計算・副作用なし）
// ---------------------------------------------------------
export async function getTankState(): Promise<TankState> {
  const meta = await getMeta();
  const t = today();
  const reservations = await getReservations(meta.lastEmptiedDate);

  // 過去の夜のみ: [前回汲み取り日, 今日)
  const auto = nightlyGuests(reservations, meta.lastEmptiedDate, t);

  const overridesAll = await getOverrides(meta.lastEmptiedDate);
  const overrides: Record<string, number> = {};
  for (const [date, guests] of Object.entries(overridesAll)) {
    if (date >= meta.lastEmptiedDate && date < t) overrides[date] = guests;
  }

  const logs: DailyLog[] = mergeNightly(auto, overrides, meta.litersPerGuestPerDay);
  return {
    capacityLiters: meta.capacityLiters,
    litersPerGuestPerDay: meta.litersPerGuestPerDay,
    currentLiters: sumLiters(logs),
    lastEmptiedDate: meta.lastEmptiedDate,
    logs,
    alerted: meta.alerted,
    updatedAt: meta.updatedAt,
  };
}

// ---------------------------------------------------------
// 公開API：今後の予約からの1日あたり平均人数（予測日数の基礎値）
// ---------------------------------------------------------
export async function upcomingDailyGuests(window = 14): Promise<number> {
  const t = today();
  const to = new Date();
  to.setDate(to.getDate() + window);
  const toStr = to.toISOString().slice(0, 10);

  const reservations = await getReservations(t);
  const nights = nightlyGuests(reservations, t, toStr);
  const total = Object.values(nights).reduce((a, b) => a + b, 0);
  return total / window; // 予約が無い夜は0として平均に反映
}

// ---------------------------------------------------------
// 公開API：Airbnb等の外部予約を1件 upsert（sync / ingest から呼ぶ）
//   source + code をキーに、確定→キャンセルの更新を追跡する。
// ---------------------------------------------------------
export async function upsertExternalReservation(
  parsed: ParsedReservation,
  emailId?: string
): Promise<void> {
  if (!supabaseConfigured()) {
    const m = mock();
    const idx = m.ext.findIndex((e) => e.source === parsed.source && e.code === parsed.code);
    const row: MockExt = {
      source: parsed.source,
      code: parsed.code,
      guests: parsed.guests,
      check_in: parsed.checkIn,
      check_out: parsed.checkOut,
      status: parsed.status,
      email_id: emailId,
    };
    // キャンセルは日付が無くても既存の日付を保持したい
    if (idx >= 0) {
      const prev = m.ext[idx];
      m.ext[idx] = {
        ...prev,
        ...row,
        check_in: row.check_in ?? prev.check_in,
        check_out: row.check_out ?? prev.check_out,
        guests: row.guests ?? prev.guests,
      };
    } else {
      m.ext.push(row);
    }
    m.updatedAt = new Date().toISOString();
    return;
  }
  try {
    // 既存を取得して、キャンセルメールで日付が欠けても上書きしないようにする
    const { data: prev } = await supabaseAdmin
      .from("stays_ext_reservations")
      .select("guests, check_in, check_out")
      .eq("source", parsed.source)
      .eq("code", parsed.code)
      .maybeSingle();
    await supabaseAdmin.from("stays_ext_reservations").upsert(
      {
        source: parsed.source,
        code: parsed.code,
        guests: parsed.guests ?? (prev as any)?.guests ?? null,
        check_in: parsed.checkIn ?? (prev as any)?.check_in ?? null,
        check_out: parsed.checkOut ?? (prev as any)?.check_out ?? null,
        status: parsed.status,
        email_id: emailId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source,code" }
    );
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------
// 公開API：手動補正(override)の設定 / 解除
// ---------------------------------------------------------
export async function setOverride(date: string, guests: number | null): Promise<TankState> {
  if (!supabaseConfigured()) {
    const m = mock();
    if (guests === null) delete m.overrides[date];
    else m.overrides[date] = Math.max(0, Math.floor(guests));
    m.updatedAt = new Date().toISOString();
    return getTankState();
  }
  try {
    if (guests === null) {
      await supabaseAdmin.from("stays_tank_logs").delete().eq("date", date);
    } else {
      const gg = Math.max(0, Math.floor(guests));
      await supabaseAdmin
        .from("stays_tank_logs")
        .upsert({ date, guests: gg, liters: gg * TANK_DEFAULTS.litersPerGuestPerDay }, { onConflict: "date" });
    }
    await supabaseAdmin
      .from("stays_tank_state")
      .upsert({ id: TANK_ID, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {
    /* noop */
  }
  return getTankState();
}

// ---------------------------------------------------------
// 公開API：警告通知フラグの記録（多重通知の抑制用）
// ---------------------------------------------------------
export async function setAlerted(alerted: boolean): Promise<void> {
  if (!supabaseConfigured()) {
    mock().alerted = alerted;
    return;
  }
  try {
    await supabaseAdmin.from("stays_tank_state").upsert({ id: TANK_ID, alerted }, { onConflict: "id" });
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------
// 公開API：汲み取り完了（リセット）
// ---------------------------------------------------------
export async function resetTank(): Promise<TankState> {
  const t = today();
  if (!supabaseConfigured()) {
    const m = mock();
    m.lastEmptiedDate = t;
    m.alerted = false;
    m.overrides = {};
    m.updatedAt = new Date().toISOString();
    return getTankState();
  }
  try {
    await supabaseAdmin
      .from("stays_tank_state")
      .upsert(
        { id: TANK_ID, last_emptied_date: t, alerted: false, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    await supabaseAdmin.from("stays_tank_logs").delete().lt("date", t);
  } catch {
    /* noop */
  }
  return getTankState();
}
