/** 部屋の名前 (春・夏・秋・冬) → 和風のウェルカム映像の季節 (花びら・葉・雪)。分からなければ null (日付で決める) */
export function seasonOf(name: string | null | undefined): string | null {
  const s = String(name ?? "");
  if (s.includes("春")) return "haru";
  if (s.includes("夏")) return "natsu";
  if (s.includes("秋")) return "aki";
  if (s.includes("冬")) return "fuyu";
  return null;
}
