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
  return <CabinApp rooms={rooms} />;
}
