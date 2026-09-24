/**
 * ゲストが画面で選んだ言語を覚えておく (この端末の Cookie・60 日)。
 * 次に開いたときも、部屋画面・鍵画面は選んだ言語で表示される。
 * サーバ側 (各ページ) で読むので、画面のちらつきもない。
 */
export const LANG_COOKIE = "guest_lang";

/** ブラウザで呼ぶ: 選んだ言語を保存。 */
export function rememberLang(lang: string) {
  try {
    document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; path=/; max-age=${60 * 24 * 3600}; SameSite=Lax`;
  } catch { /* noop */ }
}
