"use client";

/**
 * 隠しコマンドの画面演出 (音声コントロールから呼ぶ)。
 *   画面全体に重ねるが、タッチは下のボタンに通す (pointer-events: none)。
 *   深呼吸だけは「閉じる」ボタンを出す。
 *   粒の位置や大きさは最初に 1 回だけ決める (再描画でちらつかないように)。
 */
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export type ScreenFx = "sakura" | "fireworks" | "momiji" | "snow" | "aurora" | "shooting_star" | "birthday" | "party" | "countdown" | "breathe";

/** 演出の長さ (ms)。光の演出はこれより長く続くこともある */
export const SCREEN_FX_MS: Record<ScreenFx, number> = {
  sakura: 14000, fireworks: 14000, momiji: 14000, snow: 14000, aurora: 16000,
  shooting_star: 7000, birthday: 11000, party: 14000, countdown: 4200, breathe: 60000,
};

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export default function FxOverlay({ fx, n, texts, onDone }: {
  fx: ScreenFx; n: number;
  texts: { inhale: string; exhale: string; breatheDone: string; party: string; aurora: string; wish: string; birthday: string };
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, SCREEN_FX_MS[fx]);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, n]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[64] overflow-hidden font-sans tracking-normal" aria-hidden={fx !== "breathe"}>
      {fx === "sakura" || fx === "momiji" || fx === "snow" ? <Falling kind={fx} n={n} /> : null}
      {fx === "fireworks" && <Fireworks n={n} />}
      {fx === "aurora" && <Aurora label={texts.aurora} />}
      {fx === "shooting_star" && <ShootingStars n={n} label={texts.wish} />}
      {fx === "birthday" && <Birthday n={n} label={texts.birthday} />}
      {fx === "party" && <Party n={n} label={texts.party} />}
      {fx === "countdown" && <Countdown />}
      {fx === "breathe" && <Breathe texts={texts} onClose={onDone} />}
      <style>{`
        @keyframes fxFall { 0% { transform: translate3d(0,-10vh,0) rotate(0deg); opacity: 0 } 8% { opacity: 1 } 100% { transform: translate3d(var(--dx),110vh,0) rotate(var(--rot)); opacity: 0.9 } }
        @keyframes fxSway { 0%,100% { margin-left: 0 } 50% { margin-left: 26px } }
        @keyframes fxBurst { 0% { transform: translate(0,0) scale(0.4); opacity: 1 } 70% { opacity: 1 } 100% { transform: translate(var(--tx),var(--ty)) scale(1); opacity: 0 } }
        @keyframes fxFlash { 0% { opacity: 0; transform: scale(0.2) } 15% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1.4) } }
        @keyframes fxAurora { 0% { transform: translateX(-12%) skewX(-8deg); opacity: 0 } 15% { opacity: 0.85 } 50% { transform: translateX(10%) skewX(6deg) } 85% { opacity: 0.8 } 100% { transform: translateX(-6%) skewX(-4deg); opacity: 0 } }
        @keyframes fxStar { 0% { transform: translate3d(0,0,0) rotate(-35deg); opacity: 0 } 10% { opacity: 1 } 100% { transform: translate3d(-70vw,48vw,0) rotate(-35deg); opacity: 0 } }
        @keyframes fxRise { 0% { transform: translateY(0) rotate(0) } 100% { transform: translateY(-115vh) rotate(var(--rot)) } }
        @keyframes fxWash { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
        @keyframes fxTitle { 0% { opacity: 0; transform: scale(0.7) } 12% { opacity: 1; transform: scale(1.05) } 20% { transform: scale(1) } 85% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes fxCount { 0% { opacity: 0; transform: scale(2.2) } 20% { opacity: 1; transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0; transform: scale(0.6) } }
        @keyframes fxLaunch { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .fx-anim { animation-duration: 0.01s !important; animation-iteration-count: 1 !important } }
      `}</style>
    </div>
  );
}

/** 桜の花びら / 紅葉 / 雪 が上から舞い落ちる */
function Falling({ kind, n }: { kind: "sakura" | "momiji" | "snow"; n: number }) {
  const items = useMemo(() => Array.from({ length: kind === "snow" ? 46 : 32 }, (_, i) => {
    const r = (k: number) => rand(n + i * 7 + k);
    return { left: r(1) * 100, delay: r(2) * 7, dur: 6 + r(3) * 5, size: kind === "snow" ? 4 + r(4) * 7 : 12 + r(4) * 14, dx: (r(5) - 0.5) * 120, rot: (r(6) - 0.5) * 720, hue: r(7) };
  }), [kind, n]);
  return (
    <>
      {kind === "sakura" && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,170,205,0.18),transparent_65%)]" />}
      {kind === "momiji" && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,110,40,0.16),transparent_65%)]" />}
      {kind === "snow" && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,225,255,0.18),transparent_70%)]" />}
      {items.map((p, i) => (
        <span key={i} className="fx-anim absolute top-0" style={{
          left: `${p.left}%`, width: p.size, height: p.size,
          animation: `fxFall ${p.dur}s linear ${p.delay}s both, fxSway ${2 + p.hue * 2}s ease-in-out ${p.delay}s infinite`,
          ["--dx" as any]: `${p.dx}px`, ["--rot" as any]: `${p.rot}deg`,
        }}>
          {kind === "snow" ? (
            <span className="block h-full w-full rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          ) : kind === "sakura" ? (
            <svg viewBox="0 0 20 20" className="h-full w-full"><path d="M10 1 C15 5 17 12 10 19 C3 12 5 5 10 1 Z M10 1 L10 5" fill={p.hue > 0.5 ? "#ffc4dc" : "#ffa9cb"} stroke="#ff8fb8" strokeWidth="0.6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-full w-full"><path d="M12 1 L14 8 L21 6 L16 12 L22 16 L14 15 L12 23 L10 15 L2 16 L8 12 L3 6 L10 8 Z" fill={p.hue > 0.6 ? "#ff4a1c" : p.hue > 0.3 ? "#ff8a00" : "#d8261a"} /></svg>
          )}
        </span>
      ))}
    </>
  );
}

/** 花火: 画面のあちこちで光の粒がはじける */
function Fireworks({ n }: { n: number }) {
  const bursts = useMemo(() => Array.from({ length: 9 }, (_, b) => {
    const r = (k: number) => rand(n + b * 13 + k);
    const colors = ["#ff4d4d", "#4d8dff", "#ffd23f", "#c04dff", "#3dffa0", "#ff8a1c", "#ff5fc8", "#5fe0ff"];
    return { x: 12 + r(1) * 76, y: 12 + r(2) * 45, delay: b * 1.3 + r(3) * 0.6, color: colors[b % colors.length] };
  }), [n]);
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-[#020418]/40 to-transparent" />
      {bursts.map((b, i) => (
        <div key={i} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          <span className="fx-anim absolute -left-10 -top-10 h-20 w-20 rounded-full" style={{ background: `radial-gradient(circle, ${b.color}88, transparent 70%)`, animation: `fxFlash 1.6s ease-out ${b.delay}s both` }} />
          {Array.from({ length: 18 }, (_, k) => {
            const a = (k / 18) * Math.PI * 2;
            const d = 70 + rand(n + i * 31 + k) * 40;
            return <span key={k} className="fx-anim absolute h-[5px] w-[5px] rounded-full" style={{
              background: b.color, boxShadow: `0 0 8px ${b.color}`,
              ["--tx" as any]: `${Math.cos(a) * d}px`, ["--ty" as any]: `${Math.sin(a) * d + 20}px`,
              animation: `fxBurst 1.8s cubic-bezier(.1,.7,.3,1) ${b.delay}s both`,
            }} />;
          })}
        </div>
      ))}
    </>
  );
}

/** オーロラ: 緑と紫の光のカーテンが揺れる */
function Aurora({ label }: { label: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-[#010814]/35" />
      {[
        { c: "rgba(60,255,160,0.55)", top: "4%", d: 0 },
        { c: "rgba(40,200,220,0.45)", top: "14%", d: 1.2 },
        { c: "rgba(160,90,255,0.45)", top: "24%", d: 2.2 },
      ].map((b, i) => (
        <div key={i} className="fx-anim absolute -left-[20%] h-[38vh] w-[140%] blur-2xl"
          style={{ top: b.top, background: `linear-gradient(180deg, transparent, ${b.c} 45%, transparent)`, borderRadius: "50%", animation: `fxAurora 14s ease-in-out ${b.d}s both` }} />
      ))}
      <p className="fx-anim absolute inset-x-0 top-[42%] text-center font-mono text-[22px] tracking-[0.6em] text-emerald-100/90 [text-shadow:0_0_18px_rgba(60,255,160,0.8)]" style={{ animation: "fxTitle 6s ease-out 0.4s both" }}>{label}</p>
    </>
  );
}

/** 流れ星: 右上から左下へいくつか流れる */
function ShootingStars({ n, label }: { n: number; label: string }) {
  const stars = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ top: rand(n + i) * 35, left: 55 + rand(n + i + 9) * 50, delay: i * 0.8 + rand(n + i + 4) * 0.5 })), [n]);
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-[#020418]/55 to-transparent" />
      {stars.map((s, i) => (
        <span key={i} className="fx-anim absolute h-[2px] w-[140px] rounded-full"
          style={{ top: `${s.top}%`, left: `${s.left}%`, background: "linear-gradient(90deg, #fff, rgba(160,220,255,0.6) 30%, transparent)", boxShadow: "0 0 10px #bfe6ff", animation: `fxStar 1.6s ease-in ${s.delay}s both` }} />
      ))}
      <p className="fx-anim absolute inset-x-0 top-[44%] text-center text-[20px] font-semibold text-white [text-shadow:0_0_16px_rgba(160,220,255,0.9)]" style={{ animation: "fxTitle 5.5s ease-out 0.6s both" }}>✦ {label} ✦</p>
    </>
  );
}

/** ハッピーバースデー: 紙吹雪と風船 */
function Birthday({ n, label }: { n: number; label: string }) {
  const pieces = useMemo(() => Array.from({ length: 44 }, (_, i) => ({ left: rand(n + i) * 100, delay: rand(n + i + 3) * 3, dur: 4 + rand(n + i + 5) * 3, color: ["#ff5f7e", "#ffd23f", "#4dd0ff", "#7cff8a", "#c77dff"][i % 5], rot: (rand(n + i + 8) - 0.5) * 900, dx: (rand(n + i + 2) - 0.5) * 80 })), [n]);
  const balloons = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ left: 5 + i * 14 + rand(n + i) * 6, delay: rand(n + i + 11) * 2.5, color: ["#ff5f7e", "#ffd23f", "#4dd0ff", "#c77dff", "#7cff8a", "#ff8a3d", "#ff7fd0"][i] })), [n]);
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i} className="fx-anim absolute top-0 h-[10px] w-[6px]" style={{ left: `${p.left}%`, background: p.color, animation: `fxFall ${p.dur}s linear ${p.delay}s both`, ["--dx" as any]: `${p.dx}px`, ["--rot" as any]: `${p.rot}deg` }} />
      ))}
      {balloons.map((b, i) => (
        <span key={i} className="fx-anim absolute bottom-[-90px]" style={{ left: `${b.left}%`, animation: `fxRise 8s ease-in ${b.delay}s both`, ["--rot" as any]: `${(i % 2 ? 1 : -1) * 8}deg` }}>
          <span className="block h-[62px] w-[48px] rounded-[50%] shadow-[inset_-6px_-8px_0_rgba(0,0,0,0.15)]" style={{ background: b.color }} />
          <span className="mx-auto block h-[36px] w-px bg-white/60" />
        </span>
      ))}
      {label && <p className="fx-anim absolute inset-x-0 top-[38%] text-center text-[34px] font-bold text-white [text-shadow:0_0_20px_rgba(255,120,170,0.9)]" style={{ animation: "fxTitle 9s ease-out 0.3s both", fontFamily: "Georgia, serif" }}>🎂 {label}</p>}
    </>
  );
}

/** パーティー: 虹色の光が流れ、紙吹雪が降る */
function Party({ n, label }: { n: number; label: string }) {
  return (
    <>
      <div className="fx-anim absolute inset-0 opacity-30 mix-blend-screen" style={{ background: "linear-gradient(90deg,#ff3b3b,#ff9f1c,#ffe53b,#3bff6f,#3bd8ff,#6b5bff,#e43bff,#ff3b3b)", backgroundSize: "300% 100%", animation: "fxWash 3s linear infinite" }} />
      <Birthday n={n} label="" />
      <p className="fx-anim absolute inset-x-0 top-[40%] text-center font-mono text-[30px] font-bold tracking-[0.3em] text-white [text-shadow:0_0_22px_rgba(255,80,200,0.9)]" style={{ animation: "fxTitle 7s ease-out 0.2s both" }}>{label}</p>
    </>
  );
}

/** 発射: 3 → 2 → 1 → 光 */
function Countdown() {
  return (
    <>
      <div className="absolute inset-0 bg-[#01030a]/60" />
      {["3", "2", "1"].map((d, i) => (
        <p key={d} className="fx-anim absolute inset-x-0 top-[34%] text-center font-mono text-[120px] font-bold leading-none text-cyan-100 [text-shadow:0_0_30px_rgba(34,211,238,0.9)]"
          style={{ animation: `fxCount 1s ease-out ${i * 1}s both` }}>{d}</p>
      ))}
      <div className="fx-anim absolute inset-0 bg-[radial-gradient(circle,rgba(200,245,255,0.95),rgba(34,211,238,0.35)_40%,transparent_70%)]" style={{ animation: "fxLaunch 1.1s ease-out 3s both" }} />
    </>
  );
}

/** 深呼吸: 円が 4 秒で大きく (吸って)、4 秒で小さく (吐いて)。1 分 */
function Breathe({ texts, onClose }: { texts: { inhale: string; exhale: string; breatheDone: string }; onClose: () => void }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT(Date.now() - start), 250);
    return () => clearInterval(id);
  }, []);
  const done = t >= 56000;
  const inhale = Math.floor(t / 4000) % 2 === 0;
  const left = Math.max(0, Math.ceil((60000 - t) / 1000));
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/80 backdrop-blur-sm">
      <button type="button" onClick={onClose} aria-label="close"
        className="pointer-events-auto absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 active:bg-white/10"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}>
        <X className="h-5 w-5" />
      </button>
      <div className="relative flex h-64 w-64 items-center justify-center">
        <span className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,214,150,0.55),rgba(255,160,90,0.15)_60%,transparent)]"
          style={{ width: done ? 140 : inhale ? 250 : 110, height: done ? 140 : inhale ? 250 : 110, transition: "width 4s ease-in-out, height 4s ease-in-out" }} />
        <span className="absolute rounded-full border border-amber-100/40"
          style={{ width: done ? 150 : inhale ? 260 : 120, height: done ? 150 : inhale ? 260 : 120, transition: "width 4s ease-in-out, height 4s ease-in-out" }} />
        <p className="relative text-[24px] font-semibold text-amber-50">{done ? texts.breatheDone : inhale ? texts.inhale : texts.exhale}</p>
      </div>
      <p className="mt-6 font-mono text-[13px] tracking-[0.3em] text-amber-100/60">{left}s</p>
    </div>
  );
}
