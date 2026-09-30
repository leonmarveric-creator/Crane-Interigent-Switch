/**
 * 車内 iPad: お部屋の鍵 (内側のつまみ) の使い方 — 春・秋・冬のお部屋。到着画面のボタンを押したときだけ流れる。
 *   ⓪ 外から開ける (テンキー: 暗証番号 → 右下の解錠キー。夏と同じ絵。自動では鍵がかからない)
 *   ① 鍵をかける (実物の写真 3 枚: 横 → 右へ回す → 縦) → ② 鍵を開ける (縦 → 左へ回す → 横)
 *   → ③ まとめ (回す向きが動いて見える・縦 🔒 / 横 🔓・エントランスは逆) → しばらく見せて到着画面に戻る
 *   見た目は入り方ガイドと同じ部品 (.gdp)。ASTRAEA の声 (英語) + ゲストの言語の字幕。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LOCK_IMG, LOCK_T, LOCK_VOICE, lockAudio, type LockKey } from "@/lib/cabinLock";
import type { GLang } from "@/lib/cabinGeo";
import { playSafe, unlockAudio, stopVoice } from "@/lib/cabinAudio";

export interface LockCtx {
  stage: HTMLElement;
  lang: () => GLang;
  ac: () => AudioContext | null;
  duck: (sec: number) => void; // お父さんのスマホの音楽を下げる
  room: () => { code: string | null; name: string }; // お部屋の暗証番号と名前 (春 · HARU など)
}
export interface LockGuide { start(): void; stop(): void; on(): boolean; unlock(): void }

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "🔒", "0", "🔓"];
/** テンキーの絵 (夏のガイドと同じ形) */
function keypad(full = true) {
  let h = !full ? "" : `<defs><linearGradient id="lkW" x1="0" x2="1"><stop offset="0" stop-color="#6b3b17"/><stop offset=".5" stop-color="#9a5e2c"/><stop offset="1" stop-color="#5a3013"/></linearGradient></defs><rect width="600" height="520" fill="url(#lkW)" opacity=".35"/>`;
  h += `<rect x="300" y="30" width="250" height="460" rx="60" fill="#12161f" stroke="#2c3546" stroke-width="3"/><rect x="330" y="60" width="190" height="44" rx="10" fill="#050810" stroke="#223"/><text id="lkDisp" x="425" y="92" text-anchor="middle" fill="#ffc27a" font-size="26" font-family="Menlo,monospace" letter-spacing="6"></text>`;
  KEYS.forEach((k, i) => { const x = 348 + (i % 3) * 58, y = 140 + Math.floor(i / 3) * 62; h += `<g id="lkK${i}"><circle cx="${x}" cy="${y}" r="24" fill="#1c2230"/><text x="${x}" y="${y + 9}" text-anchor="middle" fill="#e6eefc" font-size="${k.length > 1 ? 20 : 24}">${k}</text></g>`; });
  h += `<circle cx="425" cy="420" r="36" fill="#0b0f18" stroke="#2c3546" stroke-width="3"/><circle id="lkRing" cx="464" cy="326" r="30" fill="none" stroke="#00c8ff" stroke-width="5" opacity="${full ? 0 : 1}"/>`;
  if (!full) return h; // まとめ: テンキーだけ (右下の解錠キーに印)
  h += `<g transform="translate(150 250)"><rect x="-60" y="-10" width="120" height="96" rx="16" fill="#243049"/><path id="lkSh" d="M-34 -10 V-44 A34 34 0 0 1 34 -44 V-10" fill="none" stroke="#9fb6d6" stroke-width="15"/><circle cy="36" r="11" fill="#0b0f18"/></g>
   <text id="lkSt" x="150" y="400" text-anchor="middle" fill="#8ff0ff" font-size="22" font-family="Menlo,monospace" letter-spacing="6">LOCKED</text>`;
  return h;
}
const esc = (s: string) => s.replace(/[<&>"]/g, "");
/** つまみの絵 (上から見た丸い台 + 棒)。cls で回し方のアニメーション */
const dial = (cls: string, col: string) => `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" fill="#0d1118" stroke="${col}" stroke-width="3" opacity=".95"/><circle cx="100" cy="100" r="62" fill="#161b24"/>
 <g class="${cls}"><rect x="42" y="88" width="116" height="24" rx="12" fill="#2a303b" stroke="#6b7486" stroke-width="2"/></g></svg>`;
const arc = (cw: boolean, col: string) => cw
  ? `<svg class="lkArc" viewBox="-10 -10 220 220"><path d="M17 52 A96 96 0 0 1 173 38" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"/><path d="M186 54 L181 29 L162 45 Z" fill="${col}"/></svg>`
  : `<svg class="lkArc" viewBox="-10 -10 220 220"><path d="M183 52 A96 96 0 0 0 27 38" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"/><path d="M14 54 L19 29 L38 45 Z" fill="${col}"/></svg>`;
const shots = (p: "l" | "u") => `<div class="lkMain">${[1, 2, 3].map((i) => `<img id="lk${p}${i}" src="${LOCK_IMG[`${p}${i}` as keyof typeof LOCK_IMG]}" alt="">`).join("")}<div class="lkBadge" id="lk${p}B"></div></div>
 <div class="lkStrip">${[1, 2, 3].map((i) => `<div class="lkTh" id="lk${p}T${i}"><img src="${LOCK_IMG[`${p}${i}` as keyof typeof LOCK_IMG]}" alt=""><small data-k="s${p === "l" ? i : 4 - i}"></small></div>${i < 3 ? `<i class="lkAr ${p}">➜</i>` : ""}`).join("")}</div>`;

const HTML = `<div class="gdTop"><b>CRANE NEST</b><small id="lkTopT">ROOM LOCK</small><div class="gdDots" id="lkDots"></div><button class="gdX" id="lkX">✕</button></div>
<div class="gdS rm lkO" data-s="0"><div class="gdRt" id="lkRn"></div><div class="gdArt"><svg viewBox="0 0 600 520" id="lkKp"></svg></div>
 <div class="gdTx"><div class="gdN">🔑</div><h2 data-k="t0"></h2><h4>FROM OUTSIDE · CODE → UNLOCK KEY</h4><div class="gdCode" id="lkCb"></div><p data-k="d0"></p><div class="lkNo" id="lkNo" data-k="noauto"></div></div></div>
<div class="gdS lkS lkL" data-s="1"><div class="gdArt lkArt">${shots("l")}</div>
 <div class="gdTx"><div class="gdN">🔒</div><h2 data-k="t1"></h2><h4>LOCK · TURN RIGHT → VERTICAL</h4><p data-k="d1"></p><div class="lkFirst" id="lkFirst">🚪 <span data-k="first"></span></div></div></div>
<div class="gdS lkS lkU" data-s="2"><div class="gdArt lkArt">${shots("u")}</div>
 <div class="gdTx"><div class="gdN">🔓</div><h2 data-k="t2"></h2><h4>UNLOCK · TURN LEFT → HORIZONTAL</h4><p data-k="d2"></p></div></div>
<div class="gdS" data-s="3"><div class="gdSum lkSum">
 <div class="gc lkc lkcO"><div class="lkKpS"><svg viewBox="295 25 260 470" id="lkKp2"></svg></div><b>🔑 <span data-k="t0"></span></b><div class="cd" id="lkCd2"></div><small data-k="c0"></small><small class="lkNoS" data-k="noauto"></small></div>
 <div class="gc lkc lkcL"><div class="lkD">${dial("lkRotCW", "#ff7a3c")}${arc(true, "#ff7a3c")}</div><b>🔒 <span data-k="t1"></span></b><em data-k="right"></em><small data-k="c1"></small></div>
 <div class="gc lkc lkcU"><div class="lkD">${dial("lkRotCCW", "#3ee08f")}${arc(false, "#3ee08f")}</div><b>🔓 <span data-k="t2"></span></b><em data-k="left"></em><small data-k="c2"></small></div>
 <div class="gc lkc lkcC"><div class="lkPair"><div>${dial("lkV", "#ff5a5a")}<span class="r" data-k="lock"></span></div><div>${dial("", "#3ee08f")}<span class="g" data-k="open"></span></div></div><small data-k="c3"></small><small class="lkEnt" data-k="ent"></small></div>
</div></div>
<div class="gdAi"><i class="gdOrb"></i><div><div class="gdNm">ASTRAEA · ROOM LOCK</div><div class="gdSub" id="lkSub"></div><div class="gdEn" id="lkEn"></div></div></div>`;

export function createLock(c: LockCtx): LockGuide {
  const host = document.createElement("div"); host.className = "gdp lkp"; host.id = "lkp"; host.innerHTML = HTML;
  c.stage.appendChild(host);
  const $ = (id: string) => host.querySelector("#" + id) as any;
  const el = new Audio();
  let run = 0, onNow = false, closeT: ReturnType<typeof setTimeout> | null = null;

  const tone = (f: number, t: number, d: number, v: number) => {
    const ctx = c.ac(); if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(v, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
    o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05);
  };
  const click = () => { tone(2200, 0, 0.03, 0.06); tone(900, 0.03, 0.06, 0.05); };
  const wait = (ms: number, r: number) => new Promise<boolean>((ok) => setTimeout(() => ok(r === run), ms));
  function say(k: LockKey) {
    const L = c.lang(), s = LOCK_VOICE[k];
    $("lkSub").innerHTML = [...s[L]].map((ch, i) => `<span style="animation-delay:${i * 22}ms">${esc(ch)}</span>`).join("");
    $("lkEn").textContent = L === "en" ? "" : s.en;
    return new Promise<void>((ok) => { el.src = lockAudio(k); el.onended = () => ok(); el.onerror = () => ok(); playSafe(el, () => c.ac(), () => ok()); setTimeout(ok, 22000); });
  }
  function show(n: number) {
    host.querySelectorAll<HTMLElement>(".gdS").forEach((e) => e.classList.toggle("on", Number(e.dataset.s) === n));
    host.querySelectorAll<HTMLElement>("#lkDots i").forEach((e) => { const k = Number(e.dataset.n); e.className = k < n ? "done" : k === n ? "on" : ""; });
  }
  function texts() {
    const T = LOCK_T[c.lang()] ?? LOCK_T.en;
    host.querySelectorAll<HTMLElement>("[data-k]").forEach((e) => { e.textContent = T[e.dataset.k!] ?? ""; });
    $("lkTopT").textContent = T.top === "ROOM LOCK" ? T.top : `${T.top} · ROOM LOCK`;
    $("lkDots").innerHTML = [0, 1, 2, 3].map((n) => `<i data-n="${n}"></i>`).join("");
    const rm = c.room(), cd = (rm.code || "").replace(/\D/g, "");
    $("lkRn").textContent = rm.name ? `🚪 ${rm.name}` : ""; $("lkRn").style.display = rm.name ? "" : "none";
    $("lkKp").innerHTML = keypad(); $("lkCb").innerHTML = [...cd].map((d) => `<span>${d}</span>`).join("");
    $("lkKp2").innerHTML = keypad(false).replace(/id="lk/g, 'id="lk2'); $("lkCd2").textContent = cd;
  }
  /** 写真を 1 → 2 → 3 と進める (下の小さい写真も光る) */
  function frame(p: "l" | "u", i: number) {
    const T = LOCK_T[c.lang()] ?? LOCK_T.en;
    for (let k = 1; k <= 3; k++) { $(`lk${p}${k}`).classList.toggle("on", k === i); $(`lk${p}T${k}`).className = "lkTh" + (k < i ? " done" : k === i ? " on" : ""); }
    const st = p === "l" ? i : 4 - i; // 1 = 解錠中 / 2 = 回す / 3 = 施錠
    const b = $(`lk${p}B`); b.className = "lkBadge on s" + st; b.textContent = (st === 1 ? "🔓 " : st === 2 ? (p === "l" ? "↻ " : "↺ ") : "🔒 ") + T[`s${st}`];
  }
  async function anim(p: "l" | "u", r: number) {
    frame(p, 1); if (p === "l") $("lkFirst").classList.remove("on");
    if (p === "l") { if (!(await wait(1300, r))) return; $("lkFirst").classList.add("on"); tone(700, 0, 0.1, 0.04); }
    if (!(await wait(p === "l" ? 1900 : 1600, r))) return; frame(p, 2); tone(520, 0, 0.35, 0.03);
    if (!(await wait(2300, r))) return; frame(p, 3); click();
  }
  /** 外から: 番号を 1 つずつ押す → 右下の解錠キー → 鍵が開く */
  async function typeIn(r: number) {
    const cd = (c.room().code || "").replace(/\D/g, ""); let typed = ""; $("lkNo").classList.remove("on");
    if (!(await wait(1400, r))) return;
    for (let i = 0; i < cd.length; i++) {
      if (!(await wait(430, r))) return;
      const g = $(`lkK${KEYS.indexOf(cd[i])}`)?.firstChild; g?.setAttribute("fill", "#00a8e8"); setTimeout(() => g?.setAttribute("fill", "#1c2230"), 300);
      typed += cd[i]; $("lkDisp").textContent = typed; $("lkCb").children[i]?.classList.add("lit"); tone(1200 + i * 60, 0, 0.07, 0.04);
    }
    if (!(await wait(600, r))) return;
    $("lkK11").firstChild.setAttribute("fill", "#00c8ff"); $("lkRing").setAttribute("opacity", "1"); tone(900, 0, 0.1, 0.05); tone(1400, 0.1, 0.2, 0.05);
    if (!(await wait(500, r))) return;
    $("lkSh").setAttribute("transform", "translate(0 -22)"); $("lkSh").setAttribute("stroke", "#46e08a"); $("lkSt").textContent = "UNLOCKED"; $("lkSt").setAttribute("fill", "#46e08a");
    if (!(await wait(1800, r))) return; $("lkNo").classList.add("on"); tone(620, 0, 0.12, 0.05); tone(460, 0.12, 0.16, 0.04);
  }
  async function start() {
    if (onNow) return; onNow = true; const r = ++run;
    c.duck(40); texts(); c.ac();
    host.classList.add("on"); c.stage.classList.add("gd-on"); if (closeT) clearTimeout(closeT);
    show(0); await say("intro"); if (r !== run) return;
    show(0); await Promise.all([say("k0"), typeIn(r), wait(7000, r)]); if (r !== run) return;
    if (!(await wait(700, r))) return;
    frame("l", 1);
    show(1); await Promise.all([say("k1"), anim("l", r), wait(6500, r)]); if (r !== run) return;
    if (!(await wait(700, r))) return;
    show(2); await Promise.all([say("k2"), anim("u", r), wait(6000, r)]); if (r !== run) return;
    if (!(await wait(700, r))) return;
    show(3); tone(880, 0, 0.1, 0.05); tone(1320, 0.1, 0.2, 0.04); await say("sum"); if (r !== run) return;
    // まとめはしばらく出しておく (読む・見る時間)。✕ でいつでも閉じられる
    closeT = setTimeout(stop, 14000);
  }
  function stop() {
    run++; onNow = false; stopVoice(el); host.classList.remove("on"); c.stage.classList.remove("gd-on"); if (closeT) clearTimeout(closeT); closeT = null;
  }
  $("lkX").onclick = (e: Event) => { e.stopPropagation(); stop(); };
  host.onclick = (e) => e.stopPropagation();
  return { start: () => void start(), stop, on: () => onNow, unlock: () => unlockAudio(el, lockAudio("intro")) };
}
