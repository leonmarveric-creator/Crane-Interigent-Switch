"use client";

/**
 * ハイテクUI の追加エフェクト集。
 *  - TouchReticle     : 触れた位置に、角ブラケットが寄って合うミニマルな照準
 *  - LockShield       : 解錠 = 六角形シールドが砕けて散る / 施錠 = 六角形が集まってバリアが閉じる
 *  - NetworkField     : 粒子が漂い、近いもの同士が線でつながるネットワーク (canvas)
 *  - PerspectiveFloor : 奥へ流れていく 3D の床グリッド
 *  - LightStreaks     : ときどき画面を横切る光のすじ
 *  - TelemetryHud     : ミニレーダー + 外気温 / チェックアウトまで / 通信 のゲージ
 * すべて prefers-reduced-motion のときは止まる (または表示しない)。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* タッチした瞬間: ミニマルな照準                                        */
/* ------------------------------------------------------------------ */
type Touch = { id: number; x: number; y: number };

/**
 * 画面に触れた位置に、4 つの角ブラケットがスッと寄って合う照準を出す (0.45 秒)。
 * 中心の点と、短い十字線だけのミニマルな演出。
 */
export function TouchReticle({ containerRef }: { containerRef: React.RefObject<HTMLElement> }) {
  const reduce = useReducedMotion();
  const [touches, setTouches] = useState<Touch[]>([]);
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reduce) return;
    const onDown = (e: PointerEvent) => {
      const id = Date.now() + Math.random();
      setTouches((ts) => [...ts.slice(-3), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setTouches((ts) => ts.filter((t) => t.id !== id)), 520);
    };
    root.addEventListener("pointerdown", onDown, { passive: true });
    return () => root.removeEventListener("pointerdown", onDown);
  }, [containerRef, reduce]);

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-hidden>
      <AnimatePresence>
        {touches.map((t) => (
          <div key={t.id} className="absolute" style={{ left: t.x, top: t.y }}>
            {/* 角ブラケット: 外から寄ってきて止まり、消える */}
            {corners.map(([sx, sy], i) => (
              <motion.span key={i} className="absolute h-2.5 w-2.5 border-cyan-200"
                style={{
                  borderLeftWidth: sx < 0 ? 1.5 : 0, borderRightWidth: sx > 0 ? 1.5 : 0,
                  borderTopWidth: sy < 0 ? 1.5 : 0, borderBottomWidth: sy > 0 ? 1.5 : 0,
                  marginLeft: sx < 0 ? -10 : 0, marginTop: sy < 0 ? -10 : 0,
                  filter: "drop-shadow(0 0 3px rgba(34,211,238,0.9))",
                }}
                initial={{ x: sx * 16, y: sy * 16, opacity: 0 }}
                animate={{ x: sx * 6, y: sy * 6, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.45, ease: [0.2, 0.9, 0.2, 1], opacity: { duration: 0.45, times: [0, 0.2, 0.7, 1] } }} />
            ))}
            {/* 十字線 */}
            <motion.span className="absolute -ml-3.5 h-px w-7 bg-cyan-200/70"
              initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: [0, 1, 1], opacity: [0, 0.8, 0] }} transition={{ duration: 0.4 }} />
            <motion.span className="absolute -mt-3.5 h-7 w-px bg-cyan-200/70"
              initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: [0, 1, 1], opacity: [0, 0.8, 0] }} transition={{ duration: 0.4 }} />
            {/* 中心の点 */}
            <motion.span className="absolute -ml-[2px] -mt-[2px] h-1 w-1 rounded-full bg-white"
              style={{ boxShadow: "0 0 6px 1px rgba(34,211,238,0.9)" }}
              initial={{ opacity: 1, scale: 1.6 }} animate={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.45 }} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 鍵: 六角形シールド                                                    */
/* ------------------------------------------------------------------ */
const HEX_R = 13; // 六角形 1 枚の半径
const hexPath = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${i ? "L" : "M"}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }).join(" ") + " Z";

/** 半径 2 までの六角形タイル (19 枚) の中心座標 */
function hexCells() {
  const cells: { x: number; y: number; ring: number }[] = [];
  const w = Math.sqrt(3) * HEX_R;
  for (let q = -2; q <= 2; q++) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      cells.push({ x: w * (q + r / 2), y: 1.5 * HEX_R * r, ring });
    }
  }
  return cells;
}

/**
 * 施錠・解錠が成功した瞬間の演出。trigger が変わるたびに再生。
 *  unlock: 光のフラッシュ → シールドが砕けて外へ散る
 *  lock  : 外から六角形が集まって閉じる → 一瞬強く光ってバリア完成
 */
export function LockShield({ trigger, mode, top = "34%", caption = true }: { trigger: number; mode: "unlock" | "lock"; top?: string; caption?: boolean }) {
  const reduce = useReducedMotion();
  const cells = useMemo(hexCells, []);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!trigger || reduce) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(id);
  }, [trigger, reduce]);
  if (!show) return null;
  const c = mode === "unlock" ? "#34d399" : "#22d3ee";
  const d = hexPath(HEX_R - 1.2);
  return (
    <svg key={trigger} viewBox="-90 -90 180 180" className="pointer-events-none absolute left-1/2 z-20 h-56 w-56 -translate-x-1/2 -translate-y-1/2 overflow-visible" style={{ top }}>
      {/* フラッシュ */}
      <motion.circle r="60" fill={c} initial={{ opacity: 0.55, scale: 0.4 }} animate={{ opacity: 0, scale: 1.6 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: mode === "lock" ? 0.55 : 0 }} style={{ filter: "blur(10px)" }} />
      {cells.map((p, i) => {
        const ang = Math.atan2(p.y, p.x) || (i * 1.3);
        const far = 60 + p.ring * 25 + (i % 3) * 8;
        const out = { x: p.x + Math.cos(ang) * far, y: p.y + Math.sin(ang) * far };
        const spin = (i % 2 ? 1 : -1) * (90 + (i * 37) % 120);
        const delay = mode === "unlock" ? p.ring * 0.05 : (2 - p.ring) * 0.06;
        return (
          <motion.path key={i} d={d} fill={c} fillOpacity="0.14" stroke={c} strokeWidth="1.2"
            initial={mode === "unlock"
              ? { x: p.x, y: p.y, opacity: 0.95, rotate: 0, scale: 1 }
              : { x: out.x, y: out.y, opacity: 0, rotate: spin, scale: 0.4 }}
            animate={mode === "unlock"
              ? { x: out.x, y: out.y, opacity: 0, rotate: spin, scale: 0.5 }
              : { x: p.x, y: p.y, opacity: [0, 1, 1, 0], rotate: 0, scale: 1 }}
            transition={mode === "unlock"
              ? { duration: 0.9, delay: 0.1 + delay, ease: [0.2, 0.8, 0.3, 1] }
              : { duration: 1.3, delay, ease: [0.3, 0.7, 0.2, 1], opacity: { duration: 1.3, times: [0, 0.35, 0.75, 1], delay } }}
            style={{ transformBox: "fill-box", transformOrigin: "center", filter: `drop-shadow(0 0 3px ${c})` }} />
        );
      })}
      {/* 施錠: 完成時の外周リング */}
      {mode === "lock" && (
        <motion.circle r="78" fill="none" stroke={c} strokeWidth="2" strokeDasharray="6 5"
          initial={{ opacity: 0, rotate: -40 }} animate={{ opacity: [0, 1, 0], rotate: 40 }}
          transition={{ duration: 0.9, delay: 0.5 }} />
      )}
      {/* 解錠: ACCESS GRANTED / 施錠: SECURED */}
      {caption && (
      <motion.text x="0" y="-82" textAnchor="middle" fill={c} fontSize="9" letterSpacing="3" fontFamily="ui-monospace, monospace"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.3, delay: 0.25, times: [0, 0.2, 0.8, 1] }}>
        {mode === "unlock" ? "ACCESS GRANTED" : "PERIMETER SECURED"}
      </motion.text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 背景: ネットワーク (粒子が線でつながる)                                */
/* ------------------------------------------------------------------ */
export function NetworkField({ count = 26 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const resize = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, amber: Math.random() > 0.85,
    }));
    const LINK = 120;
    let raf = 0, last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33 || document.hidden) return; // 約 30fps
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dd = Math.hypot(a.x - b.x, a.y - b.y);
          if (dd < LINK) {
            ctx.strokeStyle = `rgba(34,211,238,${(1 - dd / LINK) * 0.35})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = p.amber ? "rgba(251,191,36,0.9)" : "rgba(165,243,252,0.9)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    };
    if (reduce) { last = -1e9; draw(1e9); cancelAnimationFrame(raf); }
    else raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [count]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-70" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* 背景: 3D の床グリッド + 光のすじ                                      */
/* ------------------------------------------------------------------ */
export function PerspectiveFloor() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] overflow-hidden [perspective:420px]" aria-hidden
      style={{ maskImage: "linear-gradient(to top, black 10%, transparent 95%)", WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 95%)" }}>
      <div className="anim-floor absolute inset-x-[-50%] bottom-[-10%] h-[160%] origin-bottom [transform:rotateX(68deg)]"
        style={{
          backgroundImage: "linear-gradient(rgba(34,211,238,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />
      <div className="absolute inset-x-0 bottom-[38%] h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
    </div>
  );
}

export function LightStreaks() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="anim-streak absolute h-px w-[45vw]"
          style={{
            top: `${18 + i * 27}%`, left: "-50vw",
            background: "linear-gradient(90deg, transparent, rgba(165,243,252,0.9), transparent)",
            animationDelay: `${i * 3.7}s`, animationDuration: `${9 + i * 2}s`,
          }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 常に動く HUD: ミニレーダー + ゲージ                                   */
/* ------------------------------------------------------------------ */
function Gauge({ label, value, text, color = "#22d3ee" }: { label: string; value: number; text: string; color?: string }) {
  const C = 2 * Math.PI * 16;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-12 w-12">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full rotate-[135deg]">
          <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="3" strokeDasharray={`${C * 0.75} ${C}`} strokeLinecap="round" />
          <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${v * C * 0.75} ${C}`} style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 3px ${color})` }} />
          <circle cx="20" cy="20" r="11" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.6" strokeDasharray="1 2.5"
            className="anim-spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-cyan-100">{text}</span>
      </div>
      <span className="mt-0.5 font-mono text-[7.5px] tracking-[0.2em] text-cyan-300/60">{label}</span>
    </div>
  );
}

export function TelemetryHud({ temp, checkOut, devices }: {
  temp: number | null; checkOut: string; devices: string[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const [link, setLink] = useState(4);
  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); setLink(3 + Math.round(Math.random() * 2)); }, 2500);
    return () => clearInterval(id);
  }, []);
  const hoursLeft = Math.max(0, (new Date(checkOut).getTime() - now) / 3600e3);
  // レーダーの点 (部屋の機器)。スイープが通るタイミングで光る
  const blips = devices.map((name, i) => {
    const ang = (i / Math.max(1, devices.length)) * 360 + 25;
    const r = 14 + ((i * 7) % 12);
    return { name, ang, r };
  });
  const SWEEP = 4; // 秒
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] px-3 py-2 backdrop-blur-md">
      {/* ミニレーダー */}
      <div className="relative h-[76px] w-[76px] shrink-0">
        <svg viewBox="-40 -40 80 80" className="absolute inset-0 h-full w-full">
          <circle r="36" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="0.8" />
          <circle r="24" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="0.6" />
          <circle r="12" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="0.6" />
          <line x1="-36" y1="0" x2="36" y2="0" stroke="#22d3ee" strokeOpacity="0.15" strokeWidth="0.5" />
          <line x1="0" y1="-36" x2="0" y2="36" stroke="#22d3ee" strokeOpacity="0.15" strokeWidth="0.5" />
          <g style={{ transformOrigin: "0 0", animation: `rx-rot ${SWEEP}s linear infinite` }}>
            <path d="M0 0 L0 -36 A36 36 0 0 1 25.5 -25.5 Z" fill="url(#radarSweep)" />
            <line x1="0" y1="0" x2="0" y2="-36" stroke="#a5f3fc" strokeWidth="0.8" />
          </g>
          <defs>
            <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {blips.map((b) => {
            const rad = ((b.ang - 90) * Math.PI) / 180;
            return (
              <circle key={b.name} cx={Math.cos(rad) * b.r} cy={Math.sin(rad) * b.r} r="1.8" fill="#34d399" className="tl-blip"
                style={{ animationDuration: `${SWEEP}s`, animationDelay: `${(b.ang / 360) * SWEEP}s` }} />
            );
          })}
          <circle r="1.5" fill="#e0fbff" />
        </svg>
      </div>
      {/* ゲージ */}
      <div className="grid flex-1 grid-cols-3">
        {temp != null ? (
          <Gauge label="EXT TEMP" value={(temp + 5) / 45} text={`${Math.round(temp)}°`} />
        ) : (
          <Gauge label="LOCAL" value={(new Date(now + 9 * 3600e3).getUTCHours() * 60 + new Date(now).getUTCMinutes()) / 1440}
            text={new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })} />
        )}
        <Gauge label="STAY" value={Math.min(1, hoursLeft / 24)} text={hoursLeft >= 24 ? `${Math.floor(hoursLeft / 24)}d` : `${Math.floor(hoursLeft)}h`} color="#fbbf24" />
        <div className="flex flex-col items-center">
          <div className="flex h-12 items-end gap-[3px] pb-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`w-1.5 rounded-sm transition-all duration-700 ${i < link ? "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-emerald-300/15"}`}
                style={{ height: `${8 + i * 6}px` }} />
            ))}
          </div>
          <span className="font-mono text-[7.5px] tracking-[0.2em] text-cyan-300/60">LINK</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ギャラクシーモード起動: ワープ → 銀河が渦を巻いて現れる (約 3 秒)       */
/* ------------------------------------------------------------------ */
/**
 * trigger が変わるたびに再生する全画面演出。
 *  0.0s 画面が暗転し中心が光る → 0.2〜1.7s 星が中心から放射状に流れるワープ →
 *  1.2〜2.8s 渦巻き銀河が回転しながら広がり「GALAXY MODE · ONLINE」→ フェードして星空へ。
 */
export function GalaxyLaunch({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!trigger || reduce) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 3700);
    return () => clearTimeout(id);
  }, [trigger, reduce]);

  // ワープ (canvas)
  useEffect(() => {
    if (!show) return;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2, cy = h / 2;
    const stars = Array.from({ length: 240 }, () => ({
      a: Math.random() * Math.PI * 2, r: Math.random() * 40, v: 0.6 + Math.random() * 2.2,
      c: Math.random() > 0.75 ? "240,171,252" : Math.random() > 0.5 ? "165,180,252" : "255,255,255",
    }));
    const t0 = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (t > 2.1) return;
      const speed = t < 0.2 ? 0 : Math.min(1, (t - 0.2) / 0.6) * (t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.6) : 1);
      const fade = t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.6) : 1;
      for (const s of stars) {
        const prev = s.r;
        s.r += s.v * (1 + s.r * 0.045) * speed * 6;
        const x1 = cx + Math.cos(s.a) * prev, y1 = cy + Math.sin(s.a) * prev;
        const x2 = cx + Math.cos(s.a) * s.r, y2 = cy + Math.sin(s.a) * s.r;
        ctx.strokeStyle = `rgba(${s.c},${0.85 * fade})`;
        ctx.lineWidth = Math.min(2.4, 0.6 + s.r / 220);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (s.r > Math.hypot(w, h)) { s.r = Math.random() * 30; }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  // 渦巻き銀河の粒 (対数らせん 3 本)
  const arms = useMemo(() => {
    const pts: { x: number; y: number; r: number; c: string }[] = [];
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 70; i++) {
        const t = i / 70;
        const ang = arm * ((Math.PI * 2) / 3) + t * Math.PI * 3.2;
        const rad = 6 + t * 88;
        const jitter = (Math.sin(i * 12.9898 + arm * 78.233) * 43758.5453) % 1;
        pts.push({
          x: Math.cos(ang) * rad + jitter * 6, y: Math.sin(ang) * rad * 0.62 + jitter * 4,
          r: 0.6 + (1 - t) * 1.6, c: t < 0.3 ? "#fdf4ff" : arm === 1 ? "#f0abfc" : arm === 2 ? "#a5b4fc" : "#c4b5fd",
        });
      }
    }
    return pts;
  }, []);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {/* 暗転 */}
      <motion.div className="absolute inset-0 bg-[#05020f]"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.94, 0.94, 0] }} transition={{ duration: 3.6, times: [0, 0.07, 0.82, 1] }} />
      {/* 中心のフラッシュ */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div className="h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95), rgba(192,132,252,0.6) 35%, transparent 70%)" }}
          initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.4, 0.6], opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
      </div>
      {/* ワープ */}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {/* 渦巻き銀河 */}
      <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.25, rotate: -120 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.25, 1, 1.12, 1.6], rotate: [-120, 0, 35, 60] }}
        transition={{ duration: 2.5, delay: 1.0, times: [0, 0.35, 0.8, 1], ease: "easeOut" }}>
        <svg viewBox="-110 -80 220 160" className="h-[46vh] w-[92vw] max-w-[520px] overflow-visible">
          <defs>
            <radialGradient id="glxCore">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f5d0fe" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="0" cy="0" rx="70" ry="44" fill="#7c3aed" opacity="0.18" style={{ filter: "blur(12px)" }} />
          {arms.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} style={{ filter: `drop-shadow(0 0 2px ${p.c})` }} />
          ))}
          <circle r="16" fill="url(#glxCore)" />
          {/* HUD リング */}
          <ellipse cx="0" cy="0" rx="100" ry="64" fill="none" stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.6" strokeDasharray="2 5" />
          <ellipse cx="0" cy="0" rx="92" ry="58" fill="none" stroke="#f0abfc" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="30 12" />
        </svg>
      </motion.div>
      </div>
      {/* ホログラム文字 */}
      <motion.div className="absolute inset-x-0 top-[68%] text-center font-mono"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: [0, 1, 1, 0], y: 0 }}
        transition={{ duration: 2.3, delay: 1.2, times: [0, 0.18, 0.82, 1] }}>
        <p className="text-[15px] tracking-[0.55em] text-violet-100 drop-shadow-[0_0_10px_rgba(192,132,252,0.95)]">GALAXY MODE</p>
        <p className="mt-2 text-[9px] tracking-[0.4em] text-fuchsia-200/80">STARFIELD PROJECTION · ONLINE</p>
        <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
      </motion.div>
    </div>
  );
}
