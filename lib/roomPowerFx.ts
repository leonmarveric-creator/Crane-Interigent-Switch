/**
 * 部屋の「自動 ON / 自動 OFF」の演出 (画面いっぱいのホログラム風。3〜4 秒で自分で消える。指で触れなくてよい)
 *   ON  : 青い輪が描かれて、部屋の名前 → 「SYSTEMS ONLINE」→ 機器 (エアコン・照明…) が順番に点く
 *   OFF : 琥珀色の輪 → 機器が順番に消える → 「ALL SYSTEMS OFF」→ 輪がしぼんで消える
 *   音はその場で作る効果音 (オリジナル)。voice を渡すと ASTRAEA の声も (管理画面の LIVE)
 *   React でも、車内画面 (ふつうの DOM) でも使えるように、ただの関数
 */
export type FxLang = "ja" | "en" | "zh" | "ko";
export interface RoomFx { kind: "on" | "off"; room: string; lang?: FxLang; parts?: string[]; voice?: string | null; sound?: boolean; note?: string }

const TX: Record<FxLang, { on: string; off: string; onS: string; offS: string }> = {
  ja: { on: "SYSTEMS ONLINE", off: "ALL SYSTEMS OFF", onS: "お部屋の準備を始めました", offS: "お部屋をすべてオフにしました" },
  en: { on: "SYSTEMS ONLINE", off: "ALL SYSTEMS OFF", onS: "Room is getting ready", offS: "Room powered down" },
  zh: { on: "SYSTEMS ONLINE", off: "ALL SYSTEMS OFF", onS: "房间已开始准备", offS: "房间已全部关闭" },
  ko: { on: "SYSTEMS ONLINE", off: "ALL SYSTEMS OFF", onS: "객실 준비를 시작했어요", offS: "객실을 모두 껐어요" },
};
const CSS = `
.rfx{position:fixed;inset:0;z-index:2147483600;pointer-events:none;display:flex;align-items:center;justify-content:center;font-family:-apple-system,"Hiragino Sans","PingFang SC",sans-serif;opacity:0;transition:opacity .35s}
.rfx.in{opacity:1}.rfx.out{opacity:0;transition:opacity .6s}
.rfx .bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,rgba(4,18,34,.72),rgba(1,4,10,.9) 70%)}
.rfx .scan{position:absolute;left:0;right:0;height:30%;top:-30%;background:linear-gradient(180deg,transparent,var(--c2),transparent);opacity:.18;animation:rfxScan 1.6s ease-in-out .2s 2}
@keyframes rfxScan{to{top:100%}}
.rfx .box{position:relative;width:min(78vw,340px);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.rfx svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rfx .r1{fill:none;stroke:var(--c);stroke-width:2.2;stroke-dasharray:629;stroke-dashoffset:629;filter:drop-shadow(0 0 8px var(--c));animation:rfxDraw 1.1s cubic-bezier(.6,.1,.2,1) .15s forwards}
.rfx .r2{fill:none;stroke:var(--c);stroke-width:1;stroke-dasharray:3 9;opacity:.55;transform-origin:50% 50%;animation:rfxSpin 6s linear infinite}
.rfx .r3{fill:none;stroke:var(--c);stroke-width:6;stroke-dasharray:40 400;opacity:.8;transform-origin:50% 50%;animation:rfxSpin 1.8s linear infinite reverse;filter:drop-shadow(0 0 6px var(--c))}
@keyframes rfxDraw{to{stroke-dashoffset:0}}@keyframes rfxSpin{to{transform:rotate(360deg)}}
.rfx.off.end .box{transform:scale(.2);opacity:0;transition:transform .7s cubic-bezier(.6,0,.9,.4),opacity .7s}
.rfx .ct{position:relative;text-align:center;color:#eaf8ff}
.rfx .nm{font-size:clamp(40px,14vw,64px);font-weight:700;line-height:1;letter-spacing:.06em;text-shadow:0 0 22px var(--c),0 0 50px var(--c2);opacity:0;transform:scale(1.15);animation:rfxPop .6s cubic-bezier(.2,.9,.3,1.3) .55s forwards}
@keyframes rfxPop{to{opacity:1;transform:none}}
.rfx .st{margin-top:12px;font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.32em;color:var(--c);min-height:12px;text-shadow:0 0 10px var(--c)}
.rfx .sb{margin-top:8px;font-size:12px;color:rgba(234,248,255,.75);opacity:0;animation:rfxPop .5s ease 1.6s forwards}
.rfx .pt{position:absolute;left:50%;bottom:calc(50% - min(39vw,170px) - 58px);transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;width:min(92vw,420px)}
.rfx .pt span{font:700 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;padding:6px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.35);background:rgba(255,255,255,.04);transition:all .25s}
.rfx .pt span.lit{color:#03141c;background:var(--c);border-color:var(--c);box-shadow:0 0 14px var(--c)}
.rfx .pt span.dim{color:rgba(255,255,255,.28);background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.12);box-shadow:none}
.rfx .nt{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 28px);text-align:center;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.2em;color:rgba(234,248,255,.55)}
`;
const PART: Record<string, string> = { ac: "AIR", ceil: "LIGHT", wa: "WA-LIGHT", galaxy: "GALAXY", nest: "NEST" };

let AC: AudioContext | null = null;
function ac(): AudioContext | null { try { AC ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (AC.state === "suspended") void AC.resume(); return AC.state === "running" ? AC : AC; } catch { return null; } }
function tone(a: AudioContext, f0: number, f1: number, at: number, dur: number, v: number, type: OscillatorType = "sine") {
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.04, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
/** 効果音 (オリジナル): ON = 上がっていく起動音 + ピッ ピッ + 和音 / OFF = 下がっていく音 + 消える音 */
function sfx(kind: "on" | "off", n: number) {
  const a = ac(); if (!a) return;
  if (kind === "on") {
    tone(a, 180, 1400, 0, 0.9, 0.12, "sawtooth"); tone(a, 90, 700, 0, 0.9, 0.08);
    for (let i = 0; i < n; i++) tone(a, 1320 + i * 110, 1320 + i * 110, 1.2 + i * 0.28, 0.12, 0.08, "square");
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, f, f, 1.25 + n * 0.28 + i * 0.05, 1.4, 0.06));
  } else {
    for (let i = 0; i < n; i++) tone(a, 1100 - i * 120, 1100 - i * 120, 0.9 + i * 0.28, 0.1, 0.07, "square");
    tone(a, 900, 70, 1.0 + n * 0.28, 1.1, 0.12, "sawtooth"); tone(a, 140, 40, 1.15 + n * 0.28, 0.6, 0.18);
  }
}

let busy: Promise<void> = Promise.resolve();
/** 演出を出す (続けて呼ばれたら順番に) */
export function roomPowerFx(o: RoomFx): Promise<void> {
  busy = busy.then(() => run(o)).catch((e) => { console.error("roomPowerFx", e); });
  return busy;
}
async function run(o: RoomFx): Promise<void> {
  if (typeof document === "undefined") return;
  if (!document.getElementById("rfx-css")) { const s = document.createElement("style"); s.id = "rfx-css"; s.textContent = CSS; document.head.appendChild(s); }
  const L = TX[o.lang ?? "ja"] ?? TX.ja, on = o.kind === "on";
  const parts = (o.parts?.length ? o.parts : on ? ["ac"] : ["ac", "ceil", "wa"]).map((p) => PART[p] ?? p.toUpperCase());
  const el = document.createElement("div");
  el.className = `rfx ${on ? "on" : "off"}`;
  el.style.setProperty("--c", on ? "#5fe3ff" : "#ffb347"); el.style.setProperty("--c2", on ? "rgba(72,200,255,.55)" : "rgba(255,150,60,.5)");
  const esc = (s: string) => s.replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" }[c]!));
  el.innerHTML = `<div class="bg"></div><div class="scan"></div><div class="box"><svg viewBox="0 0 220 220"><circle class="r2" cx="110" cy="110" r="108"/><circle class="r1" cx="110" cy="110" r="100"/><circle class="r3" cx="110" cy="110" r="88"/></svg>
    <div class="ct"><div class="nm">${esc(o.room)}</div><div class="st"></div><div class="sb">${on ? L.onS : L.offS}</div></div></div>
    <div class="pt">${parts.map((p) => `<span class="${on ? "" : "lit"}">${esc(p)}</span>`).join("")}</div>${o.note ? `<div class="nt">${esc(o.note)}</div>` : ""}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  if (o.sound !== false) sfx(o.kind, parts.length);
  // 声 (管理画面の LIVE だけ): 終わるまで次の演出を始めない (続けて来ても声が重ならない)
  let voiceEnd: Promise<void> = Promise.resolve();
  if (o.voice) {
    try {
      const v = new Audio(o.voice); v.volume = 0.9;
      voiceEnd = new Promise<void>((res) => { v.onended = () => res(); v.onerror = () => res(); setTimeout(res, 9000); setTimeout(() => { void v.play().catch(() => res()); }, on ? 1400 : 1200); });
    } catch { /* 音が出せない */ }
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // 「SYSTEMS ONLINE」を 1 文字ずつ
  const st = el.querySelector(".st") as HTMLElement, word = on ? L.on : L.off;
  await wait(on ? 900 : 700);
  const spans = Array.from(el.querySelectorAll(".pt span"));
  if (!on) for (const s of spans) { await wait(280); s.className = "dim"; }
  for (let i = 1; i <= word.length; i++) { st.textContent = word.slice(0, i) + (i < word.length ? "▌" : ""); await wait(28); }
  if (on) for (const s of spans) { await wait(280); s.className = "lit"; }
  await wait(on ? 1500 : 1100);
  if (!on) { el.classList.add("end"); await wait(650); }
  el.classList.add("out"); await wait(650); el.remove();
  await voiceEnd;
}
