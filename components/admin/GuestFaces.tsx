"use client";

/**
 * 管理画面「LIVE」: 泊まっているゲストの顔写真 (パスポート登録の写真から顔だけ切り抜く)。
 *   - 写真は /api/admin/faces?drop= (保存しない)。切り抜いた顔はこの画面を開いている間だけ (端末には保存しない)
 *   - 顔さがしは face-api (public/vendor/faceapi, 小さい顔検出モデル)。最初の 1 回だけ読み込む
 *   - 見つからないときは、パスポートの写真の位置 (左側) をそのまま切り抜く
 *   - 押すと大きく表示 (名前・パスポート全体)
 */
import { useEffect, useState } from "react";

type Face = { name: string; face: string | null; full: string };
type G = { drop: string; names: string[]; pax: number; cc: string | null };

const CACHE = new Map<string, Promise<Face[]>>();
let FA: Promise<any> | null = null;
function loadFaceApi(): Promise<any> {
  return (FA ??= new Promise<any>((res, rej) => {
    const w = window as any; if (w.faceapi) return res(w.faceapi);
    const s = document.createElement("script"); s.src = "/vendor/faceapi/face-api.js"; s.async = true;
    s.onload = () => res(w.faceapi); s.onerror = rej; document.head.appendChild(s);
  }).then(async (fa) => { await fa.nets.tinyFaceDetector.loadFromUri("/vendor/faceapi"); return fa; }).catch((e) => { FA = null; throw e; }));
}
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/** 画像を回した canvas (横向きに撮ったパスポート用) */
function rotated(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const c = document.createElement("canvas"), r = deg % 180 !== 0, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1400 / Math.max(w, h));
  c.width = Math.round((r ? h : w) * k); c.height = Math.round((r ? w : h) * k);
  const x = c.getContext("2d")!; x.translate(c.width / 2, c.height / 2); x.rotate((deg * Math.PI) / 180); x.drawImage(img, (-w * k) / 2, (-h * k) / 2, w * k, h * k);
  return c;
}
function crop(src: HTMLCanvasElement, cx: number, cy: number, side: number): string {
  const o = document.createElement("canvas"); o.width = o.height = 200;
  const g = o.getContext("2d")!; g.fillStyle = "#0b1626"; g.fillRect(0, 0, 200, 200);
  g.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, 200, 200);
  return o.toDataURL("image/jpeg", 0.85);
}
async function faceOf(data: string): Promise<string | null> {
  const img = await loadImg(data);
  try {
    const fa = await loadFaceApi(), opt = new fa.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.35 });
    // 4 つの向きで探して、いちばん顔らしい向きを使う (横向き・逆さまに撮ったパスポートも)
    let best: { c: HTMLCanvasElement; b: any; sc: number } | null = null;
    for (const deg of [0, 90, 270, 180]) {
      const c = rotated(img, deg);
      const ds: any[] = await fa.detectAllFaces(c, opt);
      // いちばん大きい顔 (パスポートの写真。透かしの小さい顔より大きい)
      const d = ds.sort((a, z) => z.box.width * z.box.height - a.box.width * a.box.height)[0];
      if (d && (!best || d.score > best.sc)) best = { c, b: d.box, sc: d.score };
    }
    if (best) { const { c, b } = best; const side = Math.max(b.width, b.height) * 1.6; return crop(c, b.x + b.width / 2, b.y + b.height / 2 - b.height * 0.08, side); }
  } catch { /* 顔さがしが使えない端末 → 下の位置で */ }
  // パスポートの顔写真は左側 (ICAO の形)。横長の写真ならそこを切り抜く
  const c = rotated(img, img.naturalHeight > img.naturalWidth * 1.15 ? 270 : 0);
  if (c.width < c.height) return null;
  return crop(c, c.width * 0.19, c.height * 0.52, c.height * 0.5);
}
function load(drop: string): Promise<Face[]> {
  let p = CACHE.get(drop);
  if (!p) {
    p = fetch(`/api/admin/faces?drop=${encodeURIComponent(drop)}`, { cache: "no-store" }).then((r) => r.json()).then(async (j) => {
      if (!j?.ok) return [];
      const out: Face[] = [];
      for (const ph of j.photos as { name: string; data: string }[]) out.push({ name: ph.name, full: ph.data, face: await faceOf(ph.data).catch(() => null) });
      return out;
    }).catch(() => { CACHE.delete(drop); return []; });
    CACHE.set(drop, p);
  }
  return p;
}
const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export default function GuestFaces({ g, room }: { g: G; room: string }) {
  const [faces, setFaces] = useState<Face[] | null>(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<number | null>(null);
  useEffect(() => { let on = true; setFaces(null); load(g.drop).then((f) => { if (on) setFaces(f); }); return () => { on = false; }; }, [g.drop]);

  // 写真が無い人 (同行者でパスポートを撮っていない) は名前の頭文字
  const people = Array.from({ length: Math.max(g.pax, g.names.length, faces?.length ?? 0) }, (_, i) => ({ name: faces?.[i]?.name || g.names[i] || "", face: faces?.[i]?.face ?? null, full: faces?.[i]?.full ?? null }));
  const shown = people.slice(0, 4);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1" title={g.names.join(" / ")}>
        <span className="flex -space-x-2">
          {shown.map((p, i) => (
            <span key={i} className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-cyan-900/60 text-[9px] font-bold text-cyan-100 ring-2 ring-[#02060c]">
              {p.face ? <img src={p.face} alt="" className="h-full w-full object-cover" /> : faces === null && i < (g.names.length || 1) ? <span className="h-full w-full animate-pulse bg-cyan-400/20" /> : initials(p.name)}
            </span>
          ))}
        </span>
        <span className="text-[10.5px] text-white/60">{flag(g.cc)} {people.length}名</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => { setOpen(false); setFull(null); }}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#050b14] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <b className="text-base text-white">{room} <span className="ml-1 text-xs font-normal text-white/50">{flag(g.cc)} {people.length}名</span></b>
              <button type="button" onClick={() => { setOpen(false); setFull(null); }} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">閉じる</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {people.map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 p-2.5">
                  <span className="inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-cyan-900/50 text-xl font-bold text-cyan-100 ring-1 ring-cyan-300/40">
                    {p.face ? <img src={p.face} alt="" className="h-full w-full object-cover" /> : initials(p.name)}
                  </span>
                  <span className="text-center text-[12px] font-semibold leading-tight text-white">{p.name || "—"}{i === 0 && <small className="ml-1 text-[10px] text-amber-300">代表</small>}</span>
                  {p.full ? <button type="button" onClick={() => setFull(full === i ? null : i)} className="text-[10.5px] text-cyan-300/80">{full === i ? "閉じる" : "パスポートを見る"}</button>
                    : <span className="text-[10px] text-white/35">{faces === null ? "読み込み中…" : "写真なし"}</span>}
                </div>
              ))}
            </div>
            {full !== null && people[full]?.full && <img src={people[full].full!} alt="" className="mt-3 w-full rounded-lg" />}
            <p className="mt-3 text-[10px] leading-relaxed text-white/35">パスポート登録の写真から顔を切り抜いています。写真は保存せず、この画面を開いている間だけ表示します。</p>
          </div>
        </div>
      )}
    </>
  );
}
