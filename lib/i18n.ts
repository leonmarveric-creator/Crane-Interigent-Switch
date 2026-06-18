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
};

export const T: Record<Lang, Dict> = {
  ja: {
    unlock: "解錠", lock: "施錠", locked: "施錠中", unlocked: "解錠済み",
    ac: "エアコン", light: "照明", on: "オン", off: "オフ",
    wakeLight: "光目覚まし", setAlarm: "設定", clearAlarm: "解除", alarmSet: "セット完了",
    welcome: "ようこそ", checkout: "チェックアウト",
    sending: "送信中…", success: "完了", failed: "失敗しました",
    accessDenied: "アクセス拒否", accessDeniedDesc: "このリンクは無効か、滞在期間外です。",
  },
  en: {
    unlock: "Unlock", lock: "Lock", locked: "Locked", unlocked: "Unlocked",
    ac: "Air Con", light: "Light", on: "On", off: "Off",
    wakeLight: "Wake Light", setAlarm: "Set", clearAlarm: "Clear", alarmSet: "Alarm set",
    welcome: "Welcome", checkout: "Check-out",
    sending: "Sending…", success: "Done", failed: "Failed",
    accessDenied: "Access Denied", accessDeniedDesc: "This link is invalid or outside your stay period.",
  },
  zh: {
    unlock: "开锁", lock: "上锁", locked: "已上锁", unlocked: "已开锁",
    ac: "空调", light: "灯光", on: "开", off: "关",
    wakeLight: "光唤醒", setAlarm: "设定", clearAlarm: "取消", alarmSet: "已设定",
    welcome: "欢迎", checkout: "退房",
    sending: "发送中…", success: "完成", failed: "失败",
    accessDenied: "拒绝访问", accessDeniedDesc: "此链接无效或不在入住期间内。",
  },
  ko: {
    unlock: "잠금 해제", lock: "잠금", locked: "잠김", unlocked: "열림",
    ac: "에어컨", light: "조명", on: "켜기", off: "끄기",
    wakeLight: "라이트 알람", setAlarm: "설정", clearAlarm: "해제", alarmSet: "설정 완료",
    welcome: "환영합니다", checkout: "체크아웃",
    sending: "전송 중…", success: "완료", failed: "실패",
    accessDenied: "접근 거부", accessDeniedDesc: "이 링크는 유효하지 않거나 숙박 기간이 아닙니다.",
  },
};

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
