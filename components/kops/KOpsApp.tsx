"use client";

/**
 * K-OPS (AGENT KAKU の新しい画面) の入れ物。
 *   中身は public/kops/ の JS (kops.js) が直接動かす。React はデータとサーバーの機能を渡すだけ。
 *   ・車内 iPad (ゲスト用) を動かす機能 (cabinStart など) と、iPad の声をこの端末で鳴らす機能 (startRemoteVoice) を window.KOPS_API に置く
 */
import { useEffect, useRef, useState } from "react";
import { cabinStart, cabinPos, cabinEnd, cabinBoard } from "@/app/driver/actions";
import { startRemoteVoice, unlockRemoteVoice } from "@/lib/remoteVoice";
import KOpsLibrary from "@/components/kops/KOpsLibrary";

export interface KOpsGuest {
  id: string; name: string; room: string; roomId: string; lang: string; cat: "out" | "in" | "stay"; place: string | null;
  pax: number; L: number; S: number; sp: number; nights: number; reg: boolean; dropId: string | null; note: string; nat: string;
  /** ゲストの便の状態 (お迎えのとき。自動確認の結果) */
  flt?: { st: string; delay: number | null } | null;
}
export interface KOpsData { guests: KOpsGuest[]; devices: { id: string; name: string }[]; rooms: { id: string; name: string; kanji: string }[]; cabinMissing: boolean }

const V = "46";
function load(src: string): Promise<void> {
  return new Promise((ok, ng) => {
    if (/\.css(\?|$)/.test(src)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = src; l.onload = () => ok(); l.onerror = () => ng(new Error(src)); document.head.appendChild(l); return; }
    const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => ng(new Error(src)); document.head.appendChild(s);
  });
}

export default function KOpsApp({ data }: { data: KOpsData }) {
  const root = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  // 曲・歌詞・カバーの管理 (K-OPS の ☰ や TAPES から開く)
  const [lib, setLib] = useState<{ onChange: () => void } | null>(null);
  useEffect(() => {
    const w = window as any;
    w.KOPS_DATA = data;
    w.KOPS_API = {
      cabinStart: (v: any) => cabinStart(v).catch((e) => ({ ok: false, error: String(e) })),
      cabinPos: (id: string, lat: number | null, lng: number | null, kmh: number | null) => cabinPos(id, lat, lng, kmh, null).catch(() => null),
      cabinEnd: (id: string) => cabinEnd(id).catch(() => null),
      cabinBoard: (id: string) => cabinBoard(id).catch(() => null),
      remoteVoice: (id: string, h: any) => startRemoteVoice(id, h),
      unlockVoice: () => unlockRemoteVoice(),
      openLibrary: (o: { onChange: () => void }) => setLib(o),
    };
    let dead = false;
    void (async () => {
      try {
        await Promise.all([load("/cabin/leaflet/leaflet.css"), load(`/kops/kops.css?v=${V}`)]);
        if (!w.L) await load("/cabin/leaflet/leaflet.js");
        if (!w.CNRT) await load("/rt.js?v=2").catch(() => {});
        if (!w.KOPS) await load(`/kops/kops.js?v=${V}`);
        if (dead || !root.current) return;
        w.KOPS.mount(root.current);
      } catch (e) { setErr(String((e as Error)?.message || e)); }
    })();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/kops-sw.js", { scope: "/kaku/" }).catch(() => {});
    return () => { dead = true; w.KOPS?.unmount?.(); };
  }, [data]);
  return (
    <>
      <div ref={root} style={{ position: "fixed", inset: 0, background: "#000" }} />
      {lib && <KOpsLibrary onClose={() => setLib(null)} onChange={() => lib.onChange()} />}
      {err && <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, padding: 12, borderRadius: 12, background: "#300", color: "#fcc", zIndex: 99 }}>読み込めませんでした: {err}</div>}
    </>
  );
}
