/**
 * 車内 iPad の AI「ASTRAEA（アストレア）」: 状況に合わせて自分から、ユーモアのあるひと言を話す。
 *   きっかけ: 出発 / 半分 / 残り 5 km・1 km / 到着 / 信号で止まった・走り出した / 遅れ・早い / ルート外れ /
 *            海・泉佐野・橋の手前 / 夕日 / 朝・夜 / 天気 / ぞろ目の時刻 / 週末 / 曲が変わった / 電波が切れた / 静かな時間の豆知識
 *   決まり: 3 分に 1 回まで (出発・到着・橋などは別) / 道案内の声・高速モードと重ねない / 静かモードでは話さない
 *   話す前にお父さんのスマホの音楽を下げる (music_cmd "duck")。ゲストが光の玉を押すと、おまけのひと言。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AI_CHAT_MS, AI_FACT_MS, AI_GAP_MS, AI_LINES, AI_PRIORITY, AI_SPEED, aiAudio, aiPick, sunsetMin, zorome, type AiId } from "@/lib/cabinAiLines";
import { CAPTAIN, GUEST_Q, REPEAT, UNKNOWN, captainAudio, guestAudio, talkAudioUrls, weatherAnswer } from "@/lib/cabinAiTalk";

const GUIDE_Q: Record<GLang, string> = { ja: "入り方を教えて", zh: "怎么进门？", en: "How do I get in?", ko: "들어가는 방법" };
import type { GLang, LL } from "@/lib/cabinGeo";
import { playSafe, unlockAudio } from "@/lib/cabinAudio";

export interface AiState {
  tripId: string | null; dir: "in" | "out"; placeKey: string; lang: GLang;
  started: number;                 // 送迎が始まった時刻 (ms)
  paceStart: number;               // 予定の所要時間の起点 (道を引き直したらその時刻)
  total: number; d: number;        // ルートの長さ・進んだ距離 (m)
  toDest: number;                  // 目的地までの直線距離 (m)
  baseMin: number;                 // 予定の所要時間 (分)
  kmh: number | null; ll: LL | null;
  arrived: boolean; offroute: boolean;
  boosting: boolean;               // 高速モードの演出中
  crossesBridge: boolean; hasIzumiPoi: boolean;
  weather: { temp: number; code: number; days?: { code: number; max: number }[] } | null;
}
export interface AiCtx {
  root: HTMLElement; stage: HTMLElement;
  state: () => AiState;
  voiceBusy: () => boolean;        // 道案内などの声が出ているか
  ac: () => AudioContext | null;
  duck: (sec: number) => void;     // お父さんのスマホの音楽を下げる
  quiet: () => boolean;
  remote: () => boolean;           // 声はスマホから流す (iPad は音を消して長さだけ合わせる)
  send: (url: string, text: string) => void; // スマホへ声を送る
  hasCheckin: () => boolean;       // チェックイン QR が登録されているか
  checkin: () => void;             // チェックイン QR を出す
  guide: () => void;               // 入り方ガイドを流す
  roomLights: () => void;          // お部屋の照明をつける (ゲストの質問から)
  roomLit: () => void;             // 部屋の写真に灯り (見た目だけ)
}
export interface Ai { tick(): void; event(e: "arrive" | "song" | "boostEnd"): void; reset(): void; preload(): void; urls(): string[]; command(cmd: { c: string; n: number } | null): void; busy(): boolean; closeMenu(): void; unlock(): void }

const rainy = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const JST = (ms: number) => new Date(ms + 9 * 3600e3);

export function createAi(c: AiCtx): Ai {
  const $ = (id: string) => c.root.querySelector("#" + id) as HTMLElement;
  const el = new Audio(); let src: MediaElementAudioSourceNode | null = null, an: AnalyserNode | null = null;
  const blobs: Record<string, string> = {};
  let subTok = 0;
  let speaking = false, lastAt = 0, lastAny = 0, last: Partial<Record<AiId, number>> = {}, done = new Set<string>();
  let stopT = 0, stopSaid = false, shopSaid = false, offT = 0, lastBt: number | null = null;
  let spdLv = 0, spdN = 0, spdAt = 0, chatUsed = new Set<number>(), chatAt = 0, boostEndAt = 0;

  function reset() { lastCmd = null; closeMenu(); done = new Set(); lastAt = 0; lastAny = 0; stopT = 0; stopSaid = false; shopSaid = false; offT = 0; lastBt = null; spdLv = 0; spdN = 0; spdAt = 0; chatUsed = new Set(); chatAt = 0; boostEndAt = 0; }

  /* ---------- 話す ---------- */
  async function say(id: AiId, opt: { force?: boolean; duck?: boolean; i?: number } = {}) {
    if (speaking) return false;
    const s = c.state(); const now = Date.now();
    const prio = AI_PRIORITY.includes(id), spd = AI_SPEED.includes(id);
    if (!opt.force) {
      if (c.quiet() && id !== "tap" && id !== "tapmany") return false;
      if (c.voiceBusy() || (s.boosting && id !== "bridge" && !spd)) return false;
      if (!prio && !spd && now - lastAt < AI_GAP_MS) return false;
    }
    const i = opt.i ?? aiPick(id, last[id]); last[id] = i;
    if (!prio || id === "depart") lastAt = now;
    return speak(aiAudio(id, i), AI_LINES[id].v[i] as Record<GLang, string>, { duck: opt.duck });
  }
  /** 1 つのセリフを話す (声 + 字幕)。st = パネルの右上の小さな文字 */
  async function speak(url: string, line: Record<GLang, string>, opt: { duck?: boolean; st?: string } = {}) {
    if (speaking) return false;
    speaking = true; lastAny = Date.now();
    // お父さんのスマホの音楽を先に下げる (届くまで 3 秒ほど)
    const rm = c.remote();
    if (rm) { c.send(url, line.en); await new Promise((r) => setTimeout(r, 1100)); } // スマホが鳴らす (音楽もスマホで小さくする)
    else if (opt.duck !== false) { c.duck(12); await new Promise((r) => setTimeout(r, 2600)); }
    const lang = c.state().lang;
    $("aiSub").innerHTML = [...line[lang]].map((ch, k) => `<span style="animation-delay:${k * 26}ms">${ch.replace(/[<&>]/g, "")}</span>`).join("");
    $("aiEn").textContent = lang === "en" ? "" : line.en;
    c.stage.classList.add("ai-talk"); $("aiSt").textContent = opt.st ?? "SPEAKING";
    try {
      const ctx = c.ac(); if (ctx && !src) { src = ctx.createMediaElementSource(el); an = ctx.createAnalyser(); an.fftSize = 128; src.connect(an); }
      // スマホから流すときは iPad からは鳴らさない (波形の動きだけ使う)
      if (an && ctx) { try { an.disconnect(); } catch { /* */ } if (!rm) an.connect(ctx.destination); }
    } catch { /* 分析なしで鳴らす */ }
    await new Promise<void>((ok) => {
      const end = () => { el.onended = el.onerror = null; ok(); };
      el.onended = end; el.onerror = end; el.muted = rm && !an; el.src = blobs[url] || url; playSafe(el, () => c.ac(), end); setTimeout(end, 20000);
    });
    // 字幕は話し終わってもしばらく残す (読むのがゆっくりな人のために・長い文ほど長く)
    const my = ++subTok, hold = Math.min(9000, 3500 + [...line[lang]].length * (lang === "en" ? 25 : 60));
    $("aiSt").textContent = "ONLINE";
    setTimeout(() => { if (subTok === my) c.stage.classList.remove("ai-talk"); }, hold);
    speaking = false; return true;
  }
  const once = (key: string, id: AiId, opt?: { force?: boolean; duck?: boolean }) => { if (done.has(key)) return; void say(id, opt).then((ok) => { if (ok) done.add(key); }); };

  /* ---------- 毎秒: 今の状況を見て、話すことがあれば ---------- */
  function tick() {
    const s = c.state(); if (!s.tripId || speaking) return;
    const now = Date.now(), el2 = (now - s.started) / 1000, rem = Math.max(0, s.total - s.d), u = s.total ? s.d / s.total : 0;
    const t = JST(now), hh = t.getUTCHours(), mm = t.getUTCMinutes(), minNow = hh * 60 + mm + t.getUTCSeconds() / 60;
    if (s.arrived) return;
    // 出発
    // お見送りは出発直後に忘れ物チェック (まだ引き返せるうちに)、口コミのお願いはその後
    if (el2 > 9) once("depart", s.dir === "in" ? "depart" : "forgot", { force: true });
    if (el2 > 40 && s.lang !== "en" && done.has("depart")) once("subs", "subs");
    if (s.dir === "in" && el2 > 70) once("stay", "stay");
    if (s.dir === "out" && el2 > 80) once("review", "review");
    // 止まった / 走り出した / 長い停車
    const moving = (s.kmh ?? 0) > 12;
    if (!moving && (s.kmh ?? 99) < 3 && s.toDest > 400) {
      if (!stopT) stopT = now;
      if (now - stopT > 60000 && !stopSaid && !done.has("stopped")) void say("stopped").then((ok) => { if (ok) { stopSaid = true; done.add("stopped"); } });
      if (now - stopT > 180000 && !shopSaid) void say("shop").then((ok) => { if (ok) shopSaid = true; });
    } else if (moving) {
      if (stopSaid && !done.has("restart")) once("restart", "restart");
      stopT = 0;
    }
    // 速度 (80 / 100 / 120 km/h を 4 秒続けて超えたら 1 回。70 未満に落ちて 3 分たてば、また言う)
    const k = s.kmh ?? 0, lv = k >= 140 ? 140 : k >= 120 ? 120 : k >= 100 ? 100 : k >= 80 ? 80 : 0;
    if (lv > spdLv && done.has("depart")) { if (++spdN >= 4) { const want = lv; void say(`spd${want}` as AiId).then((ok) => { if (ok) { spdLv = want; spdAt = Date.now(); spdN = 0; } }); } } else spdN = 0;
    if (spdLv && k < 70 && now - spdAt > 180000) spdLv = 0;
    // ルートから外れた (20 秒続いたら)
    if (s.offroute) { if (!offT) offT = now; if (now - offT > 20000) once("offroute", "offroute"); } else offT = 0;
    // 距離
    if (u >= 0.5 && s.total > 4000) once("half", "half");
    if (rem < 5000 && s.total > 8000) once("km5", "km5");
    if (rem < 1000 && s.total > 2500) once("km1", "km1");
    if (s.dir === "in" && rem < 450) once("soon", "soon");
    // 遅れ・早い (予定のペースと比べて)
    const expect = s.baseMin * 60 * u, elP = (now - s.paceStart) / 1000;
    if (u > 0.15 && elP - expect > 240) once("late", "late");
    if (u > 0.4 && expect - elP > 180) once("early", "early");
    // 場所
    if (s.ll) {
      const [la, lo] = s.ll;
      // 橋の手前 (高速モードの前に)
      if (s.crossesBridge) {
        const toBridge = Math.min(Math.hypot((la - 34.41475) * 111000, (lo - 135.29395) * 91500), Math.hypot((la - 34.43725) * 111000, (lo - 135.26445) * 91500));
        if (toBridge < 1300 && toBridge > 500 && moving) once("bridge", "bridge", { force: true });
      }
      if (Math.hypot((la - 34.4125) * 111000, (lo - 135.2935) * 91500) < 1500) once("sea", "sea");
      if (!s.hasIzumiPoi && lo > 135.305 && s.dir === "in") once("izumi", "izumi");
      // 泉佐野に入ったら「タオル発祥の地」(お迎えのとき。お見送りは静かな時間の豆知識で)
      if (lo > 135.305 && s.dir === "in") once("fact:towel", "towel");
    }
    // 夕日・時刻・曜日・天気
    const ss = sunsetMin(now);
    if (minNow > ss - 16 && minNow < ss - 3) once("sunset", "sunset");
    if (zorome(hh, mm)) once("zorome", "zorome");
    if (el2 > 100) {
      if (hh >= 5 && hh < 10) once("tod", "morning"); else if (hh >= 19 || hh < 4) once("tod", "night");
      const dow = t.getUTCDay(); if (dow === 5 || dow === 6) once("friday", "friday");
      const w = s.weather;
      if (w) {
        if (rainy(w.code)) once("wx", "rain"); else if (w.temp >= 30) once("wx", "hot"); else if (w.temp <= 8) once("wx", "cold");
        else if (w.days?.[1] && rainy(w.days[1].code)) once("wx", "rain_tmrw");
      }
    }
    // 橋 (ブースト) を渡り終えたら最高速度のひと言
    if (boostEndAt && now - boostEndAt > 9000) once("topspeed", "topspeed");
    // 豆知識・おしゃべりは 3 分に 1 回くらい (ほかのひと言のすぐあとは避ける・同じものは 1 回の送迎で 1 回だけ)
    if (now - Math.max(chatAt, s.started) > AI_CHAT_MS && now - lastAny > AI_FACT_MS && now - lastAt > AI_GAP_MS) {
      const facts: AiId[] = [...(s.dir === "in" ? [] : (["towel"] as AiId[])), "nasu", ...(s.placeKey.startsWith("kix") ? (["kix"] as AiId[]) : []), ...(s.crossesBridge ? (["bridgefact"] as AiId[]) : [])];
      const left = facts.filter((f) => !done.has("fact:" + f));
      const chatLeft = AI_LINES.chat.v.map((_, i) => i).filter((i) => !chatUsed.has(i));
      // 地元の豆知識と、おしゃべりを交互に
      if (left.length && (done.has("lastChat") || !chatLeft.length)) { const f = left[Math.floor(Math.random() * left.length)]; void say(f).then((ok) => { if (ok) { done.add("fact:" + f); done.delete("lastChat"); chatAt = Date.now(); } }); }
      else if (chatLeft.length) { const i = chatLeft[Math.floor(Math.random() * chatLeft.length)]; void say("chat", { i }).then((ok) => { if (ok) { chatUsed.add(i); done.add("lastChat"); chatAt = Date.now(); } }); }
    }
  }

  function event(e: "arrive" | "song" | "boostEnd") {
    const s = c.state(); if (!s.tripId) return;
    if (e === "arrive") setTimeout(() => void say(s.dir === "in" ? "lights" : "bye", { force: !c.quiet() }), 7000);
    if (e === "song" && Date.now() - s.started > 60000) void say("song");
    if (e === "boostEnd") boostEndAt = Date.now();
  }

  /* ---------- ゲストが光の玉を押す → 質問メニュー ---------- */
  const TQ: Record<GLang, string> = { zh: "问问 ASTRAEA", ja: "ASTRAEA に聞く", en: "ASK ASTRAEA", ko: "ASTRAEA에게 묻기" };
  let menuT: ReturnType<typeof setTimeout> | null = null; const asked: Record<string, number> = {}; const lastQ: Record<string, number> = {};
  function menu() {
    const s = c.state(), lang = s.lang, near = !!s.tripId && (s.arrived || Math.max(0, s.total - s.d) < 3000);
    const qs = GUEST_Q.filter((q) => (q.id !== "lights" || (near && s.dir === "in")) && (q.id !== "checkin" || c.hasCheckin()));
    const items = [...qs.map((q) => ({ id: q.id, icon: q.icon, t: q.q[lang] })), ...(s.dir === "in" ? [{ id: "guide", icon: "🔑", t: GUIDE_Q[lang] }] : [])];
    const m = $("aiMenu");
    m.innerHTML = `<div class="mt"><span>✦ ${TQ[lang]}</span><button data-x>✕</button></div>` + items.map((q, k) => `<button data-q="${q.id}" class="${q.id === "lights" || q.id === "guide" ? "hot" : ""}" style="animation-delay:${k * 45}ms"><i>${q.icon}</i><span>${q.t.replace(/[<&>]/g, "")}</span></button>`).join("");
    m.querySelectorAll<HTMLElement>("[data-q]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); closeMenu(); void ask(b.dataset.q!); }));
    (m.querySelector("[data-x]") as HTMLElement).onclick = (e) => { e.stopPropagation(); closeMenu(); };
    m.classList.add("on"); if (menuT) clearTimeout(menuT); menuT = setTimeout(closeMenu, 12000);
  }
  function closeMenu() { $("aiMenu").classList.remove("on"); if (menuT) clearTimeout(menuT); menuT = null; }
  $("aiDot").onclick = (ev) => { ev.stopPropagation(); if ($("aiMenu").classList.contains("on")) closeMenu(); else menu(); };
  async function ask(id: string) {
    if (id === "guide") { c.guide(); return; }
    const q = GUEST_Q.find((x) => x.id === id); if (!q) return;
    // 話している途中なら、終わるまで待つ (最大 20 秒)
    for (let k = 0; speaking && k < 40; k++) await new Promise((r) => setTimeout(r, 500));
    asked[id] = (asked[id] || 0) + 1;
    if (asked[id] === 3 && id !== "lights" && id !== "checkin") { const i = (lastQ.rep = ((lastQ.rep ?? -1) + 1) % REPEAT.length); await speak(guestAudio("repeat", i), REPEAT[i], { st: "TO: GUEST" }); return; }
    let i: number;
    if (id === "weather") i = weatherAnswer(c.state().weather?.days?.[1]?.code);
    else { i = Math.floor(Math.random() * q.v.length); if (q.v.length > 1 && i === lastQ[id]) i = (i + 1) % q.v.length; }
    lastQ[id] = i;
    if (id === "lights") c.roomLights();
    if (id === "checkin") setTimeout(() => c.checkin(), 700);
    await speak(guestAudio(id, i), q.v[i], { st: "TO: GUEST" });
  }

  /* ---------- お父さんの指示 (スマホのボタン・声) ---------- */
  let lastCmd: number | null = null; const lastC: Record<string, number> = {};
  function command(cmd: { c: string; n: number } | null) {
    if (!cmd || typeof cmd.n !== "number") return;
    if (lastCmd == null) { lastCmd = cmd.n; if (Date.now() - cmd.n > 20000) return; } // 前の送迎の指示は実行しない
    else if (cmd.n <= lastCmd) return;
    lastCmd = cmd.n;
    if (cmd.c === "guide") { c.guide(); return; }
    if (cmd.c === "unknown") { const i = (lastC.unknown = ((lastC.unknown ?? -1) + 1) % UNKNOWN.length); void speak(captainAudio("unknown", i), UNKNOWN[i], { st: "TO: CAPTAIN", duck: false }); return; }
    const k = CAPTAIN.find((x) => x.id === cmd.c); if (!k) return;
    let i = Math.floor(Math.random() * k.v.length); if (k.v.length > 1 && i === lastC[k.id]) i = (i + 1) % k.v.length; lastC[k.id] = i;
    if (k.id === "checkin") setTimeout(() => c.checkin(), 700);
    if (k.id === "room") setTimeout(() => c.roomLit(), 4000);
    // 話している途中なら、終わってから
    const go = () => { if (speaking) { setTimeout(go, 500); return; } void speak(captainAudio(k.id, i), k.v[i], { st: "TO: CAPTAIN" }); };
    go();
  }

  /* ---------- 光の玉 (声に合わせて揺れる) ---------- */
  const FB = new Uint8Array(64);
  const draw = (cv: HTMLCanvasElement, big: boolean, lv: number, k: number) => {
    const g = cv.getContext("2d")!, w = cv.width, cx = w / 2; g.clearRect(0, 0, w, w);
    const R = w * (big ? 0.2 : 0.24) * (1 + lv * 0.5);
    let gr = g.createRadialGradient(cx, cx, 0, cx, cx, R * 1.9); gr.addColorStop(0, `rgba(120,230,255,${0.3 + lv * 0.5})`); gr.addColorStop(1, "rgba(0,140,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.lineWidth = w / 110;
    for (let r = 0; r < 3; r++) {
      g.strokeStyle = `rgba(143,240,255,${0.25 + 0.2 * r})`; g.beginPath();
      for (let a = 0; a <= 48; a++) { const th = (a / 48) * 6.283, rr = R - r * R * 0.18 + Math.sin(th * (3 + r) + k * (1.2 + r * 0.4)) * (R * 0.06 + lv * R * 0.35) * (r ? 0.6 : 1); const x = cx + Math.cos(th) * rr, y = cx + Math.sin(th) * rr; if (a) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.stroke();
    }
    gr = g.createRadialGradient(cx - R * 0.15, cx - R * 0.2, 1, cx, cx, R * 0.75); gr.addColorStop(0, "#eaffff"); gr.addColorStop(0.4, "#5fe3ff"); gr.addColorStop(1, "rgba(0,90,200,.2)");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, R * 0.72, 0, 6.283); g.fill();
  };
  let lastF = 0;
  const loop = (n: number) => {
    requestAnimationFrame(loop);
    if (!c.stage.classList.contains("trip") || n - lastF < 45) return; lastF = n; // 毎秒 22 コマほど
    let lv = 0; if (speaking && an) { an.getByteFrequencyData(FB); for (let i = 1; i < 24; i++) lv += FB[i]; lv /= 23 * 255; }
    const k = n / 1000;
    draw($("aiDotC") as HTMLCanvasElement, false, lv, k);
    if (c.stage.classList.contains("ai-talk")) draw($("aiOrb") as HTMLCanvasElement, true, lv, k);
  };
  requestAnimationFrame(loop);

  const urls = () => (Object.keys(AI_LINES) as AiId[]).flatMap((id) => AI_LINES[id].v.map((_, i) => aiAudio(id, i))).concat(talkAudioUrls());
  /** 声を先に読み込む (保存済みなら iPad の中から) */
  function preload() {
    void (async () => { for (const u of urls()) { if (blobs[u]) continue; try { const r = await fetch(u); if (r.ok) blobs[u] = URL.createObjectURL(await r.blob()); } catch { /* 次へ */ } } })();
  }
  return { tick, event, reset, preload, urls, command, busy: () => speaking, closeMenu, unlock: () => unlockAudio(el, urls()[0]) };
}
