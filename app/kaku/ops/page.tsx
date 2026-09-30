import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import { loadDriverData } from "@/lib/driverData";
import { jstDay, jstTime } from "@/lib/driverLogic";
import { placeFromText } from "@/lib/cabinGeo";
import KOpsApp, { type KOpsData } from "@/components/kops/KOpsApp";

export const dynamic = "force-dynamic";

/** 言語 → 地球に出す国 (パスポートの国籍が無いときの目安) */
const NAT: Record<string, string> = { zh: "CHN", ko: "KOR", ja: "JPN", en: "" };

/** K-OPS: AGENT KAKU の新しい画面 (iPad・iPhone 1 台で / スマホで操作して iPad に表示)。テーマは MISSION / HOLO を切り替え */
export default async function KOpsPage({ searchParams }: { searchParams?: { link?: string } }) {
  // スマホで iPad の QR を読んだとき: ログインのあとも同じ iPad につなげるように番号を残す
  const lk = searchParams?.link && /^\d{4}$/.test(searchParams.link) ? searchParams.link : null;
  if (!isStaff()) redirect(lk ? `/staff/login?next=${encodeURIComponent(`/kaku/ops?link=${lk}`)}` : "/staff/login?next=/kaku/ops");
  const data: KOpsData = { guests: [], devices: [], rooms: [], cabinMissing: true };
  try {
    const d = await loadDriverData();
    const today = jstDay(Date.now());
    const cabRoom = new Map(d.cabin.rooms.map((r) => [r.id, r]));
    data.cabinMissing = d.cabin.missing;
    data.devices = d.cabin.devices.map((x) => ({ id: x.id, name: x.name }));
    data.rooms = d.rooms.map((r) => ({ id: r.id, name: r.name, kanji: cabRoom.get(r.id)?.kanji ?? r.name.slice(0, 1) }));
    const nights = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400e3));
    data.guests = d.res
      .filter((r) => jstDay(r.checkIn) === today || jstDay(r.checkOut) === today || (jstDay(r.checkIn) < today && jstDay(r.checkOut) > today))
      .map((r) => {
        const arrive = jstDay(r.checkIn) === today, leave = jstDay(r.checkOut) === today;
        const drop = r.drop ?? null;
        const place = leave ? (drop?.dest ? placeFromText(drop.dest, drop.terminal) : null) : placeFromText(r.pickupPlace, r.flightInfo?.terminal ?? null);
        const flt = r.flightNo ? `FLT ${r.flightNo}` : "";
        const note = leave
          ? [drop?.dest, drop?.terminal ? `T${drop.terminal}` : "", drop?.departAt ? `${drop.departAt.slice(0, 5)} 出発希望` : "", drop?.flightAt ? `FLT ${jstTime(drop.flightAt)} 発` : ""].filter(Boolean).join(" · ")
          : [r.pickupPlace, r.pickupAt ? `${jstTime(r.pickupAt)} お迎え` : "", flt].filter(Boolean).join(" · ");
        return {
          id: r.id, name: drop?.names?.[0] || r.guest || "Guest", room: cabRoom.get(r.roomId)?.kanji ?? "", roomId: r.roomId, lang: r.lang,
          cat: (leave ? "out" : arrive ? "in" : "stay") as "out" | "in" | "stay",
          place: place && place !== "other" ? place : null,
          pax: drop?.pax ?? 0, L: drop?.large ?? 0, S: drop?.small ?? 0, sp: drop?.special ?? 0,
          nights: nights(r.checkIn, r.checkOut), reg: !!drop?.names?.length, dropId: drop?.id ?? null, note: note || "—", nat: NAT[r.lang] ?? "",
        };
      });
  } catch { /* 予約が読めなくても使える */ }
  return <KOpsApp data={data} />;
}
