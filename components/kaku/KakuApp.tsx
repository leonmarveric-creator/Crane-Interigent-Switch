"use client";

/**
 * AGENT KAKU: Kaku さん専用のミッション画面 (/kaku)。
 *   中身は kakuMarkup.ts の HTML を kakuEngine.ts が直接動かす (React は入れ物だけ)。
 */
import { useEffect, useRef, useState } from "react";
import { KAKU_HTML } from "@/components/kaku/kakuMarkup";
import { createKaku, type KakuCabinInfo, type KakuEngine, type KakuState } from "@/components/kaku/kakuEngine";
import { cabinStart, cabinPos, cabinEnd, cabinBoard } from "@/app/driver/actions";

function loadLeaflet(): Promise<void> {
  const w = window as any;
  if (w.L) return Promise.resolve();
  return new Promise((ok, ng) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/cabin/leaflet/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "/cabin/leaflet/leaflet.js"; s.onload = () => ok(); s.onerror = () => ng(new Error("leaflet")); document.head.appendChild(s);
  });
}
const EMPTY: KakuState = { setup: true, places: [], missions: [], monthKm: 0, monthCount: 0, todayCount: 0, bgm: { normal: null, cruise: null } };

export default function KakuApp({ cabin }: { cabin: KakuCabinInfo }) {
  const root = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let eng: KakuEngine | null = null, live = true;
    void (async () => {
      try {
        const [routes, st] = await Promise.all([
          loadLeaflet().then(() => fetch("/cabin/routes.json").then((r) => r.json())),
          fetch("/api/kaku", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (!live || !root.current) return;
        root.current.innerHTML = KAKU_HTML;
        eng = createKaku(root.current, routes, st?.ok ? { ...EMPTY, ...st } : EMPTY, {
          info: cabin,
          // 車内 iPad (ゲスト用の画面) をこの端末から動かす: 父のスマホと同じ仕組み
          start: async (v) => { const r = await cabinStart(v).catch((e) => ({ ok: false as const, error: String(e) })); return r.ok ? { ok: true, id: r.trip.id } : { ok: false, error: (r as any).error }; },
          pos: async (id, lat, lng, kmh) => { const r = await cabinPos(id, lat, lng, kmh, null).catch(() => null); return { ok: !!r?.ok, active: r?.ok ? r.active : true }; },
          end: async (id) => { await cabinEnd(id).catch(() => null); },
          board: async (id) => { await cabinBoard(id).catch(() => null); },
        });
      } catch (e) { setErr(String((e as Error)?.message || e)); }
    })();
    return () => { live = false; eng?.destroy(); };
  }, []);
  return (
    <div className="kk">
      <div className="kroot" ref={root} />
      {err && <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, padding: 12, borderRadius: 12, background: "#300", color: "#fcc", zIndex: 99 }}>読み込めませんでした: {err}</div>}
    </div>
  );
}
