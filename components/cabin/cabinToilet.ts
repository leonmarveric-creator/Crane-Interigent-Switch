/**
 * 車内 iPad: トイレの使い方ガイド (押したときだけ流れる。自動では流さない)。
 *   ① 壁の四角いボタンで流す (指が押す → 波紋 → 便器の水がうず巻く) → ② 温水洗浄便座 (座ってから)
 *   → ③ UV 殺菌灯 (さわらない・電源を入れない・目や肌に有害。無人のとき自動) → 到着画面に戻る
 *   見た目は入り方ガイドと同じ部品 (.gdp) を使う。ASTRAEA の声 (英語) + ゲストの言語の字幕。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { TOILET_T, TOILET_VOICE, toiletAudio, type ToiletKey } from "@/lib/cabinToilet";
import type { GLang } from "@/lib/cabinGeo";
import { playSafe, unlockAudio, stopVoice } from "@/lib/cabinAudio";

export interface ToiletCtx {
  stage: HTMLElement;
  lang: () => GLang;
  ac: () => AudioContext | null;
  duck: (sec: number) => void; // お父さんのスマホの音楽を下げる
}
export interface Toilet { start(): void; stop(): void; on(): boolean; unlock(): void }

const esc = (s: string) => s.replace(/[<&>"]/g, "");
/** 実際のトイレの写真 (差し替えるときはこのファイルを置き換える) */
export const TOILET_IMG = { room: "/cabin/img/toilet-guide.jpg", uv: "/cabin/img/toilet-uv.jpg" };
const BR = (x: number, y: number, w: number, h: number, id: string) => `<g id="${id}" class="tlBr" fill="none" stroke="#5fe3ff" stroke-width="6" stroke-linecap="round">${[[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].map(([px, py, sx, sy]) => `<path d="M${px} ${py + sy * 34} V${py} H${px + sx * 34}"/>`).join("")}</g>`;

const HTML = `<div class="gdTop"><b>CRANE NEST</b><small id="tlTopT">RESTROOM GUIDE</small><div class="gdDots" id="tlDots"></div><button class="gdX" id="tlX">✕</button></div>
<div class="gdS" data-s="1"><div class="gdArt tlPh"><svg viewBox="0 0 970 815" preserveAspectRatio="xMidYMid slice"><image href="${TOILET_IMG.room}" width="970" height="815"/>
 <rect id="tlDim" width="970" height="815" fill="#030814" opacity=".45" style="transition:opacity .8s"/>
 <rect id="tlScan" class="tlScan" x="0" y="0" width="970" height="6" fill="#5fe3ff" opacity=".7"/>
 ${BR(690, 70, 150, 230, "tlBrk")}
 <circle id="tlRing" class="tlPulse" cx="765" cy="190" r="62" fill="none" stroke="#5fe3ff" stroke-width="8" opacity="0" style="transition:opacity .4s"/>
 <g id="tlRip" opacity="0">${[0, 1, 2].map((i) => `<circle class="tlRipC" style="animation-delay:${i * 0.35}s" cx="765" cy="190" r="40" fill="none" stroke="#bff4ff" stroke-width="5"/>`).join("")}</g>
 <g id="tlTag" opacity="0" style="transition:opacity .4s"><rect x="660" y="300" width="210" height="62" rx="31" fill="#0a4bd6" stroke="#bff4ff" stroke-width="3"/><text x="765" y="342" text-anchor="middle" fill="#fff" font-size="32" font-weight="800">👆 <tspan data-g="push"></tspan></text></g>
 <g id="tlFl" opacity="0" style="transition:opacity .5s"><rect x="440" y="700" width="300" height="60" rx="30" fill="rgba(3,12,30,.8)" stroke="#5fe3ff" stroke-width="3"/><text x="590" y="742" text-anchor="middle" fill="#5fe3ff" font-size="30" font-weight="800" font-family="Menlo,monospace" letter-spacing="6">FLUSH ≈</text></g>
 </svg></div>
 <div class="gdTx"><div class="gdN">1</div><h2 data-g="t1"></h2><h4>PUSH THE WALL BUTTON</h4><p data-g="d1"></p></div></div>
<div class="gdS" data-s="2"><div class="gdArt tlPh"><svg viewBox="300 250 640 565" preserveAspectRatio="xMidYMid slice"><image href="${TOILET_IMG.room}" width="970" height="815"/>
 <rect x="300" y="250" width="640" height="565" fill="#030814" opacity=".35"/>
 <ellipse id="tlSeat" class="tlSpin" cx="600" cy="585" rx="250" ry="175" fill="none" stroke="#5fe3ff" stroke-width="6" stroke-dasharray="30 18" opacity="0" style="transition:opacity .5s"/>
 <g id="tlJet" opacity="0" style="transition:opacity .5s">${[0, 1, 2, 3, 4].map((i) => `<circle class="tlDrop" style="animation-delay:${i * 0.18}s" cx="${560 + i * 18}" cy="600" r="7" fill="#8ff0ff"/>`).join("")}<text x="600" y="690" text-anchor="middle" fill="#bff4ff" font-size="28" font-weight="800" font-family="Menlo,monospace" letter-spacing="5">WARM WATER</text></g>
 <g id="tlSit" opacity="0" style="transition:opacity .4s"><rect x="330" y="280" width="290" height="70" rx="35" fill="rgba(4,40,24,.85)" stroke="#46e08a" stroke-width="4"/><text x="475" y="327" text-anchor="middle" fill="#6ff0a8" font-size="30" font-weight="800">✓ <tspan data-g="sit"></tspan></text></g>
 </svg></div>
 <div class="gdTx"><div class="gdN">2</div><h2 data-g="t2"></h2><h4>WARM-WATER BIDET · SIT FIRST</h4><p data-g="d2"></p></div></div>
<div class="gdS tlUv" data-s="3"><div class="gdArt tlPh"><svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice"><image href="${TOILET_IMG.uv}" width="600" height="520"/>
 <rect x="122" y="92" width="210" height="392" rx="30" fill="none" stroke="#7fb8ff" stroke-width="6" class="tlGlow"/>
 <g id="tlNo" opacity="0" style="transition:opacity .5s"><circle cx="228" cy="290" r="150" fill="rgba(255,40,40,.12)" stroke="#ff4a4a" stroke-width="16"/><line x1="122" y1="184" x2="334" y2="396" stroke="#ff4a4a" stroke-width="16"/></g>
 <g><rect x="360" y="440" width="226" height="54" rx="27" fill="rgba(3,12,30,.85)" stroke="#8ff0ff" stroke-width="2"/><text x="473" y="475" text-anchor="middle" fill="#8ff0ff" font-size="19" font-weight="800" data-g="auto"></text></g>
 </svg></div>
 <div class="gdTx"><div class="gdN gdWarn">!</div><h2 data-g="t3"></h2><h4>UV STERILIZER · DO NOT TOUCH</h4><p data-g="d3"></p><ol class="gdPr tlWarn" id="tlW"><li data-g="w1"></li><li data-g="w2"></li><li data-g="w3"></li></ol></div></div>
<div class="gdAi"><i class="gdOrb"></i><div><div class="gdNm">ASTRAEA · RESTROOM GUIDE</div><div class="gdSub" id="tlSub"></div><div class="gdEn" id="tlEn"></div></div></div>`;

export function createToilet(c: ToiletCtx): Toilet {
  const host = document.createElement("div"); host.className = "gdp tlp"; host.id = "tlp"; host.innerHTML = HTML;
  c.stage.appendChild(host);
  const $ = (id: string) => host.querySelector("#" + id) as any;
  const el = new Audio();
  let run = 0, onNow = false, closeT: ReturnType<typeof setTimeout> | null = null;

  const tone = (f: number, t: number, d: number, v: number) => {
    const ctx = c.ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(v, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
    o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05);
  };
  const wait = (ms: number, r: number) => new Promise<boolean>((ok) => setTimeout(() => ok(r === run), ms));
  function say(k: ToiletKey) {
    const L = c.lang(), s = TOILET_VOICE[k];
    $("tlSub").innerHTML = [...s[L]].map((ch, i) => `<span style="animation-delay:${i * 22}ms">${esc(ch)}</span>`).join("");
    $("tlEn").textContent = L === "en" ? "" : s.en;
    return new Promise<void>((ok) => { el.src = toiletAudio(k); el.onended = () => ok(); el.onerror = () => ok(); playSafe(el, () => c.ac(), () => ok()); setTimeout(ok, 22000); });
  }
  function show(n: number) {
    host.querySelectorAll<HTMLElement>(".gdS").forEach((e) => e.classList.toggle("on", Number(e.dataset.s) === n));
    host.querySelectorAll<HTMLElement>("#tlDots i").forEach((e) => { const k = Number(e.dataset.n); e.className = k < n ? "done" : k === n ? "on" : ""; });
  }
  function texts() {
    const T = TOILET_T[c.lang()] ?? TOILET_T.en;
    host.querySelectorAll<HTMLElement>("[data-g]").forEach((e) => { e.textContent = T[e.dataset.g!] ?? ""; });
    $("tlTopT").textContent = T.top === "RESTROOM GUIDE" ? T.top : `${T.top} · RESTROOM GUIDE`;
    $("tlDots").innerHTML = [1, 2, 3].map((n) => `<i data-n="${n}"></i>`).join("");
  }
  const lit = (k: number) => host.querySelectorAll<HTMLElement>("#tlW li").forEach((e, i) => { e.className = i < k - 1 ? "done" : i === k - 1 ? "on" : ""; });
  async function a1(r: number) {
    ["tlRing", "tlRip", "tlTag", "tlFl"].forEach((id) => $(id).setAttribute("opacity", "0")); $("tlDim").setAttribute("opacity", ".45");
    if (!(await wait(900, r))) return; $("tlDim").setAttribute("opacity", ".15"); $("tlRing").setAttribute("opacity", "1"); $("tlTag").setAttribute("opacity", "1"); tone(1000, 0, 0.08, 0.04);
    if (!(await wait(1600, r))) return; $("tlRip").setAttribute("opacity", "1"); tone(900, 0, 0.08, 0.05); tone(1300, 0.08, 0.15, 0.04);
    if (!(await wait(900, r))) return; $("tlFl").setAttribute("opacity", "1"); for (let i = 0; i < 6; i++) tone(180 + i * 30, i * 0.18, 0.2, 0.025);
  }
  async function a2(r: number) {
    ["tlSeat", "tlJet", "tlSit"].forEach((id) => $(id).setAttribute("opacity", "0"));
    if (!(await wait(800, r))) return; $("tlSeat").setAttribute("opacity", "1");
    if (!(await wait(1400, r))) return; $("tlSit").setAttribute("opacity", "1"); tone(1000, 0, 0.1, 0.05);
    if (!(await wait(1600, r))) return; $("tlJet").setAttribute("opacity", "1"); tone(1400, 0, 0.08, 0.04);
  }
  async function a3(r: number) {
    $("tlNo").setAttribute("opacity", "0"); lit(0);
    if (!(await wait(2500, r))) return; $("tlNo").setAttribute("opacity", "1"); tone(620, 0, 0.12, 0.06); tone(460, 0.12, 0.16, 0.05);
    for (let k = 1; k <= 3; k++) { lit(k); tone(700 + k * 120, 0, 0.08, 0.04); if (!(await wait(2600, r))) return; }
  }
  async function start() {
    if (onNow) return; onNow = true; const r = ++run;
    c.duck(40); texts(); c.ac();
    host.classList.add("on"); c.stage.classList.add("gd-on"); if (closeT) clearTimeout(closeT);
    show(1); await say("intro"); if (r !== run) return;
    const steps: [number, ToiletKey, (r: number) => Promise<void>][] = [[1, "t1", a1], [2, "t2", a2], [3, "t3", a3]];
    for (const [n, k, a] of steps) {
      show(n); await Promise.all([say(k), a(r), wait(6500, r)]); if (r !== run) return;
      if (!(await wait(700, r))) return;
    }
    // 最後のひと言のあと、到着画面に戻る (写真は撮らなくてよい)
    await say("end"); if (r !== run) return;
    closeT = setTimeout(stop, 2500);
  }
  function stop() {
    run++; onNow = false; stopVoice(el); host.classList.remove("on"); c.stage.classList.remove("gd-on"); if (closeT) clearTimeout(closeT); closeT = null;
  }
  $("tlX").onclick = (e: Event) => { e.stopPropagation(); stop(); };
  host.onclick = (e) => e.stopPropagation();
  return { start: () => void start(), stop, on: () => onNow, unlock: () => unlockAudio(el, toiletAudio("intro")) };
}
