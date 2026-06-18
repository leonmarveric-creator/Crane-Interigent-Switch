import ical from "node-ical";

export interface IcalEvent {
  uid: string;
  start: Date; // 日付(all-day)の場合あり
  end: Date;
  summary: string;
}

/**
 * Airbnb の iCal URL から予約VEVENTを取得。
 * Airbnbは DATE値(終日)で来るため、チェックイン/アウトの時刻を後段で補正する。
 */
export async function fetchIcalEvents(url: string): Promise<IcalEvent[]> {
  const data = await ical.async.fromURL(url);
  const events: IcalEvent[] = [];
  for (const k of Object.keys(data)) {
    const v: any = data[k];
    if (v.type !== "VEVENT") continue;
    if (!v.uid || !v.start || !v.end) continue;
    events.push({
      uid: String(v.uid),
      start: v.start as Date,
      end: v.end as Date,
      summary: String(v.summary ?? ""),
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
