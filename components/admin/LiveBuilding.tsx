"use client";

/**
 * 管理画面「LIVE」: 建物のホログラムで、どの部屋の明かり・エアコンがついているかを見る (今日タブのいちばん上に 1 枠)。
 *   - 状態は /api/admin/live (データベースを読むだけ。SwitchBot への問い合わせはしない) を、見えている間だけ 20 秒ごとに
 *   - 空室なのについている部屋は赤く点滅 (「つけっぱなし」)
 *   - ホログラム本体は public/holo/building.html (音なし)。閉じておくこともできる
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminLang } from "@/lib/adminI18n";
import type { Part, RoomLive } from "@/lib/buildingState";

/** public/holo/building.html の版 (building.js を作り直したら合わせる) */
export const BUILDING_V = "02b5b74763";
const POLL_MS = 20000;

const TX: Record<AdminLang, Record<string, string>> = {
  ja: { title: "LIVE · 建物の今の状態", hide: "閉じる", show: "ひらく", ceil: "天井", wa: "和の灯り", ac: "エアコン", galaxy: "ギャラクシー", nest: "NEST", stay: "宿泊中", soon: "到着予定", vacant: "空室", alert: "空室なのについています", off: "すべて OFF", none: "記録なし", hookOn: "SwitchBot の知らせ: 受信中", hookOff: "SwitchBot の知らせを登録", hookSql: "SQL（migration_device_state.sql）を実行してください", hookOther: "このアカウントには別の URL が登録済みです（上書きしません）", hookDone: "登録しました", hookFail: "登録できませんでした", note: "天井・エアコンは赤外線リモコンなので「最後に送った操作」です。和の灯りなどは SwitchBot の知らせで、壁スイッチやアプリでの変更も反映されます。", cool: "冷房", heat: "暖房", on: "ON", ago: "前" },
  en: { title: "LIVE · Building now", hide: "Hide", show: "Show", ceil: "Ceiling", wa: "Wa light", ac: "AC", galaxy: "Galaxy", nest: "NEST", stay: "Staying", soon: "Arriving", vacant: "Vacant", alert: "On in a vacant room", off: "All off", none: "No record", hookOn: "SwitchBot updates: receiving", hookOff: "Register SwitchBot updates", hookSql: "Run the SQL (migration_device_state.sql)", hookOther: "Another URL is already registered for this account (not overwritten)", hookDone: "Registered", hookFail: "Could not register", note: "Ceiling and AC are IR remotes, so this is the last command sent. Wa light etc. come from SwitchBot updates, including wall-switch and app changes.", cool: "Cool", heat: "Heat", on: "ON", ago: "ago" },
  zh: { title: "LIVE · 建筑当前状态", hide: "收起", show: "展开", ceil: "顶灯", wa: "和风灯", ac: "空调", galaxy: "星空灯", nest: "NEST", stay: "入住中", soon: "即将到达", vacant: "空房", alert: "空房但设备开着", off: "全部关闭", none: "无记录", hookOn: "SwitchBot 通知：接收中", hookOff: "登记 SwitchBot 通知", hookSql: "请执行 SQL（migration_device_state.sql）", hookOther: "该账号已登记其他 URL（不覆盖）", hookDone: "已登记", hookFail: "登记失败", note: "顶灯和空调是红外遥控，显示的是最后发送的操作。和风灯等来自 SwitchBot 通知，墙上开关或 App 的变更也会反映。", cool: "制冷", heat: "制热", on: "开", ago: "前" },
};
const BY: Record<AdminLang, Record<string, string>> = { ja: { guest: "ゲスト", admin: "管理", cron: "自動" }, en: { guest: "guest", admin: "admin", cron: "auto" }, zh: { guest: "客人", admin: "管理", cron: "自动" } };
const ago = (ms: number, x: Record<string, string>) => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `${m}m ${x.ago}` : m < 1440 ? `${Math.round(m / 60)}h ${x.ago}` : `${Math.round(m / 1440)}d ${x.ago}`; };

export default function LiveBuilding({ lang }: { lang: AdminLang }) {
  const x = TX[lang] ?? TX.ja;
  const [open, setOpen] = useState(true), [data, setData] = useState<{ rooms: RoomLive[]; hooks: { setup: boolean; n: number } } | null>(null), [msg, setMsg] = useState("");
  const box = useRef<HTMLDivElement>(null), fr = useRef<HTMLIFrameElement>(null), ready = useRef(false), vis = useRef(true);
  useEffect(() => { try { if (localStorage.getItem("cnLiveOpen") === "0") setOpen(false); } catch { /* */ } }, []);
  const toggle = () => setOpen((o) => { try { localStorage.setItem("cnLiveOpen", o ? "0" : "1"); } catch { /* */ } return !o; });
  const post = (m: Record<string, unknown>) => { try { fr.current?.contentWindow?.postMessage({ holo: 1, ...m }, location.origin); } catch { /* */ } };
  const toHolo = (rooms: RoomLive[]) => rooms.filter((r) => r.holo).map((r) => ({
    k: r.holo, occ: r.occ, alert: r.alert, unknown: !Object.keys(r.parts).length,
    ceil: !!r.parts.ceil?.on, wa: !!r.parts.wa?.on, ac: !!r.parts.ac?.on, acMode: r.parts.ac?.mode === "heat" ? "heat" : "cool", galaxy: !!r.parts.galaxy?.on, nest: !!r.parts.nest?.on,
  }));
  const load = useCallback(async () => {
    if (!vis.current || document.hidden) return;
    const j = await fetch("/api/admin/live", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setData({ rooms: j.rooms, hooks: j.hooks }); if (ready.current) post({ rooms: toHolo(j.rooms) }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load(); const t = setInterval(load, POLL_MS);
    const onVis = () => { post({ pause: document.hidden }); if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVis);
    const el = box.current; let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") { io = new IntersectionObserver(([e]) => { vis.current = e.isIntersecting; post({ pause: !e.isIntersecting }); if (e.isIntersecting) void load(); }); io.observe(el); }
    const onMsg = (e: MessageEvent) => { if (e.origin !== location.origin || e.source !== fr.current?.contentWindow || !e.data?.ready) return; ready.current = true; if (data) post({ rooms: toHolo(data.rooms) }); else void load(); };
    window.addEventListener("message", onMsg);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); io?.disconnect(); window.removeEventListener("message", onMsg); };
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) ready.current = false; }, [open]);
  useEffect(() => { if (data && ready.current) post({ rooms: toHolo(data.rooms) }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const hook = async () => {
    setMsg("…");
    const j = await fetch("/api/admin/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "hook" }) }).then((r) => r.json()).catch(() => null);
    setMsg(!j ? x.hookFail : j.other ? x.hookOther : j.registered ? x.hookDone : x.hookFail);
  };
  const alerts = data?.rooms.filter((r) => r.alert) ?? [];
  const part = (r: RoomLive, p: Part) => {
    const s = r.parts[p]; if (!r.has.includes(p)) return null;
    const label = x[p], on = !!s?.on;
    const v = !s ? x.none : on ? (p === "ac" ? (s.mode === "heat" ? x.heat : s.mode === "cool" ? x.cool : x.on) : x.on) : "OFF";
    return (
      <span key={p} title={s ? `${ago(s.at, x)} · ${s.src === "hook" ? "SwitchBot" : (BY[lang] ?? BY.ja)[s.source ?? ""] ?? ""}` : ""}
        className={`rounded px-1.5 py-0.5 text-[10.5px] ${on ? (p === "wa" || p === "nest" || s?.mode === "heat" ? "bg-amber-400/20 text-amber-100" : p === "galaxy" ? "bg-violet-400/20 text-violet-100" : "bg-cyan-300/20 text-cyan-50") : "bg-white/5 text-white/40"}`}>
        {label} {v}{s?.src === "hook" ? " ⚡" : ""}
      </span>
    );
  };
  return (
    <div ref={box} className="clip-bevel mb-4 overflow-hidden border border-cyan-400/15 bg-[#02060c]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/80">◈ {x.title}</span>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && <span className="animate-pulse rounded-full bg-rose-500/25 px-2 py-0.5 text-[11px] font-semibold text-rose-200">⚠ {alerts.map((r) => r.name).join("・")}</span>}
          <button onClick={toggle} className="rounded-full border border-cyan-300/25 px-2.5 py-0.5 text-[11px] text-cyan-200/80" aria-expanded={open}>{open ? x.hide : x.show}</button>
        </div>
      </div>
      {open && (
        <div className="relative w-full" style={{ aspectRatio: "16 / 10", maxHeight: 420 }}>
          <iframe ref={fr} title={x.title} src={`/holo/building.html?v=${BUILDING_V}`} className="absolute inset-0 h-full w-full border-0" loading="lazy" />
        </div>
      )}
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {data?.rooms.map((r) => (
          <div key={r.id} className={`flex flex-wrap items-center gap-1.5 rounded px-1.5 py-1 ${r.alert ? "bg-rose-500/10 ring-1 ring-rose-400/50" : ""}`}>
            <b className="min-w-[2.2em] text-sm text-white">{r.name}</b>
            <span className={`text-[10.5px] ${r.occ === "stay" ? "text-emerald-300" : r.occ === "soon" ? "text-amber-300" : "text-white/40"}`}>{x[r.occ]}</span>
            {(["ceil", "wa", "ac", "galaxy", "nest"] as Part[]).map((p) => part(r, p))}
            {r.alert && <span className="text-[10.5px] font-semibold text-rose-300">⚠ {x.alert}</span>}
          </div>
        ))}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-white/40">
          {data && (data.hooks.setup ? (data.hooks.n > 0 ? <span className="text-emerald-300/80">⚡ {x.hookOn}</span>
            : <button onClick={hook} className="rounded border border-cyan-300/30 px-2 py-0.5 text-cyan-200">⚡ {x.hookOff}</button>) : <span className="text-amber-300/80">{x.hookSql}</span>)}
          {msg && <span>{msg}</span>}
        </div>
        <p className="text-[10px] leading-relaxed text-white/35">{x.note}</p>
      </div>
    </div>
  );
}
