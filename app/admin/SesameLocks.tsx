"use client";

// =========================================================
// Sesame 一覧（鍵の台帳）
//   ・Sesame を1台ずつ登録 (Sesame アプリの「鍵をシェア」QR 画像から自動読み取り可)
//   ・部屋 / エントランスにはプルダウンで割り当て
//   ・各鍵の状態確認 / 解錠 / 施錠
// =========================================================
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound, Plus, Loader2, Save, Trash2, ChevronDown, ImageUp, ClipboardPaste, Check, AlertTriangle,
  Activity, Lock, LockOpen, PencilLine,
} from "lucide-react";
import { parseSesameQr, type SesameQrResult } from "@/lib/sesameQr";
import type { AdminLang } from "@/lib/adminI18n";
import { saveSesameLock, deleteSesameLock, assignRoomLock } from "./sesameActions";

export interface AdminSesameLock {
  id: string; name: string; device_uuid: string; note: string | null;
  has_secret: boolean; has_api_key: boolean;
  used_by: string[];
}

/* ---------------- 文言 ---------------- */
const J = {
  title: "Sesame 一覧（鍵）", desc: "Sesame を1台ずつ登録しておくと、部屋・エントランスにプルダウンで割り当てられます。",
  missing: "Sesame 一覧のテーブルがありません。Supabase で supabase/migration_sesame_locks.sql を実行してください（今の部屋の鍵も自動で取り込まれます）。",
  add: "Sesame を追加", none: "まだ登録がありません", usedBy: "使用中", unused: "未使用",
  byQr: "QR画像から", byPaste: "リンクを貼り付け", byManual: "手入力",
  qrHelp: "Sesame アプリ → 鍵を選ぶ → 設定 →「鍵をシェア」で出る QR をスクリーンショットし、その画像を選んでください。",
  pasteHelp: "QR をカメラで読み取ったときの ssm://UI?t=sk&sk=… のリンクを貼り付けてください。",
  chooseImage: "画像を選ぶ", reading: "読み取り中…", readOk: "読み取りました。内容を確認して保存してください。",
  readFail: "QR を読み取れませんでした。QR 全体がはっきり写った画像か、リンクの貼り付け・手入力をお試しください。",
  noUuid: "これは「暗号化QR（10分間有効）」のようです。中身が一時的なコードのため、このままでは使えません。Sesame アプリの QR 画面下の「暗号化 QR」スイッチを OFF にしてから、もう一度スクリーンショットして読み込んでください。",
  name: "名前（例：HARU ドア）", uuid: "UUID", secret: "シークレットキー（32桁）", apiKey: "API キー（空欄なら登録済みの鍵と同じ）",
  keepBlank: "空欄なら変更しません", note: "メモ（任意）", save: "保存", saved: "保存しました", del: "一覧から削除", delConfirm: "もう一度押すと削除",
  edit: "編集", close: "閉じる", status: "状態", unlock: "解錠", lock: "施錠", again: "もう一度で実行",
  locked: "施錠中", unlockedS: "解錠中", battery: "電池",
  roomLock: "🔑 鍵（Sesame）", noneOpt: "（なし）", keepOpt: "（直接設定された鍵・そのまま）", inUse: "使用中",
  dupWarn: "この Sesame は他でも使われています",
};
type LT = typeof J;
const LX: Record<AdminLang, LT> = {
  ja: J,
  en: {
    ...J,
    title: "Sesame locks", desc: "Register each Sesame once, then assign it to rooms and entrances from a dropdown.",
    missing: "Sesame table missing. Run supabase/migration_sesame_locks.sql in Supabase (current room locks are imported automatically).",
    add: "Add Sesame", none: "Nothing registered yet", usedBy: "In use", unused: "Unused",
    byQr: "From QR image", byPaste: "Paste link", byManual: "Manual",
    qrHelp: "Sesame app → lock → Settings → Share key. Screenshot the QR and choose that image.",
    pasteHelp: "Paste the ssm://UI?t=sk&sk=… link you get when scanning the QR.",
    chooseImage: "Choose image", reading: "Reading…", readOk: "Read OK. Check the values and save.",
    readFail: "Could not read a QR. Try a clearer image, paste the link, or enter manually.",
    noUuid: "This looks like an encrypted QR (valid 10 min) with a temporary code. Turn OFF the “encrypted QR” switch under the QR in the Sesame app, screenshot again and load it.",
    name: "Name (e.g. HARU door)", secret: "Secret key (32 hex)", apiKey: "API key (blank = same as other locks)",
    keepBlank: "Leave blank to keep", note: "Note (optional)", save: "Save", saved: "Saved", del: "Remove", delConfirm: "Tap again to remove",
    edit: "Edit", close: "Close", status: "Status", unlock: "Unlock", lock: "Lock", again: "Tap again",
    locked: "Locked", unlockedS: "Unlocked", battery: "Battery",
    roomLock: "🔑 Lock (Sesame)", noneOpt: "(none)", keepOpt: "(set directly – keep)", inUse: "in use",
    dupWarn: "This Sesame is also used elsewhere",
  },
  zh: {
    ...J,
    title: "Sesame 列表（门锁）", desc: "先逐台登记 Sesame，之后可在房间和大门用下拉选择分配。",
    missing: "缺少 Sesame 数据表。请在 Supabase 执行 supabase/migration_sesame_locks.sql（现有房间门锁会自动导入）。",
    add: "添加 Sesame", none: "尚未登记", usedBy: "使用中", unused: "未使用",
    byQr: "从 QR 图片", byPaste: "粘贴链接", byManual: "手动输入",
    qrHelp: "Sesame App → 选择门锁 → 设置 →「分享钥匙」，截图 QR 后选择该图片。",
    pasteHelp: "粘贴扫描 QR 得到的 ssm://UI?t=sk&sk=… 链接。",
    chooseImage: "选择图片", reading: "读取中…", readOk: "已读取，请确认后保存。",
    readFail: "无法读取 QR。请使用更清晰的图片，或粘贴链接／手动输入。",
    noUuid: "这似乎是「加密二维码（10分钟内有效）」，内容为临时代码，无法直接使用。请在芝麻 App 二维码下方关闭「加密二维码」开关后，重新截图并读取。",
    name: "名称（例：HARU 门）", secret: "密钥（32 位）", apiKey: "API Key（留空＝与其他门锁相同）",
    keepBlank: "留空则不修改", note: "备注（可选）", save: "保存", saved: "已保存", del: "删除", delConfirm: "再按一次删除",
    edit: "编辑", close: "关闭", status: "状态", unlock: "开锁", lock: "上锁", again: "再按一次",
    locked: "已上锁", unlockedS: "已开锁", battery: "电量",
    roomLock: "🔑 门锁（Sesame）", noneOpt: "（无）", keepOpt: "（直接设置的门锁・保持）", inUse: "使用中",
    dupWarn: "此 Sesame 也在其他地方使用",
  },
};

const card = "clip-bevel border border-cyan-400/15 bg-[#070a12]/80 backdrop-blur-xl";
const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark] placeholder:text-white/25";

/* ---------------- 一覧セクション ---------------- */
export function SesameLocksSection({ locks, missing, lang }: { locks: AdminSesameLock[]; missing: boolean; lang: AdminLang }) {
  const t = LX[lang];
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-cyan-300" />
        <span className="text-sm text-cyan-100">{t.title}</span>
        <span className="h-px flex-1 bg-white/10" />
        {!missing && (
          <button onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <Plus className="h-3.5 w-3.5" /> {t.add}
          </button>
        )}
      </div>
      <p className="mb-3 text-[11px] text-white/40">{t.desc}</p>

      {missing && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t.missing}
        </div>
      )}

      {adding && (
        <div className={`${card} mb-4 p-5`}>
          <AddLock t={t} onDone={() => setAdding(false)} />
        </div>
      )}

      {!missing && locks.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-xs text-white/45">{t.none}</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {locks.map((l) => <LockCard key={l.id} l={l} t={t} />)}
      </div>
    </div>
  );
}

/* ---------------- 追加 (QR / 貼り付け / 手入力) ---------------- */
function AddLock({ t, onDone }: { t: LT; onDone: () => void }) {
  const [mode, setMode] = useState<"qr" | "paste" | "manual">("qr");
  const [parsed, setParsed] = useState<SesameQrResult | null>(null);
  const [readState, setReadState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [formKey, setFormKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (r: SesameQrResult | null) => {
    setParsed(r); setReadState(r ? "ok" : "fail"); setFormKey((k) => k + 1);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setReadState("busy");
    try { apply(parseSesameQr(await decodeQrFromImage(f) ?? "")); } catch { apply(null); }
  };

  const tabs: { k: typeof mode; label: string; Icon: any }[] = [
    { k: "qr", label: t.byQr, Icon: ImageUp },
    { k: "paste", label: t.byPaste, Icon: ClipboardPaste },
    { k: "manual", label: t.byManual, Icon: PencilLine },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-[11px] font-semibold">
        {tabs.map(({ k, label, Icon }) => (
          <button key={k} onClick={() => { setMode(k); setReadState("idle"); }}
            className={`flex items-center justify-center gap-1 rounded-full py-2 ${mode === k ? "bg-cyan-500/20 text-cyan-100" : "text-white/50"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "qr" && (
        <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-500/[0.04] p-4 text-center">
          <p className="text-[11px] leading-relaxed text-white/50">{t.qrHelp}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-[#04121c]">
            {readState === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {readState === "busy" ? t.reading : t.chooseImage}
          </button>
        </div>
      )}
      {mode === "paste" && (
        <div>
          <p className="mb-2 text-[11px] text-white/50">{t.pasteHelp}</p>
          <textarea rows={2} placeholder="ssm://UI?t=sk&sk=..." onChange={(e) => e.target.value.trim() && apply(parseSesameQr(e.target.value))}
            className={`${inputCls} font-mono text-xs`} />
        </div>
      )}

      {readState === "ok" && !!parsed?.deviceUuid && <p className="flex items-center gap-1.5 text-xs text-emerald-300"><Check className="h-4 w-4" /> {t.readOk}</p>}
      {readState === "fail" && <p className="flex items-start gap-1.5 text-xs text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t.readFail}</p>}
      {readState === "ok" && parsed && !parsed.deviceUuid && (
        <p className="flex items-start gap-1.5 text-xs text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t.noUuid}</p>
      )}

      {(mode === "manual" || (readState === "ok" && !!parsed?.deviceUuid)) && (
        <LockForm key={formKey} t={t} initial={{ name: parsed?.name ?? "", device_uuid: parsed?.deviceUuid ?? "", secret_key: parsed?.secretKey ?? "" }} onDone={onDone} />
      )}
    </div>
  );
}

/** 画像ファイルから QR の文字列を読む (jsQR。大きな画像は縮小してから)。 */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    for (const max of [1600, 1000, 2400]) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
      if (hit?.data) return hit.data;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------------- 登録 / 編集フォーム ---------------- */
function LockForm({
  t, initial, lock, onDone,
}: { t: LT; initial?: { name: string; device_uuid: string; secret_key: string }; lock?: AdminSesameLock; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (fd: FormData) => {
    setBusy(true); setMsg(null);
    const r = await saveSesameLock(fd).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: t.saved } : { ok: false, text: r.error ?? "ERROR" });
    if (r.ok) { router.refresh(); setTimeout(() => onDone?.(), 600); }
  };
  return (
    <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {lock && <input type="hidden" name="id" value={lock.id} />}
      <Field label={t.name}><input name="name" required defaultValue={lock?.name ?? initial?.name ?? ""} className={inputCls} /></Field>
      <Field label={t.uuid}>
        <input name="device_uuid" required defaultValue={lock?.device_uuid ?? initial?.device_uuid ?? ""}
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" className={`${inputCls} font-mono text-xs`} />
      </Field>
      <Field label={t.secret}>
        <input name="secret_key" type={lock ? "password" : "text"} autoComplete="off" required={!lock}
          defaultValue={initial?.secret_key ?? ""} placeholder={lock ? t.keepBlank : "0123456789abcdef…"} className={`${inputCls} font-mono text-xs`} />
      </Field>
      <Field label={t.apiKey}>
        <input name="api_key" type="password" autoComplete="off" placeholder={lock?.has_api_key ? t.keepBlank : ""} className={`${inputCls} font-mono text-xs`} />
      </Field>
      <div className="sm:col-span-2"><Field label={t.note}><input name="note" defaultValue={lock?.note ?? ""} className={inputCls} /></Field></div>
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

/* ---------------- 1台分のカード ---------------- */
function LockCard({ l, t }: { l: AdminSesameLock; t: LT }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [armedDel, setArmedDel] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  const del = async () => {
    if (!armedDel) { setArmedDel(true); setTimeout(() => setArmedDel(false), 4000); return; }
    const r = await deleteSesameLock(l.id).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    if (!r.ok) setDelErr(r.error ?? "ERROR"); else router.refresh();
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5c542]/90 text-[#0b2f6e]"><KeyRound className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{l.name}</p>
            <p className="truncate font-mono text-[10px] text-white/35">{l.device_uuid}</p>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
              {l.used_by.length === 0
                ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/45">{t.unused}</span>
                : l.used_by.map((u) => <span key={u} className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-200">{u}</span>)}
              {l.used_by.length > 1 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">⚠ {t.dupWarn}</span>}
              {!l.has_api_key && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-200">× API</span>}
            </div>
          </div>
        </div>
        <div className="mt-3"><LockControls lockId={l.id} t={t} /></div>
      </div>
      <button onClick={() => setEditing((v) => !v)}
        className="flex w-full items-center justify-center gap-1 border-t border-white/10 py-2.5 text-xs text-white/55">
        {editing ? t.close : t.edit} <ChevronDown className={`h-3.5 w-3.5 transition ${editing ? "rotate-180" : ""}`} />
      </button>
      {editing && (
        <div className="space-y-3 border-t border-white/10 p-4">
          <LockForm t={t} lock={l} />
          {l.used_by.length === 0 && (
            <button onClick={del}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs ${armedDel ? "border-rose-300 bg-rose-500/30 text-rose-50" : "border-rose-400/40 bg-rose-500/10 text-rose-200"}`}>
              <Trash2 className="h-3.5 w-3.5" /> {armedDel ? t.delConfirm : t.del}
            </button>
          )}
          {delErr && <p className="text-xs text-rose-300">{delErr}</p>}
        </div>
      )}
    </div>
  );
}

function LockControls({ lockId, t }: { lockId: string; t: LT }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (action: "status" | "unlock" | "lock") => {
    if (busy) return;
    if (action === "unlock" && !armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setBusy(action); setMsg(null);
    try {
      const res = await fetch("/api/admin/smartkey", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "lock", lockId, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) setMsg({ ok: false, text: j.error ?? "ERROR" });
      else if (action === "status") {
        const st = j.locked === true ? t.locked : j.locked === false ? t.unlockedS : "?";
        setMsg({ ok: true, text: `${st}${typeof j.battery === "number" ? ` · ${t.battery} ${j.battery}%` : ""}` });
      } else setMsg({ ok: true, text: action === "unlock" ? t.unlockedS : t.locked });
    } catch { setMsg({ ok: false, text: "NETWORK" }); }
    setBusy(null);
  };
  const btn = "flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-40";
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={() => run("status")} disabled={!!busy} className={`${btn} border-cyan-400/40 bg-cyan-500/10 text-cyan-200`}>
          {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />} {t.status}
        </button>
        <button onClick={() => run("unlock")} disabled={!!busy}
          className={`${btn} ${armed ? "border-amber-300 bg-amber-500/30 text-amber-50" : "border-amber-400/40 bg-amber-500/10 text-amber-200"}`}>
          {busy === "unlock" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockOpen className="h-3.5 w-3.5" />} {armed ? t.again : t.unlock}
        </button>
        <button onClick={() => run("lock")} disabled={!!busy} className={`${btn} border-emerald-400/40 bg-emerald-500/10 text-emerald-200`}>
          {busy === "lock" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} {t.lock}
        </button>
      </div>
      {msg && <p className={`mt-1.5 text-[11px] ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.ok ? "✓ " : "× "}{msg.text}</p>}
    </div>
  );
}

/* ---------------- 割り当て用プルダウン ---------------- */
export function LockSelect({
  locks, value, hasLegacy, name, lang, className,
}: { locks: AdminSesameLock[]; value: string | null; hasLegacy?: boolean; name: string; lang: AdminLang; className?: string }) {
  const t = LX[lang];
  const initial = value ?? (hasLegacy ? "__keep" : "");
  return (
    <select name={name} defaultValue={initial} className={className ?? inputCls}>
      <option value="">{t.noneOpt}</option>
      {hasLegacy && !value && <option value="__keep">{t.keepOpt}</option>}
      {locks.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}{l.used_by.length > 0 && l.id !== value ? `（${t.inUse}: ${l.used_by.join(", ")}）` : ""}
        </option>
      ))}
    </select>
  );
}

/** 部屋カードに置く「鍵（Sesame）」割り当てフォーム。 */
export function RoomLockForm({
  roomId, value, hasLegacy, locks, lang,
}: { roomId: string; value: string | null; hasLegacy: boolean; locks: AdminSesameLock[]; lang: AdminLang }) {
  const t = LX[lang];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (fd: FormData) => {
    setBusy(true); setMsg(null);
    const r = await assignRoomLock(fd).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: t.saved } : { ok: false, text: r.error ?? "ERROR" });
    if (r.ok) { router.refresh(); setTimeout(() => setMsg(null), 1800); }
  };
  return (
    <form action={submit} className="flex items-end gap-2">
      <input type="hidden" name="room_id" value={roomId} />
      <label className="flex-1 text-[11px] text-amber-200/80">
        <span className="flex items-center gap-1">{t.roomLock}
          {(value || hasLegacy) && <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] tracking-widest text-amber-100">ENABLED</span>}
        </span>
        <LockSelect locks={locks} value={value} hasLegacy={hasLegacy} name="lock_id" lang={lang}
          className="mt-1 w-full rounded-xl border border-amber-400/30 bg-black/40 px-3 py-2 text-xs text-white [color-scheme:dark]" />
      </label>
      <button type="submit" disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : msg?.ok ? <Check className="h-3.5 w-3.5" /> : null}
        {msg?.ok ? t.saved : t.save}
      </button>
      {msg && !msg.ok && <span className="text-[11px] text-rose-300">{msg.text}</span>}
    </form>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="text-xs text-white/60">{label}<div className="mt-1">{children}</div></label>;
}
