/**
 * お父さんの送迎画面 (/driver) の計算ロジック (画面とサーバ共通・副作用なし)。
 *   ※ テストから直接読み込むので、このファイルは相対 import をしない。
 */

export type Lang4 = "ja" | "en" | "zh" | "ko";

export interface DRoom {
  id: string; slug: string; name: string; building: string;
  hasLock: boolean; hasAc: boolean; hasLight: boolean; hasWafu: boolean; hasGalaxy: boolean;
  lat: number | null; lng: number | null;
}
export interface FlightInfo {
  status: string;               // Expected / EnRoute / Delayed / Landed / Arrived / Canceled / Unknown
  from?: string | null; to?: string | null;
  scheduled?: string | null;    // 到着予定 (ISO)
  expected?: string | null;     // 見込み (ISO)
  actual?: string | null;       // 着陸 (ISO)
  terminal?: string | null; gate?: string | null;
  delayMin?: number | null;
}
export interface DRes {
  id: string; roomId: string; guest: string | null; lang: Lang4;
  checkIn: string; checkOut: string; pin: string | null;
  pickupPlace: string | null; pickupAt: string | null; pickupNone: boolean;
  flightNo: string | null; flightInfo: FlightInfo | null; flightCheckedAt: string | null;
  preparedAt: string | null;
}

const JST = 9 * 3600e3;
const ms = (iso: string) => new Date(iso).getTime();
export const jstDay = (t: string | number) => new Date((typeof t === "number" ? t : ms(t)) + JST).toISOString().slice(0, 10);
export const jstTime = (t: string | number) => new Date((typeof t === "number" ? t : ms(t)) + JST).toISOString().slice(11, 16);
export const addDays = (day: string, n: number) => new Date(ms(`${day}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
export const monthKey = (nowMs: number) => jstDay(nowMs).slice(0, 7);

/** 予約の言語を 4 言語にそろえる (zh-TW などは zh) */
export function langOf(v: string | null | undefined): Lang4 {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("zh")) return "zh";
  if (s.startsWith("ko")) return "ko";
  if (s.startsWith("ja")) return "ja";
  return "en";
}

/** 部屋の色 (季節の部屋・松竹梅など) */
export function roomColor(slug: string): string {
  const s = slug.toLowerCase();
  if (/haru|spring/.test(s)) return "#ff8fb3";
  if (/natsu|natu|summer/.test(s)) return "#5fe3ff";
  if (/aki|autumn/.test(s)) return "#ffa24a";
  if (/fuyu|winter/.test(s)) return "#a9c8ff";
  if (/matsu/.test(s)) return "#e2c25a";
  if (/take/.test(s)) return "#7fd67f";
  if (/ume/.test(s)) return "#ff7a9c";
  if (/hayashi/.test(s)) return "#9ad85c";
  return "#c49bff";
}

/** 空港からのお迎えか (お迎え場所に空港の名前・便名あり) */
export function isAirportPickup(r: DRes | null | undefined): boolean {
  if (!r) return false;
  return !!r.flightNo || /空港|airport|機場|机场|공항|KIX|ITM|関空/i.test(r.pickupPlace || "");
}
/** 「おもてなし開始」の声: 空港からなら B (Welcome to Japan)、それ以外は A と C を交互に */
export function aboardVoice(r: DRes | null | undefined, turn: number): "aboard-a" | "aboard-b" | "aboard-c" {
  if (isAirportPickup(r)) return "aboard-b";
  return turn % 2 === 0 ? "aboard-a" : "aboard-c";
}

/** 迎えに行く目安の時刻 (お迎え時刻 → なければチェックイン) */
export const pickupBase = (r: DRes) => r.pickupAt || r.checkIn;

export interface Board {
  arrivals: DRes[];     // 今日チェックイン (お迎え)
  departures: DRes[];   // 今日チェックアウト (お見送り)
  staying: DRes[];      // 滞在中 (今日の出入りなし)
}
/** 今日の送迎 (日本時間の今日) */
export function todayBoard(res: DRes[], nowMs: number): Board {
  const today = jstDay(nowMs);
  const arrivals = res.filter((r) => jstDay(r.checkIn) === today).sort((a, b) => ms(pickupBase(a)) - ms(pickupBase(b)));
  const departures = res.filter((r) => jstDay(r.checkOut) === today).sort((a, b) => ms(a.checkOut) - ms(b.checkOut));
  const staying = res.filter((r) => ms(r.checkIn) <= nowMs && ms(r.checkOut) > nowMs && jstDay(r.checkIn) !== today && jstDay(r.checkOut) !== today);
  return { arrivals, departures, staying };
}

/** これからの送迎 (明日〜days 日後のお迎え) */
export function upcomingArrivals(res: DRes[], nowMs: number, days = 3): DRes[] {
  const today = jstDay(nowMs), last = addDays(today, days);
  return res.filter((r) => { const d = jstDay(r.checkIn); return d > today && d <= last; }).sort((a, b) => ms(pickupBase(a)) - ms(pickupBase(b)));
}

/** 次に対応する部屋 (まだ準備していない今日のお迎え → なければ最初のお迎え) */
export function nextArrival(b: Board): DRes | null {
  return b.arrivals.find((r) => !r.preparedAt) ?? b.arrivals[0] ?? null;
}

/** 自動準備をする時刻 */
export const autoPrepAt = (r: DRes, minutes: number) => ms(pickupBase(r)) - minutes * 60e3;

/** 自動準備の対象か (今日のお迎え・未準備・準備時刻を過ぎた・まだチェックアウト前・送迎なしでも部屋は準備する) */
export function prepDue(r: DRes, nowMs: number, minutes: number): boolean {
  if (r.preparedAt) return false;
  if (jstDay(r.checkIn) !== jstDay(nowMs)) return false;
  return nowMs >= autoPrepAt(r, minutes) && nowMs < ms(r.checkOut);
}

/* ---------------- 鍵の電池 ---------------- */
export const BATTERY_REPLACE_AT = 30;   // これを下回ったら交換 (記録が少ないうち)
export const BATTERY_MIN_AT_OUT = 20;   // チェックアウト時にこれを下回りそうなら交換
export const BATTERY_IDLE_DAYS = 60;    // 空き部屋は 2 か月に 1 回
export const BATTERY_LEAD_DAYS = 3;     // チェックインの 3 日前に確認

/** 1 日あたりの減り方 (%/日)。交換 (大きく増えた) より後の記録だけで計算。2 件未満なら null */
export function batteryDrainPerDay(logs: { battery: number | null; checked_at: string }[]): number | null {
  const L = logs.filter((l) => typeof l.battery === "number").sort((a, b) => ms(a.checked_at) - ms(b.checked_at));
  let start = 0;
  for (let i = 1; i < L.length; i++) if ((L[i].battery as number) > (L[i - 1].battery as number) + 10) start = i; // 電池交換
  const S = L.slice(start);
  if (S.length < 2) return null;
  const days = (ms(S[S.length - 1].checked_at) - ms(S[0].checked_at)) / 86400e3;
  if (days < 3) return null;
  return Math.max(0, ((S[0].battery as number) - (S[S.length - 1].battery as number)) / days);
}

/** 交換が必要か (チェックアウトの日まで持つか) */
export function batteryVerdict(battery: number, logs: { battery: number | null; checked_at: string }[], nowMs: number, untilMs: number): { replace: boolean; predicted: number | null } {
  const rate = batteryDrainPerDay(logs);
  if (rate == null) return { replace: battery < BATTERY_REPLACE_AT, predicted: null };
  const predicted = Math.round(battery - rate * Math.max(0, (untilMs - nowMs) / 86400e3));
  return { replace: predicted < BATTERY_MIN_AT_OUT || battery < BATTERY_MIN_AT_OUT, predicted };
}

/** 今日電池を確認する部屋 (チェックイン 3 日前 / 空き部屋で 60 日確認していない) */
export function batteryTargets(rooms: DRoom[], res: DRes[], lastCheck: Record<string, string | undefined>, nowMs: number): { roomId: string; reason: "checkin" | "idle"; res?: DRes }[] {
  const day = addDays(jstDay(nowMs), BATTERY_LEAD_DAYS);
  const out: { roomId: string; reason: "checkin" | "idle"; res?: DRes }[] = [];
  for (const room of rooms) {
    if (!room.hasLock) continue;
    const r = res.find((x) => x.roomId === room.id && jstDay(x.checkIn) === day);
    const last = lastCheck[room.id];
    if (r) {
      // 前回の確認から 5 日以内なら (連続した予約など) 省く
      if (!last || nowMs - ms(last) > 5 * 86400e3) out.push({ roomId: room.id, reason: "checkin", res: r });
      continue;
    }
    const busySoon = res.some((x) => x.roomId === room.id && ms(x.checkOut) > nowMs && ms(x.checkIn) < nowMs + (BATTERY_LEAD_DAYS + 1) * 86400e3);
    if (!busySoon && (!last || nowMs - ms(last) > BATTERY_IDLE_DAYS * 86400e3)) out.push({ roomId: room.id, reason: "idle" });
  }
  return out;
}

/* ---------------- 歌詞 (LRC) ---------------- */
export interface LrcLine { t: number; s: string }
export function parseLrc(text: string | null | undefined): LrcLine[] {
  const out: LrcLine[] = [];
  let offset = 0; // [offset:+500] (ミリ秒。+ で歌詞を早める)
  const off = /\[offset:\s*([+-]?\d+)\s*\]/i.exec(String(text || ""));
  if (off) offset = Number(off[1]) / 1000;
  for (const line of String(text || "").replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    // [mm:ss] [mm:ss.xx] [mm:ss.xxx] [mm:ss:xx] [m:ss,xx] (分は 3 桁まで)
    const tags = [...line.matchAll(/\[\s*(\d{1,3}):(\d{1,2})(?:[.:,](\d{1,3}))?\s*\]/g)];
    const w = line.replace(/\[[^\]]*\]/g, "").replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "").trim(); // 1 語ごとの <mm:ss.xx> は外す
    for (const m of tags) {
      const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0;
      out.push({ t: Math.max(0, +(+m[1] * 60 + +m[2] + frac - offset).toFixed(3)), s: w });
    }
  }
  return out.filter((x) => x.s).sort((a, b) => a.t - b.t);
}
/** LRC ファイルの文字コードを判定して読む (UTF-8 / UTF-16 / 中国語 GBK / 日本語 Shift_JIS / 韓国語 EUC-KR) */
export function decodeLrcBytes(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dec = (enc: string, fatal = false) => new TextDecoder(enc, { fatal }).decode(b);
  if (b[0] === 0xff && b[1] === 0xfe) return dec("utf-16le");
  if (b[0] === 0xfe && b[1] === 0xff) return dec("utf-16be");
  // BOM なし UTF-16 (1 バイトおきに 0)
  const zeros = (start: number) => { let z = 0, n = 0; for (let i = start; i < Math.min(b.length, 400); i += 2) { n++; if (b[i] === 0) z++; } return n ? z / n : 0; };
  if (zeros(1) > 0.4) return dec("utf-16le");
  if (zeros(0) > 0.4) return dec("utf-16be");
  try { return dec("utf-8", true); } catch { /* UTF-8 ではない */ }
  const score = (s: string) => (s.match(/\uFFFD/g) || []).length;
  let best = "", bestScore = Infinity;
  for (const enc of ["gb18030", "shift_jis", "euc-kr", "big5"]) {
    try { const s = dec(enc); const sc = score(s); if (sc < bestScore) { best = s; bestScore = sc; } } catch { /* 未対応 */ }
  }
  return best || dec("utf-8");
}
export const lrcTag = (t: number) => `[${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}]`;
export const toLrc = (L: LrcLine[]) => L.slice().sort((a, b) => a.t - b.t).map((l) => `${lrcTag(l.t)}${l.s}`).join("\n");
/** 今の行 (なければ -1) */
export function lyricIndex(L: LrcLine[], sec: number): number {
  let n = -1;
  for (let i = 0; i < L.length; i++) if (sec + 0.05 >= L[i].t) n = i;
  return n;
}

/* ---------------- 飛行機 (AeroDataBox の結果をまとめる) ---------------- */
export function summarizeFlight(list: any[]): FlightInfo | null {
  if (!Array.isArray(list) || !list.length) return null;
  // 日本着 (KIX/ITM/NRT/HND/NGO/FUK…) を優先。なければ最後の区間
  const f = list.find((x) => /^(KIX|ITM|UKB|NRT|HND|NGO|FUK|CTS|OKA)$/.test(x?.arrival?.airport?.iata ?? "")) ?? list[list.length - 1];
  const a = f?.arrival ?? {}, d = f?.departure ?? {};
  const t = (x: any) => x?.utc ? new Date(String(x.utc).replace(" ", "T").replace(/Z?$/, "Z")).toISOString() : null;
  const scheduled = t(a.scheduledTime), expected = t(a.revisedTime) ?? t(a.predictedTime), actual = t(a.runwayTime) ?? (f?.status === "Arrived" ? expected : null);
  const delay = scheduled && (expected || actual) ? Math.round((ms((actual || expected) as string) - ms(scheduled)) / 60000) : null;
  return {
    status: String(f?.status || "Unknown"),
    from: d?.airport?.iata ?? d?.airport?.name ?? null, to: a?.airport?.iata ?? a?.airport?.name ?? null,
    scheduled, expected, actual, terminal: a?.terminal ?? null, gate: a?.gate ?? null,
    delayMin: delay,
  };
}
/** 5 分以内に確認していれば、前回の結果を使う */
export const FLIGHT_REUSE_MS = 5 * 60e3;
export const FLIGHT_MONTHLY_FREE = 400;
