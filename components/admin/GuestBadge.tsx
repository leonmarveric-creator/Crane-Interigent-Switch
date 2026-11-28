"use client";

/**
 * 管理画面 (LIVE・デバイステスト): 泊まっているゲストのカード。写真は使わない (通信がほぼゼロ)。
 *   行: 国旗の丸 + 名字 + 人数 + 「あと ◯ 泊」
 *   押すと: 全員の名前 (代表) / 国籍 / 滞在 (チェックイン → チェックアウト、残り時間) / お見送りの送迎 (出発・行き先・便) / パスポート登録の人数
 *   データは /api/admin/live にもう入っているもの (パスポート登録の名前・国籍・送迎)
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import type { RoomLive } from "@/lib/buildingState";

type G = NonNullable<RoomLive["guest"]>;
const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
/** 名字: パスポート登録の名前は「名字 名前」の順 (パスポートの機械読み取り欄と同じ) */
const surname = (n: string, _cc: string | null) => { const u = n.toUpperCase().trim(); if (u.includes(",")) return u.split(",")[0].trim(); return u.split(/\s+/)[0]; };
const country = (cc: string | null) => { if (!cc) return "—"; try { return new Intl.DisplayNames(["ja"], { type: "region" }).of(cc) ?? cc; } catch { return cc; } };
const jst = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", ...o });
const day = (iso: string) => jst(iso, { month: "numeric", day: "numeric", weekday: "short" });
const hm = (iso: string) => jst(iso, { hour: "2-digit", minute: "2-digit" });
const jstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
function left(out: string): string {
  const ms = Date.parse(out) - Date.now(); if (ms <= 0) return "チェックアウト時刻を過ぎています";
  const h = Math.floor(ms / 3600e3); return h >= 24 ? `チェックアウトまで ${Math.floor(h / 24)} 日 ${h % 24} 時間` : `チェックアウトまで ${h} 時間 ${Math.floor((ms % 3600e3) / 60e3)} 分`;
}
/** 残りの泊数 (今夜を含む) */
function nightsLeft(out: string): number { const a = Date.parse(jstDate(new Date().toISOString())), b = Date.parse(jstDate(out)); return Math.max(0, Math.round((b - a) / 86400e3)); }

export default function GuestBadge({ g, stay, room, occ }: { g: G; stay?: RoomLive["stay"]; room: string; occ: RoomLive["occ"] }) {
  const [open, setOpen] = useState(false);
  const sur = g.names[0] ? surname(g.names[0], g.cc) : stay?.name ?? "—";
  const nl = stay ? nightsLeft(stay.out) : null;
  const tail = occ === "soon" ? "到着予定" : nl === 0 ? "本日アウト" : nl != null ? `あと ${nl} 泊` : "";
  const tr = g.tr;
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/[0.07] py-0.5 pl-0.5 pr-2 text-left">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b1a2c] text-[15px] ring-1 ring-cyan-300/40">{flag(g.cc)}</span>
        <span className="max-w-[8.5em] truncate text-[11px] font-semibold tracking-wide text-cyan-50">{sur}</span>
        <span className="text-[10.5px] text-white/50">{g.pax}名{tail ? ` · ${tail}` : ""}</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#050b14] text-white" onClick={(e) => e.stopPropagation()}>
            {/* ID カード風の見出し */}
            <div className="relative bg-[linear-gradient(135deg,rgba(34,211,238,.18),rgba(14,30,52,.4))] px-4 pb-3 pt-4">
              <div className="flex items-center justify-between font-mono text-[9.5px] tracking-[0.26em] text-cyan-300/80"><span>◈ GUEST · {room}</span><span>{occ === "stay" ? "IN HOUSE" : occ === "soon" ? "ARRIVING" : ""}</span></div>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0b1a2c] text-[30px] ring-2 ring-cyan-300/50 shadow-[0_0_18px_rgba(72,200,255,.35)]">{flag(g.cc)}</span>
                <div className="min-w-0">
                  <b className="block truncate text-lg tracking-wide">{sur} {g.pax >= 2 ? "様ご一行" : "様"}</b>
                  <span className="text-xs text-white/60">{country(g.cc)} · {g.pax}名</span>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3 text-[13px]">
              <div>
                <p className="font-mono text-[9.5px] tracking-[0.24em] text-white/40">GUESTS · パスポート登録 {g.names.length}/{g.pax}</p>
                <ul className="mt-1 space-y-0.5">
                  {Array.from({ length: Math.max(g.pax, g.names.length) }, (_, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={g.names[i] ? "text-emerald-300" : "text-white/30"}>{g.names[i] ? "✓" : "・"}</span>
                      <span className={g.names[i] ? "" : "text-white/35"}>{g.names[i] ?? "未登録"}</span>
                      {i === 0 && g.names[i] && <small className="text-[10px] text-amber-300">代表</small>}
                    </li>
                  ))}
                </ul>
              </div>
              {stay && (
                <div>
                  <p className="font-mono text-[9.5px] tracking-[0.24em] text-white/40">STAY</p>
                  <p className="mt-0.5">{day(stay.in)} {hm(stay.in)} → {day(stay.out)} {hm(stay.out)}</p>
                  <p className="text-xs text-cyan-200/80">{left(stay.out)}</p>
                </div>
              )}
              <div>
                <p className="font-mono text-[9.5px] tracking-[0.24em] text-white/40">DEPARTURE · お見送り</p>
                {tr && (tr.dest || tr.departAt || tr.flightAt) ? (
                  <p className="mt-0.5">
                    {tr.date ? `${day(`${tr.date}T00:00:00+09:00`)} ` : ""}{tr.departAt ? `${tr.departAt} 出発` : ""}{tr.dest ? ` → ${tr.dest}` : ""}{tr.terminal ? ` T${tr.terminal}` : ""}
                    {tr.flightAt ? <span className="ml-1 text-cyan-200/80">✈ {hm(tr.flightAt)}</span> : null}
                  </p>
                ) : <p className="mt-0.5 text-white/40">送迎の登録はまだありません</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-full rounded-xl border border-white/15 py-2 text-xs text-white/70">閉じる</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
