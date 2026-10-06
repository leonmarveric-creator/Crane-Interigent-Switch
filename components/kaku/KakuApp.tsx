"use client";

/**
 * AGENT KAKU: Kaku さん専用のミッション画面 (/kaku)。
 *   中身は kakuMarkup.ts の HTML を kakuEngine.ts が直接動かす (React は入れ物だけ)。
 */
import { useEffect, useRef, useState } from "react";
import { KAKU_HTML } from "@/components/kaku/kakuMarkup";
import { createKaku, type KakuCabinInfo, type KakuEngine, type KakuState, type KakuTrack } from "@/components/kaku/kakuEngine";
import { LyricsSheet } from "@/components/driver/DriverMusic";
import type { DriverTrack } from "@/lib/driverData";
import { makeT } from "@/lib/driverI18n";
import { cabinStart, cabinPos, cabinEnd, cabinBoard, cabinGetHumor, cabinSetHumor } from "@/app/driver/actions";
import { rtJoin, rtKick, CABIN_CH } from "@/lib/rtKick";

function loadLeaflet(): Promise<void> {
  const w = window as any;
  if (w.L) return Promise.resolve();
  return new Promise((ok, ng) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/cabin/leaflet/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "/cabin/leaflet/leaflet.js"; s.onload = () => ok(); s.onerror = () => ng(new Error("leaflet")); document.head.appendChild(s);
  });
}
const EMPTY: KakuState = { setup: true, places: [], missions: [], monthKm: 0, monthCount: 0, todayCount: 0, bgm: { normal: null, cruise: null } };

const tJa = makeT("ja");

export default function KakuApp({ cabin }: { cabin: KakuCabinInfo }) {
  const root = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  // 歌詞を付けるシート (お父さんの画面と同じもの)
  const [ly, setLy] = useState<{ tr: KakuTrack; save: (lrc: string | null) => Promise<string | null> } | null>(null);
  const [msg, setMsg] = useState("");
  const toast = (s: string) => { setMsg(s); setTimeout(() => setMsg((x) => (x === s ? "" : x)), 2600); };
  useEffect(() => {
    rtJoin(CABIN_CH, () => {}); // 車内 iPad への合図の回線を先に開いておく
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
          start: async (v) => { const r = await cabinStart(v).catch((e) => ({ ok: false as const, error: String(e) })); rtKick(CABIN_CH); return r.ok ? { ok: true, id: r.trip.id } : { ok: false, error: (r as any).error }; },
          pos: async (id, lat, lng, kmh) => { const r = await cabinPos(id, lat, lng, kmh, null).catch(() => null); return { ok: !!r?.ok, active: r?.ok ? r.active : true }; },
          end: async (id) => { await cabinEnd(id).catch(() => null); rtKick(CABIN_CH); },
          board: async (id) => { await cabinBoard(id).catch(() => null); rtKick(CABIN_CH); },
          humor: { get: () => cabinGetHumor(), set: async (on) => { const ok = !!(await cabinSetHumor(on).catch(() => null))?.ok; rtKick(CABIN_CH); return ok; } },
        }, { lyrics: (tr, save) => setLy({ tr, save }) });
      } catch (e) { setErr(String((e as Error)?.message || e)); }
    })();
    return () => { live = false; eng?.destroy(); };
  }, []);
  return (
    <div className="kk">
      <div className="kroot" ref={root} />
      {ly && (
        <div className="drv" style={{ position: "fixed", inset: 0, zIndex: 1000, minHeight: 0, padding: 0, background: "transparent", userSelect: "text", WebkitUserSelect: "text" }}>
          <LyricsSheet
            tr={{ id: ly.tr.id, purpose: "in", startSec: 0, lang: "ja", title: ly.tr.title, artist: null, url: ly.tr.url, cover: null, lrc: ly.tr.lrc ?? null, sort: 0 } as DriverTrack}
            t={tJa} toast={toast} onClose={() => setLy(null)}
            onSave={(lrc) => { setLy((x) => (x ? { ...x, tr: { ...x.tr, lrc } } : x)); void ly.save(lrc).then((e) => { if (e) toast(e); }); }}
          />
          {msg && <div className="toast show" style={{ zIndex: 1001 }}>{msg}</div>}
        </div>
      )}
      {!ly && msg && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", padding: "10px 16px", borderRadius: 12, background: "#031a10", color: "#dfffee", border: "1px solid #3dffa8", zIndex: 1001 }}>{msg}</div>}
      {err && <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, padding: 12, borderRadius: 12, background: "#300", color: "#fcc", zIndex: 99 }}>読み込めませんでした: {err}</div>}
    </div>
  );
}
