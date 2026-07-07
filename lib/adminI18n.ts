export const ADMIN_LANGS = ["ja", "en", "zh"] as const;
export type AdminLang = (typeof ADMIN_LANGS)[number];

export const ADMIN_LANG_LABEL: Record<AdminLang, string> = {
  ja: "日本語", en: "English", zh: "中文",
};

export const isAdminLang = (v: unknown): v is AdminLang =>
  ADMIN_LANGS.includes(v as AdminLang);

type Dict = {
  dashboard: string;
  title: string;
  logout: string;
  doorQrTitle: string;
  assignTitle: string;
  assignDesc: string;
  ac: string;
  light: string;
  galaxy: string;
  galaxyOn: string;
  galaxyOff: string;
  none: string;
  save: string;
  saved: string;
  uploadImage: string;
  addTitle: string;
  room: string;
  language: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  optional: string;
  pinField: string;
  autoPlaceholder: string;
  addButton: string;
  all: string;
  noReservations: string;
  pin: string;
  regenPin: string;
  cancel: string;
  manual: string;
  openAirbnb: string;
  switchbotEnvNote: string;
  testTitle: string;
  testDesc: string;
  openTest: string;
  unlock: string;
  lock: string;
  acOn: string;
  acOff: string;
  lightOn: string;
  lightOff: string;
  // tabs
  tabToday: string;
  tabReservations: string;
  tabRooms: string;
  tabTest: string;
  // today table
  todayTitle: string;
  todayNone: string;
  guest: string;
  status: string;
  // room image
  imageTitle: string;
  imageUrlLabel: string;
  staying: string;
  empty: string;
  arriving: string;
  period: string;
  geofenceTitle: string;
  geofenceHint: string;
  geofenceEnable: string;
  radiusM: string;
  tabHistory: string;
  historyTitle: string;
  noLogs: string;
  srcGuest: string;
  srcAdmin: string;
  srcCron: string;
  when: string;
  checkoutOff: string;
  welcomeScene: string;
  syncNow: string;
  syncing: string;
  syncDone: string;
  syncFail: string;
  addRoomTitle: string;
  roomNameLabel: string;
  slugLabel: string;
  slugHint: string;
  icalLabel: string;
  addRoomBtn: string;
  rename: string;
};

export const AT: Record<AdminLang, Dict> = {
  ja: {
    dashboard: "HOST DASHBOARD",
    title: "部屋QR ＆ 予約管理",
    logout: "ログアウト",
    doorQrTitle: "ドア用 固定QR（印刷して各部屋の入口に貼る）",
    assignTitle: "部屋ごとのデバイス割り当て",
    assignDesc: "各部屋にエアコン・照明を選んで保存します（SwitchBotアプリで付けた名前で選べます）。",
    ac: "エアコン", light: "照明",
    galaxy: "🌌 ギャラクシー（プラネタリウム）", galaxyOn: "ギャラクシーON", galaxyOff: "ギャラクシーOFF",
    none: "（なし）", save: "保存", saved: "保存しました", uploadImage: "画像/動画をアップロード",
    addTitle: "手動で予約を追加（PIN自動発行）",
    room: "部屋", language: "言語",
    checkIn: "チェックイン（日本時間）", checkOut: "チェックアウト（日本時間）",
    guestName: "ゲスト名", optional: "任意", pinField: "PIN（任意・空なら自動4桁）",
    autoPlaceholder: "自動", addButton: "予約を追加してPINを発行",
    all: "すべて", noReservations: "予約がありません",
    pin: "PIN", regenPin: "PIN再発行", cancel: "キャンセル", manual: "手動",
    openAirbnb: "Airbnbで開く",
    switchbotEnvNote: "（Netlifyに SWITCHBOT_TOKEN / SWITCHBOT_SECRET を追加して再デプロイすると選べます）",
    testTitle: "デバイステスト（その場で動作確認）",
    testDesc: "各部屋のゲスト操作画面をPIN不要で開いて、実機を動かせます。",
    openTest: "テスト画面を開く",
    unlock: "解錠", lock: "施錠",
    acOn: "エアコンON", acOff: "エアコンOFF", lightOn: "照明ON", lightOff: "照明OFF",
    tabToday: "今日", tabReservations: "予約", tabRooms: "部屋", tabTest: "テスト",
    todayTitle: "今日のゲスト", todayNone: "本日の滞在はありません",
    guest: "ゲスト", status: "状態",
    imageTitle: "部屋アート画像", imageUrlLabel: "画像URL（/rooms/room-xxx.jpg など）",
    staying: "滞在中", empty: "空室", arriving: "到着予定", period: "期間",
    geofenceTitle: "位置制限（GPS）", geofenceHint: "建物の緯度・経度（座標は天気にも使用／チェックで位置制限ON）", geofenceEnable: "位置制限を有効化", radiusM: "半径(m)",
    tabHistory: "履歴", historyTitle: "操作履歴", noLogs: "履歴がありません",
    srcGuest: "ゲスト", srcAdmin: "管理者", srcCron: "自動", when: "日時",
    checkoutOff: "退室OFF（エアコン・照明）",
    welcomeScene: "ウェルカム（エアコン＋照明ON）",
    syncNow: "今すぐ同期", syncing: "同期中…", syncDone: "同期完了", syncFail: "同期失敗",
    addRoomTitle: "部屋を追加",
    roomNameLabel: "部屋名（あとで変更可）",
    slugLabel: "slug（URL用・半角英数とハイフン）",
    slugHint: "例: aki / natu / room-501。QRとURLに使われるため後から変更しないでください",
    icalLabel: "Airbnb iCal URL（任意・あとで設定可）",
    addRoomBtn: "部屋を追加",
    rename: "名前を変更",
  },
  en: {
    dashboard: "HOST DASHBOARD",
    title: "Room QR & Reservations",
    logout: "Log out",
    doorQrTitle: "Door QR (print & post at each room entrance)",
    assignTitle: "Assign devices per room",
    assignDesc: "Pick an air conditioner / light for each room and save (choose by the names set in the SwitchBot app).",
    ac: "Air Con", light: "Light",
    galaxy: "🌌 Galaxy (planetarium)", galaxyOn: "Galaxy On", galaxyOff: "Galaxy Off",
    none: "(none)", save: "Save", saved: "Saved", uploadImage: "Upload image / video",
    addTitle: "Add reservation manually (auto PIN)",
    room: "Room", language: "Language",
    checkIn: "Check-in (JST)", checkOut: "Check-out (JST)",
    guestName: "Guest name", optional: "optional", pinField: "PIN (optional, auto 4-digit if blank)",
    autoPlaceholder: "auto", addButton: "Add reservation & issue PIN",
    all: "All", noReservations: "No reservations",
    pin: "PIN", regenPin: "Reissue PIN", cancel: "Cancel", manual: "Manual",
    openAirbnb: "Open in Airbnb",
    switchbotEnvNote: "(Add SWITCHBOT_TOKEN / SWITCHBOT_SECRET on Netlify and redeploy to choose devices)",
    testTitle: "Device test (check on the spot)",
    testDesc: "Open each room's guest screen without a PIN and operate the real devices.",
    openTest: "Open test screen",
    unlock: "Unlock", lock: "Lock",
    acOn: "AC On", acOff: "AC Off", lightOn: "Light On", lightOff: "Light Off",
    tabToday: "Today", tabReservations: "Bookings", tabRooms: "Rooms", tabTest: "Test",
    todayTitle: "Today's guests", todayNone: "No stays today",
    guest: "Guest", status: "Status",
    imageTitle: "Room art image", imageUrlLabel: "Image URL (e.g. /rooms/room-xxx.jpg)",
    staying: "Staying", empty: "Empty", arriving: "Arriving", period: "Stay",
    geofenceTitle: "Location lock (GPS)", geofenceHint: "Building lat / lng (also used for weather; check to enable lock)", geofenceEnable: "Enable location lock", radiusM: "Radius (m)",
    tabHistory: "Log", historyTitle: "Operation log", noLogs: "No history",
    srcGuest: "Guest", srcAdmin: "Host", srcCron: "Auto", when: "Time",
    checkoutOff: "Turn off (AC & Light)",
    welcomeScene: "Welcome (AC + Light on)",
    syncNow: "Sync now", syncing: "Syncing…", syncDone: "Synced", syncFail: "Sync failed",
    addRoomTitle: "Add a room",
    roomNameLabel: "Room name (can change later)",
    slugLabel: "slug (for URL; lowercase letters, numbers, hyphens)",
    slugHint: "e.g. aki / natu / room-501. Used in the QR & URL — do not change afterwards",
    icalLabel: "Airbnb iCal URL (optional)",
    addRoomBtn: "Add room",
    rename: "Rename",
  },
  zh: {
    dashboard: "房东控制台",
    title: "房间二维码 & 预订管理",
    logout: "退出登录",
    doorQrTitle: "门口固定二维码（打印后贴在各房间入口）",
    assignTitle: "为每个房间分配设备",
    assignDesc: "为每个房间选择空调・灯光并保存（可按 SwitchBot App 中设置的名称选择）。",
    ac: "空调", light: "灯光",
    galaxy: "🌌 银河（星空投影仪）", galaxyOn: "银河开", galaxyOff: "银河关",
    none: "（无）", save: "保存", saved: "已保存", uploadImage: "上传图片/视频",
    addTitle: "手动添加预订（自动生成PIN）",
    room: "房间", language: "语言",
    checkIn: "入住（日本时间）", checkOut: "退房（日本时间）",
    guestName: "房客姓名", optional: "选填", pinField: "PIN（选填，留空则自动生成4位）",
    autoPlaceholder: "自动", addButton: "添加预订并生成PIN",
    all: "全部", noReservations: "暂无预订",
    pin: "PIN", regenPin: "重新生成PIN", cancel: "取消", manual: "手动",
    openAirbnb: "在 Airbnb 打开",
    switchbotEnvNote: "（在 Netlify 添加 SWITCHBOT_TOKEN / SWITCHBOT_SECRET 并重新部署后即可选择）",
    testTitle: "设备测试（当场确认）",
    testDesc: "无需PIN即可打开各房间的房客界面，直接操作真实设备。",
    openTest: "打开测试界面",
    unlock: "开锁", lock: "上锁",
    acOn: "空调开", acOff: "空调关", lightOn: "灯光开", lightOff: "灯光关",
    tabToday: "今日", tabReservations: "预订", tabRooms: "房间", tabTest: "测试",
    todayTitle: "今日房客", todayNone: "今天没有入住",
    guest: "房客", status: "状态",
    imageTitle: "房间图片", imageUrlLabel: "图片URL（如 /rooms/room-xxx.jpg）",
    staying: "入住中", empty: "空房", arriving: "即将入住", period: "时间段",
    geofenceTitle: "位置限制（GPS）", geofenceHint: "建筑纬度 / 经度（也用于天气；勾选启用位置限制）", geofenceEnable: "启用位置限制", radiusM: "半径(m)",
    tabHistory: "记录", historyTitle: "操作记录", noLogs: "暂无记录",
    srcGuest: "房客", srcAdmin: "房东", srcCron: "自动", when: "时间",
    checkoutOff: "关闭（空调·灯光）",
    welcomeScene: "欢迎（空调＋灯光开）",
    syncNow: "立即同步", syncing: "同步中…", syncDone: "同步完成", syncFail: "同步失败",
    addRoomTitle: "添加房间",
    roomNameLabel: "房间名称（之后可修改）",
    slugLabel: "slug（用于URL；小写字母、数字、连字符）",
    slugHint: "例：aki / natu / room-501。用于二维码和URL，之后请勿更改",
    icalLabel: "Airbnb iCal URL（选填）",
    addRoomBtn: "添加房间",
    rename: "重命名",
  },
};
