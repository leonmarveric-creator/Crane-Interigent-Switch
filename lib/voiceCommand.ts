/**
 * 音声コマンドの解析 (ハイテクUI のマイクボタン用)。
 *   スマホのブラウザ音声認識で文字にした言葉から「何を」「どうする」を読み取り、
 *   既存ボタンと同じ操作 (VoiceAction) に変換する。
 *   日本語 / 英語 / 中国語 / 韓国語 の言い方をまとめて受け付ける。
 *   鍵 (解錠・施錠・エントランス) は安全のため対象外。
 */

export type VoiceAction =
  | "normal" | "welcome" | "welcome_cozy"
  | "galaxy_on" | "galaxy_off"
  | "nest_on" | "nest_off"
  | "wafu_on" | "wafu_off"
  | "ac_on" | "ac_off"
  | "light_on" | "light_off"
  | "good_night" | "away"
  | "dream_fade";

/** この部屋で使える機器 (無い機器のコマンドは null を返す) */
export type VoiceRoomCaps = { hasGalaxy?: boolean; hasNest?: boolean; hasWafu?: boolean };

// 「消す・止める」を表す言葉 (これがあればオフ)
const OFF_WORDS = [
  "オフ", "おふ", "消", "けし", "けす", "止め", "とめて", "止ま", "切っ", "切る", "切り", "やめ", "終わ",
  "关", "關", "停", "熄",
  "끄", "꺼", "끝", "정지", "멈",
];

// 英語の短い単語は単語単位で判定する (他の単語の一部に反応しないように)
const OFF_EN = /\b(off|stop|disable|end|kill)\b/i;

type Target = {
  key: string;
  words: string[];
  en?: RegExp;
  on: VoiceAction | null;
  off: VoiceAction | null;
  need?: keyof VoiceRoomCaps;
};

// 上から順に判定する (より具体的なものを先に)
const TARGETS: Target[] = [
  {
    key: "away",
    words: ["外出", "いってきます", "行ってきます", "でかけ", "出かけ", "出掛け", "全部オフ", "全部消", "ぜんぶおふ", "ぜんぶけし", "出门", "出門", "全关", "全關", "외출", "다녀올", "전부 꺼", "전체 꺼"],
    en: /\b(away|going out|leaving|all off|everything off)\b/i,
    on: "away", off: "away",
  },
  {
    key: "dream",
    words: ["ドリーム", "どりーむ", "夢見", "ゆめみ", "ゆっくり消", "ゆっくりけ", "入梦", "入夢", "드림", "꿈결"],
    en: /\b(dream|fade out|fade)\b/i,
    on: "dream_fade", off: "dream_fade", need: "hasWafu",
  },
  {
    key: "good_night",
    words: ["おやすみ", "お休み", "寝る", "晚安", "晩安", "睡觉", "睡覺", "잘자", "잘 자", "굿나잇", "취침"],
    en: /\b(good ?night|sleep|bed ?time)\b/i,
    on: "good_night", off: "good_night",
  },
  {
    key: "galaxy",
    words: ["ギャラクシ", "ぎゃらくし", "星", "銀河", "ぎんが", "星空", "银河", "갤럭시", "별"],
    en: /\b(galaxy|galaxies|stars?|starry|cosmos)\b/i,
    on: "galaxy_on", off: "galaxy_off", need: "hasGalaxy",
  },
  {
    key: "nest",
    words: ["ネスト", "ねすと", "巣", "巢", "鸟巢", "鳥巢", "藤", "네스트", "라탄"],
    en: /\b(nest|rattan)\b/i,
    on: "nest_on", off: "nest_off", need: "hasNest",
  },
  {
    key: "cozy",
    words: ["和み", "なごみ", "ナゴミ", "和风模式", "和風模式", "포근"],
    en: /\b(cozy|cosy)\b/i,
    on: "welcome_cozy", off: "wafu_off", need: "hasWafu",
  },
  {
    key: "comfort",
    words: ["快適", "かいてき", "カイテキ", "舒适", "舒適", "쾌적"],
    en: /\b(comfort|comfortable|welcome)\b/i,
    on: "welcome", off: null,
  },
  {
    key: "normal",
    words: ["ノーマル", "のーまる", "普通", "通常", "노멀", "노말", "일반"],
    en: /\bnormal\b/i,
    on: "normal", off: "light_off",
  },
  {
    key: "wafu",
    words: ["和風", "わふう", "ワフウ", "行灯", "あんどん", "アンドン", "和风", "和风灯", "和風燈", "일본풍", "안돈", "행등"],
    en: /\b(japanese lamp|lantern|andon)\b/i,
    on: "wafu_on", off: "wafu_off", need: "hasWafu",
  },
  {
    key: "ac",
    words: ["エアコン", "えあこん", "冷房", "れいぼう", "暖房", "だんぼう", "クーラー", "空调", "空調", "冷气", "冷氣", "暖气", "暖氣", "에어컨", "냉방", "난방"],
    en: /\b(air ?con|aircon|a\/?c|air conditioner|air conditioning|cooler|heater|heating|cooling)\b/i,
    on: "ac_on", off: "ac_off",
  },
  {
    key: "light",
    words: ["照明", "電気", "でんき", "デンキ", "ライト", "明かり", "あかり", "灯光", "灯", "燈", "电灯", "電燈", "조명", "불"],
    en: /\b(lights?|lamp)\b/i,
    on: "light_on", off: "light_off",
  },
];

function norm(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim();
}

/**
 * 音声認識の結果 (1 つまたは複数の候補) から操作を決める。
 * 候補が複数あるときは、最初に解釈できたものを使う。
 * 分からない・この部屋に無い機器なら null。
 */
export function parseVoiceCommand(input: string | string[], caps: VoiceRoomCaps = {}): VoiceAction | null {
  const list = Array.isArray(input) ? input : [input];
  for (const raw of list) {
    const r = parseOne(raw, caps);
    if (r) return r;
  }
  return null;
}

function parseOne(raw: string, caps: VoiceRoomCaps): VoiceAction | null {
  const text = norm(raw);
  if (!text) return null;
  const compact = text.replace(/\s+/g, "");
  const isOff = OFF_EN.test(text) || OFF_WORDS.some((w) => compact.includes(norm(w).replace(/\s+/g, "")));
  for (const t of TARGETS) {
    const hit = (t.en && t.en.test(text)) || t.words.some((w) => compact.includes(norm(w).replace(/\s+/g, "")));
    if (!hit) continue;
    if (t.need && !caps[t.need]) return null; // この部屋に無い機器 (例: 和風ライトが無い部屋の「和風ライト消して」) は何もしない
    return isOff ? t.off : t.on;
  }
  return null;
}

/** 音声認識に渡す言語コード */
export function speechLangCode(lang: string): string {
  return lang === "en" ? "en-US" : lang === "zh" ? "zh-CN" : lang === "ko" ? "ko-KR" : "ja-JP";
}

/* ---------------- 質問 (答えを画面に大きく表示する) ---------------- */
export type VoiceQuestion =
  | "wifi" | "checkout" | "entrance_code" | "room_code"
  | "weather" | "emergency"
  | "nearby" | "nearby_store" | "nearby_station" | "nearby_laundry";

// 暗証番号・パスワードを表す言葉
const CODE_WORDS = ["暗証", "番号", "パスワード", "ぱすわーど", "コード", "密码", "密碼", "비밀번호", "번호", "코드"];
const CODE_EN = /\b(code|codes|password|passcode|pin|number)\b/i;

const Q_ENTRANCE = ["エントランス", "えんとらんす", "入口", "いりぐち", "玄関", "げんかん", "建物", "大门", "大門", "入口", "현관", "입구", "건물"];
const Q_ENTRANCE_EN = /\b(entrance|front door|main door|building door|lobby)\b/i;
const Q_ROOM = ["部屋", "へや", "お部屋", "房间", "房間", "방", "객실"];
const Q_ROOM_EN = /\b(room|door)\b/i;
const Q_WIFI = ["ワイファイ", "わいふぁい", "wifi", "インターネット", "ネット", "无线", "無線", "网络", "網路", "와이파이", "인터넷"];
const Q_WIFI_EN = /\b(wi-?fi|wireless|internet|network|ssid)\b/i;
const Q_CHECKOUT = ["チェックアウト", "ちぇっくあうと", "何時まで", "なんじまで", "いつまで", "退房", "退房时间", "체크아웃", "몇 시까지"];
const Q_CHECKOUT_EN = /\b(check[- ]?out|checkout|leave by|what time.*leave)\b/i;

const Q_EMERGENCY = ["緊急", "きんきゅう", "救急", "きゅうきゅう", "警察", "けいさつ", "消防", "火事", "かじ", "怪我", "けが", "助けて", "たすけて", "紧急", "急救", "报警", "警察", "火灾", "救命", "응급", "경찰", "구급", "화재", "살려", "119", "110"];
const Q_EMERGENCY_EN = /\b(emergency|police|ambulance|fire|help me|hospital|injured)\b/i;
const Q_WEATHER = ["天気", "てんき", "雨", "あめ", "傘", "かさ", "気温", "きおん", "天气", "下雨", "雨伞", "伞", "气温", "날씨", "비 와", "비와", "우산", "기온"];
const Q_WEATHER_EN = /\b(weather|rain|raining|umbrella|forecast|temperature)\b/i;
const Q_STORE = ["コンビニ", "こんびに", "セブン", "ローソン", "ファミマ", "ファミリーマート", "スーパー", "便利店", "超市", "편의점", "마트"];
const Q_STORE_EN = /\b(convenience|7-?eleven|seven eleven|lawson|family ?mart|supermarket|grocery)\b/i;
const Q_STATION = ["駅", "えき", "電車", "でんしゃ", "地下鉄", "ちかてつ", "车站", "火车站", "地铁", "역", "지하철"];
const Q_STATION_EN = /\b(station|subway|metro|train)\b/i;
const Q_LAUNDRY = ["ランドリー", "らんどりー", "洗濯", "せんたく", "洗衣", "세탁", "빨래"];
const Q_LAUNDRY_EN = /\b(laundry|laundromat|washing machine)\b/i;
const Q_NEARBY = ["近く", "ちかく", "周辺", "しゅうへん", "附近", "周边", "근처", "주변"];
const Q_NEARBY_EN = /\b(nearby|near here|around here|close by)\b/i;

/**
 * 質問を読み取る (「Wi-Fi のパスワードは？」「チェックアウト何時？」「エントランスの暗証番号は？」など)。
 * 操作のコマンドより先に判定する。質問でなければ null。
 */
export function parseVoiceQuestion(input: string | string[]): VoiceQuestion | null {
  const list = Array.isArray(input) ? input : [input];
  for (const raw of list) {
    const text = norm(raw);
    if (!text) continue;
    const c = text.replace(/\s+/g, "");
    const has = (words: string[]) => words.some((w) => c.includes(norm(w).replace(/\s+/g, "")));
    const code = has(CODE_WORDS) || CODE_EN.test(text);
    if (has(Q_EMERGENCY) || Q_EMERGENCY_EN.test(text)) return "emergency";
    if (has(Q_WIFI) || Q_WIFI_EN.test(text)) return "wifi";
    if (has(Q_CHECKOUT) || Q_CHECKOUT_EN.test(text)) return "checkout";
    if (has(Q_ENTRANCE) || Q_ENTRANCE_EN.test(text)) {
      if (code || /[?？]|は$|何|なに|教え|知り/.test(text)) return "entrance_code";
    }
    if (code && (has(Q_ROOM) || Q_ROOM_EN.test(text))) return "room_code";
    if (has(Q_WEATHER) || Q_WEATHER_EN.test(text)) return "weather";
    if (has(Q_STORE) || Q_STORE_EN.test(text)) return "nearby_store";
    if (has(Q_STATION) || Q_STATION_EN.test(text)) return "nearby_station";
    if (has(Q_LAUNDRY) || Q_LAUNDRY_EN.test(text)) return "nearby_laundry";
    if (has(Q_NEARBY) || Q_NEARBY_EN.test(text)) return "nearby";
    if (code) return "wifi"; // 「パスワードは？」だけなら Wi-Fi が一番多い
  }
  return null;
}
