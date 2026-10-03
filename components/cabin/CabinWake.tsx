"use client";
/**
 * 車内 iPad ⚙ の「光目覚まし」: スタッフがゲストの代わりに設定し、設定できたか・動いたかを確認する。
 *   データは /api/cabin/alarm (スタッフのログインで守られている)。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CabinRoom } from "@/lib/cabinData";

export type WakeMode = "flame_on" | "horizon_rise";
export interface WakeAlarm { fireAt: string; mode: WakeMode; state: "set" | "run" | "ok" | "ng"; firedAt: string | null }
export interface WakeRoom { alarm: WakeAlarm | null; staying: boolean; hasLight: boolean; hasWafu: boolean; logs: { at: string; action: string; ok: boolean }[] }
export type WakeMap = Record<string, WakeRoom>;

const jst = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3);
const p2 = (n: number) => String(n).padStart(2, "0");
export const wakeHM = (iso: string) => { const d = jst(iso); return `${d.getUTCHours()}:${p2(d.getUTCMinutes())}`; };
const wakeDay = (iso: string) => { const d = jst(iso), n = new Date(Date.now() + 9 * 3600e3); const diff = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) / 86400e3); return diff === 0 ? "今日" : diff === 1 ? "明日" : diff === -1 ? "昨日" : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const MODE: Record<WakeMode, string> = { horizon_rise: "Horizon Rise", flame_on: "Flame On" };

/** 部屋ボタンに出す小さな印 (7:00 H / ✓ 7:00 / ✕ 6:30) */
export function wakeBadge(w: WakeRoom | undefined): { text: string; cls: string } | null {
  const a = w?.alarm; if (!a) return null;
  const t = wakeHM(a.fireAt);
  if (a.state === "ok") return { text: `✓ ${t}`, cls: "ok" };
  if (a.state === "ng") return { text: `✕ ${t}`, cls: "ng" };
  return { text: `${t} ${a.mode === "horizon_rise" ? "H" : "F"}`, cls: "set" };
}

/** ⚙ を開いている間だけ、全部屋の状態を読む (1 分ごとに更新) */
export function useWake(active: boolean) {
  const [map, setMap] = useState<WakeMap>({});
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/cabin/alarm", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setMap(r.rooms); setErr(false); } else setErr(true);
  }, []);
  useEffect(() => { if (!active) return; void load(); const id = setInterval(() => void load(), 60000); return () => clearInterval(id); }, [active, load]);
  return { map, err, reload: load };
}

const ERR: Record<string, string> = {
  UNAUTHORIZED: "ログインが切れています。スタッフ画面でログインし直してください",
  NO_WAFU: "このお部屋には和風ライトがないので Horizon Rise は使えません",
  NO_LIGHT: "このお部屋の照明がまだ登録されていません",
  SAVE_FAILED: "保存できませんでした",
  VERIFY_FAILED: "保存後の確認ができませんでした。もう一度押してください",
  CLEAR_FAILED: "解除できませんでした。もう一度押してください",
  DEVICE_FAILED: "照明が応答しませんでした（SwitchBot・Wi-Fi を確認してください）",
};

export function WakeSheet({ room, info, onClose, onChanged }: { room: CabinRoom; info: WakeRoom | undefined; onClose: () => void; onChanged: () => Promise<void> | void }) {
  const a = info?.alarm ?? null;
  const pending = a && (a.state === "set" || a.state === "run") ? a : null;
  const hasWafu = info ? info.hasWafu : room.hasWafu;
  const init = pending ? jst(pending.fireAt) : null;
  const [hh, setHh] = useState(init ? init.getUTCHours() : 7);
  const [mm, setMm] = useState(init ? init.getUTCMinutes() : 0);
  const [mode, setMode] = useState<WakeMode>(pending ? pending.mode : hasWafu ? "horizon_rise" : "flame_on");
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState(false);
  const [testLeft, setTestLeft] = useState(0);
  const tm = useRef<any>(null);
  useEffect(() => { if (!hasWafu && mode === "horizon_rise") setMode("flame_on"); }, [hasWafu, mode]);
  useEffect(() => () => clearInterval(tm.current), []);

  const post = (b: any) => fetch("/api/cabin/alarm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomId: room.id, ...b }) }).then((x) => x.json()).catch(() => null);
  const fail = (r: any) => setRes({ ok: false, text: `✕ ${r ? (ERR[r.error] ?? "うまくいきませんでした") + (r.detail ? `（${r.detail}）` : "") : "通信できませんでした。電波を確認してもう一度押してください"}` });

  async function save() {
    setBusy("save"); setRes(null);
    const r = await post({ hh, mm, mode });
    if (r?.ok && r.alarm) setRes({ ok: true, text: `✓ 設定できました（サーバーから読み直して確認済み）\n「${room.kanji}」 ${wakeDay(r.alarm.fireAt)} ${wakeHM(r.alarm.fireAt)} ・ ${MODE[r.alarm.mode as WakeMode]} ・ 1 回だけ${r.staying ? "" : "\n※ いま滞在中の予約が見つからないため、お部屋だけに設定しました"}` });
    else fail(r);
    await onChanged(); setBusy("");
  }
  async function clear() {
    setBusy("clear"); setRes(null);
    const r = await post({ clear: true });
    if (r?.ok) setRes({ ok: true, text: "✓ 解除しました（確認済み）" }); else fail(r);
    await onChanged(); setBusy("");
  }
  async function test() {
    setAsk(false); setBusy("test"); setRes(null);
    const r = await post({ test: "on", mode });
    if (!r?.ok) { fail(r); setBusy(""); return; }
    setRes({ ok: true, text: `💡 点灯の指示が通りました。お部屋の${mode === "horizon_rise" ? "和風ライト" : "照明"}を見てください（30 秒後に消します）` });
    let left = 30; setTestLeft(left);
    clearInterval(tm.current);
    tm.current = setInterval(async () => {
      left--; setTestLeft(left);
      if (left > 0) return;
      clearInterval(tm.current);
      const o = await post({ test: "off", mode });
      setRes(o?.ok ? { ok: true, text: "✓ テスト完了：点灯・消灯とも指示が通りました" } : { ok: false, text: "✕ 消灯の指示が通りませんでした。お部屋で消してください" });
      setBusy(""); void onChanged();
    }, 1000);
  }

  const bump = (dh: number, dm: number) => { let t = (hh * 60 + mm + dh * 60 + dm) % 1440; if (t < 0) t += 1440; setHh(Math.floor(t / 60)); setMm(t % 60); setRes(null); };
  const lock = !!busy;
  return (
    <div className="wk" onClick={(e) => e.stopPropagation()}>
      <div className="wk-card">
        <div className="wk-hd"><b>⏰ 「{room.kanji}」の光目覚まし</b><button onClick={onClose} disabled={busy === "test"}>✕ 閉じる</button></div>
        <div className={`wk-now ${a?.state ?? "none"}`}>
          {!a ? "いまは設定されていません" :
            a.state === "ok" ? `✓ ${wakeDay(a.fireAt)} ${wakeHM(a.fireAt)} に動きました（${MODE[a.mode]}）` :
            a.state === "ng" ? `✕ ${wakeDay(a.fireAt)} ${wakeHM(a.fireAt)} の目覚ましは動きませんでした（照明が応答なし）` :
            a.state === "run" ? `… ${wakeHM(a.fireAt)} の目覚ましを実行中です` :
            `設定中：${wakeDay(a.fireAt)} ${wakeHM(a.fireAt)} ・ ${MODE[a.mode]}`}
        </div>
        <div className="wk-time">
          <div className="wk-col"><button onClick={() => bump(1, 0)} disabled={lock}>＋</button><span>{hh}</span><button onClick={() => bump(-1, 0)} disabled={lock}>－</button></div>
          <i>:</i>
          <div className="wk-col"><button onClick={() => bump(0, 5)} disabled={lock}>＋</button><span>{p2(mm)}</span><button onClick={() => bump(0, -5)} disabled={lock}>－</button></div>
        </div>
        <div className="wk-quick">{[[5, 30], [6, 0], [6, 30], [7, 0], [7, 30], [8, 0]].map(([h, m]) => <button key={`${h}${m}`} className={hh === h && mm === m ? "on" : ""} disabled={lock} onClick={() => { setHh(h); setMm(m); setRes(null); }}>{h}:{p2(m)}</button>)}</div>
        <div className="wk-modes">
          <button className={mode === "horizon_rise" ? "on" : ""} disabled={lock || !hasWafu} onClick={() => { setMode("horizon_rise"); setRes(null); }}><b>Horizon Rise</b><small>{hasWafu ? "10 分前から和風ライトが少しずつ明るく" : "このお部屋は和風ライトなし"}</small></button>
          <button className={mode === "flame_on" ? "on" : ""} disabled={lock} onClick={() => { setMode("flame_on"); setRes(null); }}><b>Flame On</b><small>時刻ちょうどに照明がパッと点く</small></button>
        </div>
        <button className="wk-go" onClick={() => void save()} disabled={lock}>{busy === "save" ? "設定しています…" : "この内容で設定する"}</button>
        <div className="wk-row">
          <button onClick={() => setAsk(true)} disabled={lock}>{busy === "test" ? `💡 テスト中… ${testLeft}` : "💡 今すぐ試す（30 秒）"}</button>
          <button onClick={() => void clear()} disabled={lock || !pending}>解除する</button>
        </div>
        {ask && <div className="wk-ask"><span>「{room.kanji}」の{mode === "horizon_rise" ? "和風ライト" : "照明"}を今すぐ点けます。お休み中ではありませんか？</span><div className="wk-row"><button onClick={() => setAsk(false)}>やめる</button><button className="y" onClick={() => void test()}>点ける</button></div></div>}
        {res && <div className={`wk-res ${res.ok ? "ok" : "ng"}`}>{res.text}</div>}
        <div className="wk-log">
          <h5>記録（直近 3 日）</h5>
          {pending && <div><em className="set">予定</em>{wakeDay(pending.fireAt)} {wakeHM(pending.fireAt)} ・ {MODE[pending.mode]}</div>}
          {(info?.logs ?? []).map((l, i) => <div key={i}><em className={l.ok ? "ok" : "ng"}>{l.ok ? "✓ 動いた" : "✕ 動かず"}</em>{wakeDay(l.at)} {wakeHM(l.at)} ・ {l.action === "wafu_prewake" ? "和風ライト（事前に明るく）" : "照明の点灯"}</div>)}
          {!pending && !(info?.logs ?? []).length && <div className="none">まだ記録はありません</div>}
        </div>
      </div>
    </div>
  );
}
