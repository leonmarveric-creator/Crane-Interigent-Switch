/**
 * 車内 iPad: 入り方ガイド (押したときだけ流れる。自動では流さない)。
 *   ① 外から開ける (暗証番号がテンキーに 1 文字ずつ光る) → ② 中から開ける (白いつまみが右に回る)
 *   → ③ 閉めると 15 秒で自動ロック → ④ お部屋はスマホで → 📸 まとめ (写真用 + スマホに保存の QR)
 *   ASTRAEA の声 (英語) + ゲストの言語の字幕。暗証番号は登録してあるエントランスの番号から。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import QRCode from "qrcode";
import { GUIDE_T, GUIDE_VOICE, guideAudio, type GuideKey } from "@/lib/cabinAiTalk";
import type { GLang } from "@/lib/cabinGeo";

export interface GuideCtx {
  root: HTMLElement; stage: HTMLElement;
  lang: () => GLang;
  code: () => string | null;        // エントランスの暗証番号 (無ければ null)
  keyUrl: () => string | null;       // 「スマホに保存」の QR (エントランスの鍵のページ)
  ac: () => AudioContext | null;
  duck: (sec: number) => void;       // お父さんのスマホの音楽を下げる
  busy: () => boolean;               // ASTRAEA が話している
}
export interface Guide { start(): void; stop(): void; on(): boolean }

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "🔒", "0", "🔓"];
const esc = (s: string) => s.replace(/[<&>"]/g, "");

const HTML = `<div class="gdTop"><b>CRANE NEST</b><small id="gdTopT">ENTRANCE GUIDE</small><div class="gdDots" id="gdDots"><i></i><i></i><i></i><i></i><i></i></div><button class="gdX" id="gdX">✕</button></div>
<div class="gdS" data-s="1"><div class="gdArt"><svg viewBox="0 0 600 520" id="gdKp"></svg></div><div class="gdTx"><div class="gdN">1</div><h2 data-g="t1"></h2><h4>UNLOCK FROM OUTSIDE</h4><div class="gdCode" id="gdCb"></div><p data-g="d1"></p></div></div>
<div class="gdS" data-s="2"><div class="gdArt"><svg viewBox="0 0 600 520"><defs><marker id="gdAh" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ff8a3c"/></marker></defs>
 <rect x="170" y="90" width="260" height="340" rx="40" fill="#141a26" stroke="#3a4a66" stroke-width="3"/><circle cx="300" cy="260" r="92" fill="#0b0f18" stroke="#2a3446" stroke-width="3"/>
 <g id="gdKnob" style="transform-origin:300px 260px;transition:transform 1.6s cubic-bezier(.4,1.6,.5,1)"><rect x="220" y="236" width="160" height="48" rx="24" fill="#f4f6fb"/></g>
 <path id="gdArc" d="M200 160 A140 140 0 0 1 420 170" fill="none" stroke="#ff8a3c" stroke-width="10" stroke-linecap="round" marker-end="url(#gdAh)" stroke-dasharray="320" stroke-dashoffset="320" style="transition:stroke-dashoffset 1.2s"/>
 <text x="300" y="480" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6" id="gdKs">BEFORE</text></svg></div>
 <div class="gdTx"><div class="gdN">2</div><h2 data-g="t2"></h2><h4>UNLOCK FROM INSIDE</h4><p data-g="d2"></p></div></div>
<div class="gdS" data-s="3"><div class="gdArt"><svg viewBox="0 0 600 520">
 <rect x="60" y="60" width="220" height="400" rx="10" fill="#1a2233" stroke="#3a4a66" stroke-width="3"/><rect id="gdDoor" x="60" y="60" width="220" height="400" rx="10" fill="#8a929f" stroke="#c9d2de" stroke-width="3" style="transform-origin:60px 260px;transition:transform 1.4s cubic-bezier(.3,1.2,.5,1)"/>
 <circle cx="430" cy="210" r="110" fill="none" stroke="rgba(95,227,255,.15)" stroke-width="16"/><circle id="gdRing" cx="430" cy="210" r="110" fill="none" stroke="#5fe3ff" stroke-width="16" stroke-linecap="round" stroke-dasharray="691" stroke-dashoffset="0" transform="rotate(-90 430 210)"/>
 <text id="gdCnt" x="430" y="232" text-anchor="middle" fill="#fff" font-size="72" font-weight="800" font-family="Menlo,monospace">15</text>
 <g transform="translate(430 400)"><rect x="-44" y="-10" width="88" height="70" rx="12" fill="#243049"/><path id="gdSh3" d="M-26 -10 V-34 A26 26 0 0 1 26 -34 V-10" fill="none" stroke="#9fb6d6" stroke-width="12"/><circle cy="24" r="8" fill="#0b0f18"/></g>
 <text id="gdLk" x="430" y="495" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6">WAITING</text></svg></div>
 <div class="gdTx"><div class="gdN">3</div><h2 data-g="t3"></h2><h4>AUTO-LOCK · 15 SEC</h4><p data-g="d3"></p></div></div>
<div class="gdS" data-s="4"><div class="gdArt"><svg viewBox="0 0 600 520">
 <rect x="90" y="40" width="230" height="440" rx="36" fill="#0b0f18" stroke="#c9d2de" stroke-width="5"/><rect x="108" y="80" width="194" height="370" rx="10" fill="#10203a"/>
 <text id="gdRn" x="205" y="140" text-anchor="middle" fill="#fff" font-size="26" font-weight="800">YOUR ROOM</text><text x="205" y="170" text-anchor="middle" fill="#8fb2d9" font-size="14" letter-spacing="3">CRANE NEST</text>
 <rect id="gdUb" x="130" y="300" width="150" height="64" rx="32" fill="#1c5fc4" stroke="#8ff0ff" stroke-width="3"/><text id="gdUbt" x="205" y="342" text-anchor="middle" fill="#fff" font-size="24" font-weight="800">🔓 UNLOCK</text>
 <circle id="gdTap" cx="240" cy="332" r="0" fill="rgba(255,255,255,.5)"/>
 <rect x="380" y="100" width="150" height="320" rx="8" fill="#1a2233" stroke="#3a4a66" stroke-width="3"/><rect id="gdRd" x="380" y="100" width="150" height="320" rx="8" fill="#b8844f" stroke="#e0b98a" stroke-width="3" style="transform-origin:380px 260px;transition:transform 1.4s cubic-bezier(.3,1.2,.5,1)"/>
 <text id="gdRdt" x="455" y="470" text-anchor="middle" fill="#8ff0ff" font-size="20" font-family="Menlo,monospace" letter-spacing="5">LOCKED</text></svg></div>
 <div class="gdTx"><div class="gdN">4</div><h2 data-g="t4"></h2><h4>YOUR ROOM · PHONE KEY</h4><p data-g="d4"></p><div class="gdHint" data-g="h4"></div></div></div>
<div class="gdS" data-s="5"><div class="gdSum" id="gdSum"></div><div class="gdSnap"><i></i><i></i><i></i><i></i></div><div class="gdSnapT" data-g="snap"></div></div>
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
    return new Promise<void>((ok) => { el.src = guideAudio(k); el.onended = () => ok(); el.onerror = () => ok(); el.play().catch(() => ok()); setTimeout(ok, 16000); });
  }
  function show(n: number) {
    host.querySelectorAll<HTMLElement>(".gdS").forEach((e) => e.classList.toggle("on", Number(e.dataset.s) === n));
    host.querySelectorAll<HTMLElement>("#gdDots i").forEach((e, i) => { e.className = i < n - 1 ? "done" : i === n - 1 ? "on" : ""; });
  }
  async function texts() {
    const T = GUIDE_T[c.lang()] ?? GUIDE_T.en;
    host.querySelectorAll<HTMLElement>("[data-g]").forEach((e) => { e.textContent = T[e.dataset.g!] ?? ""; });
    $("gdTopT").textContent = T.top === "ENTRANCE GUIDE" ? T.top : `${T.top} · ENTRANCE GUIDE`;
    const cd = code();
    const url = c.keyUrl();
    let qr = "";
    if (url) try { qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0a1426", light: "#ffffff" } }); } catch { /* QR なし */ }
    const dots = KEYS.map((_, i) => `<circle cx="${40 + (i % 3) * 10}" cy="${16 + Math.floor(i / 3) * 12}" r="3.6" fill="${i === 11 ? "#00c8ff" : "#2a3346"}"/>`).join("");
    $("gdSum").innerHTML = `
     <div class="gc"><div class="n">1</div><b>${esc(T.t1)}</b>${cd ? `<div class="cd">${cd}</div>` : ""}<svg viewBox="0 0 100 80"><rect x="30" y="2" width="40" height="76" rx="10" fill="#12161f" stroke="#2c3546"/>${dots}<circle cx="60" cy="52" r="7" fill="none" stroke="#00c8ff" stroke-width="1.5"/></svg><small>${esc(T.c1)}</small></div>
     <div class="gc"><div class="n">2</div><b>${esc(T.t2)}</b><svg viewBox="0 0 100 80"><circle cx="50" cy="40" r="30" fill="#0b0f18" stroke="#2a3446" stroke-width="2"/><rect x="44" y="14" width="12" height="52" rx="6" fill="#f4f6fb"/><path d="M22 20 A34 34 0 0 1 78 20" fill="none" stroke="#ff8a3c" stroke-width="4"/></svg><small>${esc(T.c2)}</small></div>
     <div class="gc"><div class="n">3</div><b>${esc(T.t3)}</b><svg viewBox="0 0 100 80"><circle cx="50" cy="40" r="30" fill="none" stroke="#5fe3ff" stroke-width="5"/><text x="50" y="48" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Menlo,monospace">15s</text></svg><small>${esc(T.c3)}</small></div>
     <div class="gc"><div class="n">4</div><b>${esc(T.t4)}</b><svg viewBox="0 0 100 80"><rect x="34" y="6" width="32" height="68" rx="6" fill="#0b0f18" stroke="#c9d2de" stroke-width="2"/><rect x="40" y="46" width="20" height="10" rx="5" fill="#1a9a5a"/></svg><small>${esc(T.c4)}</small></div>
     ${qr ? `<div class="gc q"><div class="qr">${qr}</div><b>📱 ${esc(T.qr)}</b></div>` : ""}`;
    // テンキー
    let h = `<rect x="300" y="30" width="250" height="460" rx="60" fill="#12161f" stroke="#2c3546" stroke-width="3"/><rect x="330" y="60" width="190" height="44" rx="10" fill="#050810" stroke="#223"/><text id="gdDisp" x="425" y="92" text-anchor="middle" fill="#5fe3ff" font-size="26" font-family="Menlo,monospace" letter-spacing="6"></text>`;
    KEYS.forEach((k, i) => { const x = 348 + (i % 3) * 58, y = 140 + Math.floor(i / 3) * 62; h += `<g id="gdK${i}"><circle cx="${x}" cy="${y}" r="24" fill="#1c2230"/><text x="${x}" y="${y + 9}" text-anchor="middle" fill="#e6eefc" font-size="${k.length > 1 ? 20 : 24}">${k}</text></g>`; });
    h += `<circle cx="425" cy="420" r="36" fill="#0b0f18" stroke="#2c3546" stroke-width="3"/><circle id="gdRing1" cx="464" cy="326" r="30" fill="none" stroke="#00c8ff" stroke-width="5" opacity="0"/>
     <g transform="translate(150 250)"><rect x="-60" y="-10" width="120" height="96" rx="16" fill="#243049"/><path id="gdSh1" d="M-34 -10 V-44 A34 34 0 0 1 34 -44 V-10" fill="none" stroke="#9fb6d6" stroke-width="15"/><circle cy="36" r="11" fill="#0b0f18"/></g>
     <text id="gdSt1" x="150" y="400" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6">LOCKED</text>`;
    $("gdKp").innerHTML = h;
    $("gdCb").innerHTML = [...cd].map((d) => `<span>${d}</span>`).join("");
  }

  async function a1(r: number) {
    const cd = code(); let typed = ""; if (!(await wait(1400, r))) return;
    for (let i = 0; i < cd.length; i++) {
      if (!(await wait(430, r))) return;
      const g = $("gdK" + KEYS.indexOf(cd[i]))?.firstChild; g?.setAttribute("fill", "#00a8e8"); setTimeout(() => g?.setAttribute("fill", "#1c2230"), 300);
      typed += cd[i]; $("gdDisp").textContent = typed; $("gdCb").children[i]?.classList.add("lit"); tone(1200 + i * 60, 0, 0.07, 0.04);
    }
    if (!(await wait(600, r))) return;
    $("gdK11").firstChild.setAttribute("fill", "#00c8ff"); $("gdRing1").setAttribute("opacity", "1"); tone(900, 0, 0.1, 0.05); tone(1400, 0.1, 0.2, 0.05);
    if (!(await wait(500, r))) return;
    $("gdSh1").setAttribute("transform", "translate(0 -22)"); $("gdSh1").setAttribute("stroke", "#46e08a"); $("gdSt1").textContent = "UNLOCKED"; $("gdSt1").setAttribute("fill", "#46e08a");
  }
  async function a2(r: number) {
    $("gdKnob").style.transform = "rotate(0deg)"; $("gdArc").style.strokeDashoffset = "320"; $("gdKs").textContent = "BEFORE"; $("gdKs").setAttribute("fill", "#8ff0ff");
    if (!(await wait(2200, r))) return; $("gdArc").style.strokeDashoffset = "0";
    if (!(await wait(500, r))) return; $("gdKnob").style.transform = "rotate(90deg)"; tone(500, 0.5, 0.12, 0.06);
    if (!(await wait(1400, r))) return; $("gdKs").textContent = "AFTER · UNLOCKED"; $("gdKs").setAttribute("fill", "#46e08a");
  }
  async function a3(r: number) {
    $("gdDoor").style.transform = "perspective(600px) rotateY(-70deg)"; $("gdRing").style.strokeDashoffset = "0"; $("gdCnt").textContent = "15";
    $("gdSh3").setAttribute("transform", "translate(0 -14)"); $("gdSh3").setAttribute("stroke", "#9fb6d6"); $("gdLk").textContent = "WAITING"; $("gdLk").setAttribute("fill", "#8ff0ff");
    if (!(await wait(1500, r))) return; $("gdDoor").style.transform = "perspective(600px) rotateY(0deg)"; tone(180, 0.9, 0.15, 0.08);
    if (!(await wait(1200, r))) return;
    for (let s = 15; s >= 0; s--) { $("gdCnt").textContent = String(s); $("gdRing").style.strokeDashoffset = String(691 * (1 - s / 15)); tone(s ? 1500 : 900, 0, 0.04, 0.03); if (!(await wait(300, r))) return; }
    $("gdSh3").setAttribute("transform", "translate(0 0)"); $("gdSh3").setAttribute("stroke", "#5fe3ff"); $("gdLk").textContent = "LOCKED ✓"; $("gdLk").setAttribute("fill", "#46e08a"); tone(700, 0, 0.1, 0.06); tone(1100, 0.1, 0.2, 0.05);
  }
  async function a4(r: number) {
    $("gdRd").style.transform = "none"; $("gdRdt").textContent = "LOCKED"; $("gdUbt").textContent = "🔓 UNLOCK"; $("gdUb").setAttribute("fill", "#1c5fc4"); $("gdTap").setAttribute("r", "0");
    if (!(await wait(2600, r))) return; $("gdTap").setAttribute("r", "26"); tone(1500, 0, 0.05, 0.04);
    if (!(await wait(250, r))) return; $("gdTap").setAttribute("r", "0"); $("gdUb").setAttribute("fill", "#1a9a5a"); $("gdUbt").textContent = "✓ UNLOCKED";
    if (!(await wait(600, r))) return; $("gdRd").style.transform = "perspective(600px) rotateY(-60deg)"; $("gdRdt").textContent = "OPEN"; tone(900, 0, 0.1, 0.05); tone(1320, 0.1, 0.25, 0.05);
  }

  async function start() {
    if (onNow) return; onNow = true; const r = ++run;
    c.duck(45); await texts(); c.ac();
    host.classList.add("on"); c.stage.classList.add("gd-on"); if (closeT) clearTimeout(closeT);
    show(code() ? 1 : 2);
    await say("intro"); if (r !== run) return;
    const steps: [number, GuideKey, (r: number) => Promise<void>][] = [[1, "s1", a1], [2, "s2", a2], [3, "s3", a3], [4, "s4", a4]];
    for (const [n, k, a] of steps) {
      if (n === 1 && !code()) continue; // 暗証番号が登録されていなければ ① は飛ばす
      show(n); await Promise.all([say(k), a(r), wait(7500, r)]); if (r !== run) return;
      if (!(await wait(800, r))) return;
    }
    show(5); const f = $("gdFlash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); tone(2000, 0, 0.05, 0.05);
    await say("photo");
    closeT = setTimeout(stop, 120000); // 写真の画面は 2 分で閉じる
  }
  function stop() {
    run++; onNow = false; el.pause(); host.classList.remove("on"); c.stage.classList.remove("gd-on"); if (closeT) clearTimeout(closeT); closeT = null;
  }
  $("gdX").onclick = (e: Event) => { e.stopPropagation(); stop(); };
  host.onclick = (e) => e.stopPropagation();
  return { start: () => void start(), stop, on: () => onNow };
}
