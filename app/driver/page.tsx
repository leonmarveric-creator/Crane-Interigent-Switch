import { redirect } from "next/navigation";
import { isStaff } from "@/lib/staffAuth";
import { loadDriverData } from "@/lib/driverData";
import DriverApp from "@/components/driver/DriverApp";

export const dynamic = "force-dynamic";

/** お父さん専用の送迎画面 (ログインはスタッフ画面と共通)。 */
export default async function DriverPage() {
  if (!isStaff()) redirect("/staff/login?next=/driver");
  const data = await loadDriverData();
  return <DriverApp data={data} now={Date.now()} />;
}
