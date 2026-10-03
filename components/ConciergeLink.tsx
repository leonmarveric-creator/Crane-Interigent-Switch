/**
 * 「Crane Nest コンシェルジュ」(ゲスト用ガイド /g/[部屋]) へのボタン。
 *   エントランスの鍵 (/key) と お部屋の操作 (/room) の画面の左下に出す。
 *   周辺マップ・使い方・ごはんガチャなど、これから増えるサービスの入口。部屋が分からないときは共用のガイドへ
 */
const LABEL: Record<string, [string, string]> = {
  ja: ["コンシェルジュ", "周辺マップ・使い方・サービス"],
  en: ["Concierge", "Map · guides · services"],
  zh: ["礼宾服务", "周边地图・使用说明・服务"],
  "zh-TW": ["禮賓服務", "周邊地圖・使用說明・服務"],
  ko: ["컨시어지", "주변 지도・이용 안내・서비스"],
};
export default function ConciergeLink({ room, lang }: { room: string | null; lang: string }) {
  const [t, s] = LABEL[lang] ?? LABEL.en;
  return (
    <a href={`/g/${encodeURIComponent(room || "lounge")}`} aria-label={t}
      style={{ position: "fixed", left: "max(12px, env(safe-area-inset-left))", bottom: "max(12px, env(safe-area-inset-bottom))", zIndex: 60, display: "flex", alignItems: "center", gap: 10,
        padding: "9px 16px 9px 11px", borderRadius: 999, textDecoration: "none", color: "#eaf6ff", background: "rgba(10,22,40,.88)", border: "1px solid rgba(120,200,255,.55)",
        boxShadow: "0 6px 20px rgba(0,0,0,.35), 0 0 14px rgba(95,208,255,.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontFamily: "system-ui, 'Hiragino Sans', sans-serif" }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>🛎</span>
      <span style={{ display: "block", lineHeight: 1.2 }}>
        <b style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{t} ›</b>
        <small style={{ display: "block", fontSize: 10.5, opacity: 0.8 }}>{s}</small>
      </span>
    </a>
  );
}
