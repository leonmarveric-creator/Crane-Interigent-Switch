"use client";

// =========================================================
// 自社ゲストハウス専用：し尿タンク（便槽）モニタリング・ダッシュボード
//   ・稼働率（宿泊人数）に応じて累積水量を動的計算し、80%超過で通知（サーバ側）
//   ・多言語対応（既定=中国語 zh、管理画面の言語切替に追従：zh / ja / en）
//   ・アニメーション付き（水面のさざ波・ゲージ上昇・数値ポップ・警告パルス）
//   このコンポーネントは /api/admin/tank を叩くだけ（計算・通知はサーバ側）。
// =========================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Gauge,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Truck,
  Users,
  Waves,
} from "lucide-react";
import type { DailyLog, TankStatus } from "@/lib/stays/tank";
import { STATUS_META } from "@/lib/stays/tank";

// 管理画面の言語（Switch の adminI18n と同じ zh/ja/en）。
// AdminClient と同じ localStorage キー "adminLang" を参照して追従する。
type AdminLocale = "zh" | "ja" | "en";
const ADMIN_LOCALES: AdminLocale[] = ["ja", "en", "zh"];
function isAdminLocale(v: unknown): v is AdminLocale {
  return typeof v === "string" && (ADMIN_LOCALES as string[]).includes(v);
}

// APIレスポンスの型
interface TankSummary {
  pct: number;
  status: TankStatus;
  alertLine: number;
  remainingLiters: number;
  upcomingGuestsPerDay: number;
  forecastDays: number | null;
}
interface TankResponse {
  capacityLiters: number;
  litersPerGuestPerDay: number;
  currentLiters: number;
  lastEmptiedDate: string;
  logs: DailyLog[];
  alerted: boolean;
  updatedAt: string;
  summary: TankSummary;
  alertDispatched?: {
    wxpusher: { ok: boolean; skipped?: boolean; error?: string };
  } | null;
}

// ---------------- 多言語辞書（zh / ja / en） ----------------
interface TankDict {
  title: string;
  subtitle: (perGuest: number, alertLine: number) => string;
  sync: string;
  recalc: string;
  testAlert: string;
  updated: string;
  meterTitle: string;
  warn: string; // 「80% 警告」
  status: Record<TankStatus, { label: string; message: string }>;
  lastEmptied: string;
  today: string;
  remaining: string;
  toAlertLine: (l: number) => string;
  forecast: string;
  aboutDays: (n: number) => string;
  upcomingAvg: (n: number) => string;
  noUpcoming: string;
  overrideTitle: string;
  overrideHint: string;
  targetDate: string;
  overrideGuests: string;
  applyOverride: string;
  backToAuto: string;
  pumpTitle: string;
  pumpHint: string;
  pumpButton: string;
  logTitle: string;
  overrideBadge: string;
  guestsUnit: (n: number) => string;
  confirmTitle: string;
  confirmBody: (date: string) => string;
  cancel: string;
  doReset: string;
  loading: string;
  loadError: string;
  noData: string;
  t_recalcDone: string;
  t_syncNoGmail: string;
  t_syncDone: (f: number, p: number, c: number, x: number) => string;
  t_syncFail: string;
  t_overrideDone: (date: string, n: number) => string;
  t_overrideCleared: (date: string) => string;
  t_resetDone: string;
  t_invalidGuests: string;
  t_updateFail: string;
  t_alert: (p: string) => string;
  t_testAlert: (p: string) => string;
  t_testAlertFail: string;
  sent: string;
  unset: string;
  failed: string;
  wxpusherTitle: string;
  wxpusherSent: string;
  wxpusherReady: string;
  wxpusherWatching: string;
  actionLine: string;
  liveMeter: string;
  pumpCallout: string;
}

const TANK_I18N: Record<AdminLocale, TankDict> = {
  zh: {
    title: "粪池监测",
    subtitle: (p, a) =>
      `自有预订＋Airbnb（邮件导入）自动计算。已取消自动排除，仅按已过住宿夜 ${p}L/人 累加。达到80%（${a}L）自动通知。`,
    sync: "Airbnb同步",
    recalc: "重新计算",
    testAlert: "通知测试",
    updated: "更新",
    meterTitle: "水箱余量表",
    warn: "80% 警告",
    status: {
      safe: { label: "安全", message: "仍有余量" },
      caution: { label: "注意", message: "请开始安排抽取" },
      alert: { label: "警告", message: "【紧急】请立即安排抽粪车" },
    },
    lastEmptied: "上次抽取日",
    today: "今天",
    remaining: "距离满箱",
    toAlertLine: (l) => `距警告线还有 ${l} L`,
    forecast: "预计剩余天数",
    aboutDays: (n) => `约 ${n} 天`,
    upcomingAvg: (n) => `按今后预订 平均 ${n}人/天 估算`,
    noUpcoming: "暂无后续预订",
    overrideTitle: "手动修正（可选）",
    overrideHint: "人数会从预订数据自动同步。仅当实际住宿人数有偏差的那天，用此修正覆盖。",
    targetDate: "目标日期",
    overrideGuests: "修正人数",
    applyOverride: "应用修正",
    backToAuto: "恢复自动",
    pumpTitle: "抽取完成后",
    pumpHint: "把累计水量归零，并把上次抽取日更新为今天。",
    pumpButton: "抽取完成（重置）",
    logTitle: "住宿记录（自上次抽取以来 · 由预订自动计算）",
    overrideBadge: "手动修正",
    guestsUnit: (n) => `${n}人`,
    confirmTitle: "确认抽取完成",
    confirmBody: (d) => `将把累计水量重置为 0 L，并把上次抽取日更新为 ${d}。此操作不可撤销，确定吗？`,
    cancel: "取消",
    doReset: "确认重置",
    loading: "加载中…",
    loadError: "获取数据失败",
    noData: "无法显示数据。",
    t_recalcDone: "已根据预订数据重新计算",
    t_syncNoGmail: "Airbnb同步：未配置 Gmail（请设置 GMAIL_*）",
    t_syncDone: (f, p, c, x) => `Airbnb同步完成：获取${f} / 导入${p}（确认${c} / 取消${x}）`,
    t_syncFail: "Airbnb同步失败",
    t_overrideDone: (d, n) => `已把 ${d} 手动修正为 ${n}人`,
    t_overrideCleared: (d) => `已取消 ${d} 的修正，恢复自动值`,
    t_resetDone: "已作为抽取完成，将累计重置为 0 L",
    t_invalidGuests: "请输入0以上的数字",
    t_updateFail: "更新失败",
    t_alert: (p) => `检测到超过80%并已通知（WxPusher: ${p}）`,
    t_testAlert: (p) => `测试通知已发送（WxPusher: ${p}）`,
    t_testAlertFail: "通知测试失败",
    sent: "已发送✓",
    unset: "未配置",
    failed: "失败",
    wxpusherTitle: "WxPusher通知",
    wxpusherSent: "已通知",
    wxpusherReady: "等待发送",
    wxpusherWatching: "监测中",
    actionLine: "抽取线",
    liveMeter: "实时水位",
    pumpCallout: "已超过80%。请安排抽粪车，并在完成后重置。",
  },
  ja: {
    title: "便槽モニタリング",
    subtitle: (p, a) =>
      `自社予約＋Airbnb（メール取込）から自動計算。キャンセルは自動除外し、過ぎた宿泊夜だけを ${p}L/人 で積算。80%（${a}L）で自動通知。`,
    sync: "Airbnb同期",
    recalc: "再計算",
    testAlert: "通知テスト",
    updated: "更新",
    meterTitle: "タンク残量メーター",
    warn: "80% 警告",
    status: {
      safe: { label: "安全", message: "まだ余裕があります" },
      caution: { label: "注意", message: "そろそろ汲み取りの準備をしてください" },
      alert: { label: "警告", message: "【至急】バキュームカーを手配してください" },
    },
    lastEmptied: "前回の汲み取り日",
    today: "本日",
    remaining: "満杯までの残り",
    toAlertLine: (l) => `警告ラインまで ${l} L`,
    forecast: "残り予測日数",
    aboutDays: (n) => `約 ${n} 日`,
    upcomingAvg: (n) => `今後の予約 平均 ${n}名/日 換算`,
    noUpcoming: "今後の予約なし",
    overrideTitle: "手動補正（任意）",
    overrideHint: "人数は予約データから自動反映されます。実際の宿泊人数がズレた日だけ、この補正で上書きできます。",
    targetDate: "対象日",
    overrideGuests: "補正人数",
    applyOverride: "補正を適用",
    backToAuto: "自動に戻す",
    pumpTitle: "汲み取りが完了したら",
    pumpHint: "累積水量を 0L に戻し、前回汲み取り日を本日に更新します。",
    pumpButton: "汲み取り完了（リセット）",
    logTitle: "宿泊ログ（前回汲み取り以降・予約から自動算出）",
    overrideBadge: "手動補正",
    guestsUnit: (n) => `${n}名`,
    confirmTitle: "汲み取り完了の確認",
    confirmBody: (d) => `累積水量を 0 L にリセットし、前回汲み取り日を ${d} に更新します。この操作は取り消せません。よろしいですか？`,
    cancel: "キャンセル",
    doReset: "リセットする",
    loading: "読み込み中…",
    loadError: "データの取得に失敗しました",
    noData: "データを表示できませんでした。",
    t_recalcDone: "予約データから再計算しました",
    t_syncNoGmail: "Airbnb同期: Gmail連携が未設定です（GMAIL_* を設定してください）",
    t_syncDone: (f, p, c, x) => `Airbnb同期完了: 取得${f} / 反映${p}（確定${c} / キャンセル${x}）`,
    t_syncFail: "Airbnb同期に失敗しました",
    t_overrideDone: (d, n) => `${d} を ${n}名に手動補正しました`,
    t_overrideCleared: (d) => `${d} の補正を解除し自動値に戻しました`,
    t_resetDone: "汲み取り完了として累積を 0L にリセットしました",
    t_invalidGuests: "宿泊人数は0以上の数値で入力してください",
    t_updateFail: "更新に失敗しました",
    t_alert: (p) => `80%超過を検知し通知しました（WxPusher: ${p}）`,
    t_testAlert: (p) => `テスト通知を送信しました（WxPusher: ${p}）`,
    t_testAlertFail: "通知テストに失敗しました",
    sent: "送信✓",
    unset: "未設定",
    failed: "失敗",
    wxpusherTitle: "WxPusher通知",
    wxpusherSent: "通知済み",
    wxpusherReady: "送信待機",
    wxpusherWatching: "監視中",
    actionLine: "汲み取りライン",
    liveMeter: "現在水位",
    pumpCallout: "80%を超えています。バキュームカーを手配し、完了後にリセットしてください。",
  },
  en: {
    title: "Tank Monitor",
    subtitle: (p, a) =>
      `Auto-calculated from your bookings + Airbnb (email import). Cancellations excluded; only past nights counted at ${p}L/guest. Alerts at 80% (${a}L).`,
    sync: "Sync Airbnb",
    recalc: "Recalculate",
    testAlert: "Test alert",
    updated: "Updated",
    meterTitle: "Tank level",
    warn: "80% alert",
    status: {
      safe: { label: "Safe", message: "Plenty of room left" },
      caution: { label: "Caution", message: "Start arranging a pump-out soon" },
      alert: { label: "Alert", message: "[Urgent] Call the pump truck now" },
    },
    lastEmptied: "Last emptied",
    today: "Today",
    remaining: "Until full",
    toAlertLine: (l) => `${l} L to alert line`,
    forecast: "Days remaining",
    aboutDays: (n) => `~${n} days`,
    upcomingAvg: (n) => `Based on upcoming avg ${n} guests/day`,
    noUpcoming: "No upcoming bookings",
    overrideTitle: "Manual override (optional)",
    overrideHint: "Guest counts sync automatically from bookings. Override a specific day only when the real headcount differs.",
    targetDate: "Date",
    overrideGuests: "Override guests",
    applyOverride: "Apply override",
    backToAuto: "Back to auto",
    pumpTitle: "After a pump-out",
    pumpHint: "Reset the total to 0 L and set the last-emptied date to today.",
    pumpButton: "Pump-out done (reset)",
    logTitle: "Stay log (since last pump-out · auto from bookings)",
    overrideBadge: "override",
    guestsUnit: (n) => `${n} guests`,
    confirmTitle: "Confirm pump-out",
    confirmBody: (d) => `This resets the total to 0 L and sets the last-emptied date to ${d}. This cannot be undone. Continue?`,
    cancel: "Cancel",
    doReset: "Reset",
    loading: "Loading…",
    loadError: "Failed to load data",
    noData: "Could not display data.",
    t_recalcDone: "Recalculated from booking data",
    t_syncNoGmail: "Sync: Gmail not configured (set GMAIL_*)",
    t_syncDone: (f, p, c, x) => `Sync done: fetched ${f} / imported ${p} (confirmed ${c} / cancelled ${x})`,
    t_syncFail: "Airbnb sync failed",
    t_overrideDone: (d, n) => `Overrode ${d} to ${n} guests`,
    t_overrideCleared: (d) => `Cleared override for ${d}, back to auto`,
    t_resetDone: "Marked as pumped out; total reset to 0 L",
    t_invalidGuests: "Enter a number of 0 or more",
    t_updateFail: "Update failed",
    t_alert: (p) => `Over 80% detected and notified (WxPusher: ${p})`,
    t_testAlert: (p) => `Test alert sent (WxPusher: ${p})`,
    t_testAlertFail: "Test alert failed",
    sent: "sent✓",
    unset: "unset",
    failed: "failed",
    wxpusherTitle: "WxPusher alert",
    wxpusherSent: "sent",
    wxpusherReady: "ready to send",
    wxpusherWatching: "watching",
    actionLine: "Pump-out line",
    liveMeter: "Live level",
    pumpCallout: "Tank is over 80%. Arrange a pump-out, then reset after completion.",
  },
};

const LOCALE_TAG: Record<AdminLocale, string> = { zh: "zh-CN", ja: "ja-JP", en: "en-US" };

// 状態ごとの配色（Tailwindのクラスは静的文字列で持つ＝purgeされないように）
const STATUS_STYLE: Record<
  TankStatus,
  { chip: string; bar: string; ring: string; soft: string; text: string }
> = {
  safe: {
    chip: "bg-emerald-100 text-emerald-700",
    bar: "from-emerald-400 to-emerald-500",
    ring: "border-emerald-300",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
  caution: {
    chip: "bg-amber-100 text-amber-700",
    bar: "from-amber-400 to-amber-500",
    ring: "border-amber-300",
    soft: "bg-amber-50",
    text: "text-amber-700",
  },
  alert: {
    chip: "bg-red-100 text-red-700",
    bar: "from-red-500 to-rose-600",
    ring: "border-red-300",
    soft: "bg-red-50",
    text: "text-red-700",
  },
};

// アニメーション用CSS（コンポーネント内に1回だけ注入）
const TANK_CSS = `
@keyframes tankWave { from { background-position-x: 0; } to { background-position-x: 72px; } }
@keyframes tankBob { 0%,100% { transform: translateY(-50%); } 50% { transform: translateY(-58%); } }
@keyframes tankShimmer { 0% { background-position: -150% 0; } 100% { background-position: 250% 0; } }
@keyframes tankAlertPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); } 70% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }
@keyframes tankFloatUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes tankPop { 0% { transform: scale(.82); opacity: .35; } 100% { transform: scale(1); opacity: 1; } }
@keyframes tankSweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@keyframes tankScan { 0% { transform: translateY(-100%); opacity: 0; } 18%,78% { opacity: .55; } 100% { transform: translateY(100%); opacity: 0; } }
@keyframes tankSignal { 0%,100% { transform: scale(1); opacity: .75; } 50% { transform: scale(1.35); opacity: 1; } }
.tank-fill { transition: height 1100ms cubic-bezier(.22,1,.36,1); }
.tank-console {
  background:
    linear-gradient(135deg, rgba(240,253,250,.92), rgba(255,255,255,.98) 38%, rgba(255,247,237,.82)),
    repeating-linear-gradient(90deg, rgba(15,23,42,.035) 0 1px, transparent 1px 26px);
}
.tank-console::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(105deg, transparent 8%, rgba(255,255,255,.7) 24%, transparent 42%);
  animation: tankSweep 7s ease-in-out infinite;
}
.tank-scanline {
  position: absolute; inset: -20% 0;
  background: linear-gradient(180deg, transparent, rgba(14,165,233,.22), transparent);
  animation: tankScan 4.8s ease-in-out infinite;
}
.tank-signal-dot {
  display: inline-block; height: .5rem; width: .5rem; border-radius: 9999px;
  animation: tankSignal 1.8s ease-in-out infinite;
}
.tank-wave {
  position: absolute; top: 0; left: 0; right: 0; height: 12px;
  transform: translateY(-50%);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='12' viewBox='0 0 72 12'%3E%3Cpath d='M0 6 Q18 -1 36 6 T72 6 V12 H0 Z' fill='%23ffffff' fill-opacity='0.45'/%3E%3C/svg%3E");
  background-repeat: repeat-x; background-size: 72px 12px;
  animation: tankWave 1.8s linear infinite, tankBob 3.2s ease-in-out infinite;
}
.tank-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.28) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: tankShimmer 3.4s ease-in-out infinite;
}
.tank-alert-pulse { animation: tankAlertPulse 1.8s ease-out infinite; }
.tank-floatup { animation: tankFloatUp .5s ease-out both; }
.tank-pop { animation: tankPop .45s cubic-bezier(.22,1,.36,1); display: inline-block; }
@media (prefers-reduced-motion: reduce) {
  .tank-console::before, .tank-scanline, .tank-signal-dot, .tank-wave, .tank-shimmer, .tank-alert-pulse, .tank-floatup, .tank-pop { animation: none !important; }
}
`;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function GuesthouseTankDashboard() {
  // 管理画面の言語に追従（AdminClient と同じ localStorage キー "adminLang"、既定=日本語 ja）
  const [locale, setLocale] = useState<AdminLocale>("ja");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("adminLang") : null;
    if (isAdminLocale(saved)) setLocale(saved);
  }, []);
  const L = TANK_I18N[locale] || TANK_I18N.ja;

  const [data, setData] = useState<TankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [guests, setGuests] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tank", { cache: "no-store" });
      const json = (await res.json()) as TankResponse;
      setData(json);
    } catch {
      setToast(L.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 選択中の日付に手動補正が入っていれば入力欄へ反映
  useEffect(() => {
    if (!data) return;
    const log = data.logs.find((l) => l.date === date);
    setGuests(log?.overridden ? String(log.guests) : "");
  }, [date, data]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  function alertStatuses(json: TankResponse) {
    const p = json.alertDispatched!.wxpusher;
    const s = (x: { ok: boolean; skipped?: boolean }) => (x.ok ? L.sent : x.skipped ? L.unset : L.failed);
    return { wxpusher: s(p) };
  }

  function alertParts(json: TankResponse) {
    const status = alertStatuses(json);
    return L.t_alert(status.wxpusher);
  }

  function testAlertParts(json: TankResponse) {
    const status = alertStatuses(json);
    return L.t_testAlert(status.wxpusher);
  }

  // POST 共通処理（再評価＋任意の補正）
  async function postTank(body: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as TankResponse;
      if (!res.ok) throw new Error((json as any)?.error || L.t_updateFail);
      setData(json);
      flash(json.alertDispatched ? alertParts(json) : okMsg);
    } catch (err: any) {
      flash(err?.message || L.t_updateFail);
    } finally {
      setSaving(false);
    }
  }

  function refreshEvaluate() {
    postTank({}, L.t_recalcDone);
  }

  async function sendTestAlert() {
    setTestingAlert(true);
    try {
      const res = await fetch("/api/admin/tank/test-alert", { method: "POST" });
      const json = (await res.json()) as TankResponse & { error?: string };
      if (!res.ok) throw new Error(json?.error || L.t_testAlertFail);
      setData(json);
      flash(json.alertDispatched ? testAlertParts(json) : L.t_testAlertFail);
    } catch (err: any) {
      flash(err?.message || L.t_testAlertFail);
    } finally {
      setTestingAlert(false);
    }
  }

  async function syncAirbnb() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tank/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || L.t_syncFail);
      setData(json as TankResponse);
      const s = json.sync;
      if (s?.gmail?.skipped) flash(L.t_syncNoGmail);
      else if (s) flash(L.t_syncDone(s.fetched, s.parsed, s.confirmed, s.cancelled));
      else if (json.alertDispatched) flash(alertParts(json as TankResponse));
      else flash(L.t_recalcDone);
    } catch (err: any) {
      flash(err?.message || L.t_syncFail);
    } finally {
      setSaving(false);
    }
  }

  function submitOverride() {
    const n = Number(guests);
    if (!Number.isFinite(n) || n < 0) {
      flash(L.t_invalidGuests);
      return;
    }
    postTank({ date, guests: n }, L.t_overrideDone(date, n));
  }

  function clearOverride() {
    postTank({ date, guests: null }, L.t_overrideCleared(date));
  }

  async function doReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/admin/tank/reset", { method: "POST" });
      const json = (await res.json()) as TankResponse;
      if (!res.ok) throw new Error((json as any)?.error || L.t_updateFail);
      setData(json);
      setGuests("");
      setConfirmReset(false);
      flash(L.t_resetDone);
    } catch (err: any) {
      flash(err?.message || L.t_updateFail);
    } finally {
      setResetting(false);
    }
  }

  const emoji = data ? STATUS_META[data.summary.status].emoji : STATUS_META.safe.emoji;
  const style = data ? STATUS_STYLE[data.summary.status] : STATUS_STYLE.safe;
  const st = data ? L.status[data.summary.status] : L.status.safe;

  const alertLinePct = useMemo(() => {
    if (!data) return 80;
    return Math.min(100, (data.summary.alertLine / data.capacityLiters) * 100);
  }, [data]);

  const fillPct = data ? Math.min(100, data.summary.pct) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {L.loading}
      </div>
    );
  }
  if (!data) {
    return <p className="py-24 text-center text-slate-400">{L.noData}</p>;
  }

  const isAlert = data.summary.status === "alert";
  const litersToAlert = Math.max(0, Math.round(data.summary.alertLine - data.currentLiters));
  const wxpusherState = data.alerted ? L.wxpusherSent : isAlert ? L.wxpusherReady : L.wxpusherWatching;
  const wxpusherTone = data.alerted
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : isAlert
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";

  return (
    <div className="tank-console relative overflow-hidden rounded-2xl border border-teal-100/80 p-3 shadow-inner shadow-white sm:p-5">
      <style>{TANK_CSS}</style>

      {/* ===== ヘッダー ===== */}
      <div className="relative z-10 mb-5 flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-sm ${isAlert ? "border-red-200 text-red-600" : "border-teal-200 text-teal-600"}`}>
              <Droplets className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-normal text-slate-950">{L.title}</h1>
              <p className="text-xs font-semibold text-slate-400">
                {L.updated}: {new Date(data.updatedAt).toLocaleString(LOCALE_TAG[locale] || "zh-CN")}
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            {L.subtitle(data.litersPerGuestPerDay, data.summary.alertLine)}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={sendTestAlert}
              disabled={saving || testingAlert}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-sm disabled:opacity-50"
            >
              {testingAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
              {L.testAlert}
            </button>
            <button
              onClick={syncAirbnb}
              disabled={saving || testingAlert}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {L.sync}
            </button>
            <button
              onClick={refreshEvaluate}
              disabled={saving || testingAlert}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 hover:shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {L.recalc}
            </button>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[510px]">
            <SignalPill
              icon={<Waves className="h-4 w-4" />}
              label={L.liveMeter}
              value={`${data.summary.pct}%`}
              className="border-sky-200 bg-sky-50 text-sky-700"
            />
            <SignalPill
              icon={<Activity className="h-4 w-4" />}
              label={L.actionLine}
              value={`${litersToAlert} L`}
              className={isAlert ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}
            />
            <SignalPill
              icon={<MessageCircle className="h-4 w-4" />}
              label={L.wxpusherTitle}
              value={wxpusherState}
              className={wxpusherTone}
              pulse={isAlert && !data.alerted}
            />
          </div>
        </div>
      </div>

      {/* ===== ステータスカード ===== */}
      <div
        className={`tank-floatup relative z-10 mb-5 flex flex-col gap-3 overflow-hidden rounded-xl border ${style.ring} ${style.soft} p-5 sm:flex-row sm:items-center sm:justify-between ${isAlert ? "tank-alert-pulse" : ""}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.bar}`} />
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{emoji}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.chip}`}>{st.label}</span>
              <span className="text-xs font-semibold text-slate-400">{data.alerted ? L.wxpusherSent : L.wxpusherWatching}</span>
            </div>
            <p className={`mt-1 text-lg font-extrabold ${style.text}`}>{st.message}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-slate-900">
            <span key={Math.round(data.currentLiters)} className="tank-pop">{Math.round(data.currentLiters)}</span>
            <span className="ml-1 text-base font-semibold text-slate-400">/ {data.capacityLiters} L</span>
          </p>
          <p className={`text-sm font-bold ${style.text}`}>{data.summary.pct}%</p>
        </div>
      </div>

      {isAlert && (
        <div className="tank-floatup relative z-10 mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <BellRing className="h-5 w-5 shrink-0" />
          <span>{L.pumpCallout}</span>
        </div>
      )}

      <div className="relative z-10 grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* ===== 縦型タンクメーター（アニメーション） ===== */}
        <div className="tank-floatup rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Gauge className="h-4 w-4 text-brand-600" /> {L.meterTitle}
          </div>
          <div className="flex items-end justify-center gap-4">
            <div className="relative h-72 w-32 overflow-hidden rounded-[1.4rem] border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 shadow-inner">
              <div className="absolute left-1/2 top-2 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-slate-300/70" />
              <div className="tank-scanline z-10" />
              {/* 水量（さざ波・シマー付き） */}
              <div
                className={`tank-fill absolute bottom-0 left-0 w-full bg-gradient-to-t ${style.bar}`}
                style={{ height: `${fillPct}%` }}
              >
                {fillPct > 1 && <div className="tank-wave" />}
                <div className="tank-shimmer" />
              </div>
              {/* 警告ライン（赤い破線） */}
              <div
                className="absolute left-0 z-10 w-full border-t-2 border-dashed border-red-500"
                style={{ bottom: `${alertLinePct}%` }}
              >
                <span className="absolute -top-4 right-1 rounded bg-red-500 px-1 text-[10px] font-bold text-white">
                  {L.warn}
                </span>
              </div>
              {/* 中央のパーセント表示 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span key={data.summary.pct} className="tank-pop rounded-lg border border-white/80 bg-white/75 px-2.5 py-1 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur">
                  {data.summary.pct}%
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm font-bold text-slate-700">
            {Math.round(data.currentLiters)} L / {data.capacityLiters} L（{data.summary.pct}%）
          </p>
        </div>

        {/* ===== 右カラム ===== */}
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              icon={<CalendarDays className="h-4 w-4" />}
              label={L.lastEmptied}
              value={data.lastEmptiedDate}
              sub={`${L.today} ${todayStr()}`}
            />
            <Metric
              icon={<Droplets className="h-4 w-4" />}
              label={L.remaining}
              value={`${data.summary.remainingLiters} L`}
              sub={L.toAlertLine(Math.max(0, Math.round(data.summary.alertLine - data.currentLiters)))}
            />
            <Metric
              icon={<AlertTriangle className="h-4 w-4" />}
              label={L.forecast}
              value={data.summary.forecastDays === null ? "—" : L.aboutDays(data.summary.forecastDays)}
              sub={data.summary.upcomingGuestsPerDay > 0 ? L.upcomingAvg(data.summary.upcomingGuestsPerDay) : L.noUpcoming}
            />
          </div>

          {/* 手動補正 */}
          <div className="tank-floatup rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Users className="h-4 w-4 text-brand-600" /> {L.overrideTitle}
            </div>
            <p className="mb-3 text-xs text-slate-400">{L.overrideHint}</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-500">
                {L.targetDate}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                {L.overrideGuests}
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="4"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none"
                />
              </label>
              <button
                onClick={submitOverride}
                disabled={saving || testingAlert}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {L.applyOverride}
              </button>
              <button
                onClick={clearOverride}
                disabled={saving || testingAlert}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-slate-300 disabled:opacity-50"
              >
                {L.backToAuto}
              </button>
            </div>
          </div>

          {/* 汲み取り完了リセット */}
          <div className="tank-floatup rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{L.pumpTitle}</p>
                <p className="text-xs text-slate-400">{L.pumpHint}</p>
              </div>
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 hover:shadow-sm"
              >
                <Truck className="h-4 w-4" /> {L.pumpButton}
              </button>
            </div>
          </div>

          {/* 宿泊ログ */}
          {data.logs.length > 0 && (
            <div className="tank-floatup overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm shadow-slate-900/5">
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">{L.logTitle}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.logs.slice(0, 10).map((l) => (
                    <tr key={l.date} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{l.date}</td>
                      <td className="px-4 py-2 text-slate-800">
                        {L.guestsUnit(l.guests)}
                        {l.overridden && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            {L.overrideBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-700">+{l.liters} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== 確認ダイアログ ===== */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="tank-pop w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-2 text-red-600">
              <Truck className="h-5 w-5" />
              <h3 className="text-lg font-extrabold text-slate-900">{L.confirmTitle}</h3>
            </div>
            <p className="mb-5 text-sm text-slate-500">{L.confirmBody(todayStr())}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                {L.cancel}
              </button>
              <button
                onClick={doReset}
                disabled={resetting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                {L.doReset}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== トースト ===== */}
      {toast && (
        <div className="tank-pop fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---- 小さなステータスピル ----
function SignalPill({
  icon,
  label,
  value,
  className,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className: string;
  pulse?: boolean;
}) {
  return (
    <div className={`min-h-[68px] rounded-xl border px-3 py-2 shadow-sm shadow-white/80 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase">
        <span className={`${pulse ? "tank-signal-dot" : ""} inline-block h-2 w-2 rounded-full bg-current opacity-80`} />
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-extrabold">{value}</p>
    </div>
  );
}

// ---- 小さなメトリクスカード ----
function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="tank-floatup min-h-[112px] rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <span className="text-brand-600">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
