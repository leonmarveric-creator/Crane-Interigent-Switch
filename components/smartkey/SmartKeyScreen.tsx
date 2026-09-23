"use client";

// =========================================================
// スマートキー画面（ゲスト用・管理画面プレビュー共通）
//   エントランス / お部屋 を切り替えて、長押しで解錠。
//   実際の通信は onVerify / onCommand に委ねる (ゲスト=API, 管理=シミュレーション or 実機)。
// =========================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound, Globe, CalendarDays, Lock, LockOpen, Loader2, Eye, EyeOff, Clock, Wifi, Copy, Check,
  MessageCircle, ShieldCheck, AlertTriangle, Ban, DoorOpen, ChevronRight, UserRound, Hash,
} from "lucide-react";
import { SK, SK_LANGS, SK_LANG_LABEL, fmtStay, fmtTime, type SkLang } from "@/lib/smartkeyI18n";
import type { GuestKeyData, KeyState, SmartKeySettings, LockMode } from "@/lib/smartkeyLogic";

export type Door = "entrance" | "room";
export type CmdResult = { ok: boolean; error?: string };

export interface SmartKeyScreenProps {
  data: GuestKeyData;
  settings: SmartKeySettings;
  state: KeyState;
  lang: SkLang;
  onLang: (l: SkLang) => void;
  doors: 1 | 2;
  onVerify: (name: string, digits: string) => Promise<CmdResult>;
  onCommand: (door: Door, action: "unlock" | "lock") => Promise<CmdResult>;
  onVerifyAgain?: () => void;
  roomPanelHref?: string | null;
  /** 管理画面のスマホ枠内に表示する場合 true (画面全体ではなく枠内でスクロール) */
  framed?: boolean;
  /** ヘッダ右上に出す補助バッジ (管理プレビュー用) */
  badge?: React.ReactNode;
}

type Phase = "idle" | "holding" | "sending" | "unlocked" | "locking" | "error";
interface DoorUi { phase: Phase; msg: string | null; remaining: number; mode: LockMode }
const IDLE: DoorUi = { phase: "idle", msg: null, remaining: 0, mode: "timer" };
/** センサー施錠のとき「OPEN」表示を出しておく秒数 (その後は施錠待ちの表示に戻す) */
const SENSOR_OPEN_SEC = 30;

export default function SmartKeyScreen(p: SmartKeyScreenProps) {
  const t = SK[p.lang];
  const [door, setDoor] = useState<Door>("entrance");
  const [ui, setUi] = useState<Record<Door, DoorUi>>({ entrance: IDLE, room: IDLE });
  const [langOpen, setLangOpen] = useState(false);
  const cur = ui[door];
  const set = useCallback((d: Door, v: Partial<DoorUi>) => setUi((u) => ({ ...u, [d]: { ...u[d], ...v } })), []);

  useEffect(() => { if (p.doors === 1) setDoor("entrance"); }, [p.doors]);
  // 状態や設定が変わったら (プレビュー切替など) 表示をリセット
  useEffect(() => { setUi({ entrance: IDLE, room: IDLE }); }, [p.state, p.settings.app_unlock_enabled]);

  // 解錠後のカウントダウン (表示のみ。実際の自動施錠は鍵本体の設定)
  useEffect(() => {
    const id = setInterval(() => {
      setUi((u) => {
        let changed = false;
        const next = { ...u };
        (Object.keys(u) as Door[]).forEach((d) => {
          if (u[d].phase === "unlocked" && u[d].remaining > 0) {
            changed = true;
            next[d] = u[d].remaining <= 1 ? { ...IDLE, mode: u[d].mode } : { ...u[d], remaining: u[d].remaining - 1 };
          }
        });
        return changed ? next : u;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const errText = (e?: string) =>
    e === "RATE_LIMIT" ? t.rateLimit
    : e === "STOPPED" ? t.stoppedMsg
    : e === "NO_LOCK" ? t.noLock
    : e === "NETWORK" ? t.genericErr
    : t.failed;

  const modeOf = (d: Door): LockMode => (d === "entrance" ? p.settings.entrance_lock : p.settings.room_lock);

  const doUnlock = async () => {
    const d = door;
    set(d, { phase: "sending", msg: null });
    const r = await p.onCommand(d, "unlock").catch(() => ({ ok: false, error: "NETWORK" }));
    if (r.ok) {
      vibrate([20, 40, 60]);
      const mode = modeOf(d);
      set(d, {
        phase: "unlocked", msg: null, mode,
        remaining: mode === "timer" ? p.settings.countdown_sec : mode === "sensor" ? SENSOR_OPEN_SEC : -1,
      });
    } else {
      vibrate([30, 60, 30]);
      set(d, { phase: "error", msg: errText(r.error) });
    }
  };

  const doLock = async () => {
    const d = door;
    set(d, { phase: "locking" });
    const r = await p.onCommand(d, "lock").catch(() => ({ ok: false, error: "NETWORK" }));
    set(d, r.ok ? { phase: "idle", msg: t.lockedDone } : { phase: "error", msg: errText(r.error) });
  };

  const stopped = !p.settings.app_unlock_enabled;
  const disabled = p.state !== "active" || stopped;
  const roomTabNoLock = door === "room" && !p.data.roomHasLock;

  const chip =
    p.state === "verify" ? { text: t.verifyChip, dot: "bg-sky-300" }
    : p.state === "before" ? { text: t.before, dot: "bg-sky-300" }
    : p.state === "expired" ? { text: t.expired, dot: "bg-slate-300" }
    : stopped ? { text: t.stopped, dot: "bg-rose-400" }
    : { text: t.available, dot: "bg-[#f5c542]" };

  const Shell = p.framed ? "div" : "main";

  return (
    <Shell
      className={`relative bg-[#eef3fb] font-['Noto_Sans_JP',system-ui,sans-serif] text-[#10213f] [color-scheme:light] ${p.framed ? "min-h-full" : "min-h-dvh"}`}
      style={{ WebkitTapHighlightColor: "transparent" }}>
      {/* ヘッダ (青いグラデーション + 下の曲線) */}
      <div className="relative overflow-hidden pb-24 pt-5 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2f6e] via-[#1253b8] to-[#1e7be0]" />
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <svg className="absolute -bottom-px left-0 h-[61px] w-full" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 60 L0 38 Q200 -4 400 38 L400 60 Z" fill="#eef3fb" />
          <path d="M0 40 Q200 -2 400 40" fill="none" stroke="#f5c542" strokeOpacity="0.55" strokeWidth="1.5" />
        </svg>

        <div className="relative mx-auto max-w-md px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5c542] text-[#0b2f6e] shadow-md">
                <KeyRound className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <p className="truncate text-[17px] font-semibold tracking-wide">
                {p.data.building} <span className="font-normal text-white/75">Smart Key</span>
              </p>
            </div>
            <div className="relative flex shrink-0 items-center gap-2">
              {p.badge}
              <button onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <Globe className="h-4 w-4" /> {SK_LANG_LABEL[p.lang]}
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-10 z-30 w-36 overflow-hidden rounded-2xl bg-white py-1 text-sm text-[#10213f] shadow-xl">
                    {SK_LANGS.map((l) => (
                      <li key={l}>
                        <button onClick={() => { p.onLang(l); setLangOpen(false); }}
                          className={`w-full px-4 py-2 text-left ${l === p.lang ? "bg-[#e8f0fd] font-semibold text-[#1253b8]" : ""}`}>
                          {SK_LANG_LABEL[l]}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${chip.dot}`} /> {chip.text}
          </span>

          {p.state === "verify" ? (
            <>
              <h1 className="mt-3 text-[26px] font-bold leading-tight">{t.verifyTitle}</h1>
              <p className="mt-1 text-sm text-white/75">{p.data.entranceName}</p>
            </>
          ) : (
            <>
              <h1 className="mt-3 break-words text-[28px] font-bold leading-tight">
                {p.data.guestName ? t.welcome(p.data.guestName) : t.welcomeNoName}
              </h1>
              <p className="mt-1 text-sm text-white/75">
                {p.data.building}{p.data.roomName ? <> · {p.data.roomName}</> : null}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 px-3.5 py-1.5 text-[13px]">
                <CalendarDays className="h-4 w-4 text-[#f5c542]" />
                <span>{fmtStay(p.data.checkIn, p.lang)}</span>
                <span className="text-white/60">→</span>
                <span>{fmtStay(p.data.checkOut, p.lang)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative mx-auto -mt-20 max-w-md px-4 pb-10">
        {p.state === "verify" ? (
          <VerifyCard t={t} onVerify={p.onVerify} />
        ) : (
          <>
            {/* 鍵カード */}
            <div className="rounded-[28px] bg-white p-4 pb-6 shadow-[0_18px_40px_-18px_rgba(16,33,63,0.35)]">
              {p.doors === 2 && (
                <div className="mb-2 grid grid-cols-2 rounded-full bg-[#eaf1fc] p-1 text-sm font-semibold">
                  {(["entrance", "room"] as Door[]).map((d) => (
                    <button key={d} onClick={() => setDoor(d)}
                      className={`rounded-full py-2.5 transition ${door === d ? "bg-gradient-to-r from-[#0b2f6e] to-[#1253b8] text-white shadow" : "text-[#10213f]/80"}`}>
                      {d === "entrance" ? t.entrance : t.room}
                    </button>
                  ))}
                </div>
              )}

              {roomTabNoLock ? (
                <RoomNoLock t={t} href={p.roomPanelHref} roomName={p.data.roomName} />
              ) : (
                <HoldButton
                  key={door}
                  holdMs={p.settings.hold_ms}
                  countdown={p.settings.countdown_sec}
                  ui={cur}
                  disabled={disabled}
                  onComplete={doUnlock}
                  onHoldStart={() => set(door, { phase: "holding", msg: null })}
                  onHoldCancel={() => set(door, { phase: "idle" })}
                  t={t}
                  label={door === "room" ? t.holdToUnlockRoom : t.holdToUnlock}
                />
              )}

              {/* 状態メッセージ */}
              <div className="mt-1 min-h-[1.5rem] px-2 text-center text-[13px]">
                {p.state === "before" && <p className="text-[#1253b8]">{t.notStarted(fmtStay(p.data.checkIn, p.lang))}</p>}
                {p.state === "expired" && <p className="text-slate-500">{t.expiredMsg}</p>}
                {p.state === "active" && stopped && (
                  <p className="flex items-start justify-center gap-1.5 text-rose-600"><Ban className="mt-0.5 h-4 w-4 shrink-0" />{t.stoppedMsg}</p>
                )}
                {p.state === "active" && !stopped && !roomTabNoLock && cur.phase === "error" && cur.msg && (
                  <p className="flex items-start justify-center gap-1.5 text-rose-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{cur.msg}</p>
                )}
                {p.state === "active" && !stopped && cur.phase === "idle" && cur.msg && (
                  <p className="text-emerald-600">{cur.msg}</p>
                )}
              </div>

              {cur.phase === "unlocked" && cur.mode !== "sensor" && (p.settings.show_lock_now || cur.mode === "off") && !roomTabNoLock && (
                <div className="mt-2 flex justify-center">
                  <button onClick={doLock}
                    className="flex items-center gap-2 rounded-full border border-[#1253b8]/30 bg-[#eaf1fc] px-5 py-2.5 text-sm font-semibold text-[#0b2f6e] active:scale-95">
                    <Lock className="h-4 w-4" /> {cur.mode === "off" ? t.lockBtn : t.lockNow}
                  </button>
                </div>
              )}

              {door === "room" && !roomTabNoLock && p.roomPanelHref && (
                <a href={p.roomPanelHref}
                  className="mx-auto mt-4 flex w-fit items-center gap-1.5 text-[13px] font-medium text-[#1253b8]">
                  <DoorOpen className="h-4 w-4" /> {t.roomPanel} <ChevronRight className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* 情報カード */}
            {(p.state === "active" || p.state === "before") && (
              <>
                <div className={`mt-4 grid gap-3 ${p.settings.show_keypad_code && p.data.keypadCode ? "grid-cols-2" : "grid-cols-1"}`}>
                  {p.settings.show_keypad_code && p.data.keypadCode && <KeypadCard t={t} code={p.data.keypadCode} />}
                  <div className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(16,33,63,0.35)]">
                    <p className="flex items-center gap-1.5 text-sm text-[#10213f]/65"><Clock className="h-4 w-4 text-[#1253b8]" /> {t.checkout}</p>
                    <p className="mt-2 text-[32px] font-bold leading-none tracking-tight">{fmtTime(p.data.checkOut)}</p>
                  </div>
                </div>

                {p.settings.show_wifi && p.data.wifiSsid && (
                  <WifiCard t={t} ssid={p.data.wifiSsid} password={p.data.wifiPassword} />
                )}
              </>
            )}

            {p.settings.show_support && p.data.supportUrl && (
              <a href={p.data.supportUrl} target="_blank" rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-3xl bg-[#e3ecfa] py-4 text-[15px] font-semibold text-[#0b2f6e] active:scale-[0.99]">
                <MessageCircle className="h-5 w-5" /> {t.support}
              </a>
            )}

            <div className="mt-6 space-y-1 text-center text-xs text-[#10213f]/55">
              <p className="flex items-center justify-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#1253b8]" /> {t.validOnly}</p>
              {p.data.reservationCode && <p>{t.reservationNo} {p.data.reservationCode} · {p.data.entranceName}</p>}
              {p.onVerifyAgain && (
                <button onClick={p.onVerifyAgain} className="pt-2 text-[11px] text-[#1253b8]/80 underline underline-offset-2">{t.verifyAgain}</button>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function vibrate(pattern: number[]) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch { /* noop */ }
}

/* ---------------- 長押しボタン ---------------- */
function HoldButton({
  holdMs, countdown, ui, disabled, onComplete, onHoldStart, onHoldCancel, t, label,
}: {
  holdMs: number; countdown: number; ui: DoorUi; disabled: boolean;
  onComplete: () => void; onHoldStart: () => void; onHoldCancel: () => void;
  t: (typeof SK)["ja"]; label: string;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);

  const busy = ui.phase === "sending" || ui.phase === "locking";
  const canHold = !disabled && !busy && ui.phase !== "unlocked";

  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; };
  useEffect(() => stop, []);

  const down = (e: React.PointerEvent) => {
    if (!canHold) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    done.current = false;
    start.current = performance.now();
    onHoldStart();
    vibrate([8]);
    const step = () => {
      const pr = Math.min(1, (performance.now() - start.current) / holdMs);
      setProgress(pr);
      if (pr >= 1) { done.current = true; stop(); setProgress(0); onComplete(); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const up = () => {
    if (!raf.current) return;
    stop();
    setProgress(0);
    if (!done.current) onHoldCancel();
  };

  const R = 118;
  const C = 2 * Math.PI * R;
  const unlocked = ui.phase === "unlocked";
  const stay = unlocked && ui.mode !== "timer"; // センサー施錠 / 自動施錠しない → 残り秒は出さない
  const ring = stay ? 1 : unlocked ? ui.remaining / Math.max(1, countdown) : progress;
  const tone = unlocked
    ? "from-[#34d399] via-[#10b981] to-[#047857]"
    : ui.phase === "error"
    ? "from-[#fb7185] via-[#e11d48] to-[#9f1239]"
    : disabled
    ? "from-[#cbd5e1] via-[#94a3b8] to-[#64748b]"
    : "from-[#5aa9f5] via-[#1d6fe0] to-[#0b3f94]";

  const caption = unlocked && ui.mode === "sensor" ? t.sensorLock
    : stay ? t.stayUnlocked : unlocked ? t.autoLockIn(ui.remaining)
    : ui.phase === "sending" ? t.unlocking
    : ui.phase === "locking" ? t.locking
    : ui.phase === "holding" ? t.keepHolding
    : label;

  return (
    <div className="flex select-none flex-col items-center pt-6" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
      <div className="relative h-[260px] w-[260px]">
        <div className={`absolute inset-0 rounded-full ${unlocked ? "bg-emerald-100/70" : "bg-[#dbe8fb]/70"} blur-[2px]`} />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 260 260" aria-hidden>
          <circle cx="130" cy="130" r={R} fill="none" stroke={unlocked ? "#bbf7d0" : "#e3ecfa"} strokeWidth="8" />
          <circle cx="130" cy="130" r={R} fill="none" stroke={unlocked ? "#10b981" : "#f5c542"} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)}
            style={{ transition: unlocked ? "stroke-dashoffset 1s linear" : "none" }} />
        </svg>
        <motion.button
          type="button"
          aria-label={label}
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
          animate={ui.phase === "error" ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0, scale: ui.phase === "holding" ? 0.96 : 1 }}
          transition={{ duration: ui.phase === "error" ? 0.4 : 0.15 }}
          disabled={disabled && !unlocked}
          className={`absolute inset-[22px] flex touch-none flex-col items-center justify-center rounded-full bg-gradient-to-br ${tone}
            text-white shadow-[0_22px_40px_-14px_rgba(11,63,148,0.65),inset_0_2px_10px_rgba(255,255,255,0.35)]
            ${canHold ? "cursor-pointer" : "cursor-default"}`}>
          {ui.phase === "sending" || ui.phase === "locking"
            ? <Loader2 className="h-16 w-16 animate-spin" strokeWidth={1.8} />
            : unlocked
            ? <LockOpen className="h-[72px] w-[72px]" strokeWidth={2} />
            : <Lock className="h-[72px] w-[72px]" strokeWidth={2} />}
          <span className="mt-3 text-sm font-semibold tracking-[0.35em] text-white/85">
            {stay ? "OPEN" : unlocked ? `${ui.remaining}s` : t.hold}
          </span>
        </motion.button>
      </div>
      <p className={`mt-5 text-[17px] font-bold ${unlocked ? "text-emerald-600" : "text-[#0b2f6e]"}`}>
        {unlocked ? t.unlocked : caption}
      </p>
      {unlocked && <p className="mt-1 text-[13px] text-[#10213f]/60">{caption}</p>}
    </div>
  );
}

/* ---------------- 本人確認 ---------------- */
function VerifyCard({ t, onVerify }: { t: (typeof SK)["ja"]; onVerify: SmartKeyScreenProps["onVerify"] }) {
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || digits.length < 4 || busy) return;
    setBusy(true); setErr(null);
    const r = await onVerify(name.trim(), digits).catch(() => ({ ok: false, error: "NETWORK" }));
    setBusy(false);
    if (!r.ok) {
      setErr(r.error === "AMBIGUOUS" ? t.ambiguous : r.error === "LOCKED" ? t.lockedOut : r.error === "NETWORK" ? t.genericErr : t.badCode);
      setShake((s) => s + 1);
      vibrate([30, 60, 30]);
    }
  };

  return (
    <motion.form key={shake} onSubmit={submit}
      animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}}
      className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_-18px_rgba(16,33,63,0.35)]">
      <p className="text-sm leading-relaxed text-[#10213f]/70">{t.verifyDesc}</p>

      <label className="mt-5 block text-[13px] font-semibold text-[#10213f]/80">
        <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4 text-[#1253b8]" /> {t.nameLabel}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} autoComplete="name" maxLength={60}
          className="mt-2 w-full rounded-2xl border border-[#d6e2f5] bg-[#f6f9fe] px-4 py-3.5 text-base font-medium outline-none focus:border-[#1253b8] focus:bg-white" />
      </label>

      <label className="mt-4 block text-[13px] font-semibold text-[#10213f]/80">
        <span className="flex items-center gap-1.5"><Hash className="h-4 w-4 text-[#1253b8]" /> {t.digitsLabel}</span>
        <input value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" placeholder="••••" maxLength={6}
          className="mt-2 w-full rounded-2xl border border-[#d6e2f5] bg-[#f6f9fe] px-4 py-3.5 text-center font-mono text-3xl tracking-[0.6em] outline-none focus:border-[#1253b8] focus:bg-white" />
        <span className="mt-1.5 block text-xs font-normal text-[#10213f]/50">{t.digitsHint}</span>
      </label>

      {err && <p className="mt-4 flex items-start gap-1.5 text-[13px] text-rose-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{err}</p>}

      <button type="submit" disabled={busy || !name.trim() || digits.length < 4}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0b2f6e] to-[#1d6fe0] py-4 text-base font-bold text-white shadow-lg transition disabled:opacity-40">
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {t.verifying}</> : t.verifyBtn}
      </button>
    </motion.form>
  );
}

/* ---------------- 情報カード ---------------- */
function KeypadCard({ t, code }: { t: (typeof SK)["ja"]; code: string }) {
  const [show, setShow] = useState(false);
  return (
    <button onClick={() => setShow((s) => !s)}
      className="rounded-3xl bg-white p-4 text-left shadow-[0_10px_30px_-18px_rgba(16,33,63,0.35)]">
      <p className="flex items-center gap-1.5 text-sm text-[#10213f]/65"><KeyRound className="h-4 w-4 text-[#1253b8]" /> {t.keypad}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        {show
          ? <span className="font-mono text-[26px] font-bold tracking-[0.15em]">{code}</span>
          : <span className="flex gap-1.5">{Array.from({ length: Math.min(8, code.length) }).map((_, i) => <span key={i} className="h-3 w-3 rounded-full bg-[#10213f]" />)}</span>}
        {show ? <EyeOff className="h-5 w-5 text-[#10213f]/50" /> : <Eye className="h-5 w-5 text-[#10213f]/50" />}
      </div>
      {!show && <p className="mt-2 text-xs text-[#10213f]/50">{t.tapToShow}</p>}
    </button>
  );
}

function WifiCard({ t, ssid, password }: { t: (typeof SK)["ja"]; ssid: string; password: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(password || ssid); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(16,33,63,0.35)]">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#10213f]/65"><Wifi className="h-4 w-4 text-[#1253b8]" /> {t.wifi}</p>
        <p className="mt-1.5 truncate text-lg font-bold">{ssid}</p>
        {password && <p className="truncate font-mono text-sm tracking-wider text-[#10213f]/60">{password}</p>}
      </div>
      <button onClick={copy}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#f5c542] px-4 py-2.5 text-sm font-bold text-[#0b2f6e] active:scale-95">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

function RoomNoLock({ t, href, roomName }: { t: (typeof SK)["ja"]; href?: string | null; roomName: string | null }) {
  return (
    <div className="flex flex-col items-center px-4 pb-2 pt-8 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eaf1fc] text-[#1253b8]">
        <DoorOpen className="h-10 w-10" />
      </span>
      {roomName && <p className="mt-4 text-lg font-bold">{roomName}</p>}
      <p className="mt-2 text-sm leading-relaxed text-[#10213f]/65">{t.roomNoLock}</p>
      {href && (
        <a href={href}
          className="mt-5 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0b2f6e] to-[#1d6fe0] px-6 py-3 text-sm font-bold text-white shadow-lg">
          <DoorOpen className="h-4 w-4" /> {t.roomPanel}
        </a>
      )}
    </div>
  );
}
