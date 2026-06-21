import ical from "node-ical";

export interface IcalEvent {
  uid: string;
  start: Date; // 日付(all-day)の場合あり
  end: Date;
  summary: string;
  description: string;
}

/**
 * Airbnb の iCal 説明文から電話番号の下4桁を抽出 (あれば)。
 * 例: "Phone Number (Last 4 Digits): 1234"
 * 取れた場合はそれをPINに使える (ゲストは自分の番号下4桁を入力するだけ)。
 */
export function extractPhoneLast4(description: string): string | null {
  const m = description.match(/Last\s*4\s*Digits\D*(\d{4})/i);
  return m ? m[1] : null;
}

/** 4桁ランダムPIN */
export function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/** Airbnb iCal 説明文から予約ページURLを抽出。 */
export function extractReservationUrl(description: string): string | null {
  const m = description.match(/https?:\/\/\S*reservations\/details\/\w+/i);
  return m ? m[0].replace(/\\+$/, "") : null;
}

/**
 * Airbnb の iCal URL から予約VEVENTを取得。
 * Airbnbは DATE値(終日)で来るため、チェックイン/アウトの時刻を後段で補正する。
 */
/**
 * Airbnbのブロック日(ホストが手動で閉じた / 他サイト連携で埋めた)を除外する。
 * 実予約は SUMMARY が "Reserved" 等。ブロックは "Airbnb (Not available)" /
 * "Not available" / "Blocked" 等で、説明欄に予約URLが無い。
 */
function isBlockedEvent(summary: string, description: string): boolean {
  const s = summary.toLowerCase();
  if (/not available|unavailable|blocked/.test(s)) {
    // 念のため: 予約URLを含む稀なケースは実予約として残す
    return !/\/reservations\/details\//i.test(description);
  }
  return false;
}

export async function fetchIcalEvents(url: string): Promise<IcalEvent[]> {
  const data = await ical.async.fromURL(url);
  const events: IcalEvent[] = [];
  for (const k of Object.keys(data)) {
    const v: any = data[k];
    if (v.type !== "VEVENT") continue;
    if (!v.uid || !v.start || !v.end) continue;
    const summary = String(v.summary ?? "");
    const description = String(v.description ?? "");
    if (isBlockedEvent(summary, description)) continue; // ブロック日はスキップ
    events.push({
      uid: String(v.uid),
      start: v.start as Date,
      end: v.end as Date,
      summary,
      description,
    });
  }
  return events;
}

/**
 * 終日DATEに民泊の慣習的な時刻を付与 (Asia/Tokyo, UTC+9)。
 *  check_in  : 当日 15:00 JST
 *  check_out : 当日 10:00 JST
 */
export function applyStayTimes(start: Date, end: Date) {
  const JST = 9 * 60; // minutes
  const atJst = (d: Date, h: number) => {
    // dのY/M/DをJST基準で取り、UTCへ変換
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    return new Date(Date.UTC(y, m, day, h - JST / 60, 0, 0));
  };
  return { checkIn: atJst(start, 15), checkOut: atJst(end, 10) };
}
