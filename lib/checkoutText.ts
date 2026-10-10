/**
 * ゲストのチェックアウト (忘れ物の確認 → 同意 → 電源 OFF) の文面と、ボタンを出す時間。
 *   依存なしの純粋なファイル (サーバー・ブラウザ・コンシェルジュの HTML で共通に使う)。
 *   ※ 同意の文面 (policy / agree) を変えたら CHECKOUT_POLICY_VERSION も上げる (記録に残るため)
 */
export type CoLang = "ja" | "en" | "zh" | "ko";
export const CO_LANGS: CoLang[] = ["ja", "en", "zh", "ko"];
export const CHECKOUT_POLICY_VERSION = "2026-10-v1";

export interface CoText {
  nm: string;
  /** 部屋の操作画面・コンシェルジュの帯 */
  btn: string; btnHint: string; btnTime: string;
  /** チェックアウト後の表示 */
  doneT: string; doneP: string; doneC: string; toConcierge: string; toRoom: string;
  /** 流れ */
  h1: string; p1: string; cnt: string; next: string; all: string; none: string; back: string; close: string;
  items: [string, string, string][];
  h2: string; policy: string; agree: string; next2: string;
  h3: string; p3: string; cancel: string; devs: string[]; off: string; onS: string;
  h4: string; p4: string; fail: string; retry: string; notYet: string; demo: string;
}

export const CO_T: Record<CoLang, CoText> = {
  ja: {
    nm: "日本語",
    btn: "チェックアウトする", btnHint: "お忘れ物の確認 → 電気とエアコンを OFF", btnTime: "チェックアウト {T}",
    doneT: "チェックアウト済み", doneP: "ご滞在ありがとうございました。お部屋の電気とエアコンは OFF にしました。この画面の操作は終了しています。",
    doneC: "お部屋の電気とエアコンは OFF です。地図と送迎の案内は、このまま見られます。",
    toConcierge: "コンシェルジュ（地図・送迎）", toRoom: "お部屋の画面へもどる",
    h1: "お忘れ物はありませんか", p1: "ひとつずつ確かめて、タップしてください。すべて確認すると次へ進めます。",
    cnt: "{n} / {t} 確認済み", next: "すべて確認しました", all: "すべてチェック", none: "チェックをすべて外す", back: "もどる", close: "閉じる",
    items: [["🛂", "パスポート", "金庫・引き出し・ベッドの横"], ["🎧", "ワイヤレスイヤホン", "ケースを開けて、左右 2 つありますか"], ["💍", "指輪・ネックレス・イヤリング", "洗面台・枕の下・ベッドの横"], ["📱", "スマホと充電器", "コンセントに充電器が残っていませんか"], ["👛", "財布・現金・カード", "テーブル・バッグのポケット"], ["🧥", "冷蔵庫・クローゼット・傘", "上着・飲み物・傘立て"]],
    h2: "お忘れ物についてのお願い",
    policy: "チェックアウト後に見つかったお忘れ物は、<b>当館では保管・配送いたしません。</b><br>開封せずに、所轄の警察署へお届けします。お問い合わせは警察署へお願いいたします。",
    agree: "持ち物を確認しました。上の内容に同意します。", next2: "同意してチェックアウト",
    h3: "お部屋の電源を切ります", p3: "10 秒後に、エアコンと照明をすべて切ります。", cancel: "取り消す（まだお部屋にいる）",
    devs: ["エアコン", "メインライト", "和風ライト", "ギャラクシー"], off: "OFF", onS: "ON",
    h4: "ご利用ありがとうございました", p4: "お部屋の電気とエアコンを切りました。どうぞお気をつけて。またのお越しをお待ちしております。",
    fail: "通信がうまくいきませんでした。電波のよい場所で、もう一度お試しください。", retry: "もう一度",
    notYet: "チェックアウトのボタンは、チェックアウト日の朝 6 時から使えます。", demo: "テスト表示です（電源は切りません・記録しません）",
  },
  en: {
    nm: "English",
    btn: "Check out", btnHint: "Belongings check → lights & air-con OFF", btnTime: "Check-out {T}",
    doneT: "Checked out", doneP: "Thank you for staying with us. The lights and air-con are off. This screen is no longer active.",
    doneC: "The lights and air-con in your room are off. The map and transfer info are still available.",
    toConcierge: "Concierge (map · transfer)", toRoom: "Back to the room screen",
    h1: "Did you forget anything?", p1: "Check each item and tap it. You can continue once everything is checked.",
    cnt: "{n} / {t} checked", next: "All checked", all: "Check all", none: "Uncheck all", back: "Back", close: "Close",
    items: [["🛂", "Passport", "Safe, drawers, bedside"], ["🎧", "Wireless earbuds", "Open the case — are both buds there?"], ["💍", "Rings, necklaces, earrings", "Washbasin, under the pillow, bedside"], ["📱", "Phone & charger", "Is a charger still in the outlet?"], ["👛", "Wallet, cash, cards", "Table, bag pockets"], ["🧥", "Fridge, closet, umbrella", "Jackets, drinks, umbrella stand"]],
    h2: "About items left behind",
    policy: "Items found after check-out are <b>not stored or shipped by us.</b><br>They are handed, unopened, to the local police station. Please contact the police for inquiries.",
    agree: "I have checked my belongings and agree to the above.", next2: "Agree and check out",
    h3: "Turning off the room", p3: "The air-con and all lights will turn off in 10 seconds.", cancel: "Cancel (I'm still in the room)",
    devs: ["Air-con", "Main light", "Lantern", "Galaxy"], off: "OFF", onS: "ON",
    h4: "Thank you for staying with us", p4: "The lights and air-con are off. Have a safe journey — we hope to see you again.",
    fail: "Connection failed. Please try again where the signal is better.", retry: "Try again",
    notYet: "Check-out is available from 6:00 am on your check-out day.", demo: "Test view (nothing is turned off or recorded)",
  },
  zh: {
    nm: "中文",
    btn: "办理退房", btnHint: "确认随身物品 → 关闭灯和空调", btnTime: "退房 {T}",
    doneT: "已退房", doneP: "感谢您的入住。房间的灯和空调已关闭。此页面的操作已结束。",
    doneC: "房间的灯和空调已关闭。地图和接送信息仍可查看。",
    toConcierge: "礼宾服务（地图・接送）", toRoom: "返回房间页面",
    h1: "有没有落下东西？", p1: "请逐项确认并点击。全部确认后即可继续。",
    cnt: "已确认 {n} / {t}", next: "已全部确认", all: "全部勾选", none: "取消全部", back: "返回", close: "关闭",
    items: [["🛂", "护照", "保险箱・抽屉・床边"], ["🎧", "无线耳机", "打开耳机盒，左右两只都在吗？"], ["💍", "戒指・项链・耳环", "洗手台・枕头下・床边"], ["📱", "手机和充电器", "插座上还有充电器吗？"], ["👛", "钱包・现金・银行卡", "桌上・包的口袋"], ["🧥", "冰箱・衣柜・雨伞", "外套・饮料・伞架"]],
    h2: "关于遗失物品",
    policy: "退房后发现的遗失物品，<b>本馆不予保管或邮寄。</b><br>将原封不动地交给当地警察署。如有询问，请联系警察署。",
    agree: "我已确认随身物品，并同意以上内容。", next2: "同意并退房",
    h3: "正在关闭房间电源", p3: "10 秒后将关闭空调和所有照明。", cancel: "取消（我还在房间里）",
    devs: ["空调", "主灯", "和风灯", "银河"], off: "关", onS: "开",
    h4: "感谢您的入住", p4: "灯和空调已关闭。祝您旅途平安，期待再次光临。",
    fail: "连接失败。请在信号好的地方再试一次。", retry: "再试一次",
    notYet: "退房按钮从退房当天早上 6 点起可以使用。", demo: "测试显示（不会关闭电源，也不会记录）",
  },
  ko: {
    nm: "한국어",
    btn: "체크아웃하기", btnHint: "소지품 확인 → 조명・에어컨 OFF", btnTime: "체크아웃 {T}",
    doneT: "체크아웃 완료", doneP: "이용해 주셔서 감사합니다. 객실의 조명과 에어컨을 껐습니다. 이 화면의 조작은 종료되었습니다.",
    doneC: "객실의 조명과 에어컨은 꺼져 있습니다. 지도와 송영 안내는 계속 볼 수 있습니다.",
    toConcierge: "컨시어지 (지도・송영)", toRoom: "객실 화면으로 돌아가기",
    h1: "잊으신 물건은 없나요?", p1: "하나씩 확인하고 눌러 주세요. 모두 확인하면 다음으로 넘어갑니다.",
    cnt: "{n} / {t} 확인", next: "모두 확인했습니다", all: "모두 체크", none: "모두 해제", back: "뒤로", close: "닫기",
    items: [["🛂", "여권", "금고・서랍・침대 옆"], ["🎧", "무선 이어폰", "케이스를 열어 좌우 두 개가 있나요?"], ["💍", "반지・목걸이・귀걸이", "세면대・베개 밑・침대 옆"], ["📱", "휴대폰과 충전기", "콘센트에 충전기가 남아 있지 않나요?"], ["👛", "지갑・현금・카드", "테이블・가방 주머니"], ["🧥", "냉장고・옷장・우산", "겉옷・음료・우산꽂이"]],
    h2: "분실물 안내",
    policy: "체크아웃 후 발견된 분실물은 <b>당관에서 보관・배송하지 않습니다.</b><br>개봉하지 않고 관할 경찰서에 전달합니다. 문의는 경찰서로 부탁드립니다.",
    agree: "소지품을 확인했으며 위 내용에 동의합니다.", next2: "동의하고 체크아웃",
    h3: "객실 전원을 끕니다", p3: "10초 후 에어컨과 모든 조명이 꺼집니다.", cancel: "취소 (아직 객실에 있어요)",
    devs: ["에어컨", "메인 조명", "화풍 조명", "갤럭시"], off: "OFF", onS: "ON",
    h4: "이용해 주셔서 감사합니다", p4: "조명과 에어컨을 껐습니다. 조심히 가세요. 다시 만나기를 기다리겠습니다.",
    fail: "통신에 실패했습니다. 신호가 좋은 곳에서 다시 시도해 주세요.", retry: "다시 시도",
    notYet: "체크아웃 버튼은 체크아웃 당일 오전 6시부터 사용할 수 있습니다.", demo: "테스트 화면입니다 (전원을 끄지 않고 기록하지 않습니다)",
  },
};

export const coLang = (v: unknown): CoLang => {
  const s = String(v ?? "").toLowerCase();
  return s.startsWith("zh") ? "zh" : (CO_LANGS as string[]).includes(s) ? (s as CoLang) : "en";
};

/** 文面から HTML タグを外す (記録用) */
export const plainText = (s: string) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** JST の日付 (YYYY-MM-DD) */
const jstDate = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

/**
 * チェックアウトのボタンを出す時間: チェックアウト日の朝 6 時 (日本時間) から、チェックアウトの時刻まで。
 *   チェックアウトが朝 6 時より前の予約は、その 4 時間前から。
 */
export function checkoutWindow(checkOutIso: string, nowMs: number): { open: boolean; startMs: number; endMs: number } {
  const end = Date.parse(checkOutIso);
  if (!Number.isFinite(end)) return { open: false, startMs: NaN, endMs: NaN };
  const six = Date.parse(`${jstDate(end)}T06:00:00+09:00`);
  const start = Math.min(six, end - 4 * 3600e3);
  return { open: nowMs >= start && nowMs < end, startMs: start, endMs: end };
}

/** チェックアウトの時刻の表示 (例 10:00) */
export const coTime = (checkOutIso: string) => {
  const d = new Date(Date.parse(checkOutIso) + 9 * 3600e3);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
