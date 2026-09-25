export const LANGS = ["ja", "en", "zh", "ko"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABEL: Record<Lang, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
};

type Dict = {
  unlock: string;
  lock: string;
  locked: string;
  unlocked: string;
  ac: string;
  light: string;
  on: string;
  off: string;
  wakeLight: string;
  setAlarm: string;
  clearAlarm: string;
  alarmSet: string;
  wakeFlameName: string;
  wakeFlameDescription: string;
  wakeHorizonName: string;
  wakeHorizonDescription: string;
  wakeHorizonUnavailable: string;
  welcome: string;
  checkout: string;
  sending: string;
  success: string;
  failed: string;
  accessDenied: string;
  accessDeniedDesc: string;
  enterPin: string;
  pinPrompt: string;
  wrongPin: string;
  pinLocked: string;
  verify: string;
  locTooFar: string;
  locPermission: string;
  locUnavailable: string;
  comfortMode: string;
  awayMode: string;
  goodNightMode: string;
  galaxy: string;
  dreamMode: string; dreamDesc: string; dreamInfoTitle: string; dreamSteps: string[]; dreamNote: string; dreamStarted: string;
  qWifi: string; qCheckout: string; qEntrance: string; qRoom: string; qSsid: string; qPassword: string; qNone: string; qCopy: string; qCopied: string; qLoading: string;
  qWeather: string; qToday: string; qTomorrow: string; qRain: string; qUmbrellaYes: string; qUmbrellaMaybe: string; qUmbrellaNo: string;
  qNearby: string; qStore: string; qStation: string; qLaundry: string; qOpenMap: string;
  qEmergency: string; qPolice: string; qAmbulance: string; qHost: string; qEmergencyNote: string;
  voiceFab: string; voiceTipTitle: string; voiceTipBody: string;
  voiceListening: string; voiceRetry: string; voiceDenied: string; voiceWhy: string; voiceExamples: string[];
  modeSuffix: string;
  modeSelect: string; normalMode: string; normalDesc: string; comfortDesc: string; galaxyShort: string; nestShort: string; cozyDesc: string;
  galaxyDesc: string;
  galaxyAutoOff: string;
  nest: string;
  nestDesc: string;
  wafu: string;
  wafuDesc: string;
  cozyMode: string;
  wafuDetails: string;
  wafuWarmReset: string;
  wafuBack: string;
  brightness: string;
  colorTemp: string;
  color: string;
  presets: string;
  presetRelax: string;
  presetRead: string;
  presetSleep: string;
  warmWhite: string;
  coolWhite: string;
};

export const T: Record<Lang, Dict> = {
  ja: {
    unlock: "解錠", lock: "施錠", locked: "施錠中", unlocked: "解錠済み",
    ac: "エアコン", light: "照明", on: "オン", off: "オフ",
    wakeLight: "光目覚まし", setAlarm: "設定", clearAlarm: "解除", alarmSet: "セット完了",
    wakeFlameName: "Flame On",
    wakeFlameDescription: "設定時刻にメインライトが点灯します。",
    wakeHorizonName: "Horizon Rise",
    wakeHorizonDescription: "10分前から和風ライトが徐々に明るくなり、設定時刻にメインライトが点灯。5分後に和風ライトだけ自動消灯します。",
    wakeHorizonUnavailable: "この部屋には和風ライトがないため選択できません。",
    welcome: "ようこそ", checkout: "チェックアウト",
    sending: "送信中…", success: "完了", failed: "失敗しました",
    accessDenied: "アクセス拒否", accessDeniedDesc: "このリンクは無効か、滞在期間外です。",
    enterPin: "PINを入力", pinPrompt: "お預かりの暗証番号を入力してください",
    wrongPin: "PINが違います", pinLocked: "試行回数が多すぎます。しばらくしてからお試しください", verify: "認証",
    locTooFar: "操作はお部屋の近くでのみ可能です", locPermission: "位置情報を許可してください", locUnavailable: "位置情報を取得できません",
    comfortMode: "快適モード", awayMode: "外出（全部OFF）", goodNightMode: "おやすみモード",
    dreamMode: "Dream Fade", dreamDesc: "30分で消灯", dreamInfoTitle: "Dream Fade で起こること",
    dreamSteps: ["メインライト・ギャラクシー・ネストを消して、和風ライトだけのやさしい灯りにします", "30分かけて少しずつ暗くし、色も夕焼けのような暖かい赤みへ変えていきます", "30分後に和風ライトも自動で消えます。眠りを妨げにくい、ゆるやかな暗さの変化です"],
    dreamNote: "途中で照明やモードを操作するとフェードは止まります。エアコンはそのままです", dreamStarted: "Dream Fade を開始しました。おやすみなさい 🌙",
    qWifi: "Wi-Fi", qCheckout: "チェックアウト", qEntrance: "エントランスの暗証番号", qRoom: "お部屋の暗証番号", qSsid: "ネットワーク名", qPassword: "パスワード", qNone: "この情報は登録されていません", qCopy: "コピー", qCopied: "コピー済み", qLoading: "確認しています…",
    qWeather: "天気", qToday: "今日", qTomorrow: "明日", qRain: "雨", qUmbrellaYes: "傘を持っていきましょう", qUmbrellaMaybe: "折りたたみ傘があると安心", qUmbrellaNo: "傘はいらなさそう",
    qNearby: "近くの場所", qStore: "コンビニ", qStation: "駅", qLaundry: "コインランドリー", qOpenMap: "地図",
    qEmergency: "緊急時の連絡先", qPolice: "警察", qAmbulance: "救急車・消防", qHost: "ホストに連絡", qEmergencyNote: "110・119 は日本国内の携帯電話から無料でかけられます。落ち着いて、場所（住所）を伝えてください。",
    voiceFab: "話して操作", voiceTipTitle: "声でも操作できます", voiceTipBody: "マイクを押しながら「ギャラクシーオン」のように話してください", 
    voiceListening: "聞き取り中", voiceRetry: "聞き取れませんでした。もう一度どうぞ", voiceDenied: "マイクが許可されていません。ブラウザの設定で許可してください", voiceWhy: "ボタンを押している間だけ聞き取ります（録音は保存しません）", voiceExamples: ["ギャラクシーオン", "照明オフ", "Wi-Fiのパスワードは？"],
    modeSuffix: "モード",
    modeSelect: "モード", normalMode: "ノーマル", normalDesc: "メインライトだけ点灯", comfortDesc: "エアコン＋照明", galaxyShort: "満天の星・60分", nestShort: "藤の灯りだけ", cozyDesc: "行灯の灯りだけ",
    galaxy: "ギャラクシーモード", galaxyDesc: "満天の星をお部屋に投影", galaxyAutoOff: "オン後60分で自動OFF",
    nest: "ネストモード", nestDesc: "藤編みの灯りで暖かな陰影を",
    wafu: "和風ライト", wafuDesc: "行灯のやわらかな間接照明",
    cozyMode: "和みモード", wafuDetails: "詳細設定", wafuWarmReset: "暖色に戻す", wafuBack: "操作画面に戻る",
    brightness: "明るさ", colorTemp: "色温度", color: "カラー",
    presets: "プリセット", presetRelax: "くつろぎ", presetRead: "読書", presetSleep: "おやすみ",
    warmWhite: "電球色", coolWhite: "昼光色",
  },
  en: {
    unlock: "Unlock", lock: "Lock", locked: "Locked", unlocked: "Unlocked",
    ac: "Air Con", light: "Light", on: "On", off: "Off",
    wakeLight: "Wake Light", setAlarm: "Set", clearAlarm: "Clear", alarmSet: "Alarm set",
    wakeFlameName: "Flame On",
    wakeFlameDescription: "The main light turns on at the set time.",
    wakeHorizonName: "Horizon Rise",
    wakeHorizonDescription: "The Japanese lamp gradually brightens from 10 minutes before, the main light turns on at the set time, and only the Japanese lamp turns off 5 minutes later.",
    wakeHorizonUnavailable: "This room has no Japanese lamp, so this mode is unavailable.",
    welcome: "Welcome", checkout: "Check-out",
    sending: "Sending…", success: "Done", failed: "Failed",
    accessDenied: "Access Denied", accessDeniedDesc: "This link is invalid or outside your stay period.",
    enterPin: "Enter PIN", pinPrompt: "Please enter the PIN provided for your stay",
    wrongPin: "Incorrect PIN", pinLocked: "Too many attempts. Please try again later", verify: "Verify",
    locTooFar: "You must be near the room to operate", locPermission: "Please allow location access", locUnavailable: "Location unavailable",
    comfortMode: "Comfort", awayMode: "Away (all off)", goodNightMode: "Good Night",
    dreamMode: "Dream Fade", dreamDesc: "Off in 30 min", dreamInfoTitle: "What Dream Fade does",
    dreamSteps: ["Turns off the main light, Galaxy and Nest, leaving only the soft Japanese lamp", "Over 30 minutes the lamp slowly dims and shifts to a warm, sunset-like glow", "After 30 minutes the lamp turns off by itself — a gentle change of light that is kind to your sleep"],
    dreamNote: "Using any light or mode stops the fade. The air-con stays as it is", dreamStarted: "Dream Fade started. Good night 🌙",
    qWifi: "Wi-Fi", qCheckout: "Check-out", qEntrance: "Entrance code", qRoom: "Room code", qSsid: "Network name", qPassword: "Password", qNone: "This information is not available", qCopy: "Copy", qCopied: "Copied", qLoading: "Checking…",
    qWeather: "Weather", qToday: "Today", qTomorrow: "Tomorrow", qRain: "Rain", qUmbrellaYes: "Take an umbrella", qUmbrellaMaybe: "A folding umbrella would be handy", qUmbrellaNo: "No umbrella needed",
    qNearby: "Nearby", qStore: "Convenience store", qStation: "Train station", qLaundry: "Coin laundry", qOpenMap: "Map",
    qEmergency: "Emergency contacts", qPolice: "Police", qAmbulance: "Ambulance / Fire", qHost: "Contact the host", qEmergencyNote: "110 and 119 are free to call from any mobile phone in Japan. Stay calm and tell them where you are (the address).",
    voiceFab: "Voice control", voiceTipTitle: "You can also use your voice", voiceTipBody: "Hold the mic and say something like \"Galaxy on\"", 
    voiceListening: "LISTENING", voiceRetry: "Sorry, I didn't catch that. Please try again", voiceDenied: "Microphone is blocked. Please allow it in your browser settings", voiceWhy: "Listens only while you hold the button (nothing is recorded)", voiceExamples: ["Galaxy on", "Lights off", "What's the Wi-Fi password?"],
    modeSuffix: " Mode",
    modeSelect: "Modes", normalMode: "Normal", normalDesc: "Main light only", comfortDesc: "Air-con + light", galaxyShort: "Stars · 60 min", nestShort: "Woven lamp only", cozyDesc: "Lantern light only",
    galaxy: "Galaxy Mode", galaxyDesc: "Project a starry sky in your room", galaxyAutoOff: "Auto-off 60 min after on",
    nest: "Nest Mode", nestDesc: "Warm woven light with soft shadows",
    wafu: "Japanese Lamp", wafuDesc: "Soft andon accent lighting",
    cozyMode: "Cozy", wafuDetails: "Settings", wafuWarmReset: "Reset to warm", wafuBack: "Back to controls",
    brightness: "Brightness", colorTemp: "Color temp", color: "Color",
    presets: "Presets", presetRelax: "Relax", presetRead: "Reading", presetSleep: "Night",
    warmWhite: "Warm", coolWhite: "Cool",
  },
  zh: {
    unlock: "开锁", lock: "上锁", locked: "已上锁", unlocked: "已开锁",
    ac: "空调", light: "灯光", on: "开", off: "关",
    wakeLight: "光唤醒", setAlarm: "设定", clearAlarm: "取消", alarmSet: "已设定",
    wakeFlameName: "Flame On",
    wakeFlameDescription: "主灯会在设定时间亮起。",
    wakeHorizonName: "Horizon Rise",
    wakeHorizonDescription: "和风灯从提前10分钟开始逐渐变亮，主灯在设定时间亮起，5分钟后仅自动关闭和风灯。",
    wakeHorizonUnavailable: "此房间没有和风灯，因此无法选择此模式。",
    welcome: "欢迎", checkout: "退房",
    sending: "发送中…", success: "完成", failed: "失败",
    accessDenied: "拒绝访问", accessDeniedDesc: "此链接无效或不在入住期间内。",
    enterPin: "输入PIN", pinPrompt: "请输入入住时提供的密码",
    wrongPin: "PIN码错误", pinLocked: "尝试次数过多，请稍后再试", verify: "验证",
    locTooFar: "请在房间附近操作", locPermission: "请允许定位权限", locUnavailable: "无法获取定位",
    comfortMode: "舒适模式", awayMode: "外出（全关）", goodNightMode: "晚安模式",
    dreamMode: "Dream Fade", dreamDesc: "30分钟熄灯", dreamInfoTitle: "Dream Fade 会做什么",
    dreamSteps: ["关闭主灯、银河和鸟巢灯，只留下柔和的和风灯", "在30分钟内慢慢变暗，灯光颜色也逐渐变成晚霞般温暖的红色调", "30分钟后和风灯自动熄灭，柔和的明暗变化，不易打扰睡眠"],
    dreamNote: "中途操作灯光或模式时，渐暗会停止。空调保持不变", dreamStarted: "Dream Fade 已开始。晚安 🌙",
    qWifi: "Wi-Fi", qCheckout: "退房时间", qEntrance: "大门密码", qRoom: "房间密码", qSsid: "网络名称", qPassword: "密码", qNone: "暂未登记此信息", qCopy: "复制", qCopied: "已复制", qLoading: "正在确认…",
    qWeather: "天气", qToday: "今天", qTomorrow: "明天", qRain: "降雨", qUmbrellaYes: "记得带伞", qUmbrellaMaybe: "带把折叠伞比较安心", qUmbrellaNo: "应该不用带伞",
    qNearby: "附近", qStore: "便利店", qStation: "车站", qLaundry: "自助洗衣店", qOpenMap: "地图",
    qEmergency: "紧急联系方式", qPolice: "警察", qAmbulance: "救护车・消防", qHost: "联系房东", qEmergencyNote: "在日本用手机可免费拨打 110 和 119。请保持冷静，告知所在位置（地址）。",
    voiceFab: "语音控制", voiceTipTitle: "也可以用语音操作", voiceTipBody: "按住麦克风，说“打开星空”等指令", 
    voiceListening: "正在聆听", voiceRetry: "没有听清，请再说一次", voiceDenied: "麦克风未被允许，请在浏览器设置中允许", voiceWhy: "仅在按住按钮时聆听（不会保存录音）", voiceExamples: ["打开星空", "关灯", "Wi-Fi密码是什么？"],
    modeSuffix: "模式",
    modeSelect: "模式", normalMode: "普通", normalDesc: "只开主灯", comfortDesc: "空调＋照明", galaxyShort: "星空・60分钟", nestShort: "只开藤编灯", cozyDesc: "只开行灯",
    galaxy: "银河模式", galaxyDesc: "在房间投影满天星空", galaxyAutoOff: "开启60分钟后自动关闭",
    nest: "鸟巢模式", nestDesc: "藤编暖光，投下柔和光影",
    wafu: "和风灯", wafuDesc: "行灯柔和的间接照明",
    cozyMode: "和风模式", wafuDetails: "详细设置", wafuWarmReset: "恢复暖色", wafuBack: "返回操作画面",
    brightness: "亮度", colorTemp: "色温", color: "颜色",
    presets: "预设", presetRelax: "放松", presetRead: "阅读", presetSleep: "夜灯",
    warmWhite: "暖光", coolWhite: "冷光",
  },
  ko: {
    unlock: "잠금 해제", lock: "잠금", locked: "잠김", unlocked: "열림",
    ac: "에어컨", light: "조명", on: "켜기", off: "끄기",
    wakeLight: "라이트 알람", setAlarm: "설정", clearAlarm: "해제", alarmSet: "설정 완료",
    wakeFlameName: "Flame On",
    wakeFlameDescription: "설정 시간에 메인 조명이 켜집니다.",
    wakeHorizonName: "Horizon Rise",
    wakeHorizonDescription: "10분 전부터 일본풍 조명이 서서히 밝아지고 설정 시간에 메인 조명이 켜진 뒤, 5분 후 일본풍 조명만 자동으로 꺼집니다.",
    wakeHorizonUnavailable: "이 객실에는 일본풍 조명이 없어 선택할 수 없습니다.",
    welcome: "환영합니다", checkout: "체크아웃",
    sending: "전송 중…", success: "완료", failed: "실패",
    accessDenied: "접근 거부", accessDeniedDesc: "이 링크는 유효하지 않거나 숙박 기간이 아닙니다.",
    enterPin: "PIN 입력", pinPrompt: "숙박 시 안내받은 PIN을 입력하세요",
    wrongPin: "PIN이 올바르지 않습니다", pinLocked: "시도 횟수가 많습니다. 잠시 후 다시 시도하세요", verify: "확인",
    locTooFar: "객실 근처에서만 조작할 수 있습니다", locPermission: "위치 권한을 허용해 주세요", locUnavailable: "위치를 가져올 수 없습니다",
    comfortMode: "쾌적 모드", awayMode: "외출 (전체 OFF)", goodNightMode: "취침 모드",
    dreamMode: "Dream Fade", dreamDesc: "30분 후 소등", dreamInfoTitle: "Dream Fade 동작",
    dreamSteps: ["메인 조명・갤럭시・네스트를 끄고, 부드러운 일본풍 조명만 남깁니다", "30분에 걸쳐 조금씩 어두워지고, 색도 노을처럼 따뜻한 붉은빛으로 바뀝니다", "30분 후 일본풍 조명도 자동으로 꺼집니다. 수면을 방해하지 않는 완만한 변화입니다"],
    dreamNote: "도중에 조명이나 모드를 조작하면 페이드가 멈춥니다. 에어컨은 그대로입니다", dreamStarted: "Dream Fade를 시작했습니다. 안녕히 주무세요 🌙",
    qWifi: "Wi-Fi", qCheckout: "체크아웃", qEntrance: "현관 비밀번호", qRoom: "객실 비밀번호", qSsid: "네트워크 이름", qPassword: "비밀번호", qNone: "등록된 정보가 없습니다", qCopy: "복사", qCopied: "복사됨", qLoading: "확인 중…",
    qWeather: "날씨", qToday: "오늘", qTomorrow: "내일", qRain: "강수", qUmbrellaYes: "우산을 챙기세요", qUmbrellaMaybe: "접이식 우산이 있으면 안심", qUmbrellaNo: "우산은 필요 없을 것 같아요",
    qNearby: "근처", qStore: "편의점", qStation: "역", qLaundry: "코인 세탁소", qOpenMap: "지도",
    qEmergency: "긴급 연락처", qPolice: "경찰", qAmbulance: "구급차・소방", qHost: "호스트에게 연락", qEmergencyNote: "110과 119는 일본 내 휴대폰으로 무료로 걸 수 있습니다. 침착하게 위치(주소)를 알려 주세요.",
    voiceFab: "음성 조작", voiceTipTitle: "음성으로도 조작할 수 있어요", voiceTipBody: "마이크를 누른 채 \"갤럭시 켜줘\"처럼 말해 주세요", 
    voiceListening: "듣는 중", voiceRetry: "잘 못 들었어요. 다시 말씀해 주세요", voiceDenied: "마이크가 허용되지 않았습니다. 브라우저 설정에서 허용해 주세요", voiceWhy: "버튼을 누르는 동안만 듣습니다 (녹음은 저장하지 않습니다)", voiceExamples: ["갤럭시 켜줘", "조명 꺼줘", "와이파이 비밀번호는?"],
    modeSuffix: " 모드",
    modeSelect: "모드", normalMode: "노멀", normalDesc: "메인 조명만 켜기", comfortDesc: "에어컨＋조명", galaxyShort: "별빛・60분", nestShort: "라탄 조명만", cozyDesc: "행등 조명만",
    galaxy: "갤럭시 모드", galaxyDesc: "방 안에 별이 가득한 하늘을 투영", galaxyAutoOff: "켜진 뒤 60분 후 자동 꺼짐",
    nest: "네스트 모드", nestDesc: "라탄 조명으로 따뜻한 그림자를",
    wafu: "일본풍 조명", wafuDesc: "안돈의 부드러운 간접 조명",
    cozyMode: "포근 모드", wafuDetails: "상세 설정", wafuWarmReset: "따뜻한 색으로", wafuBack: "조작 화면으로",
    brightness: "밝기", colorTemp: "색온도", color: "색상",
    presets: "프리셋", presetRelax: "휴식", presetRead: "독서", presetSleep: "취침",
    warmWhite: "전구색", coolWhite: "주광색",
  },
};

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** ゲスト名の表示・エントランス導線・PIN画面の名前入力 (スマートキー連携で追加)。 */
export const GX: Record<Lang, {
  welcomeName: (name: string) => string;
  entranceKey: string;
  entranceKeySub: string;
  nameLabel: string;
  namePh: string;
  nameRequired: string;
  pinLabel: string;
}> = {
  ja: {
    welcomeName: (n) => `ようこそ、${n} 様`,
    entranceKey: "エントランスを開ける", entranceKeySub: "建物入口の鍵・Wi-Fi・暗証番号",
    nameLabel: "お名前", namePh: "例: CHEN", nameRequired: "お名前を入力してください", pinLabel: "電話番号の下4桁",
  },
  en: {
    welcomeName: (n) => `Welcome, ${n}`,
    entranceKey: "Open the entrance", entranceKeySub: "Building door key · Wi-Fi · door code",
    nameLabel: "Your name", namePh: "e.g. CHEN", nameRequired: "Please enter your name", pinLabel: "Last 4 digits of your phone",
  },
  zh: {
    welcomeName: (n) => `欢迎，${n}`,
    entranceKey: "打开大门", entranceKeySub: "大楼入口钥匙・Wi-Fi・密码",
    nameLabel: "姓名", namePh: "例：CHEN", nameRequired: "请输入姓名", pinLabel: "手机号码后 4 位",
  },
  ko: {
    welcomeName: (n) => `${n} 님, 환영합니다`,
    entranceKey: "현관 열기", entranceKeySub: "건물 입구 키・Wi-Fi・비밀번호",
    nameLabel: "이름", namePh: "예: CHEN", nameRequired: "이름을 입력해 주세요", pinLabel: "전화번호 뒤 4자리",
  },
};
