"use client";

/**
 * 高精細アークリアクター (ハイテクUI / 読み込み画面 / 起動演出で共通)。
 *   外周ベゼル・目盛り・データアーク・10個のコイル (光が周回)・逆回転する三角コア・
 *   プラズマコア (脈動 + 渦)・周回する粒子・衝撃波リング・レンズフレア・充電ゲージ。
 *   すべて SVG + CSS アニメ (JS のフレーム処理なし) なのでスマホでも軽い。
 *   prefers-reduced-motion のときは静止表示。
 */
import { useId } from "react";

type Props = {
  /** 表示サイズ (px) */
  size?: number;
  /** 稼働中 (回転が速く、光が強くなる) */
  active?: boolean;
  /** 充電ゲージ 0〜1 (null なら表示しない) */
  progress?: number | null;
  /** メインの色 */
  color?: string;
  /** 差し色 */
  accent?: string;
  className?: string;
};

// 回転の中心は常にリアクターの中心 (100,100)。
// fill-box (図形の外接矩形の中心) だと三角形のように上下非対称な図形がずれて回るため view-box 基準にする。
const PIVOT: React.CSSProperties = { transformBox: "view-box", transformOrigin: "100px 100px" };

export default function ArcReactorX({
  size = 160, active = false, progress = null, color = "#22d3ee", accent = "#fbbf24", className = "",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const k = active ? 0.55 : 1; // 回転の速さ (小さいほど速い)
  const spin = (sec: number, rev = false): React.CSSProperties => ({
    ...PIVOT, animation: `${rev ? "rx-rot-rev" : "rx-rot"} ${sec * k}s linear infinite`,
  });
  const small = size < 70; // ヘッダー用の小さい表示は細部を省略

  // 10 個のコイル (台形)
  const coils = Array.from({ length: 10 }, (_, i) => i);
  const coil = "M92 30 L108 30 L112 48 L88 48 Z";
  const C = 2 * Math.PI * 84; // 充電ゲージの円周

  return (
    <div className={`rx-root relative shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
      {/* 背後の発光 */}
      <div className="rx-glow absolute inset-[12%] rounded-full"
        style={{ background: `radial-gradient(circle, ${color}${active ? "aa" : "66"} 0%, transparent 70%)`, animationDuration: `${2.2 * k}s` }} />

      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`core${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e0fbff" />
            <stop offset="65%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`coil${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6fbff" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`flare${uid}`} x1="0" x2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`blur${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* 衝撃波リング */}
        {!small && [0, 1].map((i) => (
          <circle key={`w${i}`} cx="100" cy="100" r="70" fill="none" stroke={color} strokeWidth="1.2"
            className="rx-wave" style={{ ...PIVOT, animationDuration: `${2.8 * k}s`, animationDelay: `${i * 1.4 * k}s` }} />
        ))}

        {/* 外周ベゼル + 切り欠き */}
        <circle cx="100" cy="100" r="96" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1" />
        {!small && [45, 135, 225, 315].map((a) => (
          <rect key={a} x="97" y="1" width="6" height="7" rx="1" fill={color} fillOpacity="0.7" transform={`rotate(${a} 100 100)`} />
        ))}

        {/* 目盛りリング */}
        <g style={spin(40)}>
          {Array.from({ length: small ? 24 : 72 }, (_, i) => {
            const n = small ? 24 : 72;
            const long = i % (small ? 3 : 6) === 0;
            return (
              <line key={i} x1="100" y1="7" x2="100" y2={long ? 15 : 11} stroke={color}
                strokeOpacity={long ? 0.75 : 0.3} strokeWidth={long ? 1.4 : 0.8} transform={`rotate(${(i / n) * 360} 100 100)`} />
            );
          })}
        </g>

        {/* データアーク (逆回転) */}
        <g style={spin(14, true)}>
          <circle cx="100" cy="100" r="80" fill="none" stroke={color} strokeOpacity="0.8" strokeWidth="2.5"
            strokeDasharray="70 18 12 18 40 345" strokeLinecap="round" />
          <circle cx="100" cy="100" r="80" fill="none" stroke={accent} strokeOpacity="0.85" strokeWidth="2.5"
            strokeDasharray="16 486" strokeDashoffset="-250" strokeLinecap="round" />
        </g>

        {/* 充電ゲージ */}
        {progress !== null && (
          <circle cx="100" cy="100" r="84" fill="none" stroke="#a5f3fc" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${Math.max(0, Math.min(1, progress)) * C} ${C}`} transform="rotate(-90 100 100)"
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dasharray 0.25s linear" }} />
        )}

        {/* コイル: ゆっくり回りながら光が周回 */}
        <g style={spin(30)}>
          <circle cx="100" cy="100" r="72" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1" />
          {coils.map((i) => (
            <g key={i} transform={`rotate(${i * 36} 100 100)`}>
              <path d={coil} fill={`url(#coil${uid})`} stroke={color} strokeWidth="0.8"
                className="rx-coil" style={{ animationDuration: `${1.3 * k}s`, animationDelay: `${(i * 1.3 * k) / 10}s` }} />
              {!small && <line x1="100" y1="33" x2="100" y2="45" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.6" />}
            </g>
          ))}
          <circle cx="100" cy="100" r="50" fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="2" />
        </g>

        {/* 周回する粒子 */}
        {!small && [
          { r: 42, d: 3.2, c: "#ffffff" }, { r: 60, d: 4.8, c: color }, { r: 76, d: 6.5, c: accent },
        ].map((o, i) => (
          <g key={`o${i}`} style={spin(o.d, i === 1)}>
            <circle cx="100" cy={100 - o.r} r="2.2" fill={o.c} style={{ filter: `drop-shadow(0 0 4px ${o.c})` }} />
          </g>
        ))}

        {/* 三角コア (逆回転) */}
        <g style={spin(20, true)}>
          <polygon points="100,58 136.4,121 63.6,121" fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="2.2" strokeLinejoin="round" />
          <polygon points="100,70 126,115 74,115" fill={color} fillOpacity={active ? 0.35 : 0.2} stroke="#e0fbff" strokeOpacity="0.6" strokeWidth="0.8" />
          {!small && <polygon points="100,82 110,99 100,116 90,99" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.8" />}
        </g>

        {/* プラズマコア: 渦 + 脈動 */}
        <g filter={small ? undefined : `url(#blur${uid})`}>
          <circle cx="100" cy="100" r="26" fill="none" stroke="#e0fbff" strokeOpacity="0.7" strokeWidth="5"
            strokeDasharray="20 14 8 22" style={spin(1.6)} />
        </g>
        <circle cx="100" cy="100" r="30" fill={`url(#core${uid})`} className="rx-pulse"
          style={{ ...PIVOT, animationDuration: `${1.8 * k}s` }} />
        <circle cx="100" cy="100" r="7" fill="#ffffff" />

        {/* レンズフレア */}
        {!small && (
          <rect x="20" y="99" width="160" height="2" fill={`url(#flare${uid})`} className="rx-flare"
            style={{ ...PIVOT, animationDuration: `${3.2 * k}s` }} />
        )}
      </svg>
    </div>
  );
}
