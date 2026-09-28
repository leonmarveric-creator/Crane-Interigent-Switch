/**
 * 車内 iPad の「再生中の曲」(お父さんのスマホで流れている曲) と、到着画面の鍵 QR。
 *   スマホ → 3 秒ごとに { 曲の ID・位置・長さ・再生中か } を送迎に載せる (cabin_trips.now_playing)
 *   iPad   → 位置を時間で進めながら (3 秒の間も) 歌詞を合わせる
 *   iPad の再生ボタン → cabin_trips.music_cmd → スマホが次の送信のときに受け取って操作する
 */
import type { GLang, LL } from "@/lib/cabinGeo";

/** スマホが送るもの */
export interface NowPlayingIn { id: string; pos: number; dur: number; on: boolean }
/** サーバが保存するもの (at = サーバが受け取った時刻 ms) */
export interface NowPlaying extends NowPlayingIn { at: number }
/** iPad に出す曲の情報 */
export interface CabinTrack { id: string; title: string; artist: string | null; cover: string | null; lrc: string | null }
/** iPad からスマホへの操作 */
export type MusicCmd = "toggle" | "next" | "prev" | "seek" | "duck";
export interface MusicCmdRow { c: MusicCmd; v: number | null; n: number }

const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/** スマホから来た値をきれいにする (おかしければ null) */
export function cleanNowPlaying(v: any): NowPlayingIn | null {
  if (!v || typeof v !== "object" || !isId(v.id)) return null;
  const pos = num(v.pos, 0, 36000), dur = num(v.dur, 0, 36000);
  if (pos == null) return null;
  return { id: v.id, pos: +pos.toFixed(2), dur: dur ?? 0, on: !!v.on };
}
export function toNowPlaying(v: any): NowPlaying | null {
  const c = cleanNowPlaying(v); const at = num(v?.at, 0, 1e15);
  return c && at != null ? { ...c, at } : null;
}
/** 今の位置 (秒)。再生中なら受け取ってからの時間を足す。serverNow - Date.now() のずれ (skew) も直す */
export function npPos(np: NowPlaying, nowMs: number, skewMs = 0): number {
  let p = np.pos + (np.on ? Math.max(0, nowMs + skewMs - np.at) / 1000 : 0);
  if (np.dur > 0) p = Math.min(np.dur, p);
  return Math.max(0, p);
}
/** 送られてこなくなったら (スマホの画面が消えた・電波が切れた) 表示をやめる */
export const NP_STALE_MS = 20000;
export const npStale = (np: NowPlaying, nowMs: number, skewMs = 0) => nowMs + skewMs - np.at > NP_STALE_MS;

export function cleanCmd(c: unknown, v: unknown): MusicCmdRow | null {
  if (c !== "toggle" && c !== "next" && c !== "prev" && c !== "seek" && c !== "duck") return null;
  // seek = 秒 / duck = 音楽を下げておく秒数 (AI が話す間)
  const s = c === "seek" ? num(v, 0, 36000) : c === "duck" ? num(v, 1, 30) : null;
  if ((c === "seek" || c === "duck") && s == null) return null;
  return { c, v: s, n: Date.now() };
}

/** 今いる場所の名前 (全画面の歌詞の上に出す) */
export function locName(ll: LL | null): string {
  if (!ll) return "OSAKA BAY";
  const d = (a: number, b: number) => { const dy = (ll[0] - a) * 111000, dx = (ll[1] - b) * 91500; return Math.hypot(dx, dy); };
  if (d(34.426, 135.2792) < 1600) return "SKY GATE BRIDGE";
  if (ll[1] < 135.262) return "KANSAI AIRPORT";
  if (d(34.4106, 135.2974) < 1500) return "RINKU TOWN";
  if (ll[1] > 135.305) return "IZUMISANO";
  return "OSAKA BAY";
}

/** 到着画面の QR の URL (どちらも開いたあとに本人確認があるので、鍵の情報は入らない) */
export function qrUrls(origin: string, room: { roomSlug: string | null; entrance: string | null } | null, lang: GLang) {
  const o = origin.replace(/\/+$/, "");
  return {
    key: room?.entrance ? `${o}/key/${encodeURIComponent(room.entrance)}?lang=${lang}` : null,
    room: room?.roomSlug ? `${o}/room/${encodeURIComponent(room.roomSlug)}?lang=${lang}` : null,
  };
}

/* ---------------- 全画面・到着画面の文字 ---------------- */
export interface MusicText {
  nav: string; music: string; room: string; set: string; ready: string; out: string;
  toastRoom: string; toastSet: string; toastCmd: string; noLyrics: string;
  qKey: string; qRoom: string; qTip: string; qTitle: { key: string; room: string }; qSteps: { key: string[]; room: string[] }; qClose: string;
}
export const MUSIC_T: Record<GLang, MusicText> = {
  ja: {
    nav: "ナビゲーション", music: "ミュージック", room: "お部屋", set: "設定", ready: "ROOM READY", out: "CHECKED OUT",
    toastRoom: "お部屋の様子は右下に出ています", toastSet: "設定はドライバーのスマホで変えられます", toastCmd: "ドライバーのスマホに送りました", noLyrics: "♪",
    qKey: "エントランスの鍵", qRoom: "お部屋", qTip: "降りる前にスマホで読んでおくと、玄関ですぐ開けられます",
    qTitle: { key: "スマホで読む · エントランス", room: "スマホで読む · お部屋" },
    qSteps: { key: ["スマホのカメラでQRを読む", "お名前と電話番号の下4桁を入力", "玄関で「開ける」を押す"], room: ["スマホのカメラでQRを読む", "電話番号の下4桁を入力", "鍵・エアコン・照明をスマホで操作"] }, qClose: "閉じる",
  },
  zh: {
    nav: "导航", music: "音乐", room: "房间", set: "设置", ready: "ROOM READY", out: "CHECKED OUT",
    toastRoom: "房间的情况在右下角", toastSet: "设置请在司机的手机上更改", toastCmd: "已发送到司机的手机", noLyrics: "♪",
    qKey: "入口钥匙", qRoom: "您的房间", qTip: "下车前先用手机扫码，到门口就能直接开门",
    qTitle: { key: "用手机扫码 · 打开入口", room: "用手机扫码 · 进入房间" },
    qSteps: { key: ["用手机相机扫描二维码", "输入姓名和电话号码后4位", "到入口后点「开门」"], room: ["用手机相机扫描二维码", "输入电话号码后4位", "可以开门、调空调和照明"] }, qClose: "关闭",
  },
  en: {
    nav: "Navigation", music: "Music", room: "Room", set: "Settings", ready: "ROOM READY", out: "CHECKED OUT",
    toastRoom: "Your room is shown at the bottom right", toastSet: "Settings are changed on the driver's phone", toastCmd: "Sent to the driver's phone", noLyrics: "♪",
    qKey: "Entrance key", qRoom: "Your room", qTip: "Scan before you get out — the door will be ready when you arrive",
    qTitle: { key: "Scan with your phone · Entrance", room: "Scan with your phone · Your room" },
    qSteps: { key: ["Open your phone camera and scan", "Enter your name and the last 4 digits of your phone number", "At the entrance, tap “Open”"], room: ["Open your phone camera and scan", "Enter the last 4 digits of your phone number", "Unlock, air-con and lights from your phone"] }, qClose: "Close",
  },
  ko: {
    nav: "내비게이션", music: "음악", room: "객실", set: "설정", ready: "ROOM READY", out: "CHECKED OUT",
    toastRoom: "객실 상태는 오른쪽 아래에 있습니다", toastSet: "설정은 기사님의 휴대폰에서 바꿀 수 있습니다", toastCmd: "기사님의 휴대폰으로 보냈습니다", noLyrics: "♪",
    qKey: "입구 열쇠", qRoom: "객실", qTip: "내리기 전에 휴대폰으로 스캔해 두면 입구에서 바로 열 수 있어요",
    qTitle: { key: "휴대폰으로 스캔 · 입구", room: "휴대폰으로 스캔 · 객실" },
    qSteps: { key: ["휴대폰 카메라로 QR 스캔", "이름과 전화번호 뒤 4자리 입력", "입구에서 「열기」를 누르기"], room: ["휴대폰 카메라로 QR 스캔", "전화번호 뒤 4자리 입력", "잠금·에어컨·조명을 휴대폰으로"] }, qClose: "닫기",
  },
};
