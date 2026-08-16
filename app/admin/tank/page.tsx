// =========================================================
// 管理者専用：便槽（し尿タンク）モニタリング  /admin/tank
//   /admin 配下は middleware.ts で admin_session Cookie 保護済み。
//   計算・通知はサーバ側（/api/admin/tank/*）。この画面は表示と操作のみ。
// =========================================================
import Link from "next/link";
import GuesthouseTankDashboard from "@/components/admin/GuesthouseTankDashboard";

export const dynamic = "force-dynamic";

export default function AdminTankPage() {
  return (
    <main className="min-h-screen bg-[#070a12] px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-[#0b1020] px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:text-cyan-100"
          >
            ← 管理トップ
          </Link>
        </div>
        <GuesthouseTankDashboard />
      </div>
    </main>
  );
}
