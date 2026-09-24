"use client";

/**
 * ハイテクUI の追加エフェクト集。
 *  - CommandBeamLayer : ボタンを押すと、リアクターからそのボタンへ光線 → 粒子が弾ける → 「CMD ▸ SENT」
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
/* ボタン → 光線                                                        */
/* ------------------------------------------------------------------ */
type Beam = { id: number; x1: number; y1: number; x2: number; y2: number; code: string };

/**
 * main 要素内でボタンが押されたら、source (リアクター) からボタンの中心へ光線を飛ばす。
 * 画面全体に重ねる固定レイヤー。
 */
export function CommandBeamLayer({ sourceRef, containerRef }: {
  sourceRef: React.RefObject<HTMLElement>; containerRef: React.RefObject<HTMLElement>;
}) {
  const reduce = useReducedMotion();
  const [beams, setBeams] = useState<Beam[]>([]);
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reduce) return;
    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest?.("button, [role=button], a");
      const src = sourceRef.current;
      if (!btn || !src || (btn as HTMLButtonElement).disabled || src.contains(btn)) return;
      const a = src.getBoundingClientRect(), b = btn.getBoundingClientRect();
      const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
      const x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
      if (Math.hypot(x2 - x1, y2 - y1) < 90) return; // すぐ近くのボタン (ヘッダー) は省略
      const id = Date.now() + Math.random();
      const code = "0x" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0").toUpperCase();
      setBeams((bs) => [...bs.slice(-2), { id, x1, y1, x2, y2, code }]);
      setTimeout(() => setBeams((bs) => bs.filter((x) => x.id !== id)), 1600);
    };
    root.addEventListener("pointerdown", onDown, { passive: true });
    return () => root.removeEventListener("pointerdown", onDown);
  }, [sourceRef, containerRef, reduce]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#e0fbff" stopOpacity="1" />
          </linearGradient>
        </defs>
        <AnimatePresence>
          {beams.map((b) => {
            const mx = (b.x1 + b.x2) / 2 + (b.y2 - b.y1) * 0.18;
            const my = (b.y1 + b.y2) / 2 - (b.x2 - b.x1) * 0.18;
            const d = `M${b.x1} ${b.y1} Q${mx} ${my} ${b.x2} ${b.y2}`;
            return (
              <g key={b.id}>
                {/* 太い外光 */}
                <motion.path d={d} fill="none" stroke="#22d3ee" strokeWidth="8" strokeLinecap="round"
                  style={{ filter: "blur(5px)" }}
                  initial={{ pathLength: 0, opacity: 0.6 }} animate={{ pathLength: 1, opacity: [0.6, 0.6, 0] }}
                  transition={{ duration: 1.1, times: [0, 0.55, 1], ease: "easeOut" }} />
                {/* 芯 */}
                <motion.path d={d} fill="none" stroke="url(#beamGrad)" strokeWidth="2.6" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                  transition={{ duration: 1.1, times: [0, 0.55, 1], ease: "easeOut" }} />
                {/* 光線の先頭を走る光の玉 (曲線上の点をたどる) */}
                {(() => {
                  const pts = Array.from({ length: 9 }, (_, k) => {
                    const t = k / 8, u = 1 - t;
                    return { x: u * u * b.x1 + 2 * u * t * mx + t * t * b.x2, y: u * u * b.y1 + 2 * u * t * my + t * t * b.y2 };
                  });
                  return (
                    <motion.circle r="4" fill="#ffffff" style={{ filter: "drop-shadow(0 0 6px #67e8f9)" }}
                      initial={{ cx: b.x1, cy: b.y1, opacity: 1 }}
                      animate={{ cx: pts.map((q) => q.x), cy: pts.map((q) => q.y), opacity: [1, 1, 1, 1, 1, 1, 1, 1, 0] }}
                      transition={{ duration: 0.45, ease: "easeIn" }} />
                  );
                })()}
                {/* 着弾リング */}
                <motion.circle cx={b.x2} cy={b.y2} fill="none" stroke="#a5f3fc" strokeWidth="1.5"
                  initial={{ r: 2, opacity: 0 }} animate={{ r: [2, 34], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }} />
                {/* 粒子 */}
                {Array.from({ length: 10 }, (_, i) => {
                  const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
                  const dist = 26 + Math.random() * 26;
                  return (
                    <motion.circle key={i} cx={b.x2} cy={b.y2} r="1.6" fill="#e0fbff"
                      initial={{ x: 0, y: 0, opacity: 0 }}
                      animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: [0, 1, 0] }}
                      transition={{ duration: 0.6, delay: 0.32, ease: "easeOut" }} />
                  );
                })}
                {/* ホログラムのラベル */}
                <motion.text x={b.x2 + 14} y={b.y2 - 16} fill="#67e8f9" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="2"
                  initial={{ opacity: 0, x: b.x2 + 6 }} animate={{ opacity: [0, 1, 1, 0], x: b.x2 + 14 }}
                  transition={{ duration: 1.1, delay: 0.35, times: [0, 0.15, 0.75, 1] }}>
                  CMD {b.code} ▸ SENT
                </motion.text>
              </g>
            );
          })}
        </AnimatePresence>
      </svg>
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
export function LockShield({ trigger, mode }: { trigger: number; mode: "unlock" | "lock" }) {
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
    <svg key={trigger} viewBox="-90 -90 180 180" className="pointer-events-none absolute left-1/2 top-[34%] z-20 h-56 w-56 -translate-x-1/2 -translate-y-1/2 overflow-visible">
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
      <motion.text x="0" y="-82" textAnchor="middle" fill={c} fontSize="9" letterSpacing="3" fontFamily="ui-monospace, monospace"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.3, delay: 0.25, times: [0, 0.2, 0.8, 1] }}>
        {mode === "unlock" ? "ACCESS GRANTED" : "PERIMETER SECURED"}
      </motion.text>
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
