/**
 * 車内 iPad の画面の文字 (お客さんの言語: 日本語 / English / 中文 / 한국어)。
 * 音声はすべて英語の女性アンドロイド (public/cabin/audio) なので、ここは画面の文字だけ。
 */
import type { GLang } from "@/lib/cabinGeo";

export interface CabinText {
  etaIn: string; etaTo: string; dest: string; u: string; km: string; arrived: string;
  wx: string; rec: string; recs: [string, string, string][];
  room: string; live: string; out: string;
  ac: string; acm: { cool: string; heat: string }; run: string; off: string; lt: string; ltWait: string; ltOn: string; wifi: string; wifiOk: string; lock: string; locked: string;
  meter: { cool: [string, string, string]; heat: [string, string, string] }; ends: { cool: [string, string]; heat: [string, string] };
  tAc: { cool: string; heat: string }; tLt: string; tLtOn: string; tWf: string;
  inT: string; inRows: [string, string, string]; outT: string; outRows: [string, string, string]; yr: string;
  poi: Record<"bridge" | "rinku" | "izumi", [string, string, string]>;
  bSub: string; bFoot: string; bBr: string; bStat: string; bTriv: [string, string, string];
  wxName: (code: number) => string;
}

const wxJa = (c: number) => (c <= 1 ? "晴れ" : c <= 3 ? "くもり時々晴れ" : c <= 48 ? "くもり" : c <= 67 || (c >= 80 && c <= 82) ? "雨" : c <= 77 || c <= 86 ? "雪" : "雷雨");
const wxEn = (c: number) => (c <= 1 ? "Sunny" : c <= 3 ? "Partly cloudy" : c <= 48 ? "Cloudy" : c <= 67 || (c >= 80 && c <= 82) ? "Rain" : c <= 77 || c <= 86 ? "Snow" : "Thunderstorm");
const wxZh = (c: number) => (c <= 1 ? "晴" : c <= 3 ? "多云" : c <= 48 ? "阴" : c <= 67 || (c >= 80 && c <= 82) ? "雨" : c <= 77 || c <= 86 ? "雪" : "雷雨");
const wxKo = (c: number) => (c <= 1 ? "맑음" : c <= 3 ? "구름 조금" : c <= 48 ? "흐림" : c <= 67 || (c >= 80 && c <= 82) ? "비" : c <= 77 || c <= 86 ? "눈" : "뇌우");

export const CABIN_T: Record<GLang, CabinText> = {
  zh: {
    etaIn: "到达住处还有", etaTo: "到达{p}还有", dest: "目的地", u: "分", km: "约 {k} km", arrived: "已到达",
    wx: "泉佐野 · 天气", rec: "附近推荐",
    recs: [["🐟", "泉佐野渔港 青空市场", "新鲜海鲜 · 车程约10分钟"], ["🛍", "临空奥特莱斯", "购物 · 海边"], ["🌅", "临空公园", "海上夕阳"], ["♨", "犬鸣山", "温泉 · 瀑布 · 自然"]],
    room: "您的房间", live: "实时", out: "已退房",
    ac: "空调", acm: { cool: "制冷", heat: "制热" }, run: "运行中", off: "已关闭", lt: "照明", ltWait: "到达时自动打开", ltOn: "已打开", wifi: "Wi-Fi", wifiOk: "已准备", lock: "门锁", locked: "已上锁",
    meter: { cool: ["❄ 正在为您降温", "房间正在慢慢变凉", "❄ 持续降温中 · 请慢慢休息"], heat: ["🔥 正在为您升温", "房间正在慢慢变暖", "🔥 持续升温中 · 请慢慢休息"] },
    ends: { cool: ["热", "凉爽"], heat: ["冷", "温暖"] },
    tAc: { cool: "制冷运行中", heat: "制热运行中" }, tLt: "到达时自动点亮", tLtOn: "照明 已打开", tWf: "Wi-Fi 已准备",
    inT: "欢迎回家 · 请慢慢休息", inRows: ["💡 照明 已打开", "❄️ 空调 运行中", "📶 Wi-Fi 已准备"],
    outT: "感谢您的入住 · 祝您旅途平安", outRows: ["🔒 房门 已上锁", "💡 房间设备 全部关闭", "🧳 请带好随身物品"], yr: "YOUR ROOM",
    poi: { bridge: ["🌉", "天空之门大桥", "连接关西机场的大桥，全长约3.7公里"], rinku: ["🏙", "临空城", "临空门大厦 · 临空奥特莱斯"], izumi: ["🏡", "泉佐野", "欢迎来到泉佐野，马上就到了"] },
    bSub: "HIGH-SPEED MODE · 高速模式", bFoot: "天空之门大桥 · 全长 3,750 米 · 海上", bBr: "天空之门大桥", bStat: "{km} km · 最高 {max} km/h · 约 {t}",
    bTriv: ["全长 3,750 米 · 世界最长级别的桁架桥", "上层是汽车道，下层是铁路", "关西机场建在大阪湾的人工岛上"],
    wxName: wxZh,
  },
  en: {
    etaIn: "TO YOUR STAY", etaTo: "TO {p}", dest: "DESTINATION", u: "min", km: "about {k} km", arrived: "Arrived",
    wx: "IZUMISANO · WEATHER", rec: "NEARBY",
    recs: [["🐟", "Izumisano Fishing Port Market", "Fresh seafood · about 10 min"], ["🛍", "Rinku Premium Outlets", "Shopping by the sea"], ["🌅", "Rinku Park", "Sunset over the sea"], ["♨", "Inunakiyama", "Hot springs · waterfalls · nature"]],
    room: "YOUR ROOM", live: "LIVE", out: "CHECKED OUT",
    ac: "Air-con", acm: { cool: "cooling", heat: "heating" }, run: "Running", off: "Off", lt: "Lights", ltWait: "On when you arrive", ltOn: "On", wifi: "Wi-Fi", wifiOk: "Ready", lock: "Door lock", locked: "Locked",
    meter: { cool: ["❄ Cooling your room", "Getting cooler as we drive", "❄ Still cooling · make yourself at home"], heat: ["🔥 Warming your room", "Getting warmer as we drive", "🔥 Still warming · make yourself at home"] },
    ends: { cool: ["WARM", "COOL"], heat: ["COLD", "COZY"] },
    tAc: { cool: "COOLING", heat: "HEATING" }, tLt: "ON AT ARRIVAL", tLtOn: "LIGHTS ON", tWf: "Wi-Fi READY",
    inT: "Welcome home · Please relax", inRows: ["💡 Lights ON", "❄️ Air-con running", "📶 Wi-Fi ready"],
    outT: "Thank you for staying · Have a safe trip", outRows: ["🔒 Door locked", "💡 All room devices OFF", "🧳 Please take all your belongings"], yr: "YOUR ROOM",
    poi: { bridge: ["🌉", "Sky Gate Bridge", "Connects Kansai Airport to the mainland · about 3.7 km"], rinku: ["🏙", "Rinku Town", "Rinku Gate Tower Building · Premium Outlets"], izumi: ["🏡", "Izumisano", "Welcome to Izumisano. Almost there."] },
    bSub: "HIGH-SPEED MODE", bFoot: "SKY GATE BRIDGE · 3,750 m · OVER THE SEA", bBr: "SKY GATE BRIDGE", bStat: "{km} km · MAX {max} km/h · approx. {t}",
    bTriv: ["3,750 m · one of the world's longest truss bridges", "Cars on the upper deck, trains below", "Kansai Airport sits on a man-made island in Osaka Bay"],
    wxName: wxEn,
  },
  ja: {
    etaIn: "お宿まで あと", etaTo: "{p}まで あと", dest: "目的地", u: "分", km: "約 {k} km", arrived: "到着",
    wx: "泉佐野 · 天気", rec: "近くのおすすめ",
    recs: [["🐟", "泉佐野漁港 青空市", "新鮮な魚介 · 車で約10分"], ["🛍", "りんくうプレミアム・アウトレット", "買い物 · 海のそば"], ["🌅", "りんくう公園", "海に沈む夕日"], ["♨", "犬鳴山", "温泉 · 滝 · 自然"]],
    room: "お部屋", live: "LIVE", out: "チェックアウト済み",
    ac: "エアコン", acm: { cool: "冷房", heat: "暖房" }, run: "運転中", off: "OFF", lt: "照明", ltWait: "到着時に点灯", ltOn: "点灯", wifi: "Wi-Fi", wifiOk: "準備OK", lock: "鍵", locked: "施錠済み",
    meter: { cool: ["❄ お部屋を冷やしています", "走るほど涼しくなっています", "❄ 引き続き冷やしています · ごゆっくり"], heat: ["🔥 お部屋を暖めています", "走るほど暖かくなっています", "🔥 引き続き暖めています · ごゆっくり"] },
    ends: { cool: ["暑い", "涼しい"], heat: ["寒い", "暖かい"] },
    tAc: { cool: "冷房運転中", heat: "暖房運転中" }, tLt: "到着時に点灯", tLtOn: "照明 点灯", tWf: "Wi-Fi 準備OK",
    inT: "おかえりなさい · ごゆっくりどうぞ", inRows: ["💡 照明 ON", "❄️ エアコン 運転中", "📶 Wi-Fi 準備OK"],
    outT: "ご滞在ありがとうございました · お気をつけて", outRows: ["🔒 施錠しました", "💡 お部屋の設備 すべてOFF", "🧳 お忘れ物のないように"], yr: "YOUR ROOM",
    poi: { bridge: ["🌉", "スカイゲートブリッジ", "関西空港と本土を結ぶ橋 · 全長約3.7km"], rinku: ["🏙", "りんくうタウン", "りんくうゲートタワービル · アウトレット"], izumi: ["🏡", "泉佐野", "泉佐野へようこそ · もうすぐ到着です"] },
    bSub: "HIGH-SPEED MODE · 高速モード", bFoot: "スカイゲートブリッジ · 全長 3,750 m · 海の上", bBr: "スカイゲートブリッジ", bStat: "{km} km · 最高 {max} km/h · 約 {t}",
    bTriv: ["全長 3,750 m · 世界最大級のトラス橋", "上は車、下は電車が走る2階建ての橋", "関西空港は大阪湾の人工島にあります"],
    wxName: wxJa,
  },
  ko: {
    etaIn: "숙소까지", etaTo: "{p}까지", dest: "목적지", u: "분", km: "약 {k} km", arrived: "도착",
    wx: "이즈미사노 · 날씨", rec: "주변 추천",
    recs: [["🐟", "이즈미사노 어항 아오조라 시장", "신선한 해산물 · 차로 약 10분"], ["🛍", "린쿠 프리미엄 아웃렛", "쇼핑 · 바닷가"], ["🌅", "린쿠 공원", "바다 위의 석양"], ["♨", "이누나키산", "온천 · 폭포 · 자연"]],
    room: "객실", live: "LIVE", out: "체크아웃",
    ac: "에어컨", acm: { cool: "냉방", heat: "난방" }, run: "작동 중", off: "꺼짐", lt: "조명", ltWait: "도착 시 자동 점등", ltOn: "켜짐", wifi: "Wi-Fi", wifiOk: "준비 완료", lock: "도어락", locked: "잠김",
    meter: { cool: ["❄ 객실을 시원하게 하는 중", "달리는 동안 점점 시원해져요", "❄ 계속 냉방 중 · 편히 쉬세요"], heat: ["🔥 객실을 따뜻하게 하는 중", "달리는 동안 점점 따뜻해져요", "🔥 계속 난방 중 · 편히 쉬세요"] },
    ends: { cool: ["더움", "시원"], heat: ["추움", "따뜻"] },
    tAc: { cool: "냉방 중", heat: "난방 중" }, tLt: "도착 시 점등", tLtOn: "조명 켜짐", tWf: "Wi-Fi 준비",
    inT: "어서 오세요 · 편히 쉬세요", inRows: ["💡 조명 ON", "❄️ 에어컨 작동 중", "📶 Wi-Fi 준비 완료"],
    outT: "이용해 주셔서 감사합니다 · 안전한 여행 되세요", outRows: ["🔒 문 잠김", "💡 객실 설비 모두 OFF", "🧳 소지품을 잊지 마세요"], yr: "YOUR ROOM",
    poi: { bridge: ["🌉", "스카이 게이트 브리지", "간사이공항과 본토를 잇는 다리 · 약 3.7km"], rinku: ["🏙", "린쿠타운", "린쿠 게이트 타워 빌딩 · 아웃렛"], izumi: ["🏡", "이즈미사노", "이즈미사노에 오신 것을 환영합니다 · 곧 도착해요"] },
    bSub: "HIGH-SPEED MODE · 고속 모드", bFoot: "스카이 게이트 브리지 · 3,750 m · 바다 위", bBr: "스카이 게이트 브리지", bStat: "{km} km · 최고 {max} km/h · 약 {t}",
    bTriv: ["길이 3,750 m · 세계 최대급 트러스교", "위층은 자동차, 아래층은 철도", "간사이공항은 오사카만의 인공섬에 있어요"],
    wxName: wxKo,
  },
};
