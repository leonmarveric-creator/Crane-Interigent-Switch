"use client";

/**
 * 早朝便の自動光目覚まし (お部屋の操作画面: ハイテク・和風・マジカル 共通)。
 *   ふだんは 1 行の帯。押すと時間の流れと「時間を変える / 使わない」が開く。
 *   「おやすみ」を押したときに一度だけ、画面いっぱいで確認する (lib/deviceClient の setGoodNightGate)。
 *   状態はサーバーで計算して渡す (この画面からは定期的に聞きに行かない)。
 */
import { useEffect, useState } from "react";
import { setGoodNightGate } from "@/lib/deviceClient";
import { WAKE_T, hmJst, wakeLang, type WakeState } from "@/lib/wakeAutoLogic";

type Variant = "tech" | "wafu" | "magic";
const STYLE: Record<Variant, { band: string; off: string; title: string; sub: string; panel: string; text: string; btn: string; pri: string }> = {
  tech: { band: "border-amber-300/70 bg-gradient-to-r from-amber-900/40 to-[#0b1622]/90", off: "border-cyan-400/20 bg-white/[0.04]", title: "text-amber-100", sub: "text-amber-200/75", panel: "border-amber-300/30 bg-[#0b1622]/90", text: "text-[#c9d8e8]", btn: "border-cyan-400/25 bg-white/[0.04] text-white", pri: "border-amber-300/70 text-amber-200" },
  wafu: { band: "border-[#c98a3a] bg-[#fff4e6]", off: "border-[#ded6c7] bg-[#fffdf8]", title: "text-[#8a5a1c]", sub: "text-[#8a5a1c]/75", panel: "border-[#ded6c7] bg-[#fffdf8]", text: "text-[#4a4537]", btn: "border-[#d6cfbb] bg-[#f8f5ee] text-[#2c2a26]", pri: "border-[#c98a3a] text-[#8a5a1c]" },
  magic: { band: "border-[#e9c97a] bg-gradient-to-r from-[#4a3410]/80 to-[#2a1a3a]/80", off: "border-[#e9c97a]/30 bg-white/[0.05]", title: "text-[#ffe9b0]", sub: "text-[#ffe9b0]/75", panel: "border-[#e9c97a]/30 bg-[#1b1230]/90", text: "text-[#f3e6c8]", btn: "border-[#e9c97a]/30 bg-white/[0.05] text-[#fff6dd]", pri: "border-[#e9c97a] text-[#ffe9b0]" },
};

export default function WakeAutoBanner({ roomSlug, initial, lang, variant, demo, className = "" }: {
  roomSlug: string; initial: WakeState | null; lang: string; variant: Variant; demo?: boolean; className?: string;
}) {
  const [st, setSt] = useState<WakeState | null>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<null | (() => void)>(null);
  const t = WAKE_T[wakeLang(lang)], s = STYLE[variant];

  // 「おやすみ」の前の確認 (一晩に 1 回)
  useEffect(() => {
    if (!st?.on) { setGoodNightGate(null); return; }
    const key = `cn.wakeAck.${st.wakeAt}`;
    try { if (localStorage.getItem(key)) return; } catch { /* noop */ }
    setGoodNightGate(() => new Promise<void>((res) => setModal(() => () => { try { localStorage.setItem(key, "1"); } catch { /* noop */ } setModal(null); res(); })));
    return () => setGoodNightGate(null);
  }, [st?.on, st?.wakeAt]);

  if (!st) return null;
  const wakeMs = Date.parse(st.wakeAt), depMs = Date.parse(st.departAt), minMs = Date.parse(st.minAt), maxMs = Date.parse(st.maxAt);
  const D = hmJst(depMs), W = hmJst(wakeMs);
  const flash = (x: string) => { setToast(x); setTimeout(() => setToast(""), 2400); };

  const send = async (body: any, okMsg: string) => {
    if (demo) { // 管理のテスト表示: 保存しない
      if (body.action === "off") setSt({ ...st, on: false });
      else if (body.action === "on") setSt({ ...st, on: true });
      else setSt({ ...st, on: true, edited: true, wakeAt: new Date(edit).toISOString() });
      setEditing(false); flash(okMsg); return;
    }
    setBusy(true);
    const r = await fetch(`/api/wake/${encodeURIComponent(roomSlug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r?.ok) { if (r.state) setSt(r.state); else setSt({ ...st, on: body.action !== "off" }); setEditing(false); flash(okMsg); }
    else flash(t.err);
  };
  const warn = edit < minMs ? t.tooEarly : edit > maxMs ? t.tooLate : "";
  const startEdit = () => { setEdit(wakeMs); setEditing((v) => !v); };

  return (
    <div className={className}>
      <button onClick={() => (st.on ? setOpen((v) => !v) : send({ action: "on" }, t.onT))}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left ${st.on ? s.band : s.off}`}>
        <span className="text-xl leading-none">🌅</span>
        <span className="min-w-0 flex-1">
          <b className={`block truncate text-[14.5px] font-bold ${st.on ? s.title : s.text}`}>{st.on ? t.on.replace("{W}", W) : t.off}</b>
          <small className={`mt-0.5 block truncate text-[11px] ${st.on ? s.sub : s.text} opacity-80`}>{st.on ? t.sub.replace("{D}", D) : t.subOff}</small>
        </span>
        <span className={`text-lg transition-transform ${open && st.on ? "rotate-90" : ""} ${s.title}`}>›</span>
      </button>

      {open && st.on && (
        <div className={`mt-2 rounded-2xl border p-3 ${s.panel}`}>
          <div className={`flex items-center gap-1.5 text-[11px] ${s.text}`}>
            <div className="flex min-w-[48px] flex-col items-center"><b className="text-[13.5px]">{W}</b>{t.wake}</div>
            <div className="relative h-0.5 flex-1 bg-gradient-to-r from-amber-300 to-cyan-300"><span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] opacity-70">{t.gap.replace("{M}", String(Math.round((depMs - wakeMs) / 60e3)))}</span></div>
            <div className="flex min-w-[48px] flex-col items-center"><b className="text-[13.5px]">{D}</b>{t.dep}</div>
            {st.flightAt && <><div className="h-0.5 flex-1 bg-gradient-to-r from-cyan-300 to-violet-300" /><div className="flex min-w-[48px] flex-col items-center"><b className="text-[13.5px]">{hmJst(Date.parse(st.flightAt))}</b>{t.fl}</div></>}
          </div>
          <p className={`mt-2.5 text-[12px] leading-relaxed ${s.text}`}>{t.body}</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={startEdit} className={`flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold ${s.pri}`}>{t.edit}</button>
            <button disabled={busy} onClick={() => send({ action: "off" }, t.offT)} className={`flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold ${s.btn}`}>{t.offB}</button>
          </div>
          {editing && (
            <div className="mt-3">
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setEdit((v) => v - 15 * 60e3)} className={`h-11 w-14 rounded-xl border font-semibold ${s.btn}`}>−15</button>
                <b className={`min-w-[96px] text-center text-[30px] font-light ${s.title}`}>{hmJst(edit)}</b>
                <button onClick={() => setEdit((v) => v + 15 * 60e3)} className={`h-11 w-14 rounded-xl border font-semibold ${s.btn}`}>+15</button>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {[30, 45, 60, 90].map((m, i) => (
                  <button key={m} onClick={() => setEdit(depMs - m * 60e3)}
                    className={`rounded-full border px-3 py-1 text-[12px] ${Math.round((depMs - edit) / 60e3) === m ? s.pri : s.btn}`}>{t.q[i]}</button>
                ))}
              </div>
              <p className="mt-1.5 min-h-[1.2em] text-center text-[11.5px] text-rose-400">{warn}</p>
              <button disabled={!!warn || busy} onClick={() => send({ action: "set", time: hmJst(edit) }, t.saved.replace("{W}", hmJst(edit)))}
                className="mt-1 w-full rounded-xl bg-gradient-to-br from-amber-200 to-orange-400 py-2.5 text-[14px] font-bold text-[#1d1204] disabled:opacity-40">{t.save}</button>
            </div>
          )}
        </div>
      )}
      {toast && <p className="mt-1.5 text-center text-[12px] text-emerald-400">{toast}</p>}

      {/* おやすみの前の確認 */}
      {modal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#02040a]/85 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-amber-300/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,179,71,0.22),#0a1018_70%)] px-5 py-6 text-center text-white">
            <div className="mx-auto mb-3 h-[74px] w-[74px] rounded-full bg-[radial-gradient(circle_at_50%_60%,#ffd08a,#ff9f3f_55%,transparent_72%)] shadow-[0_0_40px_rgba(255,179,71,0.55)]" />
            <p className="text-[14px] tracking-wider text-amber-200">{t.mT}</p>
            <p className="my-1 text-[52px] font-light leading-none">{W}</p>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#c9d8e8]">{t.mS.replace("{D}", D)}</p>
            <button onClick={() => modal()} className="mt-4 w-full rounded-2xl bg-gradient-to-br from-amber-200 to-orange-400 py-3.5 text-[16px] font-bold text-[#1d1204]">{t.ok}</button>
            <div className="mt-2 flex gap-2">
              <button onClick={() => { modal(); setOpen(true); setEdit(wakeMs); setEditing(true); }} className="flex-1 rounded-xl border border-white/15 py-2.5 text-[13.5px]">{t.edit}</button>
              <button onClick={() => { modal(); void send({ action: "off" }, t.offT); }} className="flex-1 rounded-xl border border-white/15 py-2.5 text-[13.5px]">{t.offB}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
