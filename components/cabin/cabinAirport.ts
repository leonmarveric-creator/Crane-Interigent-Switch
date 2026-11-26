/**
 * ✈ 空港案内 (お父さんのスマホの「✈ 空港」ボタン → 車内 iPad)
 *   airport_how          … お迎えのとき「明日どうやって空港へ？」: 2 つの行き方 (無料送迎＋電車 / 車で直接) をホログラムで比較 → 最後に QR
 *   airport_r1/r2/t1/t2  … 降りたあとの道順 (りんくう大屋根 / 5 番出口 / 関空 T1 / T2) の詳しいナビ
 *   中身は public/airport/*.html。声と効果音は iPad アプリの音声 (タップ済み) を借りて鳴らす。案内中はスマホの音楽を小さく (20%) にする
 */
import QRCode from "qrcode";
import type { GLang } from "@/lib/cabinGeo";

const GUIDE_L: Record<GLang, string> = { zh: "zh-hans", ja: "ja", en: "en", ko: "ko" };

export interface AirportCtx {
  host: () => HTMLElement;               // 重ねる場所 (.stage)
  lang: () => GLang;
  ac: () => AudioContext | null;          // iPad アプリの AudioContext (タップで解錠済み)
  duck: (sec: number) => void;            // スマホの音楽を小さくする (秒)
  sfx: (k: string) => void;
}

export function createAirport(c: AirportCtx) {
  let imgs: string[] = [];
  let el: HTMLElement | null = null, fr: HTMLIFrameElement | null = null, duckT = 0, closeT = 0, maxT = 0;
  const lite = () => { try { return localStorage.getItem("cabAirFull") !== "1"; } catch { return true; } }; // 古い iPad でも軽く動くように、普段は軽量版
  function mount() {
    if (el) return;
    el = document.createElement("div"); el.className = "airov";
    el.innerHTML = `<iframe title="airport" allow="autoplay"></iframe><button class="airx" aria-label="close">✕</button>`;
    c.host().appendChild(el); fr = el.querySelector("iframe"); (el.querySelector(".airx") as HTMLElement).onclick = () => close();
  }
  function close() {
    if (!el) return;
    clearInterval(duckT); clearTimeout(closeT); clearTimeout(maxT); duckT = closeT = maxT = 0;
    el.classList.remove("on"); const f = fr; setTimeout(() => { if (f && !el?.classList.contains("on")) f.src = "about:blank"; }, 500);
    c.duck(1); // すぐ音楽を戻す (1 秒後)
  }
  function open(cmd: string) {
    mount(); if (!el || !fr) return;
    const w = window as any; w.__cabAC = c.ac(); try { w.__cabAC?.resume?.(); } catch { /* ignore */ }
    const l = c.lang(), gl = GUIDE_L[l] ?? "en";
    const guestUrl = `${location.origin}/airport/guide.html#${gl}`;
    w.__cabAirDone = () => { clearTimeout(closeT); closeT = window.setTimeout(close, 45000); }; // 比較が終わったら QR を 45 秒見せて閉じる
    let src: string;
    if (cmd === "airport_how") src = `/airport/${lite() ? "compare-lite" : "compare"}.html?l=${l}`;
    else {
      const d = cmd.slice(8); // r1 r2 t1 t2
      src = d === "r1" || d === "r2" ? `/airport/guide.html#cab&l=${gl}&m=train&d=t1&r=${d === "r2" ? 2 : 1}&s=2` : `/airport/guide.html#cab&l=${gl}&m=car&d=${d}&r=1&s=3`;
    }
    fr.onload = async () => {
      try { const svg = await QRCode.toString(guestUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0a1426", light: "#ffffff" } }); (fr?.contentWindow as any)?.__setQr?.(svg); } catch { /* ignore */ }
    };
    fr.src = src; el.classList.add("on");
    // 案内のあいだ、スマホの音楽はずっと小さめ (20%)
    clearInterval(duckT); c.duck(30); duckT = window.setInterval(() => c.duck(30), 25000);
    clearTimeout(maxT); maxT = window.setTimeout(close, 6 * 60 * 1000);
  }
  /** 到着のホログラム演出 (お見送り: 着いたとき自動 / お迎え: 迎え先に近づいたとき)。最後に「詳しいナビ」ボタンと QR、お見送りはアストレアの最後のひとこと */
  function arrive(o: { s: "t1" | "t2" | "r1" | "r2" | "hin" | "pick" | "pick2" | "pickh" | "pickr1" | "pickr2"; name?: string | null; flight?: string | null; room?: string | null; pax?: number | null; lang?: GLang }) {
    mount(); if (!el || !fr) return;
    const w = window as any; w.__cabAC = c.ac(); try { w.__cabAC?.resume?.(); } catch { /* ignore */ }
    const l = o.lang ?? c.lang(), gl = GUIDE_L[l] ?? "en";
    const q = new URLSearchParams({ s: o.s, l }); if ((window as any).__CAB_LITE) q.set("lt", "1"); if (o.name) q.set("nm", o.name); if (o.flight) q.set("fl", o.flight); if (o.room) q.set("rm", o.room); if (o.pax) q.set("np", String(o.pax));
    const guestUrl = /^pick/.test(o.s) || o.s === "hin" ? null : `${location.origin}/airport/guide.html#${gl}`; // 日根野駅は詳しいナビがまだ無い
    w.__cabAirDone = () => { clearTimeout(closeT); closeT = window.setTimeout(close, 60000); };
    fr.onload = async () => {
      try { if (imgs.length) (fr?.contentWindow as any)?.__setImgs?.(imgs); } catch { /* ignore */ }
      if (!guestUrl) return;
      try { const svg = await QRCode.toString(guestUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0a1426", light: "#ffffff" } }); (fr?.contentWindow as any)?.__setQr?.(svg); } catch { /* ignore */ }
    };
    fr.src = `/airport/${lite() ? "arrive" : "arrive-full"}.html?${q}`; el.classList.add("on");
    clearInterval(duckT); c.duck(30); duckT = window.setInterval(() => c.duck(30), 25000);
    clearTimeout(maxT); maxT = window.setTimeout(close, 6 * 60 * 1000);
  }
  return { open, arrive, close, setImgs: (u: string[]) => { imgs = u.slice(0, 30); }, on: () => !!el?.classList.contains("on") };
}
