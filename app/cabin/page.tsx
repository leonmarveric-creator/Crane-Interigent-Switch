import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toCabinRoom } from "@/lib/cabinData";
import CabinApp from "@/components/cabin/CabinApp";

export const dynamic = "force-dynamic";

/** 車内 iPad (お客さん用の画面)。ログインはスタッフ画面と共通 (60 日間そのまま) */
export default async function CabinPage() {
  if (!isStaff()) redirect("/staff/login?next=/cabin");
  const { data } = await supabaseAdmin.from("rooms").select("*").eq("is_active", true).order("building").order("slug");
  const rooms = ((data ?? []) as any[]).map((r) => toCabinRoom(r));
  // 同じ棟のエントランス (⚙ の「エントランスの鍵の QR」用。スマートキーの SQL が未実行でも落ちないように)
  try {
    const { data: ents } = await supabaseAdmin.from("entrances").select("slug, building").eq("is_active", true).order("slug");
    for (const r of rooms) r.entrance = ((ents ?? []) as any[]).find((e) => (e.building || "Crane Nest") === r.building)?.slug ?? null;
  } catch { /* ignore */ }
  return <CabinApp rooms={rooms} />;
}
