/**
 * 車内 iPad: お父さんのスマホで流れている曲のカバーと歌詞。
 *   ・ふだん: 地図の下の空いている所にホログラムの歌詞 (地図の邪魔をしない)
 *   ・🎵 を押すと全画面: 歌詞がメイン。大阪湾の夕景 + 海のきらめき、左にカバーと再生ボタン、
 *     右に「いつもの地図」と「いつもの部屋カード」をそのまま小さく移して表示 (閉じると元に戻す)
 *   ・再生ボタンはスマホへ送る (cabin_trips.music_cmd)。3〜6 秒で反映
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseLrc, lyricIndex, type LrcLine } from "@/lib/driverLogic";
import { locName, npPos, npStale, MUSIC_T, type CabinTrack, type MusicCmd, type NowPlaying } from "@/lib/cabinMusic";
import type { GLang, LL } from "@/lib/cabinGeo";

export interface NpCtx {
  root: HTMLElement;
  stage: HTMLElement;
  map: any;                         // Leaflet の地図 (全画面の間は右のカードへ移す)
  refit: () => void;                // 地図をルート全体に合わせる (走り出す前)
  car: () => LL | null;             // 車の位置
  started: () => boolean;           // 位置が来ているか
  lang: () => GLang;
  setLang: (l: GLang) => void;      // 全画面の言語ボタン → 画面全体の言語
  tripInfo: () => { dir: "in" | "out"; route: string; season: string | null } | null;
  cmd: (c: MusicCmd, v: number | null) => void;
  tick: () => void;                 // ボタンの音
}
export interface NpView { update(np: NowPlaying | null, track: CabinTrack | null, skewMs: number): void; texts(): void; reset(): void; relayout(): void }

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ARC = 2 * Math.PI * 132;
const BAY = "/cabin/bay.webp";

export function createNowPlaying(c: NpCtx): NpView {
  const $ = (id: string) => c.root.querySelector("#" + id) as HTMLElement;
  const stage = c.stage;
  let np: NowPlaying | null = null, tr: CabinTrack | null = null, lrc: LrcLine[] = [], skew = 0;
  let mode: "H" | "C" = "H", open = false;

  /* ---------- 状態 ---------- */
  function update(n: NowPlaying | null, t: CabinTrack | null, s: number) {
    skew = s;
    if (t && t.id !== tr?.id) {
      tr = t; lrc = parseLrc(t.lrc); hLi = -2; fLi = -2;
      c.root.querySelectorAll<HTMLImageElement>("#hCov,#f2Cov").forEach((e) => { e.style.visibility = t.cover ? "" : "hidden"; if (t.cover) e.src = t.cover; });
      $("hMeta").textContent = `HOLO · ${t.title.toUpperCase()}${t.artist ? " · " + t.artist.toUpperCase() : ""}`;
      $("f2T").textContent = t.title; $("f2A").textContent = t.artist || "Crane Nest";
    }
    np = n;
  }
  const on = () => !!(np && tr && np.id === tr.id && !npStale(np, Date.now(), skew));
  // スマホで位置を測ってからサーバに届くまでの時間 (約 0.3 秒) を足す
  const LAG = 0.3;
  const pos = () => (np ? npPos(np, Date.now(), skew) + (np.on ? LAG : 0) : 0);

  /* ---------- ホログラムの歌詞 (地図の下) ---------- */
  let hLi = -2, hOn = -1;
  function holo() {
    const t = pos(), i = lyricIndex(lrc, t);
    if (i !== hLi) {
      // 1 行だけだと歌とずれたときにわからないので、前の行と次の行も小さく出す
      const pv = $("hPrev"); pv.textContent = i > 0 && lrc[i - 1]?.s ? lrc[i - 1].s : ""; pv.classList.remove("in"); void pv.offsetWidth; pv.classList.add("in");
      hLi = i; hOn = -1;
      const s = lrc[i]?.s ?? (lrc.length ? "♪" : tr?.title ?? "♪");
      $("hLine").innerHTML = [...s].map((ch, k) => `<span style="--i:${k};--gx:${(Math.random() * 10 - 5).toFixed(1)}px">${ch === " " ? " " : ch.replace(/[<&>"]/g, "")}</span>`).join("");
      $("hNext").textContent = lrc[i + 1]?.s ?? "";
      // 長い行は文字を小さくして 1 行に収める (切らない)
      const L = $("hLine"), W = (L.parentElement as HTMLElement).clientWidth; let fs = 28; L.style.fontSize = fs + "px";
      while (L.scrollWidth > W && fs > 16) { fs -= 1; L.style.fontSize = fs + "px"; }
      $("holo").style.setProperty("--hfs", fs + "px");
    }
    // 歌詞の時間は「行の始まり」だけなので、1 文字ずつ色を進めると歌とずれる → 行が始まったら行全体を光らせる
    if (hOn !== 1) { const spans = $("hLine").children; for (let k = 0; k < spans.length; k++) spans[k].classList.add("on"); hOn = 1; }
    $("hTime").textContent = np?.dur ? `${fmt(t)} / ${fmt(np.dur)}` : fmt(t);
  }

  /* ---------- 全画面: 夕景 (写真) + 海のきらめき ---------- */
  let geo: any = null, sceneDone = false;
  function scene() {
    const cv = $("f2Scene") as HTMLCanvasElement, box = $("npfull").getBoundingClientRect(), mid = (c.root.querySelector(".f2mid") as HTMLElement).getBoundingClientRect();
    const sc = box.width / ($("npfull").offsetWidth || 1); // ステージは拡大・縮小されている
    const W = box.width / sc, H = box.height / sc; if (!W || !H) return false;
    const im = new Image();
    im.onload = () => {
      const k = Math.min(2, (window.devicePixelRatio || 1) * sc); cv.width = W * k; cv.height = H * k;
      const g = cv.getContext("2d")!; g.setTransform(k, 0, 0, k, 0, 0);
      const port = stage.classList.contains("port"); // 縦: 写真は高さ 300 まで (下に再生ボタン・地図・部屋)
      const mx0 = (mid.left - box.left) / sc, mw = mid.width / sc, cx = mx0 + mw / 2, midB = (mid.bottom - box.top) / sc;
      const dw = port ? Math.min(mw + 170, (300 * im.width) / im.height) : mw + 170, dh = (dw * im.height) / im.width, left = cx - dw / 2, top = 58, yw = top + dh * 0.815;
      let gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#050d24"); gr.addColorStop(yw / H, "#0b2346"); gr.addColorStop(Math.min(0.99, (top + dh) / H), "#0a2244"); gr.addColorStop(0.8, "#061631"); gr.addColorStop(1, "#040b1c");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // 写真 (ふちをぼかしてなじませる)
      const oc = document.createElement("canvas"); oc.width = Math.round(dw * k); oc.height = Math.round(dh * k);
      const o = oc.getContext("2d")!; o.drawImage(im, 0, 0, oc.width, oc.height); o.globalCompositeOperation = "destination-in";
      gr = o.createLinearGradient(0, 0, oc.width, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.14, "#000"); gr.addColorStop(0.86, "#000"); gr.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = gr; o.fillRect(0, 0, oc.width, oc.height);
      gr = o.createLinearGradient(0, 0, 0, oc.height); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.08, "#000"); gr.addColorStop(0.86, "#000"); gr.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = gr; o.fillRect(0, 0, oc.width, oc.height);
      g.drawImage(oc, left, top, dw, dh);
      // 岸の灯りの位置を写真から拾う (海に映す光の柱の元)
      const s2 = document.createElement("canvas"); s2.width = im.width; s2.height = 12; const sx = s2.getContext("2d")!;
      sx.drawImage(im, 0, im.height * 0.7, im.width, 12, 0, 0, im.width, 12);
      const d = sx.getImageData(0, 0, im.width, 12).data, lights: { x: number; c: number[]; a: number }[] = [];
      for (let x = 0; x < im.width; x += 2) {
        let best = 0, col = [255, 200, 140];
        for (let y = 0; y < 12; y++) { const i = (y * im.width + x) * 4, v = d[i] + d[i + 1] + d[i + 2]; if (v > best) { best = v; col = [d[i], d[i + 1], d[i + 2]]; } }
        const u = x / im.width; if (best > 330 && u > 0.08 && u < 0.92) lights.push({ x: left + u * dw, c: col, a: Math.min(1, (best - 300) / 300) });
      }
      geo = { W, H, mx0, mw, left, dw, yw, lights, glints: null, base: port ? midB - 24 : H * 0.745, seaB: port ? midB - 10 : H * 0.8 };
    };
    im.src = BAY;
    return true;
  }
  let fxLast = 0;
  function fx(now: number) {
    if (!open) return;
    requestAnimationFrame(fx);
    if (now - fxLast < 32) return; fxLast = now; // 毎秒 30 コマ
    const cv = $("f2Fx") as HTMLCanvasElement, W = cv.clientWidth, H = cv.clientHeight, k = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
    const g = cv.getContext("2d")!, t = now / 1000; g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
    if (!geo) return;
    const G = geo, { mx0, mw, yw, left, dw } = G, x0 = mx0 - 20, x1 = mx0 + mw + 20;
    g.globalCompositeOperation = "lighter";
    // ① 岸の灯りが海に映って揺れる光の柱
    G.lights.forEach((L: any, i: number) => {
      const [r, gg, b] = L.c;
      for (let j = 0; j < 12; j++) {
        const y = yw + 3 + j * (5 + j * 1.6), sway = Math.sin(t * 1.6 + i * 0.7 + j * 0.9) * (1 + j * 0.5), fl = 0.5 + 0.5 * Math.sin(t * 3.1 + i * 1.3 + j * 2.1);
        const a = L.a * (0.32 - j * 0.024) * (0.45 + 0.55 * fl); if (a <= 0.01) continue;
        g.fillStyle = `rgba(${r},${gg},${b},${a})`; g.fillRect(L.x + sway - 0.8 - j * 0.15, y, 1.6 + j * 0.3, 2 + j * 0.5);
      }
    });
    // ② 海のきらめき
    if (!G.glints) { G.glints = []; for (let i = 0; i < 200; i++) { const dep = Math.pow(Math.random(), 1.8); G.glints.push({ x: left + dw * 0.08 + Math.random() * dw * 0.84, y: yw + 4 + dep * (G.seaB - yw), w: 2 + dep * 9, sp: 0.6 + Math.random() * 1.8, p: Math.random() * 6.28, warm: Math.random() < 0.35 }); } }
    for (const q of G.glints) {
      const s = Math.sin(t * q.sp + q.p); if (s < 0.5) continue;
      const a = Math.pow((s - 0.5) * 2, 3) * (q.warm ? 0.4 : 0.3) * (1 - ((q.y - yw) / (H - yw)) * 0.8);
      g.fillStyle = q.warm ? `rgba(255,205,140,${a})` : `rgba(170,215,255,${a})`; g.fillRect(q.x + Math.sin(t * 0.7 + q.p) * 3, q.y, q.w, 0.8);
    }
    // ③ 水面を横切る光の帯
    const bx = mx0 + (((t * 0.035) % 1.4) - 0.2) * mw, gr = g.createRadialGradient(bx, yw + 60, 0, bx, yw + 60, 160);
    gr.addColorStop(0, "rgba(90,160,255,.09)"); gr.addColorStop(1, "rgba(90,160,255,0)");
    g.save(); g.translate(0, yw + 60); g.scale(1, 0.25); g.translate(0, -(yw + 60)); g.fillStyle = gr; g.fillRect(bx - 160, yw - 600, 320, 1400); g.restore();
    // ④ 粒の波 (歌詞の下)
    const base = G.base, cols = Math.floor((x1 - x0) / 2.6), rows = 15;
    const wave = (u: number, r: number) => Math.sin(u * 7.5 - t * 0.9) * 0.6 + Math.sin(u * 15 + t * 1.4 + r * 0.25) * 0.28 + Math.sin(u * 3 + t * 0.4) * 0.3;
    for (let r = 0; r < rows; r++) {
      const rr = r / (rows - 1);
      for (let cc = 0; cc <= cols; cc++) {
        const u = cc / cols, x = x0 + u * (x1 - x0), env = Math.pow(Math.sin(u * Math.PI), 1.4), wv = wave(u, r);
        const y = base + (rr - 0.5) * (16 + 36 * Math.max(0, wv)) * env - wv * 40 * env;
        const pk = Math.max(0, wv), a = env * (0.22 + 0.75 * pk) * (1 - Math.abs(rr - 0.5) * 1.2);
        if (a < 0.04) continue;
        g.fillStyle = pk > 0.7 && rr > 0.35 && rr < 0.65 ? `rgba(200,245,255,${a})` : `rgba(60,160,255,${a})`;
        g.fillRect(x, y, 1.6, 1.6);
        if (r % 3 === 0) { g.fillStyle = `rgba(60,150,255,${a * 0.22})`; g.fillRect(x, base + 42 + (base - y) * 0.35, 1.3, 1.3); }
      }
    }
    g.strokeStyle = "rgba(120,220,255,.55)"; g.lineWidth = 1.3; g.beginPath();
    for (let cc = 0; cc <= 120; cc++) { const u = cc / 120, x = x0 + u * (x1 - x0), env = Math.pow(Math.sin(u * Math.PI), 1.4), y = base - wave(u, 5) * 40 * env; if (cc) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke(); g.strokeStyle = "rgba(60,160,255,.18)"; g.lineWidth = 6; g.stroke();
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- 全画面: いつもの地図と部屋カードを右へ移す ---------- */
  let home: { m: [Node, Node | null]; r: [Node, Node | null]; rw: number; rh: number; z: number | null } | null = null;
  function fitRoom() {
    const rb = c.root.querySelector(".roomb") as HTMLElement, slot = $("f2RSlot"); if (!rb || rb.parentElement !== slot || !home) return;
    const s = Math.min(slot.clientWidth / home.rw, slot.clientHeight / home.rh);
    rb.style.transform = `scale(${s})`; rb.style.left = (slot.clientWidth - home.rw * s) / 2 + "px";
  }
  function moveIn() {
    const mp = $("map"), rb = c.root.querySelector(".roomb") as HTMLElement;
    home = { m: [mp.parentNode!, mp.nextSibling], r: [rb.parentNode!, rb.nextSibling], rw: rb.offsetWidth, rh: rb.offsetHeight, z: null };
    rb.style.width = home.rw + "px"; rb.style.height = home.rh + "px";
    (c.root.querySelector(".f2map") as HTMLElement).appendChild(mp); $("f2RSlot").appendChild(rb);
    fitRoom();
    requestAnimationFrame(() => {
      c.map.invalidateSize(false);
      if (!c.started()) c.refit(); else { home!.z = c.map.getZoom(); c.map.setZoom(home!.z! - 1, { animate: false }); const p = c.car(); if (p) c.map.panTo(p, { animate: false }); }
    });
  }
  function moveOut() {
    if (!home) return;
    const mp = $("map"), rb = c.root.querySelector(".roomb") as HTMLElement, h = home; home = null;
    h.m[0].insertBefore(mp, h.m[1]); h.r[0].insertBefore(rb, h.r[1]);
    rb.style.transform = rb.style.left = rb.style.width = rb.style.height = "";
    requestAnimationFrame(() => {
      c.map.invalidateSize(false);
      if (!c.started()) c.refit(); else { if (h.z != null) c.map.setZoom(h.z, { animate: false }); const p = c.car(); if (p) c.map.panTo(p, { animate: false }); }
    });
  }

  /* ---------- 全画面: 文字・天気・カード ---------- */
  function texts() {
    const l = c.lang(), T = MUSIC_T[l] ?? MUSIC_T.en;
    c.root.querySelectorAll<HTMLElement>(".npfull [data-t]").forEach((e) => { e.textContent = (T as any)[e.dataset.t!] ?? ""; });
    c.root.querySelectorAll<HTMLElement>("[data-fl]").forEach((e) => e.classList.toggle("on", e.dataset.fl === l));
    $("npfull").dataset.fl = l;
    const ti = c.tripInfo(); if (ti) { $("f2Route").textContent = ti.route; c.root.querySelectorAll<HTMLElement>(".f2seasons div").forEach((e) => e.classList.toggle("on", e.dataset.s === ti.season)); }
    $("f2WxI").textContent = $("wxI").textContent || "";
    const tt = parseInt($("wxT").textContent || ""); $("f2WxT").textContent = isNaN(tt) ? "" : tt + "°C";
    $("f2WxD").textContent = (($("wxD").textContent || "").split(/\d/)[0] || "").trim();
  }
  function side() {
    $("f2Eta").textContent = ($("etaM").firstChild as Text | null)?.textContent ?? "--";
    const km = ($("km").textContent || "").match(/[\d.]+\s*km/); $("f2Km").textContent = km ? km[0] : "";
    $("f2Loc").textContent = locName(c.car());
  }
  function toast(s: string) { const e = $("f2Toast"); e.textContent = s; e.classList.add("on"); clearTimeout((toast as any).t); (toast as any).t = setTimeout(() => e.classList.remove("on"), 2400); }

  /* ---------- 全画面: 歌詞とプレーヤー ---------- */
  let fLi = -2;
  function full() {
    const t = pos(), i = lyricIndex(lrc, t), dur = np?.dur || 0;
    if (i !== fLi) {
      fLi = i; const now = $("f2Now"), s = lrc[i]?.s ?? (lrc.length ? "♪" : tr?.title ?? "♪");
      now.textContent = s; now.classList.remove("in"); void now.offsetWidth; now.classList.add("in");
      let fs = 40; now.style.fontSize = fs + "px"; const W = (now.parentElement as HTMLElement).clientWidth - 32; while (now.scrollWidth > W && fs > 20) now.style.fontSize = --fs + "px";
      $("f2P1").textContent = i > 0 ? lrc[i - 1]?.s ?? "" : ""; $("f2N1").textContent = lrc[i + 1]?.s ?? ""; $("f2N2").textContent = lrc[i + 2]?.s ?? "";
    }
    const u = dur ? Math.min(1, t / dur) : 0;
    ($("f2Arc") as any).style.strokeDasharray = `${(u * ARC).toFixed(1)} 900`;
    $("f2Fill").style.width = u * 100 + "%"; $("f2Knob").style.left = u * 100 + "%";
    $("f2Cur").textContent = fmt(t); $("f2Dur").textContent = dur ? fmt(dur) : "--:--";
    $("f2Play").textContent = np?.on ? "❚❚" : "▶";
  }

  /* ---------- 毎フレーム ---------- */
  let sideT = 0;
  function loop(now: number) {
    const isOn = on() && stage.classList.contains("trip");
    stage.classList.toggle("np-on", isOn); stage.dataset.np = mode;
    $("npFullBtn").classList.toggle("off", !isOn);
    const want = isOn && mode === "C";
    if (want !== open) {
      open = want;
      if (open) { stage.dataset.np = "C"; requestAnimationFrame(() => { if (!sceneDone) sceneDone = scene(); moveIn(); texts(); side(); fLi = -2; requestAnimationFrame(fx); }); }
      else moveOut();
    }
    if (isOn) { if (mode === "H") holo(); else if (open) { full(); if (now - sideT > 1000) { sideT = now; side(); } } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- ボタン ---------- */
  const setMode = (m: "H" | "C") => { mode = m; c.tick(); };
  $("npFullBtn").onclick = (e) => {
    e.stopPropagation();
    // 曲が届いていないとき: ボタンに「スマホで曲が流れていない」と少し出す
    if (!on()) { const b = $("npFullBtn"); b.textContent = "🎵 NO MUSIC"; c.tick(); setTimeout(() => { b.textContent = "🎵"; }, 2200); return; }
    setMode(mode === "C" ? "H" : "C");
  };
  const send = (cm: MusicCmd, v: number | null = null) => {
    c.tick(); c.cmd(cm, v); toast((MUSIC_T[c.lang()] ?? MUSIC_T.en).toastCmd);
    // すぐ反映したように見せる (次の知らせで本当の状態に戻る)
    if (np) { const p = pos(); if (cm === "toggle") np = { ...np, pos: p, at: Date.now() + skew, on: !np.on }; else if (cm === "seek" && v != null) np = { ...np, pos: v, at: Date.now() + skew }; }
  };
  $("f2Play").onclick = () => send("toggle");
  $("f2Prev").onclick = () => send("prev");
  $("f2Next").onclick = () => send("next");
  $("f2Back10").onclick = () => send("seek", Math.max(0, pos() - 10));
  $("f2Fwd10").onclick = () => send("seek", pos() + 10);
  $("f2Seek").onclick = (e) => {
    if (!np?.dur) return; const r = ($("f2Seek").querySelector(".f2bar") as HTMLElement).getBoundingClientRect();
    send("seek", Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * np.dur);
  };
  c.root.querySelectorAll<HTMLElement>("[data-fl]").forEach((b) => (b.onclick = () => { c.tick(); c.setLang(b.dataset.fl as GLang); texts(); }));
  c.root.querySelectorAll<HTMLElement>("[data-f2]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.f2, T = MUSIC_T[c.lang()] ?? MUSIC_T.en;
    if (k === "nav") setMode("H"); else if (k === "room") toast(T.toastRoom); else if (k === "set") toast(T.toastSet);
  }));

  /** iPad を回したとき (縦 ⇄ 横) */
  function relayout() {
    if (!open) return;
    geo = null; sceneDone = false;
    requestAnimationFrame(() => { sceneDone = scene(); fitRoom(); c.map.invalidateSize(false); const p = c.car(); if (p) c.map.panTo(p, { animate: false }); else c.refit(); });
  }
  function reset() { np = null; tr = null; lrc = []; mode = "H"; hLi = -2; fLi = -2; $("hLine").textContent = ""; }
  return { update, texts, reset, relayout };
}
