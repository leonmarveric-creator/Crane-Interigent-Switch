/**
 * 建物のホログラム (軽量版): 3D (WebGL) を使わず、2D の canvas で線と面を描いて回す。
 *   形は public/holo/geo/{部屋}.json (本物のホログラム public/holo/room.js から書き出した線と面。部屋ごと約 60KB)。
 *   - ゆっくり左右に回り (±15°)、上下に少し揺れる。古い iPhone でも軽いように 30 コマ・画質は 1.5 倍まで
 *   - 機器の光: エアコン (冷たい風の流れ) / 天井 (光の円錐と床の明かり) / 和の灯り・NEST (暖かい光) / ギャラクシー (星) / シールド (外出モード)
 *   - 光は「足し算」で重ねる (ホログラムらしく)
 *   - 自動で画質を調整: 最初の数コマの描画時間を測り、重い端末・ほかのアプリと同時で忙しいときは
 *     にじみ (ブルーム) と光の粒を減らす → さらに重ければ解像度も下げる。見た目の形はそのまま
 */
type V3 = [number, number, number];
interface Geo { cam: { p: V3; d: V3; fov: number }; room: { x: [number, number]; z: [number, number]; f: number }; dev: Record<string, V3>; L: [string, number, string][]; T: [string, number, string][] }

const CACHE = new Map<string, Promise<Geo | null>>();
export function loadHoloGeo(room: string, url?: string): Promise<Geo | null> {
  const u = url ?? `/holo/geo/${room}.json?v=1`;
  let p = CACHE.get(u);
  if (!p) { p = fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null); CACHE.set(u, p); }
  return p;
}
const dec = (b64: string) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); const a = new Int16Array(u.buffer), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 100; return f; };
const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${a})`;

export interface HoloLite { set(dev: string, on: boolean): void; shield(on: boolean): void; stop(): void }

export function holoLite(cv: HTMLCanvasElement, g: Geo): HoloLite {
  const ctx = cv.getContext("2d")!;
  // 線: 奥ほど暗く (3 段)・明るい線は太いにじみも
  const L = g.L.map(([c, a, b]) => { const A = Math.min(1, a * 1.25); return { n: rgba(c, Math.min(1, A * 1.3)), m: rgba(c, A), f: rgba(c, A * 0.5), g: a > 0.2 ? rgba(c, A * 0.16) : null, v: dec(b) }; });
  // 建物の大きさ (床の丸い台・走査の面・光の粒に使う)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const m of L) for (let i = 0; i < m.v.length; i += 3) { const x = m.v[i], y = m.v[i + 1], z = m.v[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, gy = Math.max(-0.5, Math.min(0, y0)), bh = Math.min(12, y1 - gy);
  let lvl = 2, ema = 0, nF = 0; // 画質 2: 全部 / 1: にじみ 1 回・粒少なめ・太い線なし / 0: にじみなし・解像度を下げる
  const motes = Array.from({ length: 46 }, () => [bx + (Math.random() - 0.5) * (x1 - x0), gy + Math.random() * bh, bz + (Math.random() - 0.5) * (z1 - z0), 0.2 + Math.random() * 0.5]);
  const sm = document.createElement("canvas"), sx = sm.getContext("2d")!; // 光のにじみ (小さく描いて引き伸ばす)
  const T = g.T.map(([c, a, b]) => ({ c: rgba(c, Math.min(0.5, a * 0.9)), v: dec(b) }));
  const R = g.room, fy = (g.dev.andon?.[1] ?? 0.65) - 0.65, cy = (g.dev.light?.[1] ?? fy + 2.2) + 0.25;
  const ctr: V3 = [(R.x[0] + R.x[1]) / 2, fy + 1.1, (R.z[0] + R.z[1]) / 2];
  // カメラ: 元のホログラムと同じ向きから、部屋のまわりを回る
  const cp = g.cam.p, d = g.cam.d, dist0 = Math.hypot(cp[0] - ctr[0], cp[1] - ctr[1], cp[2] - ctr[2]);
  const yaw0 = Math.atan2(cp[0] - ctr[0], cp[2] - ctr[2]), pitch0 = Math.asin((cp[1] - ctr[1]) / dist0);
  void d;
  const st: Record<string, number> = { ac: 0, ceil: 0, wa: 0, nest: 0, galaxy: 0, shield: 0 }, goal: Record<string, number> = { ...st };
  let dpr = Math.min(1.75, window.devicePixelRatio || 1);
  let W = 0, H = 0, alive = true, last = 0;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); sm.width = Math.max(1, Math.round(W / 4)); sm.height = Math.max(1, Math.round(H / 4)); };
  size();
  const stars = Array.from({ length: 60 }, () => [R.x[0] + Math.random() * (R.x[1] - R.x[0]), cy - Math.random() * 0.3, R.z[0] + Math.random() * (R.z[1] - R.z[0]), Math.random() * 6] as number[]);
  let proj: (x: number, y: number, z: number) => [number, number, number] = () => [0, 0, 0];
  const frame = (ts: number) => {
    if (!alive) return; requestAnimationFrame(frame);
    if (ts - last < 32) return; last = ts; const t = ts / 1000, t0 = performance.now();
    if (!W) size();
    for (const k in st) st[k] += (goal[k] - st[k]) * 0.12;
    // カメラ (ゆっくり回る)
    const yaw = yaw0 + Math.sin(t * 0.32) * 0.27, pitch = pitch0 + Math.sin(t * 0.21) * 0.04, dist = dist0 * 1.08;
    const ex = ctr[0] + Math.sin(yaw) * Math.cos(pitch) * dist, ey = ctr[1] + Math.sin(pitch) * dist, ez = ctr[2] + Math.cos(yaw) * Math.cos(pitch) * dist;
    let fx = ctr[0] - ex, fyv = ctr[1] - ey, fz = ctr[2] - ez; const fl = Math.hypot(fx, fyv, fz); fx /= fl; fyv /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl; // 右 (水平)
    const ux = -rz * fyv, uy = rz * fx - rx * fz, uz = rx * fyv; // 上
    const f = (H / 2) / Math.tan(((g.cam.fov || 32) * Math.PI) / 360) * 1.05;
    proj = (x, y, z) => { const dx = x - ex, dy = y - ey, dz = z - ez, cz = dx * fx + dy * fyv + dz * fz; const sx = dx * rx + dz * rz, sy = dx * ux + dy * uy + dz * uz; return [W / 2 + (sx / cz) * f, H / 2 - (sy / cz) * f, cz]; };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    // 床の丸い台 (回る目盛り・同心円)
    { const ring = (rad: number, a: number, dash: number[] | null, rot: number, w = 1) => { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const an = (i / 64) * Math.PI * 2 + rot, p = proj(bx + Math.cos(an) * rad, gy, bz + Math.sin(an) * rad); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.setLineDash(dash ?? []); ctx.lineWidth = w; ctx.strokeStyle = `rgba(110,220,255,${a})`; ctx.stroke(); ctx.setLineDash([]); };
      const rr = Math.max(x1 - x0, z1 - z0) * 0.62;
      const c0 = proj(bx, gy, bz), e1 = proj(bx + rr * 1.25, gy, bz); const gr0 = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], Math.abs(e1[0] - c0[0]) + 1); gr0.addColorStop(0, "rgba(60,170,230,.16)"); gr0.addColorStop(1, "rgba(60,170,230,0)"); ctx.fillStyle = gr0; ctx.fillRect(0, 0, W, H);
      ring(rr, 0.55, null, 0, 1.4); ring(rr * 1.08, 0.35, [2, 6], t * 0.15); ring(rr * 1.22, 0.4, [26, 10, 4, 10], -t * 0.1, 2); ring(rr * 0.7, 0.25, [1, 4], t * 0.3); ring(rr * 1.36, 0.18, null, 0); }
    // 面 (ガラス・床)
    for (const m of T) { ctx.beginPath(); const v = m.v; for (let i = 0; i + 8 < v.length; i += 9) { const a = proj(v[i], v[i + 1], v[i + 2]), b = proj(v[i + 3], v[i + 4], v[i + 5]), c = proj(v[i + 6], v[i + 7], v[i + 8]); if (a[2] < 0.1 || b[2] < 0.1 || c[2] < 0.1) continue; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); } ctx.fillStyle = m.c; ctx.fill(); }
    // 線
    ctx.lineWidth = 1;
    const dN = dist - 2.5, dF = dist + 2.5;
    const pn = new Path2D(), pm = new Path2D(), pf = new Path2D();
    for (const m of L) { const P = [new Path2D(), new Path2D(), new Path2D()]; const v = m.v;
      for (let i = 0; i + 5 < v.length; i += 6) { const a = proj(v[i], v[i + 1], v[i + 2]), b = proj(v[i + 3], v[i + 4], v[i + 5]); if (a[2] < 0.1 || b[2] < 0.1) continue; const dz = (a[2] + b[2]) / 2, k = dz < dN ? 0 : dz < dF ? 1 : 2; P[k].moveTo(a[0], a[1]); P[k].lineTo(b[0], b[1]); }
      if (m.g && lvl === 2) { ctx.lineWidth = 3.4; ctx.strokeStyle = m.g; ctx.stroke(P[0]); ctx.stroke(P[1]); ctx.lineWidth = 1; }
      ctx.strokeStyle = m.n; ctx.stroke(P[0]); ctx.strokeStyle = m.m; ctx.stroke(P[1]); ctx.strokeStyle = m.f; ctx.stroke(P[2]); }
    void pn; void pm; void pf;
    // 走査の面 (下から上へ建物を通る)
    { const h = gy + ((t * 0.22) % 1) * (bh + 1); const q = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => proj(x, h, z)); ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = "rgba(120,220,255,.05)"; ctx.fill(); ctx.strokeStyle = "rgba(160,235,255,.45)"; ctx.lineWidth = 1; ctx.stroke(); }
    // 上っていく光の粒
    for (let mi = 0; mi < (lvl === 2 ? motes.length : 20); mi++) { const m = motes[mi]; m[1] += 0.012 * (0.5 + m[3]); if (m[1] > gy + bh) m[1] = gy; const p = proj(m[0], m[1], m[2]); if (p[2] < 0.1) continue; const a = 0.25 + 0.5 * m[3]; ctx.fillStyle = `rgba(170,235,255,${a})`; const s2 = Math.max(0.8, (m[3] * 18) / p[2]); ctx.fillRect(p[0] - s2 / 2, p[1] - s2 / 2, s2, s2); }
    // この部屋の枠を明るく
    const box: V3[] = [[R.x[0], fy, R.z[0]], [R.x[1], fy, R.z[0]], [R.x[1], fy, R.z[1]], [R.x[0], fy, R.z[1]]];
    ctx.strokeStyle = `rgba(143,230,255,${0.55 + 0.25 * Math.sin(t * 2.4)})`; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = box[i], b = box[(i + 1) % 4]; for (const y of [fy, cy]) { const p = proj(a[0], y, a[2]), q = proj(b[0], y, b[2]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } const p = proj(a[0], fy, a[2]), q = proj(a[0], cy, a[2]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = box[i], b = box[(i + 1) % 4], p1 = proj(a[0], fy, a[2]), p2 = proj(b[0], fy, b[2]), p3 = proj(b[0], cy, b[2]), p4 = proj(a[0], cy, a[2]); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.closePath(); } ctx.fillStyle = "rgba(120,220,255,.035)"; ctx.fill();
    const glow = (p: V3, r: number, col: string, a: number) => { if (a < 0.01) return; const s = proj(p[0], p[1], p[2]); if (s[2] < 0.1) return; const rr = (r * f) / s[2]; const gr = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], rr); gr.addColorStop(0, col.replace("A", String(a))); gr.addColorStop(1, col.replace("A", "0")); ctx.fillStyle = gr; ctx.fillRect(s[0] - rr, s[1] - rr, rr * 2, rr * 2); };
    const floorQuad = (col: string) => { ctx.beginPath(); box.forEach((b, i) => { const p = proj(b[0], fy + 0.01, b[2]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    // 天井の照明: 光の円錐 + 床の明かり
    if (st.ceil > 0.01 && g.dev.light) { const l = g.dev.light; glow(l, 0.5, "rgba(255,250,235,A)", st.ceil); floorQuad(`rgba(255,240,210,${0.16 * st.ceil})`);
      const top = proj(l[0], l[1], l[2]); ctx.beginPath(); ctx.moveTo(top[0], top[1]); const ring = 16; for (let i = 0; i <= ring; i++) { const a = (i / ring) * Math.PI * 2, p = proj(l[0] + Math.cos(a) * 0.9, fy, l[2] + Math.sin(a) * 0.9); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.fillStyle = `rgba(255,245,220,${0.08 * st.ceil})`; ctx.fill(); }
    // 和の灯り・NEST: 暖かい光
    if (g.dev.andon) { glow(g.dev.andon, 0.8, "rgba(255,180,90,A)", st.wa * 0.9); if (st.wa > 0.01) floorQuad(`rgba(255,170,80,${0.07 * st.wa})`); }
    glow([R.x[0] + 0.35, fy + 0.5, (R.z[0] + R.z[1]) / 2], 0.7, "rgba(255,200,120,A)", st.nest * 0.8);
    // エアコン: 冷たい風 (流れる点線)
    if (st.ac > 0.01 && g.dev.ac) { const a = g.dev.ac; glow(a, 0.45, "rgba(140,230,255,A)", st.ac); ctx.setLineDash([4, 7]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(160,235,255,${0.7 * st.ac})`;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const u = i / 10, p = proj(a[0] + (ctr[0] - a[0]) * u * 0.8 + (k - 1.5) * 0.18, a[1] - u * u * 1.4, a[2] + (ctr[2] - a[2]) * u * 0.8); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
      ctx.setLineDash([]); }
    // ギャラクシー: 天井に星
    if (st.galaxy > 0.01) for (const s of stars) { const p = proj(s[0], s[1], s[2]); const a = st.galaxy * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s[3]))); ctx.fillStyle = `rgba(200,170,255,${a})`; ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    // シールド (外出モード): 部屋をおおう半球の網
    if (st.shield > 0.01) { const rx2 = (R.x[1] - R.x[0]) / 2 + 0.35, rz2 = Math.abs(R.z[1] - R.z[0]) / 2 + 0.35, hh = cy - fy + 0.4, cx0 = (R.x[0] + R.x[1]) / 2, cz0 = (R.z[0] + R.z[1]) / 2;
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,175,80,${0.55 * st.shield * (0.75 + 0.25 * Math.sin(t * 3))})`; ctx.beginPath();
      for (let j = 1; j <= 5; j++) { const v = (j / 6) * Math.PI / 2; for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, p = proj(cx0 + Math.cos(a) * rx2 * Math.cos(v), fy + Math.sin(v) * hh, cz0 + Math.sin(a) * rz2 * Math.cos(v)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.2; for (let j = 0; j <= 8; j++) { const v = (j / 8) * Math.PI / 2, p = proj(cx0 + Math.cos(a) * rx2 * Math.cos(v), fy + Math.sin(v) * hh, cz0 + Math.sin(a) * rz2 * Math.cos(v)); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } }
      ctx.stroke(); }
    // 走査線 (下から上へ)
    const sy0 = H * (1 - ((t * 0.25) % 1.2)); const sg = ctx.createLinearGradient(0, sy0 - 40, 0, sy0 + 40); sg.addColorStop(0, "rgba(140,225,255,0)"); sg.addColorStop(0.5, "rgba(140,225,255,.10)"); sg.addColorStop(1, "rgba(140,225,255,0)"); ctx.fillStyle = sg; ctx.fillRect(0, sy0 - 40, W, 80);
    // 光のにじみ (全体を小さく縮めて、引き伸ばして重ねる → 柔らかい光)
    if (lvl > 0) { sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, sm.width, sm.height); sx.drawImage(cv, 0, 0, sm.width, sm.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = lvl === 2 ? 0.55 : 0.7; ctx.drawImage(sm, 0, 0, cv.width, cv.height);
      if (lvl === 2) { ctx.globalAlpha = 0.3; ctx.drawImage(sm, -cv.width * 0.02, -cv.height * 0.02, cv.width * 1.04, cv.height * 1.04); } ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = "source-over";
    // 画質の自動調整 (1 コマの描画時間の平均。30 コマ = 33ms のうち、半分以上を使っていたら軽くする)
    const dt = performance.now() - t0; ema = nF++ ? ema * 0.8 + dt * 0.2 : dt;
    if (nF > 8 && lvl > 0 && ema > (lvl === 2 ? 15 : 20)) { lvl--; nF = 0; if (lvl === 0) { dpr = Math.min(dpr, 1.25); size(); } }
  };
  requestAnimationFrame(frame);
  const onR = () => size(); addEventListener("resize", onR);
  return {
    set(dev, on) { if (dev in goal) goal[dev] = on ? 1 : 0; },
    shield(on) { goal.shield = on ? 1 : 0; if (on) for (const k of ["ac", "ceil", "wa", "nest", "galaxy"]) goal[k] = 0; },
    stop() { alive = false; removeEventListener("resize", onR); cv.width = cv.height = 1; sm.width = sm.height = 1; /* メモリをすぐ返す */ },
  };
}
