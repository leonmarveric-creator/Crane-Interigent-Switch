/**
 * 車内 iPad の BOOST (スカイゲートブリッジ) の起動音。GUEST 送迎の設定で選ぶ (app_settings.boost_sfx)。
 *   どの音も長さ 8.8 秒・点火 5.2 秒は同じ (画面の演出とスマホの BOOST の曲はこの時間で合わせている)。
 *   "orig" は元の public/cabin/audio/boost-sfx.mp3。ほかは public/cabin/audio/boost/<id>.mp3
 *   (騒音の中でも聞こえる大きさにそろえ、「ブースト開始」の声の間は声の帯域だけ下げてある)
 */
export const BOOST_SFX = [
  { id: "U", name: "迫力 U：パワー", zh: "力量 U" },
  { id: "V", name: "迫力 V：インパクト", zh: "冲击 V" },
  { id: "W", name: "迫力 W：ハイパーカー", zh: "超跑 W" },
  { id: "R", name: "洗練 R：プレミアム EV", zh: "精致 R" },
  { id: "S", name: "洗練 S：ハイパーカー", zh: "精致 S" },
  { id: "T", name: "洗練 T：スペースシップ", zh: "精致 T" },
  { id: "E", name: "チャージ E：クリア", zh: "充能 E" },
  { id: "F", name: "チャージ F：タービン", zh: "充能 F" },
  { id: "G", name: "チャージ G：充電メーター", zh: "充能 G" },
  { id: "H", name: "チャージ H：フル", zh: "充能 H" },
  { id: "xC", name: "サイバー C：シーケンサー", zh: "赛博 C" },
  { id: "xD", name: "ホログラム D：グリッチ", zh: "全息 D" },
  { id: "hA", name: "ハイテク起動 A：システム", zh: "高科技 A" },
  { id: "hB", name: "ハイテク起動 B：エンジン", zh: "高科技 B" },
  { id: "cA", name: "シネマ A：予告編", zh: "电影 A" },
  { id: "cB", name: "シネマ B：走り出す", zh: "电影 B" },
  { id: "aA", name: "アーマー A：スーツアップ", zh: "装甲 A" },
  { id: "aB", name: "アーマー B：ジェット", zh: "装甲 B" },
  { id: "fA", name: "近未来 A：クリーン", zh: "未来 A" },
  { id: "fB", name: "近未来 B：ハイパー", zh: "未来 B" },
  { id: "cur", name: "今までの音（大きくしたもの）", zh: "原来的声音（加大）" },
  { id: "orig", name: "今までの音（そのまま）", zh: "原来的声音" },
] as const;
export type BoostSfxId = (typeof BOOST_SFX)[number]["id"];
export const BOOST_SFX_DEFAULT: BoostSfxId = "cur";
export const isBoostSfx = (v: unknown): v is BoostSfxId => typeof v === "string" && BOOST_SFX.some((x) => x.id === v);
/** /cabin/audio/ からのファイル名 (拡張子なし) */
export const boostSfxFile = (id: string | null | undefined): string => (!id || id === "orig" || !isBoostSfx(id) ? "boost-sfx" : `boost/${id}`);
