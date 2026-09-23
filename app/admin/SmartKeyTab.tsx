"use client";

// =========================================================
// 管理画面「スマートキー」タブ
//   ・緊急停止（全物件のアプリ解錠を一時停止）
//   ・エントランス（どの Sesame を使うか）の登録・実機テスト・QR発行
//   ・ゲスト画面の設定（長押し時間 / カウントダウン / 表示項目）
//   ・プレビュー（シミュレーション / 実機）
//   ・入退館ログ
// =========================================================
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Power, PowerOff, Loader2, Check, Copy, Download, Printer, Plus, ChevronDown, KeyRound, Lock, LockOpen,
  Activity, AlertTriangle, Save, Undo2, RotateCcw, Smartphone, Zap, FlaskConical, History, DoorOpen, Wifi,
} from "lucide-react";
import SmartKeyScreen, { type Door, type CmdResult } from "@/components/smartkey/SmartKeyScreen";
import { SK_LANGS, SK_LANG_LABEL, type SkLang } from "@/lib/smartkeyI18n";
import {
  DEFAULT_SMARTKEY_SETTINGS, type GuestKeyData, type KeyState, type SmartKeySettings,
} from "@/lib/smartkeyLogic";
import type { AdminLang } from "@/lib/adminI18n";
import { saveEntrance, saveSmartKeySettings, setAppUnlockEnabled } from "./smartkeyActions";
import type { Room, Reservation } from "./AdminClient";

export interface AdminEntrance {
  id: string; slug: string; display_name: string; building: string; is_active: boolean;
  sesame_device_uuid: string | null;
  has_secret: boolean; has_api_key: boolean; api_key_from_env: boolean;
  keypad_code: string | null; wifi_ssid: string | null; wifi_password: string | null; support_url: string | null;
  url: string; qr: string;
}
export interface EntranceLog {
  id: string; entrance_name: string | null; room_name: string | null; guest_name: string | null;
  action: string; source: string; success: boolean; created_at: string;
}
export interface SmartKeyProps {
  entrances: AdminEntrance[];
  settings: SmartKeySettings;
  logs: EntranceLog[];
  setupMissing: boolean;
}

/* ---------------- 管理画面の文言 (ja / en / zh) ---------------- */
const L_JA = {
    sec: "秒", title: "スマートキー", desc: "エントランスの Sesame 設定、ゲスト用鍵画面の設定・プレビュー、実機での動作確認ができます。操作はすべて記録されます。",
    setupMissing: "スマートキー用のテーブルがありません。Supabase の SQL Editor で supabase/migration_smartkey.sql を実行してください。",
    running: "アプリ解錠：稼働中", runningDesc: "ゲストはスマホから解錠・施錠できます。トラブル時はここで全物件のアプリ解錠を一時停止できます。",
    stoppedT: "アプリ解錠：緊急停止中", stoppedDesc: "ゲストのアプリ解錠（エントランス・お部屋）を止めています。テンキー・物理キーは使えます。",
    stop: "緊急停止する", resume: "再開する", again: "もう一度押すと実行",
    entrances: "エントランス（Sesame）", addEntrance: "エントランスを追加",
    name: "表示名", slug: "slug（QR/URL用・半角英数とハイフン）", building: "棟（この棟に泊まる予約だけ通します）",
    uuid: "Sesame UUID", secret: "シークレットキー（32桁の16進数）", apiKey: "Sesame API キー",
    keepBlank: "空欄のままなら変更しません", setOk: "設定済み", notSet: "未設定", fromEnv: "環境変数を使用",
    keypad: "テンキー暗証番号（任意）", wifiSsid: "Wi-Fi SSID（任意）", wifiPass: "Wi-Fi パスワード（任意）", support: "サポート連絡先URL（LINE / WhatsApp / tel: など）",
    active: "有効", inactive: "停止中", save: "保存", saved: "保存しました", edit: "設定を編集", close: "閉じる",
    clearSecret: "シークレットキーを削除", clearApi: "APIキーを削除",
    sesameHelp: "Sesame アプリ →（エントランスの鍵）→ 設定 → 「オーナー鍵を共有」の QR から UUID とシークレットキーを取得します。API キーは CANDY HOUSE Biz / Developer で発行します。",
    status: "状態を確認", unlock: "解錠", lock: "施錠", locked: "施錠中", unlockedS: "解錠中", battery: "電池",
    qrTitle: "ゲスト用QR（エントランスに掲示）", copyUrl: "URLをコピー", download: "QR画像", print: "印刷",
    noEntrances: "エントランスがまだありません。「エントランスを追加」から Sesame を登録してください。",
    guestSettings: "ゲスト画面の設定", savedState: "保存済み", unsaved: "未保存の変更",
    hold: "解錠までの長押し時間", holdHint: "短いほど素早く開きますが、誤操作しやすくなります",
    countdown: "自動施錠までのカウントダウン", countdownHint: "解錠後に表示する秒数。実際の自動施錠時間は鍵本体の設定に合わせてください",
    showLockNow: "「今すぐ施錠」ボタンを表示", showKeypad: "暗証番号（テンキー用）を表示", showWifi: "Wi-Fi 情報を表示", showSupport: "「サポートに連絡」ボタンを表示",
    saveApply: "保存して反映", revert: "変更を取り消す", reset: "初期値に戻す",
    preview: "プレビューの切り替え", screenState: "画面の状態", stVerify: "本人確認", stBefore: "開始前", stActive: "利用中", stExpired: "期限切れ",
    language: "言語", doors: "ドアの数", door1: "1つ", door2: "2つ（エントランス＋お部屋）",
    sim: "鍵の応答（シミュレーション）", simOk: "成功", simFail: "失敗（鍵が応答しない）", simRate: "回数制限",
    mode: "操作モード", modeSim: "シミュレーション", modeReal: "実機で動かす",
    realWarn: "実機モード：長押しすると選択中のエントランス／お部屋の鍵が実際に動きます（緊急停止中でも管理者は操作できます）。",
    previewNote: "プレビューはサンプルデータです。長押し・施錠などの操作もできますが、シミュレーションでは実際の鍵には一切信号を送りません。「本人確認」では何を入力しても次へ進めます。",
    targetEntrance: "動かすエントランス", targetRoom: "動かすお部屋", noLockRoom: "（鍵未設定）",
    logs: "入退館ログ", noLogs: "まだ記録がありません", when: "日時", who: "ゲスト", what: "操作", where: "場所",
    todayGuests: "このエントランスを使える予約（今〜24時間以内）", none: "なし", verified: "本人確認済み",
    openPreview: "ゲスト画面のプレビュー・実機テスト（ツール → テスト）", previewTitle: "スマートキー：ゲスト画面プレビュー",
};
type LT = { [K in keyof typeof L_JA]: string };
const L: Record<AdminLang, LT> = {
  ja: L_JA,
  en: {
    sec: "s", title: "Smart Key", desc: "Configure entrance Sesame locks, the guest key screen, preview it and test the real locks. Every change and operation is logged.",
    setupMissing: "Smart-key tables are missing. Run supabase/migration_smartkey.sql in the Supabase SQL Editor.",
    running: "App unlock: running", runningDesc: "Guests can lock/unlock from their phones. In trouble, pause app unlocking for all properties here.",
    stoppedT: "App unlock: EMERGENCY STOP", stoppedDesc: "Guest app unlocking (entrance and rooms) is paused. Keypads and physical keys still work.",
    stop: "Emergency stop", resume: "Resume", again: "Tap again to confirm",
    entrances: "Entrances (Sesame)", addEntrance: "Add entrance",
    name: "Display name", slug: "slug (for QR/URL: a-z 0-9 -)", building: "Building (only bookings in this building pass)",
    uuid: "Sesame UUID", secret: "Secret key (32 hex chars)", apiKey: "Sesame API key",
    keepBlank: "Leave blank to keep current", setOk: "Set", notSet: "Not set", fromEnv: "Using env var",
    keypad: "Keypad code (optional)", wifiSsid: "Wi-Fi SSID (optional)", wifiPass: "Wi-Fi password (optional)", support: "Support URL (LINE / WhatsApp / tel:)",
    active: "Active", inactive: "Disabled", save: "Save", saved: "Saved", edit: "Edit settings", close: "Close",
    clearSecret: "Remove secret key", clearApi: "Remove API key",
    sesameHelp: "Sesame app → (entrance lock) → Settings → share owner key QR gives the UUID and secret key. Get the API key from CANDY HOUSE Biz / Developer.",
    status: "Check status", unlock: "Unlock", lock: "Lock", locked: "Locked", unlockedS: "Unlocked", battery: "Battery",
    qrTitle: "Guest QR (post at the entrance)", copyUrl: "Copy URL", download: "QR image", print: "Print",
    noEntrances: "No entrances yet. Register a Sesame with “Add entrance”.",
    guestSettings: "Guest screen settings", savedState: "Saved", unsaved: "Unsaved changes",
    hold: "Hold time to unlock", holdHint: "Shorter opens faster but is easier to trigger by mistake",
    countdown: "Auto-lock countdown", countdownHint: "Seconds shown after unlocking. Match the lock's own auto-lock setting",
    showLockNow: "Show “Lock now” button", showKeypad: "Show keypad code", showWifi: "Show Wi-Fi", showSupport: "Show “Contact support”",
    saveApply: "Save & apply", revert: "Discard changes", reset: "Reset to defaults",
    preview: "Preview", screenState: "Screen state", stVerify: "Verify", stBefore: "Before", stActive: "In stay", stExpired: "Expired",
    language: "Language", doors: "Doors", door1: "One", door2: "Two (entrance + room)",
    sim: "Lock response (simulation)", simOk: "Success", simFail: "Fail (no response)", simRate: "Rate limit",
    mode: "Mode", modeSim: "Simulation", modeReal: "Real device",
    realWarn: "Real mode: holding the button really operates the selected entrance / room lock (admins can operate even during emergency stop).",
    previewNote: "Sample data. You can hold and lock, but simulation never sends anything to the real locks. In “Verify” any input proceeds.",
    targetEntrance: "Entrance to operate", targetRoom: "Room to operate", noLockRoom: "(no lock)",
    logs: "Entrance log", noLogs: "No records yet", when: "When", who: "Guest", what: "Action", where: "Where",
    todayGuests: "Bookings that can use this entrance (now – 24h)", none: "None", verified: "Verified",
    openPreview: "Guest screen preview & real test (Tools → Test)", previewTitle: "Smart key: guest screen preview",
  },
  zh: {
    sec: "秒", title: "智能钥匙", desc: "设置大门 Sesame、客人钥匙页面并预览，也可用真实门锁测试。所有操作都会记录。",
    setupMissing: "缺少智能钥匙数据表。请在 Supabase SQL Editor 执行 supabase/migration_smartkey.sql。",
    running: "App 开锁：运行中", runningDesc: "客人可用手机开锁/上锁。出现问题时可在此暂停所有物业的 App 开锁。",
    stoppedT: "App 开锁：紧急停止中", stoppedDesc: "已暂停客人 App 开锁（大门与房间）。密码键盘与实体钥匙仍可使用。",
    stop: "紧急停止", resume: "恢复", again: "再按一次执行",
    entrances: "大门（Sesame）", addEntrance: "添加大门",
    name: "显示名称", slug: "slug（QR/URL 用：英数字与连字符）", building: "楼栋（仅允许入住该楼栋的预订）",
    uuid: "Sesame UUID", secret: "密钥（32 位十六进制）", apiKey: "Sesame API Key",
    keepBlank: "留空则不修改", setOk: "已设置", notSet: "未设置", fromEnv: "使用环境变量",
    keypad: "键盘密码（可选）", wifiSsid: "Wi-Fi SSID（可选）", wifiPass: "Wi-Fi 密码（可选）", support: "客服链接（LINE / WhatsApp / tel:）",
    active: "启用", inactive: "停用", save: "保存", saved: "已保存", edit: "编辑设置", close: "关闭",
    clearSecret: "删除密钥", clearApi: "删除 API Key",
    sesameHelp: "Sesame App →（大门锁）→ 设置 → 分享拥有者钥匙的 QR 可取得 UUID 与密钥。API Key 在 CANDY HOUSE Biz / Developer 申请。",
    status: "检查状态", unlock: "开锁", lock: "上锁", locked: "已上锁", unlockedS: "已开锁", battery: "电量",
    qrTitle: "客人 QR（张贴在大门）", copyUrl: "复制链接", download: "QR 图片", print: "打印",
    noEntrances: "还没有大门。请点击“添加大门”登记 Sesame。",
    guestSettings: "客人页面设置", savedState: "已保存", unsaved: "有未保存的更改",
    hold: "长按开锁时间", holdHint: "越短开得越快，但越容易误触",
    countdown: "自动上锁倒计时", countdownHint: "开锁后显示的秒数。请与门锁本身的自动上锁设置一致",
    showLockNow: "显示“立即上锁”按钮", showKeypad: "显示键盘密码", showWifi: "显示 Wi-Fi", showSupport: "显示“联系客服”",
    saveApply: "保存并生效", revert: "取消更改", reset: "恢复默认",
    preview: "预览切换", screenState: "页面状态", stVerify: "身份确认", stBefore: "开始前", stActive: "入住中", stExpired: "已过期",
    language: "语言", doors: "门的数量", door1: "1 个", door2: "2 个（大门＋房间）",
    sim: "门锁响应（模拟）", simOk: "成功", simFail: "失败（无响应）", simRate: "次数限制",
    mode: "操作模式", modeSim: "模拟", modeReal: "真实设备",
    realWarn: "真实模式：长按会真的操作所选大门／房间的门锁（紧急停止中管理员仍可操作）。",
    previewNote: "预览为示例数据。可长按与上锁，但模拟模式不会向真实门锁发送任何信号。“身份确认”输入任何内容都可继续。",
    targetEntrance: "要操作的大门", targetRoom: "要操作的房间", noLockRoom: "（未设置门锁）",
    logs: "出入记录", noLogs: "暂无记录", when: "时间", who: "客人", what: "操作", where: "地点",
    todayGuests: "可使用此大门的预订（现在〜24小时内）", none: "无", verified: "已确认",
    openPreview: "客人页面预览・真实测试（工具 → 测试）", previewTitle: "智能钥匙：客人页面预览",
  },
};

const card = "clip-bevel border border-cyan-400/15 bg-[#070a12]/80 backdrop-blur-xl";
const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark] placeholder:text-white/25";
const LOCALE: Record<AdminLang, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN" };
const fmt = (iso: string, lang: AdminLang) =>
  new Date(iso).toLocaleString(LOCALE[lang], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

export default function SmartKeyTab({
  entrances, settings, logs, setupMissing, rooms, reservations, lang, onOpenPreview,
}: SmartKeyProps & { rooms: Room[]; reservations: Reservation[]; lang: AdminLang; onOpenPreview?: () => void }) {
  const t = L[lang];
  const [draft, setDraft] = useState<SmartKeySettings>(settings);
  useEffect(() => { setDraft(settings); }, [settings]);

  const buildings = useMemo(() => {
    const s = new Set<string>(["Crane Nest", "Crane Nest 2"]);
    rooms.forEach((r) => s.add(r.building || "Crane Nest"));
    return Array.from(s);
  }, [rooms]);

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-cyan-200"><KeyRound className="h-4 w-4" /> {t.title}</div>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{t.desc}</p>
      </div>

      {setupMissing && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t.setupMissing}
        </div>
      )}

      <EmergencyCard enabled={settings.app_unlock_enabled} t={t} />

      <EntrancesSection entrances={entrances} buildings={buildings} rooms={rooms} reservations={reservations} t={t} lang={lang} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SettingsCard saved={settings} draft={draft} setDraft={setDraft} t={t} />
          {onOpenPreview && (
            <button onClick={onOpenPreview}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/40 bg-violet-500/10 py-3 text-sm font-semibold text-violet-100">
              <Smartphone className="h-4 w-4" /> {t.openPreview}
            </button>
          )}
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LogsCard logs={logs} t={t} lang={lang} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 緊急停止 ---------------- */
function EmergencyCard({ enabled, t }: { enabled: boolean; t: LT }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setBusy(true); setArmed(false); setErr(null);
    const r = await setAppUnlockEnabled(!enabled).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (!r.ok) setErr(r.error ?? "ERROR");
    router.refresh();
  };

  return (
    <div className={`flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center ${enabled ? "border-emerald-400/30 bg-emerald-500/[0.07]" : "border-rose-400/50 bg-rose-500/15"}`}>
      <div className="flex flex-1 items-start gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${enabled ? "bg-emerald-500/80" : "bg-rose-500 anim-alert"}`}>
          {enabled ? <Power className="h-6 w-6 text-white" /> : <PowerOff className="h-6 w-6 text-white" />}
        </span>
        <div>
          <p className={`text-base font-semibold ${enabled ? "text-emerald-100" : "text-rose-100"}`}>{enabled ? t.running : t.stoppedT}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{enabled ? t.runningDesc : t.stoppedDesc}</p>
          {err && <p className="mt-1 text-xs text-rose-300">{err}</p>}
        </div>
      </div>
      <button onClick={run} disabled={busy}
        className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60
          ${enabled
            ? armed ? "bg-rose-500 text-white ring-2 ring-rose-300" : "bg-rose-600/90 text-white"
            : armed ? "bg-emerald-500 text-white ring-2 ring-emerald-300" : "bg-emerald-600/90 text-white"}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        {armed ? t.again : enabled ? t.stop : t.resume}
      </button>
    </div>
  );
}

/* ---------------- エントランス一覧 / 追加 ---------------- */
function EntrancesSection({
  entrances, buildings, rooms, reservations, t, lang,
}: { entrances: AdminEntrance[]; buildings: string[]; rooms: Room[]; reservations: Reservation[]; t: LT; lang: AdminLang }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <DoorOpen className="h-4 w-4 text-cyan-300" />
        <span className="text-sm text-cyan-100">{t.entrances}</span>
        <span className="h-px flex-1 bg-white/10" />
        <button onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
          <Plus className="h-3.5 w-3.5" /> {t.addEntrance}
        </button>
      </div>

      {adding && (
        <div className={`${card} mb-4 p-5`}>
          <EntranceForm buildings={buildings} t={t} onDone={() => setAdding(false)} />
        </div>
      )}

      {entrances.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-xs text-white/45">{t.noEntrances}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {entrances.map((e) => (
          <EntranceCard key={e.id} e={e} buildings={buildings} rooms={rooms} reservations={reservations} t={t} lang={lang} />
        ))}
      </div>
    </div>
  );
}

function EntranceForm({ e, buildings, t, onDone }: { e?: AdminEntrance; buildings: string[]; t: LT; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (fd: FormData) => {
    setBusy(true); setMsg(null);
    const r = await saveEntrance(fd).catch((err) => ({ ok: false, error: String(err?.message ?? err) }));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: t.saved } : { ok: false, text: r.error ?? "ERROR" });
    if (r.ok) { router.refresh(); setTimeout(() => onDone?.(), 700); }
  };

  const Status = ({ ok, env }: { ok: boolean; env?: boolean }) => (
    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${ok ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/40"}`}>
      {env ? t.fromEnv : ok ? t.setOk : t.notSet}
    </span>
  );

  return (
    <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label={t.name}><input name="display_name" required defaultValue={e?.display_name ?? ""} placeholder="Crane Nest Entrance" className={inputCls} /></Field>
      {e ? (
        <Field label="slug"><input value={e.slug} readOnly className={`${inputCls} font-mono text-white/40`} /></Field>
      ) : (
        <Field label={t.slug}><input name="slug" required pattern="[a-zA-Z0-9\-\s]+" placeholder="crane-nest" className={`${inputCls} font-mono lowercase`} /></Field>
      )}
      <Field label={t.building}>
        <select name="building" defaultValue={e?.building ?? buildings[0]} className={inputCls}>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-xs text-white/60">
        <input type="checkbox" name="is_active" defaultChecked={e?.is_active ?? true} className="h-4 w-4 accent-emerald-500" />
        {t.active}
      </label>

      <div className="sm:col-span-2 mt-1 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200"><KeyRound className="h-3.5 w-3.5" /> Sesame</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.uuid}><input name="sesame_device_uuid" defaultValue={e?.sesame_device_uuid ?? ""} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${inputCls} font-mono text-xs`} /></Field>
          <Field label={<>{t.secret}{e && <Status ok={e.has_secret} />}</>}>
            <input name="sesame_secret_key" type="password" autoComplete="off" placeholder={e?.has_secret ? t.keepBlank : "0123abcd…"} className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label={<>{t.apiKey}{e && <Status ok={e.has_api_key} env={e.api_key_from_env} />}</>}>
            <input name="sesame_api_key" type="password" autoComplete="off" placeholder={e?.has_api_key ? t.keepBlank : "SESAME_API_KEY"} className={`${inputCls} font-mono text-xs`} />
          </Field>
          {e && (
            <div className="flex flex-col justify-end gap-1 pb-1 text-[11px] text-white/45">
              {e.has_secret && <label className="flex items-center gap-1.5"><input type="checkbox" name="clear_secret" className="accent-rose-500" /> {t.clearSecret}</label>}
              {e.has_api_key && !e.api_key_from_env && <label className="flex items-center gap-1.5"><input type="checkbox" name="clear_api_key" className="accent-rose-500" /> {t.clearApi}</label>}
            </div>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/35">💡 {t.sesameHelp}</p>
      </div>

      <Field label={t.keypad}><input name="keypad_code" defaultValue={e?.keypad_code ?? ""} inputMode="numeric" className={`${inputCls} font-mono`} /></Field>
      <Field label={t.support}><input name="support_url" defaultValue={e?.support_url ?? ""} placeholder="https://line.me/R/ti/p/@xxxx" className={`${inputCls} text-xs`} /></Field>
      <Field label={t.wifiSsid}><input name="wifi_ssid" defaultValue={e?.wifi_ssid ?? ""} className={inputCls} /></Field>
      <Field label={t.wifiPass}><input name="wifi_password" defaultValue={e?.wifi_password ?? ""} className={`${inputCls} font-mono`} /></Field>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/15 py-3 text-sm text-emerald-200 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t.save}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.ok ? "✓ " : ""}{msg.text}</span>}
      </div>
    </form>
  );
}

function EntranceCard({
  e, buildings, rooms, reservations, t, lang,
}: { e: AdminEntrance; buildings: string[]; rooms: Room[]; reservations: Reservation[]; t: LT; lang: AdminLang }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [big, setBig] = useState(false);
  const ready = !!e.sesame_device_uuid && e.has_secret && e.has_api_key;

  // この棟に泊まる、今〜24時間以内の予約 (電話下4桁 = PIN で入れる人)
  const upcoming = useMemo(() => {
    const now = Date.now();
    const ids = new Set(rooms.filter((r) => (r.building || "Crane Nest") === e.building).map((r) => r.id));
    const slugToId = new Map(rooms.map((r) => [r.slug, r.id]));
    return reservations.filter((r) => {
      const rid = r.assigned_room_id || slugToId.get(r.room_slug);
      return r.status === "active" && rid && ids.has(rid) &&
        new Date(r.check_out).getTime() > now && new Date(r.check_in).getTime() - 86400000 <= now;
    });
  }, [rooms, reservations, e.building]);

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex gap-4 p-4">
        <button onClick={() => setBig(true)} className="shrink-0" title={t.qrTitle}>
          <img src={e.qr} alt="QR" className="h-24 w-24 rounded-xl bg-white p-1.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.display_name}</span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">{e.building}</span>
            {!e.is_active && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{t.inactive}</span>}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-white/40">/key/{e.slug}</p>
          <p className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
            <Chip ok={!!e.sesame_device_uuid}>UUID</Chip>
            <Chip ok={e.has_secret}>Secret</Chip>
            <Chip ok={e.has_api_key}>API{e.api_key_from_env ? " (env)" : ""}</Chip>
            {e.wifi_ssid && <Chip ok><Wifi className="inline h-3 w-3" /> {e.wifi_ssid}</Chip>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={async () => { await navigator.clipboard.writeText(e.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {t.copyUrl}
            </button>
            <a href={e.qr} download={`key-${e.slug}.png`}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              <Download className="h-3.5 w-3.5" /> {t.download}
            </a>
            <button onClick={() => printPoster(e)}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              <Printer className="h-3.5 w-3.5" /> {t.print}
            </button>
          </div>
        </div>
      </div>

      {/* 実機操作 */}
      <div className="border-t border-white/10 p-4">
        <RealLockControls target={{ kind: "entrance", id: e.id }} disabled={!ready} t={t} />
      </div>

      {/* 使える予約 */}
      <div className="border-t border-white/10 px-4 py-3">
        <p className="mb-1.5 text-[11px] text-white/45">{t.todayGuests}</p>
        {upcoming.length === 0 ? <p className="text-[11px] text-white/30">{t.none}</p> : (
          <ul className="space-y-1">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-white/80">{r.assigned_room_name ?? r.room_name}</span>
                <span className="text-white/35">{fmt(r.check_in, lang)} → {fmt(r.check_out, lang)}</span>
                <span className="ml-auto font-mono text-cyan-200">{r.unlock_pin ?? "----"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={() => setEditing((v) => !v)}
        className="flex w-full items-center justify-center gap-1 border-t border-white/10 py-2.5 text-xs text-white/55">
        {editing ? t.close : t.edit} <ChevronDown className={`h-3.5 w-3.5 transition ${editing ? "rotate-180" : ""}`} />
      </button>
      {editing && (
        <div className="border-t border-white/10 p-4">
          <EntranceForm e={e} buildings={buildings} t={t} />
        </div>
      )}

      {big && (
        <div onClick={() => setBig(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="rounded-3xl bg-white p-6 text-center text-[#0b2f6e]">
            <img src={e.qr} alt="QR" className="mx-auto h-72 w-72" />
            <p className="mt-3 font-semibold">{e.display_name}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{e.url}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 ${ok ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>
      {ok ? "✓" : "×"} {children}
    </span>
  );
}

/** 掲示用ポスターを印刷 (4言語の案内 + QR)。 */
function printPoster(e: AdminEntrance) {
  const w = window.open("", "_blank", "width=720,height=960");
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(e.display_name)}</title>
<style>body{font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#0b2f6e;text-align:center;margin:40px}
h1{font-size:30px;margin:0 0 6px}p{margin:4px 0;font-size:16px}.qr{width:360px;height:360px;margin:24px auto}
.langs{margin-top:18px;line-height:1.9;font-size:15px;color:#334}.url{font-family:monospace;font-size:12px;color:#667;margin-top:16px}
.bar{height:10px;background:linear-gradient(90deg,#0b2f6e,#1d6fe0);border-radius:6px;margin-bottom:28px}.dot{color:#e0a800}</style></head>
<body><div class="bar"></div><h1>🔑 ${esc(e.display_name)}</h1><p>Smart Key</p>
<img class="qr" src="${e.qr}" alt="QR"/>
<div class="langs">
<div>スマホでQRを読み取り、お名前と電話番号の下4桁を入力してください</div>
<div>Scan with your phone, then enter your name and the last 4 digits of your phone number</div>
<div>請用手機掃描 QR，輸入姓名與電話號碼末 4 碼</div>
<div>请用手机扫描二维码，输入姓名和手机号码后 4 位</div>
<div>휴대폰으로 QR을 스캔한 뒤 이름과 전화번호 뒤 4자리를 입력하세요</div>
</div><div class="url">${esc(e.url)}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

/* ---------------- 実機操作ボタン ---------------- */
async function adminCmd(body: Record<string, unknown>): Promise<CmdResult & { locked?: boolean | null; battery?: number | null }> {
  try {
    const res = await fetch("/api/admin/smartkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok && j.ok !== false, error: j.error, locked: j.locked, battery: j.battery };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

function RealLockControls({ target, disabled, t }: { target: { kind: "entrance"; id: string }; disabled: boolean; t: LT }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (action: "unlock" | "lock" | "status") => {
    if (busy) return;
    if (action === "unlock" && !armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setBusy(action); setMsg(null);
    const r = await adminCmd({ target: "entrance", entranceId: target.id, action });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error ?? "ERROR" }); return; }
    if (action === "status") {
      const st = r.locked === true ? t.locked : r.locked === false ? t.unlockedS : "?";
      setMsg({ ok: true, text: `${st}${typeof r.battery === "number" ? ` · ${t.battery} ${r.battery}%` : ""}` });
    } else {
      setMsg({ ok: true, text: action === "unlock" ? t.unlockedS : t.locked });
    }
  };

  const btn = "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-40";
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => run("status")} disabled={disabled || !!busy} className={`${btn} border-cyan-400/40 bg-cyan-500/10 text-cyan-200`}>
          {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} {t.status}
        </button>
        <button onClick={() => run("unlock")} disabled={disabled || !!busy}
          className={`${btn} ${armed ? "border-amber-300 bg-amber-500/30 text-amber-50" : "border-amber-400/40 bg-amber-500/10 text-amber-200"}`}>
          {busy === "unlock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} {armed ? t.again : t.unlock}
        </button>
        <button onClick={() => run("lock")} disabled={disabled || !!busy} className={`${btn} border-emerald-400/40 bg-emerald-500/10 text-emerald-200`}>
          {busy === "lock" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {t.lock}
        </button>
      </div>
      {msg && <p className={`mt-2 text-[11px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.ok ? "✓ " : "× "}{msg.text}</p>}
    </div>
  );
}

/* ---------------- ゲスト画面の設定 ---------------- */
function SettingsCard({
  saved, draft, setDraft, t,
}: { saved: SmartKeySettings; draft: SmartKeySettings; setDraft: (s: SmartKeySettings) => void; t: LT }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const keys: (keyof SmartKeySettings)[] = ["hold_ms", "countdown_sec", "show_lock_now", "show_keypad_code", "show_wifi", "show_support"];
  const dirty = keys.some((k) => draft[k] !== saved[k]);

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await saveSmartKeySettings(draft).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    if (!r.ok) setErr(r.error ?? "ERROR");
    router.refresh();
  };

  const toggles: { k: "show_lock_now" | "show_keypad_code" | "show_wifi" | "show_support"; label: string }[] = [
    { k: "show_lock_now", label: t.showLockNow },
    { k: "show_keypad_code", label: t.showKeypad },
    { k: "show_wifi", label: t.showWifi },
    { k: "show_support", label: t.showSupport },
  ];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <p className="text-sm font-semibold text-cyan-100">{t.guestSettings}</p>
        <span className={`text-[11px] ${dirty ? "text-amber-300" : "text-white/40"}`}>{dirty ? t.unsaved : t.savedState}</span>
      </div>
      <div className="space-y-5 p-5">
        <Slider label={t.hold} hint={t.holdHint} value={draft.hold_ms / 1000} min={0.5} max={3} step={0.1} unit={t.sec}
          onChange={(v) => setDraft({ ...draft, hold_ms: Math.round(v * 1000) })} display={(v) => v.toFixed(1)} />
        <Slider label={t.countdown} hint={t.countdownHint} value={draft.countdown_sec} min={3} max={60} step={1} unit={t.sec}
          onChange={(v) => setDraft({ ...draft, countdown_sec: Math.round(v) })} display={(v) => String(v)} />

        <div className="space-y-2">
          {toggles.map(({ k, label }) => (
            <label key={k} className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
              <span className="text-white/80">{label}</span>
              <input type="checkbox" checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} className="peer sr-only" />
              <span className="relative h-7 w-12 rounded-full bg-white/15 transition-colors peer-checked:bg-cyan-500
                after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-['']
                peer-checked:after:translate-x-5" />
            </label>
          ))}
        </div>

        {err && <p className="text-xs text-rose-300">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={!dirty || busy}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-[#04121c] disabled:opacity-35">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t.saveApply}
          </button>
          <button onClick={() => setDraft(saved)} disabled={!dirty}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70 disabled:opacity-35">
            <Undo2 className="h-4 w-4" /> {t.revert}
          </button>
          <button onClick={() => setDraft({ ...DEFAULT_SMARTKEY_SETTINGS, app_unlock_enabled: saved.app_unlock_enabled })}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70">
            <RotateCcw className="h-4 w-4" /> {t.reset}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, hint, value, min, max, step, unit, onChange, display,
}: { label: string; hint: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; display: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-white/85">{label}</p>
        <p className="font-mono text-base text-cyan-300">{display(value)} {unit}</p>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-cyan-400" />
      <p className="mt-1 text-[11px] text-white/40">{hint}</p>
    </div>
  );
}

/* ---------------- プレビュー (ツール → テスト に表示) ---------------- */
type Sim = "ok" | "fail" | "rate";

/** ツール→テストに置くゲスト画面プレビュー (保存済みの設定で表示)。 */
export function SmartKeyPreview({
  entrances, settings, rooms, lang,
}: { entrances: AdminEntrance[]; settings: SmartKeySettings; rooms: Room[]; lang: AdminLang }) {
  const t = L[lang];
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-violet-200">
        <KeyRound className="h-4 w-4" /> {t.previewTitle}
      </div>
      <PreviewSection draft={settings} entrances={entrances} rooms={rooms} t={t} lang={lang} />
    </div>
  );
}

function PreviewSection({
  draft, entrances, rooms, t, lang,
}: { draft: SmartKeySettings; entrances: AdminEntrance[]; rooms: Room[]; t: LT; lang: AdminLang }) {
  const [state, setState] = useState<KeyState>("active");
  const [skLang, setSkLang] = useState<SkLang>(lang === "zh" ? "zh" : lang === "en" ? "en" : "ja");
  const [doors, setDoors] = useState<1 | 2>(2);
  const [sim, setSim] = useState<Sim>("ok");
  const [mode, setMode] = useState<"sim" | "real">("sim");
  const [entranceId, setEntranceId] = useState<string>(entrances[0]?.id ?? "");
  const entrance = entrances.find((e) => e.id === entranceId) ?? entrances[0];
  const buildingRooms = rooms.filter((r) => !entrance || (r.building || "Crane Nest") === entrance.building);
  const [roomSlug, setRoomSlug] = useState<string>("");
  useEffect(() => {
    if (!buildingRooms.some((r) => r.slug === roomSlug)) {
      setRoomSlug((buildingRooms.find((r) => r.has_lock) ?? buildingRooms[0])?.slug ?? "");
    }
  }, [entranceId, buildingRooms, roomSlug]);
  const room = rooms.find((r) => r.slug === roomSlug);

  // サンプル滞在: 昨日15:00 → 明日10:00 (開始前は明日から)
  const data: GuestKeyData = useMemo(() => {
    const jstMidnight = (() => {
      const d = new Date(Date.now() + 9 * 3600e3); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 9 * 3600e3;
    })();
    const day = 86400e3;
    const ci = state === "before" ? jstMidnight + day + 15 * 3600e3 : state === "expired" ? jstMidnight - 3 * day + 15 * 3600e3 : jstMidnight - day + 15 * 3600e3;
    const co = state === "before" ? jstMidnight + 3 * day + 10 * 3600e3 : state === "expired" ? jstMidnight - day + 10 * 3600e3 : jstMidnight + day + 10 * 3600e3;
    return {
      entranceSlug: entrance?.slug ?? "preview",
      entranceName: entrance?.display_name ?? "Crane Nest Entrance",
      building: entrance?.building ?? "Crane Nest",
      guestName: "CHEN",
      roomName: room?.display_name ?? "HARU",
      roomSlug: room?.slug ?? null,
      roomHasLock: mode === "real" ? !!room?.has_lock : true,
      checkIn: new Date(ci).toISOString(),
      checkOut: new Date(co).toISOString(),
      reservationCode: "A1B2C3D4",
      keypadCode: entrance?.keypad_code || "246810",
      wifiSsid: entrance?.wifi_ssid || "CraneNest-Guest",
      wifiPassword: entrance?.wifi_password || "crane-stay-2026",
      supportUrl: entrance?.support_url || "#",
    };
  }, [state, entrance, room, mode]);

  const onCommand = async (door: Door, action: "unlock" | "lock"): Promise<CmdResult> => {
    if (mode === "real") {
      if (door === "entrance") {
        if (!entrance) return { ok: false, error: "NO_LOCK" };
        return adminCmd({ target: "entrance", entranceId: entrance.id, action });
      }
      if (!room) return { ok: false, error: "NO_LOCK" };
      return adminCmd({ target: "room", roomSlug: room.slug, action });
    }
    await new Promise((r) => setTimeout(r, 700));
    if (sim === "fail") return { ok: false, error: "DEVICE_ERROR" };
    if (sim === "rate") return { ok: false, error: "RATE_LIMIT" };
    return { ok: true };
  };

  return (
    <div className="space-y-4">
      <div className={`${card} overflow-hidden`}>
        <div className="border-b border-white/10 px-5 py-3.5 text-sm font-semibold text-cyan-100">{t.preview}</div>
        <div className="space-y-4 p-5">
          <ChipRow label={t.mode} value={mode} onChange={(v) => setMode(v as "sim" | "real")}
            options={[{ v: "sim", l: t.modeSim, icon: <FlaskConical className="h-3.5 w-3.5" /> }, { v: "real", l: t.modeReal, icon: <Zap className="h-3.5 w-3.5" /> }]}
            danger="real" />
          {mode === "real" && (
            <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3">
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-100"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.realWarn}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label={t.targetEntrance}>
                  <select value={entrance?.id ?? ""} onChange={(e) => setEntranceId(e.target.value)} className={inputCls}>
                    {entrances.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
                  </select>
                </Field>
                <Field label={t.targetRoom}>
                  <select value={roomSlug} onChange={(e) => setRoomSlug(e.target.value)} className={inputCls}>
                    {buildingRooms.map((r) => <option key={r.id} value={r.slug}>{r.display_name}{r.has_lock ? "" : ` ${t.noLockRoom}`}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}
          <ChipRow label={t.screenState} value={state} onChange={(v) => setState(v as KeyState)}
            options={[{ v: "verify", l: t.stVerify }, { v: "before", l: t.stBefore }, { v: "active", l: t.stActive }, { v: "expired", l: t.stExpired }]} />
          <ChipRow label={t.language} value={skLang} onChange={(v) => setSkLang(v as SkLang)}
            options={SK_LANGS.map((l) => ({ v: l, l: SK_LANG_LABEL[l] }))} />
          <ChipRow label={t.doors} value={String(doors)} onChange={(v) => setDoors(v === "1" ? 1 : 2)}
            options={[{ v: "1", l: t.door1 }, { v: "2", l: t.door2 }]} />
          {mode === "sim" && (
            <ChipRow label={t.sim} value={sim} onChange={(v) => setSim(v as Sim)}
              options={[{ v: "ok", l: t.simOk }, { v: "fail", l: t.simFail }, { v: "rate", l: t.simRate }]} />
          )}
          <p className="text-[11px] leading-relaxed text-white/40">{t.previewNote}</p>
        </div>
      </div>

      {/* スマホ枠 */}
      <div className="mx-auto w-full max-w-[400px] rounded-[48px] border-[10px] border-[#101a33] bg-[#101a33] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="h-[760px] overflow-y-auto overflow-x-hidden rounded-[38px] [scrollbar-width:none]">
          <SmartKeyScreen
            framed
            data={data}
            settings={draft}
            state={state}
            lang={skLang}
            onLang={setSkLang}
            doors={doors}
            roomPanelHref={room ? `/admin/test/${room.slug}` : null}
            onVerify={async () => { await new Promise((r) => setTimeout(r, 500)); setState("active"); return { ok: true }; }}
            onCommand={onCommand}
            badge={
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${mode === "real" ? "bg-amber-400 text-[#3b2600]" : "bg-white/20 text-white"}`}>
                {mode === "real" ? <Zap className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />} {mode === "real" ? "LIVE" : "PREVIEW"}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function ChipRow({
  label, value, onChange, options, danger,
}: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string; icon?: React.ReactNode }[]; danger?: string }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold text-white/45">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.v === value;
          const dangerOn = on && danger === o.v;
          return (
            <button key={o.v} onClick={() => onChange(o.v)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition
                ${dangerOn ? "bg-amber-400 text-[#2a1a00]" : on ? "bg-cyan-500 text-[#04121c]" : "border border-white/10 bg-white/5 text-white/65"}`}>
              {o.icon}{o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- ログ ---------------- */
function LogsCard({ logs, t, lang }: { logs: EntranceLog[]; t: LT; lang: AdminLang }) {
  const label: Record<string, string> = {
    verify: `✓ ${t.stVerify}`, verify_fail: `× ${t.stVerify}`,
    unlock: `🏢 ${t.unlock}`, lock: `🏢 ${t.lock}`,
    room_unlock: `🚪 ${t.unlock}`, room_lock: `🚪 ${t.lock}`,
    stop: `⛔ ${t.stop}`, resume: `▶ ${t.resume}`,
  };
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5 text-sm font-semibold text-cyan-100">
        <History className="h-4 w-4" /> {t.logs}
      </div>
      {logs.length === 0 ? (
        <p className="p-6 text-center text-xs text-white/40">{t.noLogs}</p>
      ) : (
        <div className="max-h-[900px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wide text-white/35">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2">{t.when}</th><th className="px-2 py-2">{t.what}</th><th className="px-2 py-2">{t.who}</th><th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-white/5 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-white/50">{fmt(l.created_at, lang)}</td>
                  <td className="px-2 py-2">
                    <span className="text-white/85">{label[l.action] ?? l.action}</span>
                    <span className="block text-[10px] text-white/35">{[l.entrance_name, l.room_name].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-2 py-2 text-white/65">{l.source === "admin" ? "Admin" : l.guest_name ?? "—"}</td>
                  <td className="px-2 py-2">{l.success ? <Check className="h-4 w-4 text-emerald-300" /> : <span className="text-rose-300">×</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="text-xs text-white/60">{label}<div className="mt-1">{children}</div></label>;
}
