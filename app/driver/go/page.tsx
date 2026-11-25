import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import { loadDriverData } from "@/lib/driverData";
import DriverApp from "@/components/driver/DriverApp";

export const dynamic = "force-dynamic";

/** お父さん専用「今日の送迎」(ボタンひとつ)。今日の分だけを出す。いつもの画面は /driver のまま */
export default async function DriverGoPage() {
  if (!isStaff()) redirect("/staff/login?next=/driver/go");
  const data = await loadDriverData();
  return <DriverApp data={data} now={Date.now()} simple />;
}
