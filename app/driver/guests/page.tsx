import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import CraneNestGuests from "@/components/staff/CraneNestGuests";

export const dynamic = "force-dynamic";

/** 確認用: Crane Nest のシステムの登録ゲストと、こちらの予約との紐づけ (お父さんの画面から。はじめは中文) */
export default async function DriverGuestsPage({ searchParams }: { searchParams: { days?: string; lang?: string } }) {
  if (!isStaff()) redirect("/staff/login?next=/driver");
  return (
    <div className="min-h-dvh bg-[#f6efe2] text-[#3b3228] [color-scheme:light]">
      <CraneNestGuests days={searchParams.days} lang={searchParams.lang === "ja" ? "ja" : "zh"} base="/driver/guests" backHref="/driver" />
    </div>
  );
}
