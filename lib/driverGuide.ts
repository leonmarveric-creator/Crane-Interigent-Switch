/**
 * 案内モードでゲストに見せる説明 (ゲストの言語)。{code} {pin} {ssid} {pass} は実際の値に置き換える。
 */
export type GuideLang = "en" | "zh" | "ko" | "ja";
export type GuideStep = { icon: "door" | "phone" | "home" | "wifi" | "chat"; h: string; big?: string; p: string };

export const GUIDE: Record<GuideLang, GuideStep[]> = {
  en: [
    { icon: "door", h: "Building entrance", big: "{code} ✓", p: "Enter this code on the keypad next to the entrance door, then press ✓. The door unlocks for a few seconds." },
    { icon: "phone", h: "Your room key", big: "PIN {pin}", p: "Scan the QR code, enter this PIN, then tap <b>Unlock</b>. The lights and air-con turn on automatically when you enter for the first time." },
    { icon: "home", h: "Smart room", p: "Control the lights, air-con and the Galaxy star projector from your phone. You can also hold the mic button and say “Lights on”." },
    { icon: "wifi", h: "Wi-Fi", big: "{ssid}", p: "Password: <b>{pass}</b><br>You can also ask the room assistant “What's the Wi-Fi password?”." },
    { icon: "chat", h: "Need help?", p: "Tap <b>Contact host</b> at the bottom of the room page. We are happy to help anytime. Enjoy your stay!" },
  ],
  zh: [
    { icon: "door", h: "大楼入口", big: "{code} ✓", p: "在入口门旁的密码键盘输入这个密码，然后按 ✓。门锁会打开几秒钟。" },
    { icon: "phone", h: "房间钥匙", big: "PIN {pin}", p: "扫描二维码并输入这个 PIN，然后点 <b>开锁</b>。第一次进门时，灯和空调会自动打开。" },
    { icon: "home", h: "智能房间", p: "用手机就能控制灯光、空调和星空投影。也可以按住麦克风按钮说“开灯”。" },
    { icon: "wifi", h: "Wi-Fi", big: "{ssid}", p: "密码：<b>{pass}</b><br>也可以问房间助手“Wi-Fi密码是什么？”" },
    { icon: "chat", h: "需要帮助？", p: "点房间页面下方的 <b>联系房东</b>，我们随时为您服务。祝您入住愉快！" },
  ],
  ko: [
    { icon: "door", h: "건물 입구", big: "{code} ✓", p: "입구 옆 키패드에 이 번호를 입력하고 ✓를 누르세요. 문이 몇 초 동안 열립니다." },
    { icon: "phone", h: "객실 열쇠", big: "PIN {pin}", p: "QR 코드를 스캔하고 이 PIN을 입력한 뒤 <b>잠금 해제</b>를 누르세요. 처음 들어갈 때 조명과 에어컨이 자동으로 켜집니다." },
    { icon: "home", h: "스마트 객실", p: "휴대폰으로 조명, 에어컨, 갤럭시 별빛 프로젝터를 조작할 수 있어요. 마이크 버튼을 누르고 \"조명 켜줘\"라고 말해도 됩니다." },
    { icon: "wifi", h: "Wi-Fi", big: "{ssid}", p: "비밀번호: <b>{pass}</b><br>객실 어시스턴트에게 \"와이파이 비밀번호는?\"이라고 물어봐도 돼요." },
    { icon: "chat", h: "도움이 필요하세요?", p: "객실 화면 아래의 <b>호스트에게 연락</b>을 누르세요. 언제든 도와드릴게요. 즐거운 시간 보내세요!" },
  ],
  ja: [
    { icon: "door", h: "建物の入口", big: "{code} ✓", p: "入口ドアの横のキーパッドにこの番号を入れて ✓ を押してください。数秒間ドアが開きます。" },
    { icon: "phone", h: "お部屋の鍵", big: "PIN {pin}", p: "QRコードを読み取ってこの PIN を入れ、<b>解錠</b> を押してください。はじめて入るとき、照明とエアコンが自動でつきます。" },
    { icon: "home", h: "スマートルーム", p: "照明・エアコン・ギャラクシー（星空）をスマホで操作できます。マイクを押して「照明つけて」と話してもOKです。" },
    { icon: "wifi", h: "Wi-Fi", big: "{ssid}", p: "パスワード：<b>{pass}</b><br>お部屋のアシスタントに「Wi-Fiのパスワードは？」と聞くこともできます。" },
    { icon: "chat", h: "困ったときは", p: "お部屋の画面の下にある <b>ホストに連絡</b> を押してください。いつでもお手伝いします。ごゆっくりどうぞ！" },
  ],
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
/** 値を入れた説明 (値が無い段は省く) */
export function guideSteps(lang: GuideLang, v: { code: string | null; pin: string | null; ssid: string | null; pass: string | null }): GuideStep[] {
  const fill = (s: string) => s.replace("{code}", esc(v.code || "")).replace("{pin}", esc(v.pin || "")).replace("{ssid}", esc(v.ssid || "")).replace("{pass}", esc(v.pass || ""));
  return GUIDE[lang].filter((s) => (s.icon !== "door" || v.code) && (s.icon !== "wifi" || v.ssid))
    .map((s) => ({ ...s, big: s.big && (s.icon !== "phone" || v.pin) ? fill(s.big) : undefined, p: fill(s.p) }));
}
