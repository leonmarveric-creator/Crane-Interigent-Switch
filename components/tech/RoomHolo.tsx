"use client";

/**
 * ゲストのお部屋画面 (ハイテク UI) に足すホログラム。今ある画面はそのままで、モードのボタンの下に 1 枠だけ足す。
 *   - 建物の中のこのお部屋を投影し、ゲストが操作すると (シーリングライト・和の灯り・エアコン・鍵・モード) その部分が反応する
 *   - モードごとの演出: 快適 = 澄んだ光 / 和み = 暖色と蛍 / おやすみ = 青く暗く・星 / 外出 = シールド / Dream Fade = 和の灯りがゆっくり消える / ギャラクシー = 回る星空 / ネスト = 暖かい光
 *   - 操作の知らせは lib/deviceClient.ts の callDevice が出す "cn:device" (成功したときだけ)
 *   - 画面に見えている間だけ動かす (電池・通信のため)。写真 (360° の写真) は使わない
 *   - 中身は public/holo/room.html (音は鳴らさない。お部屋画面の効果音・声はそのまま)
 */
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";

/** public/holo/room.html の版 (room.js を作り直したら合わせる) */
export const HOLO_V = "67b35bafe7";
const KEYS = ["haru", "natsu", "aki", "fuyu"] as const;
const KANJI: Record<string, (typeof KEYS)[number]> = { 春: "haru", 夏: "natsu", 秋: "aki", 冬: "fuyu" };

/** Crane Nest の季節のお部屋だけ (模型がある) */
export function holoRoomKey(roomSlug: string, roomName: string): (typeof KEYS)[number] | null {
  const s = (roomSlug || "").toLowerCase();
  for (const [re, k] of [[/haru|spring/, "haru"], [/natsu|natu|summer/, "natsu"], [/(^|[^a-z])aki|autumn/, "aki"], [/fuyu|winter/, "fuyu"]] as const) if (re.test(s)) return k;
  for (const ch of roomName || "") if (KANJI[ch]) return KANJI[ch];
  return null;
}

const TXT: Record<Lang, { title: string; hide: string; show: string; tip: string }> = {
  ja: { title: "ROOM HOLOGRAM", hide: "閉じる", show: "ひらく", tip: "操作するとお部屋のホログラムが反応します（ドラッグで回せます）" },
  en: { title: "ROOM HOLOGRAM", hide: "Hide", show: "Show", tip: "Your controls light up the hologram of your room (drag to rotate)" },
  zh: { title: "ROOM HOLOGRAM", hide: "收起", show: "展开", tip: "操作后，房间的全息影像会跟着反应（可拖动旋转）" },
  ko: { title: "ROOM HOLOGRAM", hide: "닫기", show: "열기", tip: "조작하면 객실 홀로그램이 반응합니다 (드래그로 회전)" },
};

export default function RoomHolo({ roomSlug, roomName, lang }: { roomSlug: string; roomName: string; lang: Lang }) {
  const room = holoRoomKey(roomSlug, roomName);
  const box = useRef<HTMLDivElement>(null), fr = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(true), [near, setNear] = useState(false), ready = useRef(false), queue = useRef<{ dev: string; value?: string }[]>([]);
  useEffect(() => { try { if (localStorage.getItem("cnHoloOpen") === "0") setOpen(false); } catch { /* */ } }, []);
  const toggle = () => setOpen((o) => { try { localStorage.setItem("cnHoloOpen", o ? "0" : "1"); } catch { /* */ } return !o; });

  // 画面の近くに来たら読み込む / 見えていない間は止める
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setNear(true);
      post({ pause: !e.isIntersecting });
    }, { rootMargin: "200px 0px" });
    io.observe(el);
    const vis = () => post({ pause: document.hidden });
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function post(m: Record<string, unknown>) { try { fr.current?.contentWindow?.postMessage({ holo: 1, ...m }, location.origin); } catch { /* */ } }

  // お部屋の操作 (成功したもの) → ホログラムへ
  useEffect(() => {
    const onDev = (e: Event) => {
      const d = (e as CustomEvent).detail as { action?: string; value?: string } | undefined; if (!d?.action) return;
      const m = { dev: d.action, value: d.value };
      if (ready.current) post(m); else queue.current = [...queue.current.slice(-5), m];
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== fr.current?.contentWindow || !e.data || e.data.holo !== 1 || !e.data.ready) return;
      ready.current = true; queue.current.forEach(post); queue.current = [];
    };
    window.addEventListener("cn:device", onDev); window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("cn:device", onDev); window.removeEventListener("message", onMsg); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) ready.current = false; }, [open]);

  if (!room) return null;
  const x = TXT[lang] ?? TXT.en;
  return (
    <div ref={box} className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#02060c]">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">◈ {x.title}</span>
        <button onClick={toggle} className="rounded-full border border-cyan-300/25 px-2.5 py-0.5 text-[11px] text-cyan-200/80 active:scale-95" aria-expanded={open}>
          {open ? x.hide : x.show}
        </button>
      </div>
      {open && (
        <>
          <div className="relative w-full" style={{ aspectRatio: "6 / 5", maxHeight: 360 }}>
            {near && (
              <iframe ref={fr} title={x.title} src={`/holo/room.html?room=${room}&lang=${lang}&v=${HOLO_V}`}
                className="absolute inset-0 h-full w-full border-0" loading="lazy" />
            )}
          </div>
          <p className="px-3 py-2 text-[11px] text-white/40">{x.tip}</p>
        </>
      )}
    </div>
  );
}
