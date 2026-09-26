/**
 * 飛行機の運航状況 (AeroDataBox / RapidAPI)。サーバ専用。
 *   環境変数 AERODATABOX_KEY (RapidAPI のキー) が無ければ使わない (「地図で見る」リンクだけ)。
 *   1 回の確認 = 1 回分。月の回数は driver_flight_usage に記録する。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { summarizeFlight, monthKey, jstDay, type FlightInfo } from "@/lib/driverLogic";

export const flightConfigured = () => !!process.env.AERODATABOX_KEY;

/** 便名を AA123 の形に (空白・ハイフンを取って大文字) */
export const normFlightNo = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function fetchFlight(flightNo: string, arrivalIso: string): Promise<{ ok: boolean; info?: FlightInfo | null; error?: string }> {
  const key = process.env.AERODATABOX_KEY;
  if (!key) return { ok: false, error: "NOT_CONFIGURED" };
  const no = normFlightNo(flightNo);
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(no)) return { ok: false, error: "BAD_FLIGHT" };
  // 出発日で探すので、到着日と前日の 2 日を順に試す (夜行便対策)。回数は 1 回ずつ数える
  const day = jstDay(arrivalIso);
  const days = [day, new Date(new Date(`${day}T00:00:00Z`).getTime() - 86400e3).toISOString().slice(0, 10)];
  for (const d of days) {
    await countUse();
    try {
      const r = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${no}/${d}?withAircraftImage=false&withLocation=false`, {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" }, cache: "no-store",
      });
      if (r.status === 204 || r.status === 404) continue;
      if (!r.ok) return { ok: false, error: `HTTP_${r.status}` };
      const info = summarizeFlight(await r.json());
      if (info) return { ok: true, info };
    } catch { return { ok: false, error: "NETWORK" }; }
  }
  return { ok: true, info: null };
}

async function countUse() {
  const m = monthKey(Date.now());
  try {
    const { data } = await supabaseAdmin.from("driver_flight_usage").select("used").eq("month", m).maybeSingle();
    await supabaseAdmin.from("driver_flight_usage").upsert({ month: m, used: Number(data?.used ?? 0) + 1 });
  } catch { /* 表がなければ数えない */ }
}
