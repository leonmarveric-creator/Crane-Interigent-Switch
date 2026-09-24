/**
 * ゲストのスマホの言語設定 (Accept-Language ヘッダー) から、最初に表示する言語を決める。
 *   例: "ko-KR,ko;q=0.9,en-US;q=0.8" → ko
 *   優先順: ?lang= → スマホの言語設定 → 予約の言語 → 英語 (各ページで使用)
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/** 部屋の操作画面 (ja / en / zh / ko)。対応していない言語だけなら null。 */
export function roomLangFromHeader(header: string | null | undefined): "ja" | "en" | "zh" | "ko" | null {
  for (const tag of parseAcceptLanguage(header)) {
    const base = tag.split("-")[0];
    if (base === "ja" || base === "en" || base === "zh" || base === "ko") return base;
  }
  return null;
}

/** スマートキー画面 (ja / en / zh-TW / zh / ko)。繁体字 (台湾・香港・マカオ) は zh-TW。 */
export function keyLangFromHeader(header: string | null | undefined): "ja" | "en" | "zh-TW" | "zh" | "ko" | null {
  for (const tag of parseAcceptLanguage(header)) {
    const base = tag.split("-")[0];
    if (base === "zh") return /-(tw|hk|mo|hant)\b/.test(tag) ? "zh-TW" : "zh";
    if (base === "ja" || base === "en" || base === "ko") return base;
  }
  return null;
}
