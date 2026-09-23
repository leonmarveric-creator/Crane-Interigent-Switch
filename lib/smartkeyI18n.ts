/** スマートキー（エントランス）画面の多言語辞書。 */
export const SK_LANGS = ["ja", "en", "zh-TW", "zh", "ko"] as const;
export type SkLang = (typeof SK_LANGS)[number];

export const SK_LANG_LABEL: Record<SkLang, string> = {
  ja: "日本語", en: "English", "zh-TW": "繁體中文", zh: "简体中文", ko: "한국어",
};
export const SK_LOCALE: Record<SkLang, string> = {
  ja: "ja-JP", en: "en-US", "zh-TW": "zh-TW", zh: "zh-CN", ko: "ko-KR",
};

export const isSkLang = (v: unknown): v is SkLang => SK_LANGS.includes(v as SkLang);
/** 予約の guest_lang (ja/en/zh/ko) や ?lang= から画面の言語へ。 */
export function toSkLang(v: unknown, fallback: SkLang = "en"): SkLang {
  if (isSkLang(v)) return v;
  const s = String(v ?? "").toLowerCase();
  if (s === "zh-hant" || s === "zh-hk" || s === "tw") return "zh-TW";
  if (s.startsWith("zh")) return "zh";
  if (s.startsWith("ja")) return "ja";
  if (s.startsWith("ko")) return "ko";
  if (s.startsWith("en")) return "en";
  return fallback;
}

type Dict = {
  available: string; before: string; expired: string; stopped: string; verifyChip: string;
  welcome: (name: string) => string; welcomeNoName: string;
  entrance: string; room: string;
  hold: string; holdToUnlock: string; holdToUnlockRoom: string; keepHolding: string;
  unlocking: string; locking: string; unlocked: string; lockedDone: string;
  autoLockIn: (n: number) => string; lockNow: string;
  failed: string; rateLimit: string; stoppedMsg: string; notStarted: (when: string) => string;
  expiredMsg: string; noLock: string; genericErr: string;
  keypad: string; tapToShow: string; checkout: string; wifi: string; copy: string; copied: string;
  support: string; validOnly: string; reservationNo: string;
  verifyTitle: string; verifyDesc: string; nameLabel: string; namePh: string;
  digitsLabel: string; digitsHint: string; verifyBtn: string; verifying: string;
  badCode: string; ambiguous: string; lockedOut: string;
  roomPanel: string; roomNoLock: string; verifyAgain: string;
};

export const SK: Record<SkLang, Dict> = {
  ja: {
    available: "ご利用可能", before: "ご利用開始前", expired: "ご利用期間終了", stopped: "一時停止中", verifyChip: "本人確認",
    welcome: (n) => `ようこそ、${n} 様`, welcomeNoName: "ようこそ",
    entrance: "エントランス", room: "お部屋",
    hold: "HOLD", holdToUnlock: "長押しで解錠", holdToUnlockRoom: "長押しでお部屋を解錠", keepHolding: "そのまま押し続けてください",
    unlocking: "解錠しています…", locking: "施錠しています…", unlocked: "解錠しました", lockedDone: "施錠しました",
    autoLockIn: (n) => `${n}秒後に自動で施錠されます`, lockNow: "今すぐ施錠",
    failed: "鍵が応答しません。少し待ってもう一度お試しください",
    rateLimit: "操作回数の上限に達しました。1分ほど待ってからお試しください",
    stoppedMsg: "現在アプリでの解錠を一時停止しています。お手数ですがサポートへご連絡ください",
    notStarted: (w) => `${w} からご利用いただけます`,
    expiredMsg: "ご利用期間が終了しました。ご滞在ありがとうございました。",
    noLock: "この鍵はまだ設定されていません。サポートへご連絡ください",
    genericErr: "通信できませんでした。電波の良い場所でもう一度お試しください",
    keypad: "暗証番号", tapToShow: "タップで表示", checkout: "チェックアウト", wifi: "WI-FI",
    copy: "コピー", copied: "コピーしました", support: "サポートに連絡",
    validOnly: "このキーは滞在期間中のみ有効です", reservationNo: "予約番号",
    verifyTitle: "本人確認", verifyDesc: "ご予約者のお名前と、ご予約時に登録した電話番号の下4桁を入力してください。",
    nameLabel: "お名前", namePh: "例: CHEN", digitsLabel: "電話番号の下4桁", digitsHint: "例: 090-1234-5678 → 5678",
    verifyBtn: "確認する", verifying: "確認しています…",
    badCode: "一致するご予約が見つかりません。お名前と番号をご確認ください",
    ambiguous: "複数のご予約が見つかりました。サポートへご連絡ください",
    lockedOut: "入力回数の上限に達しました。10分ほど待ってからお試しください",
    roomPanel: "お部屋の操作パネルを開く", roomNoLock: "お部屋の鍵はドアのテンキーをご利用ください。照明・エアコンは操作パネルから操作できます。",
    verifyAgain: "別のご予約で入り直す",
  },
  en: {
    available: "Available", before: "Not started yet", expired: "Stay ended", stopped: "Paused", verifyChip: "Verification",
    welcome: (n) => `Welcome, ${n}`, welcomeNoName: "Welcome",
    entrance: "Entrance", room: "Room",
    hold: "HOLD", holdToUnlock: "Press and hold to unlock", holdToUnlockRoom: "Press and hold to unlock your room", keepHolding: "Keep holding…",
    unlocking: "Unlocking…", locking: "Locking…", unlocked: "Unlocked", lockedDone: "Locked",
    autoLockIn: (n) => `Locks automatically in ${n}s`, lockNow: "Lock now",
    failed: "The lock did not respond. Please wait a moment and try again",
    rateLimit: "Too many attempts. Please wait about a minute and try again",
    stoppedMsg: "App unlocking is temporarily paused. Please contact support",
    notStarted: (w) => `Available from ${w}`,
    expiredMsg: "Your stay has ended. Thank you for staying with us.",
    noLock: "This lock is not set up yet. Please contact support",
    genericErr: "Connection failed. Please try again where the signal is better",
    keypad: "Door code", tapToShow: "Tap to show", checkout: "Check-out", wifi: "WI-FI",
    copy: "Copy", copied: "Copied", support: "Contact support",
    validOnly: "This key works only during your stay", reservationNo: "Booking",
    verifyTitle: "Verify your booking", verifyDesc: "Enter the guest name and the last 4 digits of the phone number used for your booking.",
    nameLabel: "Name", namePh: "e.g. CHEN", digitsLabel: "Last 4 digits of phone", digitsHint: "e.g. +1 416 555 1234 → 1234",
    verifyBtn: "Continue", verifying: "Checking…",
    badCode: "No matching booking. Please check your name and digits",
    ambiguous: "More than one booking matched. Please contact support",
    lockedOut: "Too many attempts. Please try again in about 10 minutes",
    roomPanel: "Open room controls", roomNoLock: "Use the keypad on your room door. Lights and air-con are in the room controls.",
    verifyAgain: "Use a different booking",
  },
  "zh-TW": {
    available: "可使用", before: "尚未開始", expired: "住宿已結束", stopped: "暫停中", verifyChip: "身分確認",
    welcome: (n) => `歡迎，${n}`, welcomeNoName: "歡迎",
    entrance: "大門", room: "房間",
    hold: "HOLD", holdToUnlock: "長按開鎖", holdToUnlockRoom: "長按打開房門", keepHolding: "請繼續按住",
    unlocking: "開鎖中…", locking: "上鎖中…", unlocked: "已開鎖", lockedDone: "已上鎖",
    autoLockIn: (n) => `${n} 秒後自動上鎖`, lockNow: "立即上鎖",
    failed: "門鎖沒有回應，請稍候再試",
    rateLimit: "操作次數已達上限，請約 1 分鐘後再試",
    stoppedMsg: "目前暫停使用 App 開鎖，請聯絡客服",
    notStarted: (w) => `${w} 起可使用`,
    expiredMsg: "住宿期間已結束，感謝您的入住。",
    noLock: "此門鎖尚未設定，請聯絡客服",
    genericErr: "連線失敗，請在訊號較好的地方再試一次",
    keypad: "密碼", tapToShow: "點擊顯示", checkout: "退房", wifi: "WI-FI",
    copy: "複製", copied: "已複製", support: "聯絡客服",
    validOnly: "此鑰匙僅在住宿期間有效", reservationNo: "預訂編號",
    verifyTitle: "身分確認", verifyDesc: "請輸入預訂人姓名，以及預訂時登記的電話號碼末 4 碼。",
    nameLabel: "姓名", namePh: "例：CHEN", digitsLabel: "電話號碼末 4 碼", digitsHint: "例：0912-345-678 → 5678",
    verifyBtn: "確認", verifying: "確認中…",
    badCode: "找不到相符的預訂，請確認姓名與號碼",
    ambiguous: "找到多筆預訂，請聯絡客服",
    lockedOut: "輸入次數已達上限，請約 10 分鐘後再試",
    roomPanel: "開啟房間控制面板", roomNoLock: "房門請使用門上的密碼鍵盤。燈光與冷氣可在控制面板操作。",
    verifyAgain: "使用其他預訂重新登入",
  },
  zh: {
    available: "可使用", before: "尚未开始", expired: "住宿已结束", stopped: "暂停中", verifyChip: "身份确认",
    welcome: (n) => `欢迎，${n}`, welcomeNoName: "欢迎",
    entrance: "大门", room: "房间",
    hold: "HOLD", holdToUnlock: "长按开锁", holdToUnlockRoom: "长按打开房门", keepHolding: "请继续按住",
    unlocking: "开锁中…", locking: "上锁中…", unlocked: "已开锁", lockedDone: "已上锁",
    autoLockIn: (n) => `${n} 秒后自动上锁`, lockNow: "立即上锁",
    failed: "门锁没有响应，请稍后再试",
    rateLimit: "操作次数已达上限，请约 1 分钟后再试",
    stoppedMsg: "目前暂停使用 App 开锁，请联系客服",
    notStarted: (w) => `${w} 起可使用`,
    expiredMsg: "住宿期间已结束，感谢您的入住。",
    noLock: "此门锁尚未设置，请联系客服",
    genericErr: "连接失败，请在信号较好的地方再试一次",
    keypad: "密码", tapToShow: "点击显示", checkout: "退房", wifi: "WI-FI",
    copy: "复制", copied: "已复制", support: "联系客服",
    validOnly: "此钥匙仅在住宿期间有效", reservationNo: "预订编号",
    verifyTitle: "身份确认", verifyDesc: "请输入预订人姓名，以及预订时登记的手机号码后 4 位。",
    nameLabel: "姓名", namePh: "例：CHEN", digitsLabel: "手机号码后 4 位", digitsHint: "例：138-1234-5678 → 5678",
    verifyBtn: "确认", verifying: "确认中…",
    badCode: "找不到匹配的预订，请确认姓名与号码",
    ambiguous: "找到多个预订，请联系客服",
    lockedOut: "输入次数已达上限，请约 10 分钟后再试",
    roomPanel: "打开房间控制面板", roomNoLock: "房门请使用门上的密码键盘。灯光和空调可在控制面板操作。",
    verifyAgain: "使用其他预订重新登录",
  },
  ko: {
    available: "이용 가능", before: "이용 시작 전", expired: "이용 기간 종료", stopped: "일시 정지", verifyChip: "본인 확인",
    welcome: (n) => `${n} 님, 환영합니다`, welcomeNoName: "환영합니다",
    entrance: "현관", room: "객실",
    hold: "HOLD", holdToUnlock: "길게 눌러 잠금 해제", holdToUnlockRoom: "길게 눌러 객실 잠금 해제", keepHolding: "계속 누르고 계세요",
    unlocking: "잠금 해제 중…", locking: "잠그는 중…", unlocked: "잠금 해제됨", lockedDone: "잠겼습니다",
    autoLockIn: (n) => `${n}초 후 자동으로 잠깁니다`, lockNow: "지금 잠그기",
    failed: "도어락이 응답하지 않습니다. 잠시 후 다시 시도해 주세요",
    rateLimit: "조작 횟수 한도에 도달했습니다. 1분 정도 후에 다시 시도해 주세요",
    stoppedMsg: "현재 앱 잠금 해제가 일시 중지되었습니다. 고객센터에 문의해 주세요",
    notStarted: (w) => `${w}부터 이용 가능합니다`,
    expiredMsg: "이용 기간이 종료되었습니다. 이용해 주셔서 감사합니다.",
    noLock: "이 도어락은 아직 설정되지 않았습니다. 고객센터에 문의해 주세요",
    genericErr: "연결에 실패했습니다. 신호가 좋은 곳에서 다시 시도해 주세요",
    keypad: "비밀번호", tapToShow: "탭하여 표시", checkout: "체크아웃", wifi: "WI-FI",
    copy: "복사", copied: "복사됨", support: "고객센터 문의",
    validOnly: "이 키는 숙박 기간에만 유효합니다", reservationNo: "예약 번호",
    verifyTitle: "본인 확인", verifyDesc: "예약자 이름과 예약 시 등록한 전화번호 뒤 4자리를 입력해 주세요.",
    nameLabel: "이름", namePh: "예: CHEN", digitsLabel: "전화번호 뒤 4자리", digitsHint: "예: 010-1234-5678 → 5678",
    verifyBtn: "확인", verifying: "확인 중…",
    badCode: "일치하는 예약이 없습니다. 이름과 번호를 확인해 주세요",
    ambiguous: "여러 예약이 확인되었습니다. 고객센터에 문의해 주세요",
    lockedOut: "입력 횟수 한도에 도달했습니다. 10분 정도 후에 다시 시도해 주세요",
    roomPanel: "객실 제어판 열기", roomNoLock: "객실 문은 도어 키패드를 이용해 주세요. 조명·에어컨은 제어판에서 조작할 수 있습니다.",
    verifyAgain: "다른 예약으로 다시 확인",
  },
};

/** "9/22(火) 15:00" 形式 (Asia/Tokyo)。 */
export function fmtStay(iso: string | null, lang: SkLang): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat(SK_LOCALE[lang], {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = g("weekday").replace(/^周|^週|요일$/, "");
  return `${g("month")}/${g("day")}(${wd}) ${g("hour").padStart(2, "0")}:${g("minute")}`;
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(iso));
}
