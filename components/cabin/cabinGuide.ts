/**
 * 車内 iPad: 入り方ガイド (押したときだけ流れる。自動では流さない)。
 *   ① 外から開ける (暗証番号がテンキーに 1 文字ずつ光る) → ② 中から開ける (白いつまみが右に回る)
 *   → ③ 閉めると 15 秒で自動ロック → (夏のお部屋) ④ 番号 → ⑤ つまみを左へ → ⑥ 斜め＝施錠 / 水平＝解錠 → 📸 まとめ
 *   ASTRAEA の声 (英語) + ゲストの言語の字幕。暗証番号は登録してあるエントランスの番号から。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import QRCode from "qrcode";
import { GUIDE_T, GUIDE_VOICE, guideAudio, type GuideKey, type RoomGuide } from "@/lib/cabinAiTalk";
import type { GLang } from "@/lib/cabinGeo";

export interface GuideCtx {
  root: HTMLElement; stage: HTMLElement;
  lang: () => GLang;
  code: () => string | null;        // エントランスの暗証番号 (無ければ null)
  keyUrl: () => string | null;       // エントランスの鍵のページ (スマートキー)
  roomUrl: () => string | null;      // お部屋のページ (スマートキー)
  room: () => { guide: RoomGuide | null; code: string | null; name: string }; // お部屋の開け方 (夏だけ)
  ac: () => AudioContext | null;
  duck: (sec: number) => void;       // お父さんのスマホの音楽を下げる
  busy: () => boolean;               // ASTRAEA が話している
}
/** all = エントランス + お部屋 (到着前・ASTRAEA) / ent = エントランスだけ / room = お部屋だけ (到着画面のボタン) */
export type GuideScope = "all" | "ent" | "room";
export interface Guide { start(scope?: GuideScope): void; stop(): void; on(): boolean; hasRoom(): boolean }

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "🔒", "0", "🔓"];
const esc = (s: string) => s.replace(/[<&>"]/g, "");

const HTML = `<div class="gdTop"><b>CRANE NEST</b><small id="gdTopT">ENTRANCE GUIDE</small><div class="gdDots" id="gdDots"></div><button class="gdX" id="gdX">✕</button></div>
<div class="gdS" data-s="1"><div class="gdArt"><svg viewBox="0 0 600 520" id="gdKp"></svg></div><div class="gdTx"><div class="gdN">1</div><h2 data-g="t1"></h2><h4>UNLOCK FROM OUTSIDE</h4><div class="gdCode" id="gdCb"></div><p data-g="d1"></p></div></div>
<div class="gdS" data-s="2"><div class="gdArt"><svg viewBox="0 0 600 520"><defs><marker id="gdAh" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ff8a3c"/></marker></defs>
 <rect x="170" y="90" width="260" height="340" rx="40" fill="#141a26" stroke="#3a4a66" stroke-width="3"/><circle cx="300" cy="260" r="92" fill="#0b0f18" stroke="#2a3446" stroke-width="3"/>
 <g id="gdKnob" style="transform-origin:300px 260px;transition:transform 1.6s cubic-bezier(.4,1.6,.5,1)"><rect x="220" y="236" width="160" height="48" rx="24" fill="#f4f6fb"/></g>
 <path id="gdArc" d="M200 160 A140 140 0 0 1 420 170" fill="none" stroke="#ff8a3c" stroke-width="10" stroke-linecap="round" marker-end="url(#gdAh)" stroke-dasharray="320" stroke-dashoffset="320" style="transition:stroke-dashoffset 1.2s"/>
 <text x="300" y="480" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6" id="gdKs">BEFORE</text></svg></div>
 <div class="gdTx"><div class="gdN">2</div><h2 data-g="t2"></h2><h4>UNLOCK FROM INSIDE · TURN RIGHT</h4><ol class="gdPr" id="gdPr2"><li data-g="p21"></li><li data-g="p22"></li><li data-g="p23"></li></ol></div></div>
<div class="gdS" data-s="3"><div class="gdArt"><svg viewBox="0 0 600 520">
 <rect x="60" y="60" width="220" height="400" rx="10" fill="#1a2233" stroke="#3a4a66" stroke-width="3"/><rect id="gdDoor" x="60" y="60" width="220" height="400" rx="10" fill="#8a929f" stroke="#c9d2de" stroke-width="3" style="transform-origin:60px 260px;transition:transform 1.4s cubic-bezier(.3,1.2,.5,1)"/>
 <circle cx="430" cy="210" r="110" fill="none" stroke="rgba(95,227,255,.15)" stroke-width="16"/><circle id="gdRing" cx="430" cy="210" r="110" fill="none" stroke="#5fe3ff" stroke-width="16" stroke-linecap="round" stroke-dasharray="691" stroke-dashoffset="0" transform="rotate(-90 430 210)"/>
 <text id="gdCnt" x="430" y="232" text-anchor="middle" fill="#fff" font-size="72" font-weight="800" font-family="Menlo,monospace">15</text>
 <g transform="translate(430 400)"><rect x="-44" y="-10" width="88" height="70" rx="12" fill="#243049"/><path id="gdSh3" d="M-26 -10 V-34 A26 26 0 0 1 26 -34 V-10" fill="none" stroke="#9fb6d6" stroke-width="12"/><circle cy="24" r="8" fill="#0b0f18"/></g>
 <text id="gdLk" x="430" y="495" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6">WAITING</text></svg></div>
 <div class="gdTx"><div class="gdN">3</div><h2 data-g="t3"></h2><h4>AUTO-LOCK · 15 SEC</h4><p data-g="d3"></p></div></div>
<div class="gdS rm" data-s="4"><div class="gdRt" data-rn></div><div class="gdArt"><svg viewBox="0 0 600 520" id="gdRkp"></svg></div><div class="gdTx"><div class="gdN">4</div><h2 data-g="t4"></h2><h4>YOUR ROOM · ENTER THE CODE</h4><div class="gdCode" id="gdRcb"></div><p data-g="d4"></p></div></div>
<div class="gdS rm" data-s="5"><div class="gdRt" data-rn></div><div class="gdArt"><svg viewBox="0 0 600 520"><defs><marker id="gdAh2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#5fe3ff"/></marker><linearGradient id="gdWood" x1="0" x2="1"><stop offset="0" stop-color="#6b3b17"/><stop offset=".5" stop-color="#8a5226"/><stop offset="1" stop-color="#5a3013"/></linearGradient></defs>
 <rect x="0" y="0" width="120" height="520" fill="url(#gdWood)" opacity=".7"/><rect x="170" y="80" width="280" height="360" rx="36" fill="#15181f" stroke="#3a3f4c" stroke-width="3"/><circle cx="310" cy="270" r="100" fill="#0b0d12" stroke="#2c313c" stroke-width="3"/>
 <g id="gdRknob" style="transform-origin:310px 270px;transform:rotate(-60deg);transition:transform 1.8s cubic-bezier(.4,1.3,.5,1)"><rect x="220" y="246" width="180" height="48" rx="12" fill="#23272f" stroke="#666e7d" stroke-width="3"/></g>
 <path id="gdRarc" d="M440 180 A150 150 0 0 0 190 160" fill="none" stroke="#5fe3ff" stroke-width="10" stroke-linecap="round" marker-end="url(#gdAh2)" stroke-dasharray="330" stroke-dashoffset="330" style="transition:stroke-dashoffset 1.2s;filter:drop-shadow(0 0 6px #00c8ff)"/>
 <text x="310" y="490" text-anchor="middle" fill="#ff7a7a" font-size="22" font-family="Menlo,monospace" letter-spacing="5" id="gdRks">LOCKED · TILTED</text></svg></div>
 <div class="gdTx"><div class="gdN">5</div><h2 data-g="t5"></h2><h4>TURN LEFT · COUNTERCLOCKWISE</h4><ol class="gdPr" id="gdPr5"><li data-g="p51"></li><li data-g="p52"></li><li data-g="p53"></li></ol><div class="gdHint" data-g="h5"></div></div></div>
<div class="gdS rm" data-s="6"><div class="gdRt" data-rn></div><div class="gdArt"><svg viewBox="0 0 600 520">
 <g id="gdStL" style="transition:opacity .5s"><rect x="30" y="40" width="255" height="420" rx="18" fill="rgba(255,70,70,.08)" stroke="#ff5a5a" stroke-width="3"/><text x="157" y="92" text-anchor="middle" fill="#ff7a7a" font-size="26" font-weight="800">🔒 LOCKED</text>
  <circle cx="157" cy="250" r="86" fill="#0b0d12" stroke="#2c313c" stroke-width="3"/><g transform="rotate(-60 157 250)"><rect x="77" y="228" width="160" height="44" rx="10" fill="#23272f" stroke="#666e7d" stroke-width="3"/><line x1="60" y1="250" x2="254" y2="250" stroke="#ff5a5a" stroke-width="4" stroke-dasharray="10 8"/></g>
  <text x="157" y="420" text-anchor="middle" fill="#ffb3b3" font-size="22" font-weight="700" data-g="tilt"></text></g>
 <g id="gdStR" style="transition:opacity .5s"><rect x="315" y="40" width="255" height="420" rx="18" fill="rgba(70,224,138,.08)" stroke="#46e08a" stroke-width="3"/><text x="442" y="92" text-anchor="middle" fill="#6ff0a8" font-size="26" font-weight="800">🔓 UNLOCKED</text>
  <circle cx="442" cy="250" r="86" fill="#0b0d12" stroke="#2c313c" stroke-width="3"/><rect x="362" y="228" width="160" height="44" rx="10" fill="#23272f" stroke="#666e7d" stroke-width="3"/><line x1="345" y1="250" x2="539" y2="250" stroke="#46e08a" stroke-width="4" stroke-dasharray="10 8"/>
  <text x="442" y="420" text-anchor="middle" fill="#b9ffd6" font-size="22" font-weight="700" data-g="flat"></text></g></svg></div>
 <div class="gdTx"><div class="gdN">6</div><h2 data-g="t6"></h2><h4>TILTED = LOCKED · HORIZONTAL = UNLOCKED</h4><p data-g="d6"></p></div></div>
<div class="gdS rm" data-s="7"><div class="gdRt" data-rn></div><div class="gdArt gdCmp"><svg viewBox="0 0 600 520">
 <text x="150" y="44" text-anchor="middle" fill="#8ff0ff" font-size="22" font-weight="800" data-g="ent"></text><text x="450" y="44" text-anchor="middle" fill="#ffc27a" font-size="22" font-weight="800" data-g="rm"></text>
 <line x1="300" y1="30" x2="300" y2="500" stroke="rgba(255,255,255,.15)" stroke-width="2" stroke-dasharray="6 8"/>
 <g><rect x="40" y="70" width="220" height="190" rx="16" fill="rgba(255,70,70,.08)" stroke="#ff5a5a" stroke-width="2.5"/><circle cx="150" cy="160" r="58" fill="#0b0f18" stroke="#2a3446" stroke-width="2"/><rect x="90" y="146" width="120" height="28" rx="14" fill="#f4f6fb"/><text x="150" y="250" text-anchor="middle" fill="#ff7a7a" font-size="20" font-weight="800">🔒 ━ LOCKED</text></g>
 <g><rect x="40" y="290" width="220" height="190" rx="16" fill="rgba(70,224,138,.08)" stroke="#46e08a" stroke-width="2.5"/><circle cx="150" cy="380" r="58" fill="#0b0f18" stroke="#2a3446" stroke-width="2"/><rect x="136" y="320" width="28" height="120" rx="14" fill="#f4f6fb"/><text x="150" y="470" text-anchor="middle" fill="#6ff0a8" font-size="20" font-weight="800">🔓 ┃ UNLOCKED</text></g>
 <g id="gdCmpR"><rect x="340" y="70" width="220" height="190" rx="16" fill="rgba(255,70,70,.08)" stroke="#ff5a5a" stroke-width="2.5"/><circle cx="450" cy="160" r="58" fill="#0b0d12" stroke="#2c313c" stroke-width="2"/><g transform="rotate(-60 450 160)"><rect x="390" y="146" width="120" height="28" rx="8" fill="#23272f" stroke="#666e7d" stroke-width="2"/></g><text x="450" y="250" text-anchor="middle" fill="#ff7a7a" font-size="20" font-weight="800">🔒 ╱ LOCKED</text>
  <rect x="340" y="290" width="220" height="190" rx="16" fill="rgba(70,224,138,.08)" stroke="#46e08a" stroke-width="2.5"/><circle cx="450" cy="380" r="58" fill="#0b0d12" stroke="#2c313c" stroke-width="2"/><rect x="390" y="366" width="120" height="28" rx="8" fill="#23272f" stroke="#666e7d" stroke-width="2"/><text x="450" y="470" text-anchor="middle" fill="#6ff0a8" font-size="20" font-weight="800">🔓 ━ UNLOCKED</text></g>
 <g id="gdCmpX" opacity="0" style="transition:opacity .4s"><circle cx="150" cy="160" r="72" fill="none" stroke="#ffd23c" stroke-width="5"/><circle cx="450" cy="380" r="72" fill="none" stroke="#ffd23c" stroke-width="5"/><path d="M215 200 L385 340" stroke="#ffd23c" stroke-width="4" stroke-dasharray="8 7" marker-end="url(#gdAh3)"/><defs><marker id="gdAh3" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ffd23c"/></marker></defs></g>
 </svg></div>
 <div class="gdTx"><div class="gdN gdWarn">!</div><h2 data-g="t7"></h2><h4>SAME SHAPE · OPPOSITE MEANING</h4><p data-g="d7"></p></div></div>
<div class="gdS sm" data-s="8"><div class="gdSmart"><div class="gdRec" data-g="rec"></div><h2 data-g="t8"></h2><p data-g="d8"></p><div class="gdQs" id="gdQs"></div></div></div>
<div class="gdS" data-s="9"><div class="gdSum" id="gdSum"></div><div class="gdSnap"><i></i><i></i><i></i><i></i></div><div class="gdSnapT" data-g="snap"></div></div>
<div class="gdFlash" id="gdFlash"></div>
<div class="gdAi"><i class="gdOrb"></i><div><div class="gdNm">ASTRAEA · ENTRANCE GUIDE</div><div class="gdSub" id="gdSub"></div><div class="gdEn" id="gdEn"></div></div></div>`;

export function createGuide(c: GuideCtx): Guide {
  const host = document.createElement("div"); host.className = "gdp"; host.id = "gdp"; host.innerHTML = HTML;
  c.stage.appendChild(host);
  const $ = (id: string) => host.querySelector("#" + id) as any;
  const el = new Audio();
  let run = 0, onNow = false, closeT: ReturnType<typeof setTimeout> | null = null;
  const code = () => (c.code() || "").replace(/\D/g, "");

  const tone = (f: number, t: number, d: number, v: number) => {
    const ctx = c.ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(v, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
    o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05);
  };
  const wait = (ms: number, r: number) => new Promise<boolean>((ok) => setTimeout(() => ok(r === run), ms));
  function say(k: GuideKey) {
    const L = c.lang(), s = GUIDE_VOICE[k] as Record<GLang, string>;
    $("gdSub").innerHTML = [...s[L]].map((ch, i) => `<span style="animation-delay:${i * 22}ms">${esc(ch)}</span>`).join("");
    $("gdEn").textContent = L === "en" ? "" : s.en;
    return new Promise<void>((ok) => { el.src = guideAudio(k); el.onended = () => ok(); el.onerror = () => ok(); el.play().catch(() => ok()); setTimeout(ok, 22000); });
  }
  function show(n: number) {
    host.querySelectorAll<HTMLElement>(".gdS").forEach((e) => e.classList.toggle("on", Number(e.dataset.s) === n));
    host.querySelectorAll<HTMLElement>("#gdDots i").forEach((e) => { const k = Number(e.dataset.n); e.className = k < n ? "done" : k === n ? "on" : ""; });
  }
  async function texts(scope: GuideScope) {
    const T = GUIDE_T[c.lang()] ?? GUIDE_T.en;
    host.querySelectorAll<HTMLElement>("[data-g]").forEach((e) => { e.textContent = T[e.dataset.g!] ?? ""; });
    $("gdTopT").textContent = T.top === "ENTRANCE GUIDE" ? T.top : `${T.top} · ENTRANCE GUIDE`;
    const cd = code(), rm = c.room(), rc = (rm.code || "").replace(/\D/g, ""), hasRoom = rm.guide === "natsu" && scope !== "ent", ent = scope !== "room";
    const mk = async (u: string | null) => { if (!u) return ""; try { return await QRCode.toString(u, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0a1426", light: "#ffffff" } }); } catch { return ""; } };
    const qrK = ent ? await mk(c.keyUrl()) : "", qrR = hasRoom || (ent && c.roomUrl()) ? await mk(c.roomUrl()) : "";
    // ⑧ いちばん確実なのはスマホの鍵 (エントランス / お部屋の QR)
    $("gdQs").innerHTML = [qrK ? `<div class="gdQ"><div class="qr">${qrK}</div><b>🔑 ${esc(T.k1)}</b></div>` : "", qrR ? `<div class="gdQ rmq"><div class="qr">${qrR}</div><b>🚪 ${esc(T.k2)}</b></div>` : ""].join("");
    const pad = (on: string) => `<svg viewBox="0 0 100 100"><rect x="28" y="4" width="44" height="92" rx="12" fill="#12161f" stroke="#2c3546"/>${KEYS.map((_, i) => `<circle cx="${39 + (i % 3) * 11}" cy="${20 + Math.floor(i / 3) * 13}" r="4" fill="${i === 11 ? on : "#2a3346"}"/>`).join("")}<circle cx="61" cy="59" r="8" fill="none" stroke="${on}" stroke-width="1.6"/></svg>`;
    /** まとめ用: 回す前 → 回す向き (大きな矢印) → 回した後 */
    const turn = (id: string, from: number, to: number, bar: string, dir: "R" | "L", col: string, lab: string) => {
      const k = (cx: number, rot: number, ring: string, ico: string) => `<circle cx="${cx}" cy="44" r="27" fill="#0b0f18" stroke="${ring}" stroke-width="3"/><g transform="rotate(${rot} ${cx} 44)"><rect x="${cx - 20}" y="37" width="40" height="14" rx="6" fill="${bar}"/></g><text x="${cx}" y="94" text-anchor="middle" font-size="13">${ico}</text>`;
      const arc = dir === "R" ? "M100 18 A23 23 0 1 1 77 41" : "M100 18 A23 23 0 1 0 123 41";
      return `<svg viewBox="0 0 200 100" class="turn"><defs><marker id="${id}" markerWidth="3.2" markerHeight="3.2" refX="1.6" refY="1.6" orient="auto"><path d="M0 0L3.2 1.6L0 3.2z" fill="${col}"/></marker></defs>${k(30, from, "#ff5a5a", "🔒")}<path d="${arc}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" marker-end="url(#${id})" style="filter:drop-shadow(0 0 4px ${col})"/><text x="100" y="88" text-anchor="middle" fill="${col}" font-size="17" font-weight="800">${esc(lab)}</text>${k(170, to, "#46e08a", "🔓")}</svg>`;
    };
    const card = (n: number, cls: string, lab: string, svg: string, t: string, small: string, cdv = "") =>
      `<div class="gc ${cls}">${lab ? `<span class="lab">${lab}</span>` : ""}<div class="n">${n}</div>${svg}<b>${esc(t)}</b>${cdv ? `<div class="cd">${cdv}</div>` : ""}${small.includes("→") ? `<ol class="mp">${small.split("→").map((x) => `<li>${esc(x.trim())}</li>`).join("")}</ol>` : `<small>${esc(small)}</small>`}</div>`; // 手順は ①②③ で並べる
    const qc = qrK || qrR ? `<div class="gc q"><span class="gcRec">★ ${esc(T.rec)}</span>${qrK ? `<div class="qr">${qrK}</div><b>🔑 ${esc(T.k1)}</b>` : ""}${qrR ? `<div class="qr">${qrR}</div><b>🚪 ${esc(T.k2)}</b>` : ""}</div>` : "";
    const roomCards = (n0: number, cls: string, lab: string) => card(n0, cls, lab, pad("#ffb35c"), T.t4, T.c4, rc) +
      card(n0 + 1, cls, "", turn("gdMa5", -60, -180, "#9aa3b5", "L", "#5fe3ff", T.tl), T.t5, T.c5) +
      card(n0 + 2, cls, "", '<svg viewBox="0 0 100 100"><g transform="rotate(-60 28 50)"><rect x="8" y="44" width="40" height="12" rx="4" fill="#ff5a5a"/></g><rect x="56" y="44" width="40" height="12" rx="4" fill="#46e08a"/><text x="28" y="90" text-anchor="middle" font-size="13">🔒</text><text x="76" y="90" text-anchor="middle" font-size="13">🔓</text></svg>', T.t6, `${T.c6}  ${T.c7}`);
    host.classList.toggle("hasRoom", hasRoom && ent);
    // お部屋だけのガイド: お部屋の 3 枚 + QR (エントランスは出さない)
    if (!ent) $("gdSum").innerHTML = roomCards(1, "rmc", "") + qc;
    else $("gdSum").innerHTML =
      card(1, "", `🏢 ${esc(T.ent)}${T.ent === "ENTRANCE" ? "" : " · ENTRANCE"}`, pad("#00c8ff"), T.t1, T.c1, cd) +
      card(2, "", "", turn("gdMa2", 0, 90, "#f4f6fb", "R", "#ff8a3c", T.tr), T.t2, T.c2) +
      card(3, "", "", '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="#5fe3ff" stroke-width="6"/><text x="50" y="59" text-anchor="middle" fill="#fff" font-size="24" font-weight="800" font-family="Menlo,monospace">15s</text></svg>', T.t3, T.c3) +
      qc + (hasRoom ? roomCards(4, "rmc", `🚪 ${esc(T.rm)} · ${esc(rm.name)}`) : "");
    host.querySelectorAll<HTMLElement>("[data-rn]").forEach((e) => { e.textContent = "🚪 " + rm.name; });
    const steps = [...(ent ? [1, 2, 3] : []), ...(hasRoom ? [4, 5, 6, 7] : []), ...(qrK || qrR ? [8] : []), 9].filter((n) => n !== 1 || cd);
    $("gdDots").innerHTML = steps.map((n) => `<i data-n="${n}"></i>`).join("");
    kpInto("gdKp", "gdCb", cd, "e", false); kpInto("gdRkp", "gdRcb", rc, "r", true);
  }
  function kpInto(svg: string, cb: string, cd: string, p: string, room: boolean) {
    let h = room ? `<defs><linearGradient id="gdW2" x1="0" x2="1"><stop offset="0" stop-color="#6b3b17"/><stop offset=".5" stop-color="#9a5e2c"/><stop offset="1" stop-color="#5a3013"/></linearGradient></defs><rect width="600" height="520" fill="url(#gdW2)" opacity=".35"/>` : "";
    h += `<rect x="300" y="30" width="250" height="460" rx="60" fill="#12161f" stroke="#2c3546" stroke-width="3"/><rect x="330" y="60" width="190" height="44" rx="10" fill="#050810" stroke="#223"/><text id="gd${p}Disp" x="425" y="92" text-anchor="middle" fill="${room ? "#ffc27a" : "#5fe3ff"}" font-size="26" font-family="Menlo,monospace" letter-spacing="6"></text>`;
    KEYS.forEach((k, i) => { const x = 348 + (i % 3) * 58, y = 140 + Math.floor(i / 3) * 62; h += `<g id="gd${p}K${i}"><circle cx="${x}" cy="${y}" r="24" fill="#1c2230"/><text x="${x}" y="${y + 9}" text-anchor="middle" fill="#e6eefc" font-size="${k.length > 1 ? 20 : 24}">${k}</text></g>`; });
    h += `<circle cx="425" cy="420" r="36" fill="#0b0f18" stroke="#2c3546" stroke-width="3"/><circle id="gd${p}Ring" cx="464" cy="326" r="30" fill="none" stroke="#00c8ff" stroke-width="5" opacity="0"/>
     <g transform="translate(150 250)"><rect x="-60" y="-10" width="120" height="96" rx="16" fill="#243049"/><path id="gd${p}Sh" d="M-34 -10 V-44 A34 34 0 0 1 34 -44 V-10" fill="none" stroke="#9fb6d6" stroke-width="15"/><circle cy="36" r="11" fill="#0b0f18"/></g>
     <text id="gd${p}St" x="150" y="400" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6">LOCKED</text>`;
    $(svg).innerHTML = h;
    $(cb).innerHTML = [...cd].map((d) => `<span>${d}</span>`).join("");
  }
  async function typeIn(r: number, p: string, cb: string, cd: string) {
    let typed = ""; if (!(await wait(1400, r))) return;
    for (let i = 0; i < cd.length; i++) {
      if (!(await wait(430, r))) return;
      const g = $(`gd${p}K${KEYS.indexOf(cd[i])}`)?.firstChild; g?.setAttribute("fill", "#00a8e8"); setTimeout(() => g?.setAttribute("fill", "#1c2230"), 300);
      typed += cd[i]; $(`gd${p}Disp`).textContent = typed; $(cb).children[i]?.classList.add("lit"); tone(1200 + i * 60, 0, 0.07, 0.04);
    }
    if (!(await wait(600, r))) return;
    $(`gd${p}K11`).firstChild.setAttribute("fill", "#00c8ff"); $(`gd${p}Ring`).setAttribute("opacity", "1"); tone(900, 0, 0.1, 0.05); tone(1400, 0.1, 0.2, 0.05);
    if (!(await wait(500, r))) return;
    $(`gd${p}Sh`).setAttribute("transform", "translate(0 -22)"); $(`gd${p}Sh`).setAttribute("stroke", "#46e08a"); $(`gd${p}St`).textContent = "UNLOCKED"; $(`gd${p}St`).setAttribute("fill", "#46e08a");
  }
  const a1 = (r: number) => typeIn(r, "e", "gdCb", code());
  /** 回す手順 ①②③ を順に光らせる */
  const pr = (id: string, k: number) => host.querySelectorAll<HTMLElement>(`#${id} li`).forEach((e, i) => { e.className = i < k - 1 ? "done" : i === k - 1 ? "on" : ""; });
  async function a2(r: number) {
    pr("gdPr2", 1);
    $("gdKnob").style.transform = "rotate(0deg)"; $("gdArc").style.strokeDashoffset = "320"; $("gdKs").textContent = "BEFORE"; $("gdKs").setAttribute("fill", "#8ff0ff");
    if (!(await wait(4200, r))) return; pr("gdPr2", 2); $("gdArc").style.strokeDashoffset = "0";
    if (!(await wait(500, r))) return; $("gdKnob").style.transform = "rotate(90deg)"; tone(500, 0.5, 0.12, 0.06);
    if (!(await wait(3600, r))) return; pr("gdPr2", 3); $("gdKs").textContent = "AFTER · UNLOCKED"; $("gdKs").setAttribute("fill", "#46e08a");
  }
  async function a3(r: number) {
    $("gdDoor").style.transform = "perspective(600px) rotateY(-70deg)"; $("gdRing").style.strokeDashoffset = "0"; $("gdCnt").textContent = "15";
    $("gdSh3").setAttribute("transform", "translate(0 -14)"); $("gdSh3").setAttribute("stroke", "#9fb6d6"); $("gdLk").textContent = "WAITING"; $("gdLk").setAttribute("fill", "#8ff0ff");
    if (!(await wait(1500, r))) return; $("gdDoor").style.transform = "perspective(600px) rotateY(0deg)"; tone(180, 0.9, 0.15, 0.08);
    if (!(await wait(1200, r))) return;
    for (let s = 15; s >= 0; s--) { $("gdCnt").textContent = String(s); $("gdRing").style.strokeDashoffset = String(691 * (1 - s / 15)); tone(s ? 1500 : 900, 0, 0.04, 0.03); if (!(await wait(300, r))) return; }
    $("gdSh3").setAttribute("transform", "translate(0 0)"); $("gdSh3").setAttribute("stroke", "#5fe3ff"); $("gdLk").textContent = "LOCKED ✓"; $("gdLk").setAttribute("fill", "#46e08a"); tone(700, 0, 0.1, 0.06); tone(1100, 0.1, 0.2, 0.05);
  }
  const a4 = (r: number) => typeIn(r, "r", "gdRcb", (c.room().code || "").replace(/\D/g, ""));
  async function a5(r: number) {
    pr("gdPr5", 1); $("gdRknob").style.transform = "rotate(-60deg)"; $("gdRarc").style.strokeDashoffset = "330"; $("gdRks").textContent = "LOCKED · TILTED"; $("gdRks").setAttribute("fill", "#ff7a7a");
    if (!(await wait(4200, r))) return; pr("gdPr5", 2); $("gdRarc").style.strokeDashoffset = "0";
    if (!(await wait(600, r))) return; $("gdRknob").style.transform = "rotate(-180deg)"; tone(520, 0.4, 0.12, 0.06);
    if (!(await wait(3600, r))) return; pr("gdPr5", 3); $("gdRks").textContent = "UNLOCKED · HORIZONTAL"; $("gdRks").setAttribute("fill", "#46e08a"); tone(900, 0, 0.1, 0.05); tone(1320, 0.1, 0.2, 0.05);
  }
  async function a6(r: number) {
    for (let k = 0; k < 6; k++) { const L = k % 2 === 0; $("gdStL").style.opacity = L ? "1" : ".35"; $("gdStR").style.opacity = L ? ".35" : "1"; tone(L ? 600 : 1000, 0, 0.08, 0.04); if (!(await wait(1300, r))) return; }
    $("gdStL").style.opacity = "1"; $("gdStR").style.opacity = "1";
  }

  /* ⑦ エントランスとお部屋は逆 (横＝施錠 ⇄ 横＝解錠) を点滅で強調 */
  async function a7(r: number) {
    $("gdCmpX").setAttribute("opacity", "0"); if (!(await wait(2500, r))) return;
    for (let k = 0; k < 4; k++) { $("gdCmpX").setAttribute("opacity", k % 2 ? "0.35" : "1"); tone(k % 2 ? 700 : 1100, 0, 0.1, 0.05); if (!(await wait(900, r))) return; }
    $("gdCmpX").setAttribute("opacity", "1");
  }
  async function start(scope: GuideScope = "all") {
    if (onNow) return; onNow = true; const r = ++run;
    c.duck(45); await texts(scope); c.ac();
    host.classList.add("on"); c.stage.classList.add("gd-on"); if (closeT) clearTimeout(closeT);
    const ent = scope !== "room", hasRoom = c.room().guide === "natsu" && scope !== "ent";
    show(ent ? (code() ? 1 : 2) : 4);
    if (ent) { await say("intro"); if (r !== run) return; }
    const steps: [number, GuideKey, (r: number) => Promise<void>][] = [...(ent ? ([[1, "s1", a1], [2, "s2", a2], [3, "s3", a3]] as [number, GuideKey, (r: number) => Promise<void>][]) : []), ...(hasRoom ? ([[4, "r1", a4], [5, "r2", a5], [6, "r3", a6], [7, "r4", a7]] as [number, GuideKey, (r: number) => Promise<void>][]) : [])];
    for (const [n, k, a] of steps) {
      if (n === 1 && !code()) continue; // 暗証番号が登録されていなければ ① は飛ばす
      if (n === 4) { show(4); await say("room"); if (r !== run) return; }
      show(n); await Promise.all([say(k), a(r), wait(7500, r)]); if (r !== run) return;
      if (!(await wait(800, r))) return;
    }
    if ((ent && c.keyUrl()) || (hasRoom && c.roomUrl()) || (ent && c.roomUrl())) { show(8); await Promise.all([say("smart"), wait(9000, r)]); if (r !== run) return; if (!(await wait(600, r))) return; }
    show(9); const f = $("gdFlash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); tone(2000, 0, 0.05, 0.05);
    await say("photo");
    closeT = setTimeout(stop, 120000); // 写真の画面は 2 分で閉じる
  }
  function stop() {
    run++; onNow = false; el.pause(); host.classList.remove("on"); c.stage.classList.remove("gd-on"); if (closeT) clearTimeout(closeT); closeT = null;
  }
  $("gdX").onclick = (e: Event) => { e.stopPropagation(); stop(); };
  host.onclick = (e) => e.stopPropagation();
  return { start: (sc?: GuideScope) => void start(sc), stop, on: () => onNow, hasRoom: () => c.room().guide === "natsu" };
}
