/**
 * チェックアウト済みのお部屋の操作画面 (ゲストがチェックアウトボタンで退室したあと)。
 *   電気・エアコン・鍵の操作はもうできない。コンシェルジュ (地図・送迎) への入口だけ出す。
 */
import { CO_T, coLang } from "@/lib/checkoutText";

export default function CheckedOutScreen({ roomSlug, roomName, lang, at }: { roomSlug: string; roomName: string; lang: string; at: string }) {
  const L = coLang(lang), t = CO_T[L];
  let when = "";
  try {
    when = new Date(at).toLocaleString(L === "zh" ? "zh-CN" : L, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
  } catch { /* noop */ }
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_-10%,#0f2440,#04060c_60%)] px-6 text-center text-[#eaf3ff]">
      <p className="text-[12px] tracking-[0.18em] text-[#8fa6c2]">CRANE NEST · {roomName}</p>
      <div className="mx-auto mb-5 mt-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#46e08a] bg-[#46e08a]/10 text-[46px] text-[#46e08a]">✓</div>
      <h1 className="text-[24px] font-bold">{t.doneT}</h1>
      <p className="mt-1 text-[12.5px] text-[#8fa6c2]">{when}</p>
      <p className="mx-auto mt-4 max-w-sm text-[14px] leading-relaxed text-[#c4d4ea]">{t.doneP}</p>
      <a href={`/g/${encodeURIComponent(roomSlug)}?lang=${L}`}
        className="mt-8 block w-full max-w-sm rounded-2xl border border-[#5fe3ff] px-4 py-3.5 text-[15px] font-semibold text-[#5fe3ff] no-underline">
        🛎 {t.toConcierge}
      </a>
    </main>
  );
}
