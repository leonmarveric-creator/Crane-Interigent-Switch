import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import CraneNestGuests from "@/components/staff/CraneNestGuests";

export const dynamic = "force-dynamic";

/** 確認用: Crane Nest のシステムの登録ゲストと、こちらの予約との紐づけ (スタッフ画面から) */
export default async function GuestsPage({ searchParams }: { searchParams: { days?: string; lang?: string } }) {
  if (!isStaff()) redirect("/staff/login");
  return <CraneNestGuests days={searchParams.days} lang={searchParams.lang === "zh" ? "zh" : "ja"} base="/staff/guests" backHref="/staff" />;
}
