import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import { loadDriverData } from "@/lib/driverData";
import { jstDay, jstTime } from "@/lib/driverLogic";
import KakuApp from "@/components/kaku/KakuApp";
import type { KakuCabinInfo } from "@/components/kaku/kakuEngine";

export const dynamic = "force-dynamic";

/** Kaku さん専用のミッション画面 (ログインはスタッフ画面と共通)。今日の到着・出発の予約と車内 iPad も渡す */
export default async function KakuPage() {
  if (!isStaff()) redirect("/staff/login?next=/kaku");
  let cabin: KakuCabinInfo = { devices: [], rooms: [], res: [], missing: true };
  try {
    const d = await loadDriverData();
    const today = jstDay(Date.now());
    cabin = {
      missing: d.cabin.missing,
      devices: d.cabin.devices.map((x) => ({ id: x.id, name: x.name })),
      rooms: d.rooms.map((r) => ({ id: r.id, name: r.name })),
      res: d.res.filter((r) => jstDay(r.checkIn) === today || jstDay(r.checkOut) === today).map((r) => ({
        id: r.id, guest: r.guest, roomId: r.roomId, lang: r.lang, arrive: jstDay(r.checkIn) === today,
        pickupPlace: r.pickupPlace, pickupAt: r.pickupAt ? jstTime(r.pickupAt) : null, terminal: r.flightInfo?.terminal ?? null, flightNo: r.flightNo,
      })),
    };
  } catch { /* 予約が読めなくても使える */ }
  return <KakuApp cabin={cabin} />;
}
