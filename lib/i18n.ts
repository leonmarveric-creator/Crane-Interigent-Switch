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
  galaxy: string;
  galaxyDesc: string;
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
    welcome: "ようこそ", checkout: "チェックアウト",
    sending: "送信中…", success: "完了", failed: "失敗しました",
    accessDenied: "アクセス拒否", accessDeniedDesc: "このリンクは無効か、滞在期間外です。",
    enterPin: "PINを入力", pinPrompt: "お預かりの暗証番号を入力してください",
    wrongPin: "PINが違います", pinLocked: "試行回数が多すぎます。しばらくしてからお試しください", verify: "認証",
    locTooFar: "操作はお部屋の近くでのみ可能です", locPermission: "位置情報を許可してください", locUnavailable: "位置情報を取得できません",
    comfortMode: "快適モード", awayMode: "外出（全部OFF）",
    galaxy: "ギャラクシーモード", galaxyDesc: "満天の星をお部屋に投影",
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
    welcome: "Welcome", checkout: "Check-out",
    sending: "Sending…", success: "Done", failed: "Failed",
    accessDenied: "Access Denied", accessDeniedDesc: "This link is invalid or outside your stay period.",
    enterPin: "Enter PIN", pinPrompt: "Please enter the PIN provided for your stay",
    wrongPin: "Incorrect PIN", pinLocked: "Too many attempts. Please try again later", verify: "Verify",
    locTooFar: "You must be near the room to operate", locPermission: "Please allow location access", locUnavailable: "Location unavailable",
    comfortMode: "Comfort", awayMode: "Away (all off)",
    galaxy: "Galaxy Mode", galaxyDesc: "Project a starry sky in your room",
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
    welcome: "欢迎", checkout: "退房",
    sending: "发送中…", success: "完成", failed: "失败",
    accessDenied: "拒绝访问", accessDeniedDesc: "此链接无效或不在入住期间内。",
    enterPin: "输入PIN", pinPrompt: "请输入入住时提供的密码",
    wrongPin: "PIN码错误", pinLocked: "尝试次数过多，请稍后再试", verify: "验证",
    locTooFar: "请在房间附近操作", locPermission: "请允许定位权限", locUnavailable: "无法获取定位",
    comfortMode: "舒适模式", awayMode: "外出（全关）",
    galaxy: "银河模式", galaxyDesc: "在房间投影满天星空",
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
    welcome: "환영합니다", checkout: "체크아웃",
    sending: "전송 중…", success: "완료", failed: "실패",
    accessDenied: "접근 거부", accessDeniedDesc: "이 링크는 유효하지 않거나 숙박 기간이 아닙니다.",
    enterPin: "PIN 입력", pinPrompt: "숙박 시 안내받은 PIN을 입력하세요",
    wrongPin: "PIN이 올바르지 않습니다", pinLocked: "시도 횟수가 많습니다. 잠시 후 다시 시도하세요", verify: "확인",
    locTooFar: "객실 근처에서만 조작할 수 있습니다", locPermission: "위치 권한을 허용해 주세요", locUnavailable: "위치를 가져올 수 없습니다",
    comfortMode: "쾌적 모드", awayMode: "외출 (전체 OFF)",
    galaxy: "갤럭시 모드", galaxyDesc: "방 안에 별이 가득한 하늘을 투영",
    wafu: "일본풍 조명", wafuDesc: "안돈의 부드러운 간접 조명",
    cozyMode: "포근 모드", wafuDetails: "상세 설정", wafuWarmReset: "따뜻한 색으로", wafuBack: "조작 화면으로",
    brightness: "밝기", colorTemp: "색온도", color: "색상",
    presets: "프리셋", presetRelax: "휴식", presetRead: "독서", presetSleep: "취침",
    warmWhite: "전구색", coolWhite: "주광색",
  },
};

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
