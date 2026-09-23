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
  autoLockIn: (n: number) => string; lockNow: string; stayUnlocked: string; lockBtn: string; sensorLock: string;
  failed: string; rateLimit: string; stoppedMsg: string; notStarted: (when: string) => string;
  expiredMsg: string; noLock: string; genericErr: string;
  geoNotice: string; geoAskTitle: string; geoAskBody: string; geoAskOk: string; geoAskCancel: string;
  geoChecking: string; geoDenied: string; geoUnavailable: string; geoImprecise: string; geoFar: (m: number) => string;
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
    autoLockIn: (n) => `${n}秒後に自動で施錠されます`, lockNow: "今すぐ施錠", stayUnlocked: "自動では施錠されません。出るときは「施錠する」を押してください", sensorLock: "ドアを閉めると自動で施錠されます", lockBtn: "施錠する",
    failed: "鍵が応答しません。少し待ってもう一度お試しください",
    rateLimit: "操作回数の上限に達しました。1分ほど待ってからお試しください",
    stoppedMsg: "現在アプリでの解錠を一時停止しています。お手数ですがサポートへご連絡ください",
    notStarted: (w) => `${w} からご利用いただけます`,
    expiredMsg: "ご利用期間が終了しました。ご滞在ありがとうございました。",
    noLock: "この鍵はまだ設定されていません。サポートへご連絡ください",
    genericErr: "通信できませんでした。電波の良い場所でもう一度お試しください",
    geoNotice: "離れた場所からの誤操作を防ぐため、エントランスを開けるときだけ現在地を確認します（保存はしません）",
    geoAskTitle: "位置情報の確認について",
    geoAskBody: "ほかのゲストの安全のため、エントランスはドアの近くにいるときだけ開けられます。\nこのあと位置情報の許可を求められたら「許可」を選んでください。\n位置情報はドアの近くにいるかの確認だけに使い、保存しません。",
    geoAskOk: "OK（位置情報を許可して開ける）", geoAskCancel: "キャンセル",
    geoChecking: "現在地を確認中…",
    geoDenied: "位置情報がオフのため開けられません。ブラウザ（設定アプリ）でこのサイトの位置情報を許可してから、もう一度お試しください",
    geoUnavailable: "現在地を取得できませんでした。少し待つか、屋外に出てもう一度お試しください",
    geoImprecise: "位置の精度が低いため確認できません。iPhone の場合は「正確な位置情報」をオンにしてお試しください",
    geoFar: (m) => `エントランスから約 ${m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`} 離れています。ドアの前で操作してください`,
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
    autoLockIn: (n) => `Locks automatically in ${n}s`, lockNow: "Lock now", stayUnlocked: "It will not lock automatically. Tap “Lock” when you leave", sensorLock: "Locks automatically when the door closes", lockBtn: "Lock",
    failed: "The lock did not respond. Please wait a moment and try again",
    rateLimit: "Too many attempts. Please wait about a minute and try again",
    stoppedMsg: "App unlocking is temporarily paused. Please contact support",
    notStarted: (w) => `Available from ${w}`,
    expiredMsg: "Your stay has ended. Thank you for staying with us.",
    noLock: "This lock is not set up yet. Please contact support",
    genericErr: "Connection failed. Please try again where the signal is better",
    geoNotice: "To prevent the door from being opened by mistake from far away, we check your location only when you unlock the entrance (it is not stored)",
    geoAskTitle: "About your location",
    geoAskBody: "For the safety of other guests, the entrance can only be unlocked when you are near the door.\nWhen your browser asks for location access, please choose “Allow”.\nYour location is only used to check that you are near the door and is never stored.",
    geoAskOk: "OK (allow location and unlock)", geoAskCancel: "Cancel",
    geoChecking: "Checking your location…",
    geoDenied: "Location is turned off, so the door cannot be unlocked. Please allow location for this site in your browser (Settings) and try again",
    geoUnavailable: "Could not get your location. Please wait a moment or step outside and try again",
    geoImprecise: "Your location is not precise enough. On iPhone, turn on “Precise Location” and try again",
    geoFar: (m) => `You are about ${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} from the entrance. Please unlock it in front of the door`,
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
    autoLockIn: (n) => `${n} 秒後自動上鎖`, lockNow: "立即上鎖", stayUnlocked: "不會自動上鎖，離開時請按「上鎖」", sensorLock: "關上門後會自動上鎖", lockBtn: "上鎖",
    failed: "門鎖沒有回應，請稍候再試",
    rateLimit: "操作次數已達上限，請約 1 分鐘後再試",
    stoppedMsg: "目前暫停使用 App 開鎖，請聯絡客服",
    notStarted: (w) => `${w} 起可使用`,
    expiredMsg: "住宿期間已結束，感謝您的入住。",
    noLock: "此門鎖尚未設定，請聯絡客服",
    genericErr: "連線失敗，請在訊號較好的地方再試一次",
    geoNotice: "為了防止在遠處誤操作打開大門，只有在開大門時會確認您的位置（不會保存）",
    geoAskTitle: "關於位置資訊",
    geoAskBody: "為了其他房客的安全，只有在門附近時才能打開大門。\n接下來如果詢問是否允許使用位置資訊，請選擇「允許」。\n位置資訊只用於確認您是否在門附近，不會保存。",
    geoAskOk: "OK（允許位置資訊並開門）", geoAskCancel: "取消",
    geoChecking: "正在確認位置…",
    geoDenied: "位置資訊已關閉，無法開門。請在瀏覽器（設定）中允許此網站使用位置資訊後再試一次",
    geoUnavailable: "無法取得目前位置。請稍等一下，或到室外再試一次",
    geoImprecise: "位置精度太低，無法確認。iPhone 請開啟「精確位置」後再試",
    geoFar: (m) => `您距離大門約 ${m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${m} 公尺`}。請在門前操作`,
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
    autoLockIn: (n) => `${n} 秒后自动上锁`, lockNow: "立即上锁", stayUnlocked: "不会自动上锁，离开时请按「上锁」", sensorLock: "关上门后会自动上锁", lockBtn: "上锁",
    failed: "门锁没有响应，请稍后再试",
    rateLimit: "操作次数已达上限，请约 1 分钟后再试",
    stoppedMsg: "目前暂停使用 App 开锁，请联系客服",
    notStarted: (w) => `${w} 起可使用`,
    expiredMsg: "住宿期间已结束，感谢您的入住。",
    noLock: "此门锁尚未设置，请联系客服",
    genericErr: "连接失败，请在信号较好的地方再试一次",
    geoNotice: "为了防止在远处误操作打开大门，只有在开大门时会确认您的位置（不会保存）",
    geoAskTitle: "关于位置信息",
    geoAskBody: "为了其他客人的安全，只有在门附近时才能打开大门。\n接下来如果询问是否允许使用位置信息，请选择「允许」。\n位置信息只用于确认您是否在门附近，不会保存。",
    geoAskOk: "OK（允许位置信息并开门）", geoAskCancel: "取消",
    geoChecking: "正在确认位置…",
    geoDenied: "位置信息已关闭，无法开门。请在浏览器（设置）中允许此网站使用位置信息后再试一次",
    geoUnavailable: "无法获取当前位置。请稍等一下，或到室外再试一次",
    geoImprecise: "位置精度太低，无法确认。iPhone 请打开「精确位置」后再试",
    geoFar: (m) => `您距离大门约 ${m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${m} 米`}。请在门前操作`,
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
    autoLockIn: (n) => `${n}초 후 자동으로 잠깁니다`, lockNow: "지금 잠그기", stayUnlocked: "자동으로 잠기지 않습니다. 나갈 때 「잠그기」를 눌러 주세요", sensorLock: "문을 닫으면 자동으로 잠깁니다", lockBtn: "잠그기",
    failed: "도어락이 응답하지 않습니다. 잠시 후 다시 시도해 주세요",
    rateLimit: "조작 횟수 한도에 도달했습니다. 1분 정도 후에 다시 시도해 주세요",
    stoppedMsg: "현재 앱 잠금 해제가 일시 중지되었습니다. 고객센터에 문의해 주세요",
    notStarted: (w) => `${w}부터 이용 가능합니다`,
    expiredMsg: "이용 기간이 종료되었습니다. 이용해 주셔서 감사합니다.",
    noLock: "이 도어락은 아직 설정되지 않았습니다. 고객센터에 문의해 주세요",
    genericErr: "연결에 실패했습니다. 신호가 좋은 곳에서 다시 시도해 주세요",
    geoNotice: "멀리서 실수로 문이 열리는 것을 막기 위해, 현관을 열 때만 현재 위치를 확인합니다 (저장하지 않습니다)",
    geoAskTitle: "위치 정보 확인 안내",
    geoAskBody: "다른 게스트의 안전을 위해 현관은 문 근처에 있을 때만 열 수 있습니다.\n이어서 위치 정보 권한을 요청하면 「허용」을 선택해 주세요.\n위치 정보는 문 근처에 있는지 확인하는 데만 사용하며 저장하지 않습니다.",
    geoAskOk: "확인 (위치 허용하고 열기)", geoAskCancel: "취소",
    geoChecking: "현재 위치 확인 중…",
    geoDenied: "위치 정보가 꺼져 있어 열 수 없습니다. 브라우저(설정)에서 이 사이트의 위치 정보를 허용한 후 다시 시도해 주세요",
    geoUnavailable: "현재 위치를 가져오지 못했습니다. 잠시 기다리거나 실외에서 다시 시도해 주세요",
    geoImprecise: "위치 정확도가 낮아 확인할 수 없습니다. iPhone은 「정확한 위치」를 켜고 다시 시도해 주세요",
    geoFar: (m) => `현관에서 약 ${m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`} 떨어져 있습니다. 문 앞에서 조작해 주세요`,
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
