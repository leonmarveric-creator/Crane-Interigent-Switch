/**
 * 音声コントロールのあいさつ・隠しコマンドの画面の文言 (4 言語)。
 *   声はアンドロイドの英語の録音、画面の文字はゲストの言語で出す。
 */
export type ExtrasText = {
  morning: string; night: string; home: string; out: string; tired: string;
  checkoutToday: string; alarmAt: string; noAlarm: string; tomorrowWeather: string; todayWeather: string;
  whoTitle: string; whoBody: string; poweredBy: string;
  helpTitle: string; helpGroups: { title: string; items: string[] }[];
  fortuneTitle: string; ranks: Record<"daikichi" | "chukichi" | "shokichi" | "kichi" | "suekichi", string>;
  colors: Record<"red" | "gold" | "pink" | "green" | "blue" | "purple" | "orange", string>;
  luckyColor: string; fortuneNote: string;
  inhale: string; exhale: string; breatheDone: string;
  party: string; aurora: string; wish: string; birthday: string;
  seasonOnly: (season: string, room: string) => string;
  seasons: Record<"spring" | "summer" | "autumn" | "winter", string>;
  seasonRooms: Record<"spring" | "summer" | "autumn" | "winter", string>;
  limited: string;
};

const ja: ExtrasText = {
  morning: "おはようございます", night: "おやすみなさい", home: "おかえりなさい", out: "いってらっしゃい", tired: "今日もおつかれさまでした",
  checkoutToday: "本日チェックアウト", alarmAt: "目覚まし", noAlarm: "目覚ましは未設定です", tomorrowWeather: "明日の天気", todayWeather: "今日の天気",
  whoTitle: "この部屋のアシスタント", whoBody: "お部屋のことは何でも声で聞いてください。", poweredBy: "Powered by ASTRALIS ―「星々の」という意味のシステムです",
  helpTitle: "こんなことが話せます",
  helpGroups: [
    { title: "操作", items: ["ギャラクシーオン", "照明オフ", "エアコンつけて"] },
    { title: "質問", items: ["Wi-Fiのパスワードは？", "チェックアウトは？", "明日の天気は？", "近くのコンビニ"] },
    { title: "あいさつ", items: ["おはよう", "ただいま", "いってきます", "おやすみ", "疲れた"] },
    { title: "おたのしみ", items: ["おみくじ", "流れ星", "オーロラ", "パーティーモード", "発射", "深呼吸", "ハッピーバースデー"] },
  ],
  fortuneTitle: "今日の運勢", ranks: { daikichi: "大吉", chukichi: "中吉", shokichi: "小吉", kichi: "吉", suekichi: "末吉" },
  colors: { red: "赤", gold: "金", pink: "ピンク", green: "緑", blue: "青", purple: "紫", orange: "オレンジ" },
  luckyColor: "ラッキーカラー", fortuneNote: "和風ライトをラッキーカラーにしました",
  inhale: "吸って", exhale: "吐いて", breatheDone: "おつかれさまでした",
  party: "PARTY MODE", aurora: "AURORA", wish: "願いごとをどうぞ", birthday: "Happy Birthday!",
  seasonOnly: (s, r) => `「${s}」の演出は ${r} の部屋だけの特別な演出です`,
  seasons: { spring: "桜", summer: "花火", autumn: "紅葉", winter: "雪" },
  seasonRooms: { spring: "春 HARU", summer: "夏 NATSU", autumn: "秋 AKI", winter: "冬 FUYU" },
  limited: "今日は光の演出の回数が上限に達したので、画面だけでお楽しみください",
};

const en: ExtrasText = {
  morning: "Good morning", night: "Good night", home: "Welcome home", out: "Have a safe trip", tired: "You've done enough today",
  checkoutToday: "Check-out today", alarmAt: "Alarm", noAlarm: "No alarm set", tomorrowWeather: "Tomorrow", todayWeather: "Today",
  whoTitle: "Your room assistant", whoBody: "Ask me anything about your room.", poweredBy: "Powered by ASTRALIS — \"of the stars\"",
  helpTitle: "Things you can say",
  helpGroups: [
    { title: "Control", items: ["Galaxy on", "Lights off", "Air con on"] },
    { title: "Questions", items: ["What's the Wi-Fi password?", "When is check-out?", "Weather tomorrow?", "Nearby convenience store"] },
    { title: "Greetings", items: ["Good morning", "I'm home", "I'm going out", "Good night", "I'm tired"] },
    { title: "Just for fun", items: ["Fortune", "Shooting star", "Aurora", "Party mode", "Launch", "Breathe", "Happy birthday"] },
  ],
  fortuneTitle: "Today's fortune", ranks: { daikichi: "Great blessing", chukichi: "Middle blessing", shokichi: "Small blessing", kichi: "Blessing", suekichi: "Future blessing" },
  colors: { red: "Red", gold: "Gold", pink: "Pink", green: "Green", blue: "Blue", purple: "Purple", orange: "Orange" },
  luckyColor: "Lucky color", fortuneNote: "The lamp is now your lucky color",
  inhale: "Breathe in", exhale: "Breathe out", breatheDone: "Well done",
  party: "PARTY MODE", aurora: "AURORA", wish: "Make a wish", birthday: "Happy Birthday!",
  seasonOnly: (s, r) => `The ${s} show is a special effect only in the ${r} room`,
  seasons: { spring: "cherry blossom", summer: "fireworks", autumn: "autumn leaves", winter: "snow" },
  seasonRooms: { spring: "HARU (Spring)", summer: "NATSU (Summer)", autumn: "AKI (Autumn)", winter: "FUYU (Winter)" },
  limited: "Today's light show limit has been reached — enjoy it on screen",
};

const zh: ExtrasText = {
  morning: "早上好", night: "晚安", home: "欢迎回来", out: "路上小心", tired: "今天辛苦了",
  checkoutToday: "今天退房", alarmAt: "闹钟", noAlarm: "未设置闹钟", tomorrowWeather: "明天天气", todayWeather: "今天天气",
  whoTitle: "本房间的助手", whoBody: "关于房间的任何问题都可以用语音问我。", poweredBy: "Powered by ASTRALIS —「星辰的」之意",
  helpTitle: "可以这样说",
  helpGroups: [
    { title: "操作", items: ["打开星空", "关灯", "打开空调"] },
    { title: "提问", items: ["Wi-Fi密码是什么？", "几点退房？", "明天天气？", "附近的便利店"] },
    { title: "问候", items: ["早上好", "我回来了", "我出门了", "晚安", "好累"] },
    { title: "彩蛋", items: ["抽签", "流星", "极光", "派对模式", "发射", "深呼吸", "生日快乐"] },
  ],
  fortuneTitle: "今日运势", ranks: { daikichi: "大吉", chukichi: "中吉", shokichi: "小吉", kichi: "吉", suekichi: "末吉" },
  colors: { red: "红色", gold: "金色", pink: "粉色", green: "绿色", blue: "蓝色", purple: "紫色", orange: "橙色" },
  luckyColor: "幸运色", fortuneNote: "和风灯已变成你的幸运色",
  inhale: "吸气", exhale: "呼气", breatheDone: "辛苦了",
  party: "PARTY MODE", aurora: "AURORA", wish: "许个愿吧", birthday: "Happy Birthday!",
  seasonOnly: (s, r) => `「${s}」是 ${r} 房间专属的特别演出`,
  seasons: { spring: "樱花", summer: "烟花", autumn: "红叶", winter: "雪" },
  seasonRooms: { spring: "春 HARU", summer: "夏 NATSU", autumn: "秋 AKI", winter: "冬 FUYU" },
  limited: "今天的灯光演出次数已达上限，请欣赏画面演出",
};

const ko: ExtrasText = {
  morning: "좋은 아침이에요", night: "안녕히 주무세요", home: "어서 오세요", out: "잘 다녀오세요", tired: "오늘도 수고했어요",
  checkoutToday: "오늘 체크아웃", alarmAt: "알람", noAlarm: "알람이 설정되지 않았어요", tomorrowWeather: "내일 날씨", todayWeather: "오늘 날씨",
  whoTitle: "이 방의 어시스턴트", whoBody: "방에 대한 것은 무엇이든 음성으로 물어보세요.", poweredBy: "Powered by ASTRALIS — '별들의'라는 뜻",
  helpTitle: "이렇게 말해 보세요",
  helpGroups: [
    { title: "조작", items: ["갤럭시 켜줘", "조명 꺼줘", "에어컨 켜줘"] },
    { title: "질문", items: ["와이파이 비밀번호는?", "체크아웃은?", "내일 날씨는?", "근처 편의점"] },
    { title: "인사", items: ["좋은 아침", "다녀왔어", "다녀올게", "잘자", "피곤해"] },
    { title: "숨은 기능", items: ["운세", "별똥별", "오로라", "파티 모드", "발사", "심호흡", "생일 축하"] },
  ],
  fortuneTitle: "오늘의 운세", ranks: { daikichi: "대길", chukichi: "중길", shokichi: "소길", kichi: "길", suekichi: "말길" },
  colors: { red: "빨강", gold: "금색", pink: "핑크", green: "초록", blue: "파랑", purple: "보라", orange: "주황" },
  luckyColor: "행운의 색", fortuneNote: "와후 라이트를 행운의 색으로 바꿨어요",
  inhale: "들이쉬고", exhale: "내쉬고", breatheDone: "수고했어요",
  party: "PARTY MODE", aurora: "AURORA", wish: "소원을 빌어 보세요", birthday: "Happy Birthday!",
  seasonOnly: (s, r) => `'${s}' 연출은 ${r} 방에서만 볼 수 있는 특별 연출이에요`,
  seasons: { spring: "벚꽃", summer: "불꽃놀이", autumn: "단풍", winter: "눈" },
  seasonRooms: { spring: "봄 HARU", summer: "여름 NATSU", autumn: "가을 AKI", winter: "겨울 FUYU" },
  limited: "오늘 조명 연출 횟수가 한도에 도달했어요. 화면으로 즐겨 주세요",
};

export function extrasText(lang: string): ExtrasText {
  return lang === "ja" ? ja : lang === "zh" ? zh : lang === "ko" ? ko : en;
}
