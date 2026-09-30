/**
 * ASTRAEA と話す: ゲストの質問メニュー (iPad の光の玉) / お父さんの指示 (スマホのボタン・声)。
 *   声: public/cabin/audio/ai/g-<id>-<番号>.mp3 (ゲスト) / d-<id>-<番号>.mp3 (お父さん)。字幕はゲストの言語。
 *   ※ 自動生成。セリフを変えたら声も作り直すこと。
 */
import type { GLang } from "@/lib/cabinGeo";

type Line = Record<GLang, string>;
export interface GuestQ { id: string; icon: string; q: Line; v: Line[] }
export interface CaptainCmd { id: CaptainId; icon: string; zh: string; ja: string; v: Line[] }
export type CaptainId = "intro" | "status" | "joke" | "room" | "bridge" | "thanks" | "checkin";
export const CAPTAIN_IDS: CaptainId[] = ["intro", "status", "joke", "room", "bridge", "thanks", "checkin"];
/** お父さんの指示 (ASTRAEA が答えるもの + 入り方ガイド + 聞き取れなかった) */
export type CaptainCmdId = CaptainId | "guide" | "unknown";
export const CMD_IDS: CaptainCmdId[] = [...CAPTAIN_IDS, "guide", "unknown"];

export const GUEST_Q: GuestQ[] = [
  { id: "who", icon: "🙋", q: {"ja": "あなたは誰？", "zh": "你是谁？", "en": "Who are you?", "ko": "당신은 누구예요?"}, v: [
    { en: "I'm Astraea, the in-car intelligence of Crane Nest. I navigate, I prepare your room, and occasionally, I'm charming.", ja: "私は ASTRAEA。Crane Nest の車内 AI です。道案内に、お部屋の準備。そして時々、魅力的です。", zh: "我是 ASTRAEA，Crane Nest 的车载智能。我负责导航、准备房间，偶尔还很迷人。", ko: "저는 ASTRAEA, Crane Nest의 차량 AI예요. 길 안내, 객실 준비, 그리고 가끔은 매력 발산을 합니다." },
    { en: "Astraea. Named after the star maiden of Greek myth. Tonight, I guide cars instead of stars. The pay is similar.", ja: "ASTRAEA です。ギリシャ神話の星の乙女から名前をいただきました。今日は星ではなく車の案内です。お給料は同じくらいです。", zh: "我是 ASTRAEA，名字来自希腊神话中的星之少女。今天我引导的不是星星而是汽车。薪水差不多。", ko: "ASTRAEA입니다. 그리스 신화 속 별의 여신에서 따온 이름이에요. 오늘은 별 대신 차를 안내해요. 월급은 비슷합니다." }
  ] },
  { id: "food", icon: "🍜", q: {"ja": "おすすめのごはんは？", "zh": "推荐吃什么？", "en": "Where should I eat?", "ko": "맛집 추천해 줄래요?"}, v: [
    { en: "For fresh seafood, the fishing port market in Izumisano. Ten minutes by car. I've never eaten there, but my data is very enthusiastic.", ja: "新鮮な海鮮なら、泉佐野漁港の青空市場です。車で 10 分。私は食べたことはありませんが、データがとても熱く語っています。", zh: "想吃新鲜海鲜，就去泉佐野渔港的青空市场，开车十分钟。我没吃过，但我的数据对它非常热情。", ko: "신선한 해산물은 이즈미사노 어항 시장이에요. 차로 10분. 먹어 본 적은 없지만, 제 데이터가 아주 열광적이에요." },
    { en: "Try mizu-nasu, the local eggplant you can eat raw. Juicy, sweet, and it has never once complained about traffic.", ja: "地元の水なすをぜひ。生で食べられる、みずみずしいなすです。しかも一度も渋滞に文句を言ったことがありません。", zh: "一定要尝尝本地的水茄子，可以生吃，多汁又甜，而且从来不抱怨堵车。", ko: "이 지역 미즈나스를 드셔 보세요. 날로 먹는 촉촉한 가지예요. 게다가 교통 체증에 불평한 적이 한 번도 없어요." }
  ] },
  { id: "weather", icon: "☀", q: {"ja": "明日の天気は？", "zh": "明天天气怎么样？", "en": "Weather tomorrow?", "ko": "내일 날씨는요?"}, v: [
    { en: "Tomorrow looks sunny. Perfect for sightseeing. I'll take the credit, if nobody objects.", ja: "明日は晴れの予報です。観光日和。どなたも反対しなければ、私の手柄にしておきます。", zh: "明天预报晴天，很适合观光。如果没人反对，这功劳就算我的。", ko: "내일은 맑음 예보예요. 관광하기 딱 좋아요. 아무도 반대하지 않으면 제 공으로 할게요." },
    { en: "Tomorrow brings rain. I recommend an umbrella. Or a hot spring. I strongly recommend the hot spring.", ja: "明日は雨の予報です。傘をおすすめします。もしくは温泉を。温泉を強くおすすめします。", zh: "明天有雨。建议带伞。或者去泡温泉。我强烈推荐温泉。", ko: "내일은 비 예보예요. 우산을 추천해요. 아니면 온천을요. 온천을 강력 추천합니다." },
    { en: "Tomorrow will be cloudy. Soft light, no sunburn, very photogenic. Clouds are underrated.", ja: "明日はくもりの予報です。やわらかい光で日焼けもせず、写真映えします。雲は過小評価されています。", zh: "明天多云。光线柔和，不会晒伤，拍照很好看。云被低估了。", ko: "내일은 흐림 예보예요. 부드러운 빛, 햇볕 걱정 없음, 사진발 최고. 구름은 과소평가돼 있어요." }
  ] },
  { id: "driver", icon: "🚗", q: {"ja": "ドライバーはどんな人？", "zh": "司机是什么样的人？", "en": "Tell me about the driver", "ko": "기사님은 어떤 분이에요?"}, v: [
    { en: "Captain Hiroshi. Excellent driver, excellent host, and the only human I let choose the music.", ja: "キャプテン・ヒロシです。運転も、おもてなしも一流。私が選曲を任せている、ただひとりの人間です。", zh: "Hiroshi 机长。开车一流，待客一流，也是我唯一允许选歌的人类。", ko: "캡틴 히로시예요. 운전도 접대도 일류. 제가 선곡을 맡기는 유일한 인간이에요." },
    { en: "Captain Hiroshi has driven this road thousands of times. I've calculated it thousands of times. Together, we are unstoppable. Within the speed limit.", ja: "キャプテン・ヒロシはこの道を何千回も走っています。私は何千回も計算しています。二人そろえば無敵です。法定速度の範囲で。", zh: "Hiroshi 机长跑过这条路几千次，我计算过几千次。我们联手就是无敌的。在限速范围内。", ko: "캡틴 히로시는 이 길을 수천 번 달렸고, 저는 수천 번 계산했어요. 둘이 합치면 무적이에요. 제한 속도 안에서요." }
  ] },
  { id: "joke", icon: "😂", q: {"ja": "ジョークを言って", "zh": "讲个笑话", "en": "Tell me a joke", "ko": "농담 하나 해 줘요"}, v: [
    { en: "Why did the car apply for a job at the hotel? It wanted to work in parking. I'll be here all week.", ja: "車がホテルの面接を受けた理由？パーキング部門で働きたかったから。……今週はずっとこの調子です。", zh: "汽车为什么去酒店应聘？因为它想在停车部门工作。……这周我都会是这个水平。", ko: "자동차가 호텔 면접을 본 이유는? 주차 부서에서 일하고 싶어서요. …이번 주 내내 이 수준이에요." },
    { en: "I tried to tell a joke about traffic. It didn't go anywhere.", ja: "渋滞のジョークを言おうとしたのですが、話が前に進みませんでした。", zh: "我本想讲个关于堵车的笑话，结果它一动不动。", ko: "교통 체증 농담을 하려 했는데, 이야기가 앞으로 나가질 않네요." },
    { en: "My sense of humor is still in beta. Please rate this joke five stars to help me improve.", ja: "私のユーモアはまだベータ版です。改善のため、このジョークに星 5 つをお願いします。", zh: "我的幽默感还在测试版。为了帮助我进步，请给这个笑话五星好评。", ko: "제 유머 감각은 아직 베타 버전이에요. 개선을 위해 이 농담에 별 다섯 개 부탁드려요." }
  ] },
  { id: "manners", icon: "🇯🇵", q: {"ja": "日本のマナーを教えて", "zh": "教我日本礼仪", "en": "Japanese manners?", "ko": "일본 매너 알려 줘요"}, v: [
    { en: "Please take your shoes off at the entrance. Socks are perfectly fine. I don't have feet, so I follow this rule perfectly.", ja: "玄関で靴を脱いでお上がりください。靴下のままで大丈夫です。私には足がないので、このルールは完璧に守れています。", zh: "请在玄关脱鞋后进入。穿着袜子就可以。我没有脚，所以这条规矩守得非常完美。", ko: "현관에서 신발을 벗고 들어오세요. 양말은 신고 계셔도 괜찮아요. 저는 발이 없어서 이 규칙을 완벽히 지켜요." },
    { en: "In Japan, it's polite to be quiet on trains. In this car, however, you may laugh at my jokes as loudly as you like.", ja: "日本では電車の中は静かにするのがマナーです。ただしこの車の中では、私のジョークに大声で笑っていただいて構いません。", zh: "在日本，坐电车时保持安静是礼貌。不过在这辆车里，您可以尽情为我的笑话大笑。", ko: "일본에서는 전철 안에서 조용히 하는 게 매너예요. 하지만 이 차 안에서는 제 농담에 마음껏 크게 웃으셔도 돼요." }
  ] },
  { id: "lights", icon: "💡", q: {"ja": "お部屋の明かりをつけて", "zh": "打开房间的灯", "en": "Turn on my room lights", "ko": "객실 불 켜 줘요"}, v: [
    { en: "Right away. Your room lights are on. I've also made the room look like I did it on purpose. Because I did.", ja: "かしこまりました。お部屋の明かりをつけました。しかも、ちゃんと狙ってやったように見えます。狙ってやりましたので。", zh: "马上办。房间的灯已经打开了。而且看起来像是我特意安排的。因为确实是。", ko: "바로 할게요. 객실 조명을 켰어요. 일부러 한 것처럼 보이게요. 실제로 일부러 했거든요." },
    { en: "Lights on. Your room is now glowing and waiting. It's been practicing.", ja: "照明オン。お部屋が明るくなって、あなたをお待ちしています。練習していましたから。", zh: "灯已打开。房间正亮着灯等您。它已经练习很久了。", ko: "조명 켜짐. 객실이 환하게 기다리고 있어요. 연습 많이 했거든요." }
  ] },
  { id: "checkin", icon: "📋", q: {"ja": "チェックイン", "zh": "办理入住", "en": "Check-in", "ko": "체크인"}, v: [
    { en: "Check-in mode. Please scan this code with your phone and register your passport. It takes about one minute. Two, if you pose for the photo.", ja: "チェックインモードです。スマホでこの QR を読み込んで、パスポートを登録してください。約 1 分で終わります。写真でポーズを決めると 2 分です。", zh: "入住登记模式。请用手机扫描这个二维码并登记护照。大约一分钟。如果拍照时摆姿势，就两分钟。", ko: "체크인 모드입니다. 휴대폰으로 이 QR을 스캔하고 여권을 등록해 주세요. 약 1분이면 끝나요. 사진에 포즈를 잡으시면 2분." }
  ] },
];
export const CAPTAIN: CaptainCmd[] = [
  { id: "intro", icon: "🎤", zh: "自我介绍", ja: "自己紹介して", v: [
    { en: "Of course, Captain. Good evening, everyone. I'm Astraea, the intelligence of this vehicle. The Captain drives. I do everything else. Mostly the talking.", ja: "かしこまりました、キャプテン。皆さま、こんばんは。この車の AI、ASTRAEA です。運転はキャプテン、それ以外は私が。主におしゃべりを。", zh: "遵命，机长。各位好，我是这辆车的智能助手 ASTRAEA。开车交给机长，其他的交给我。主要是聊天。", ko: "알겠습니다, 캡틴. 여러분 안녕하세요. 이 차의 AI, ASTRAEA입니다. 운전은 캡틴이, 나머지는 제가. 주로 수다를요." }
  ] },
  { id: "status", icon: "📊", zh: "状况报告", ja: "状況報告", v: [
    { en: "All systems nominal, Captain. Your guests are comfortable, the room is cooling, and we are right on schedule. The only concern is your coffee level.", ja: "全システム正常です、キャプテン。ゲストの皆さまは快適、お部屋は冷房中、到着も予定どおり。唯一の懸念は、キャプテンのコーヒー残量です。", zh: "所有系统正常，机长。客人们很舒适，房间正在降温，我们准时到达。唯一的担忧是您的咖啡余量。", ko: "모든 시스템 정상입니다, 캡틴. 손님들은 편안하시고, 객실은 냉방 중, 도착도 예정대로. 유일한 걱정은 캡틴의 커피 잔량입니다." },
    { en: "Status report. Route: clear. Room: ready. Guests: delightful. Driver: acceptable.", ja: "状況報告。ルート、順調。お部屋、準備完了。ゲスト、素敵。ドライバー、合格点。", zh: "状况报告。路线：顺畅。房间：已就绪。客人：非常可爱。司机：合格。", ko: "상황 보고. 경로: 원활. 객실: 준비 완료. 손님: 멋짐. 기사님: 합격점." }
  ] },
  { id: "joke", icon: "😂", zh: "讲个笑话", ja: "ジョーク", v: [
    { en: "As you wish, Captain. Why don't cars ever get lonely? Because they always have a lot of drive. Thank you. The Captain laughed on the inside.", ja: "仰せのままに、キャプテン。車が寂しくならない理由？いつもドライブがあるからです。……ありがとうございます。キャプテンは心の中で笑っています。", zh: "遵命，机长。汽车为什么从不寂寞？因为它总有动力。谢谢。机长在心里笑了。", ko: "분부대로, 캡틴. 자동차가 외롭지 않은 이유는? 늘 드라이브가 있으니까요. 감사합니다. 캡틴은 속으로 웃고 계십니다." },
    { en: "Captain, I must warn you, my jokes have a ninety percent failure rate. Here goes. What does a GPS say at a party? Recalculating my social life.", ja: "キャプテン、ご注意ください。私のジョークの失敗率は 90% です。では。パーティーで GPS は何と言う？『人付き合いを再計算中』。", zh: "机长，提醒您，我的笑话失败率是百分之九十。那我开始了：GPS 在派对上会说什么？“正在重新计算我的社交生活”。", ko: "캡틴, 미리 경고드려요. 제 농담 실패율은 90%예요. 갑니다. 파티에서 GPS가 하는 말은? '인간관계를 다시 계산 중'." }
  ] },
  { id: "room", icon: "🏠", zh: "准备房间", ja: "お部屋の準備", v: [
    { en: "Preparing the room now, Captain. Air conditioning on, lights on arrival, welcome mode engaged. The room is very excited to meet you.", ja: "ただいまお部屋を準備します、キャプテン。エアコン起動、照明は到着時に点灯、おもてなしモード起動。お部屋も皆さまに会えるのを楽しみにしています。", zh: "正在准备房间，机长。空调已开启，灯光到达时点亮，欢迎模式已启动。房间也非常期待见到各位。", ko: "지금 객실을 준비합니다, 캡틴. 에어컨 가동, 조명은 도착 시 점등, 환영 모드 가동. 객실도 여러분을 만나길 기대하고 있어요." }
  ] },
  { id: "bridge", icon: "🌉", zh: "马上过桥", ja: "もうすぐ橋", v: [
    { en: "I see it, Captain. Sky Gate Bridge in one minute. Boost systems standing by. Everyone, please enjoy the view. And hold on to your excitement.", ja: "確認しました、キャプテン。1 分後にスカイゲートブリッジです。ブーストシステム待機中。皆さま、景色をお楽しみください。わくわくは、しっかり握っておいてください。", zh: "看到了，机长。一分钟后到达天空门大桥。加速系统待命。各位，请欣赏风景，并抓紧您的兴奋。", ko: "확인했습니다, 캡틴. 1분 후 스카이 게이트 브리지입니다. 부스트 시스템 대기 중. 여러분, 경치를 즐기시고 설렘을 꽉 붙잡으세요." }
  ] },
  { id: "thanks", icon: "🙏", zh: "感谢客人", ja: "ゲストにお礼", v: [
    { en: "With pleasure, Captain. Thank you for staying at Crane Nest. It was an honor to drive you. Well, the Captain drove. I supervised.", ja: "喜んで、キャプテン。Crane Nest にお泊まりいただき、ありがとうございました。お送りできて光栄でした。……運転したのはキャプテンで、私は監督でしたが。", zh: "乐意之至，机长。感谢您入住 Crane Nest。能送您是我们的荣幸。嗯，开车的是机长，我负责监督。", ko: "기꺼이요, 캡틴. Crane Nest에 머물러 주셔서 감사합니다. 모셔다 드릴 수 있어 영광이었어요. 운전은 캡틴이, 저는 감독을 했지만요." }
  ] },
  { id: "checkin", icon: "📋", zh: "办理入住", ja: "チェックイン", v: [
    { en: "Right away, Captain. Everyone, please scan this code with your phone and register your passport. By the time we arrive, you'll be officially checked in. Efficiency is my love language.", ja: "かしこまりました、キャプテン。皆さま、スマホでこの QR を読み込み、パスポートを登録してください。到着する頃には、チェックイン完了です。効率こそ、私の愛情表現です。", zh: "马上办，机长。各位，请用手机扫描这个二维码并登记护照。到达时，您就已经完成入住了。效率就是我表达爱的方式。", ko: "바로 할게요, 캡틴. 여러분, 휴대폰으로 이 QR을 스캔해서 여권을 등록해 주세요. 도착할 즈음이면 체크인 완료입니다. 효율이 제 애정 표현이에요." },
    { en: "Check-in mode engaged, Captain. Passports, please. Digitally. The paperwork is on me.", ja: "チェックインモード起動、キャプテン。パスポートをお願いします。デジタルで。書類仕事は私が引き受けます。", zh: "入住模式已启动，机长。请出示护照，电子版的。文书工作交给我。", ko: "체크인 모드 가동, 캡틴. 여권을 부탁드려요. 디지털로요. 서류 작업은 제가 맡겠습니다." }
  ] },
];
/** 同じ質問を 3 回目 */
export const REPEAT: Line[] = [
  { en: "You asked that already. I'm flattered you enjoyed it.", ja: "さっきもお答えしましたね。気に入っていただけたようで光栄です。", zh: "您刚才问过了。看来您很喜欢，我很荣幸。", ko: "아까도 물어보셨죠. 마음에 드셨다니 영광이에요." },
  { en: "Déjà vu detected. I'll answer again, with the same enthusiasm.", ja: "デジャヴを検知しました。同じ熱量で、もう一度お答えします。", zh: "检测到既视感。我会以同样的热情再回答一次。", ko: "데자뷔 감지. 같은 열정으로 다시 대답할게요." }
];
/** 声の指示が分からなかった */
export const UNKNOWN: Line[] = [
  { en: "My apologies, Captain. I didn't quite catch that. Could you say it once more?", ja: "申し訳ありません、キャプテン。よく聞き取れませんでした。もう一度お願いできますか？", zh: "抱歉，机长。我没听清楚。能再说一遍吗？", ko: "죄송합니다, 캡틴. 잘 못 들었어요. 한 번 더 말씀해 주시겠어요?" },
  { en: "Captain, that was either a command or a very creative sentence. Please try again.", ja: "キャプテン、今のは指示でしょうか、それとも独創的な文章でしょうか。もう一度お願いします。", zh: "机长，刚才那是指令，还是一句很有创意的话？请再说一次。", ko: "캡틴, 방금 건 명령인가요, 아니면 아주 창의적인 문장인가요? 다시 한 번 부탁드려요." }
];

export const guestAudio = (id: string, i: number) => `/cabin/audio/ai/g-${id}-${i}.mp3`;
export const captainAudio = (id: string, i: number) => `/cabin/audio/ai/d-${id}-${i}.mp3`;
export const talkAudioUrls = () => [
  ...GUEST_Q.flatMap((q) => q.v.map((_, i) => guestAudio(q.id, i))), ...REPEAT.map((_, i) => guestAudio("repeat", i)),
  ...CAPTAIN.flatMap((c) => c.v.map((_, i) => captainAudio(c.id, i))), ...UNKNOWN.map((_, i) => captainAudio("unknown", i)),
  ...(["intro", "s1", "s2", "s3", "room", "r1", "r2", "r3", "r4", "smart", "photo"] as const).map((k) => `/cabin/audio/ai/guide-${k}.mp3`),
];

/** 明日の天気で答えを選ぶ (0 = 晴れ / 1 = 雨 / 2 = くもり) */
export const weatherAnswer = (code: number | null | undefined) =>
  code == null ? 2 : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 ? 1 : code <= 2 ? 0 : 2;

/** お父さんの声 (文字にしたもの) → 指示。分からなければ null */
const WORDS: [CaptainId | "guide", RegExp][] = [
  ["guide", /開け方|あけかた|入り方|はいりかた|开门|開門|进门|進門|怎么进|怎麼進|how to (get in|open|enter)|entrance guide/i],
  ["checkin", /チェック\s*イン|ちぇっくいん|パスポート|入住|登记|登記|护照|護照|check\s*-?\s*in|passport/i],
  ["intro", /自己紹介|紹介|自我介绍|介绍|介紹|introduce|who are you/i],
  ["status", /状況|じょうきょう|報告|状况|报告|狀況|status|report/i],
  ["joke", /ジョーク|冗談|じょうだん|笑話|笑话|讲个笑|講個笑|joke|funny/i],
  ["bridge", /橋|はし|桥|bridge/i],
  ["thanks", /お礼|ありがとう|さようなら|バイバイ|感谢|感謝|谢谢|謝謝|再见|再見|goodbye|thank/i],
  ["room", /部屋|へや|準備|房间|房間|准备|準備|room|prepare/i],
];
export function matchCaptain(text: string): CaptainId | "guide" | null {
  const s = String(text || "");
  for (const [id, re] of WORDS) if (re.test(s)) return id;
  return null;
}

/* ---------------- 入り方ガイド (エントランス 3 ステップ + お部屋) ---------------- */
export type GuideKey = "intro" | "s1" | "s2" | "s3" | "room" | "r1" | "r2" | "r3" | "r4" | "smart" | "photo";
export const GUIDE_VOICE: Record<GuideKey, Line> = {
  "intro": { en: "Before we arrive, a quick lesson on how to get in. Short, simple, and very important. I checked.", ja: "到着の前に、入り方をご説明します。短くて、簡単で、とても大切です。確認済みです。", zh: "到达之前，先说明一下怎么进门。简短、简单，而且非常重要。我确认过了。", ko: "도착 전에 들어가는 방법을 알려 드릴게요. 짧고, 간단하고, 아주 중요해요. 제가 확인했어요." },
  "s1": { en: "Step one, from outside. Your phone is the easiest key. But if your battery runs out, use the keypad: enter the code, then press the unlock key at the bottom right. I could do it in a tenth of a second. Three seconds is perfectly fine for humans.", ja: "ステップ 1、外から開ける方法です。いちばん簡単なのはスマホですが、スマホの電池が切れたときは、テンキーで暗証番号を入力し、右下の解錠キーを押します。私なら 0.1 秒ですが、人間の皆さまは 3 秒で大丈夫です。", zh: "第一步，从外面开门。用手机开门最方便；如果手机没电了，就在键盘输入密码，再按右下角的解锁键。我只要 0.1 秒，人类用 3 秒就完全可以。", ko: "1단계, 밖에서 여는 방법이에요. 휴대폰으로 여는 게 가장 쉽지만, 배터리가 떨어졌을 때는 키패드에 비밀번호를 입력하고 오른쪽 아래 잠금 해제 버튼을 누르세요. 저는 0.1초면 되지만, 사람은 3초면 충분해요." },
  "s2": { en: "Step two. From the inside, grip the white knob. Horizontal means locked. Turn it to the right, a quarter turn, until it stands upright. Click. Unlocked. Then simply open the door. No code needed. Just a confident wrist.", ja: "ステップ 2。中から開けるときは、まず白いつまみを持ちます。横向きは施錠中。右へ、縦になるまで 4 分の 1 回します。カチッ。これで解錠です。あとはドアを開けるだけ。暗証番号は不要、自信のある手首だけで十分です。", zh: "第二步。从室内开门时，先握住白色旋钮。横向是上锁状态。向右转四分之一圈，直到竖起来。咔嗒一声，解锁了。然后开门就行。不需要密码，只需要一个自信的手腕。", ko: "2단계. 안에서 열 때는 먼저 흰색 손잡이를 잡으세요. 가로는 잠긴 상태예요. 세로가 될 때까지 오른쪽으로 4분의 1 돌리세요. 딸깍. 잠금 해제예요. 이제 문을 열면 돼요. 비밀번호는 필요 없어요. 자신 있는 손목이면 충분해요." },
  "s3": { en: "Step three. Close the door, and it locks itself after fifteen seconds. Very responsible. More responsible than most doors I know.", ja: "ステップ 3。ドアを閉めると、15 秒で自動的に鍵がかかります。とても責任感のあるドアです。私の知る多くのドアより。", zh: "第三步。关门后 15 秒会自动上锁。非常有责任感，比我认识的大多数门都强。", ko: "3단계. 문을 닫으면 15초 후 자동으로 잠겨요. 아주 책임감 있는 문이죠. 제가 아는 대부분의 문보다요." },
  "r4": { en: "One more thing. The entrance and your room have similar knobs, but they work the opposite way. At the entrance, horizontal means locked. In your room, horizontal means unlocked. Same shape, different personality.", ja: "もうひとつ大事なことを。エントランスとお部屋のつまみは形が似ていますが、向きの意味が逆です。エントランスは横が施錠、お部屋は横が解錠。見た目は同じ、性格は正反対です。", zh: "还有一点很重要。入口和房间的旋钮外观相似，但意思正好相反。入口是横向＝上锁，房间是横向＝解锁。长得一样，性格相反。", ko: "하나 더 중요한 점이요. 입구와 객실의 손잡이는 모양이 비슷하지만 의미가 반대예요. 입구는 가로가 잠김, 객실은 가로가 잠금 해제. 생긴 건 같아도 성격은 정반대예요." },
  "smart": { en: "Honestly, the easiest way is your phone. Scan these codes, and you can unlock the entrance and your room with one tap. No codes to remember, no knobs to argue with. I'd use it myself. If I had hands.", ja: "正直に申し上げると、いちばん確実なのはスマホです。この QR を読み込めば、エントランスもお部屋もワンタップで開けられます。番号を覚える必要も、つまみと格闘する必要もありません。私なら使います。手があれば、ですが。", zh: "说实话，最可靠的方法是用手机。扫描这些二维码，入口和房间都能一键开锁。不用记密码，也不用和旋钮较劲。换作是我也会用。如果我有手的话。", ko: "솔직히 가장 확실한 방법은 휴대폰이에요. 이 QR을 스캔하면 입구도 객실도 한 번의 탭으로 열 수 있어요. 비밀번호를 외울 필요도, 손잡이와 씨름할 필요도 없어요. 저라면 쓸 거예요. 손이 있다면요." },
  "photo": { en: "Please take a photo of this screen. I'll hold still. I'm very photogenic.", ja: "この画面を写真に撮ってください。私はじっとしています。写真写りには自信がありますので。", zh: "请拍下这个画面。我会一动不动。我很上镜的。", ko: "이 화면을 사진으로 찍어 주세요. 가만히 있을게요. 사진발은 자신 있거든요." },
  "room": { en: "Now, your room. It has its own keypad, and its own code.", ja: "続いて、お部屋です。お部屋にも専用のテンキーと、専用の暗証番号があります。", zh: "接下来是您的房间。房间有自己的密码键盘和专属密码。", ko: "이제 객실이에요. 객실에도 전용 키패드와 전용 비밀번호가 있어요." },
  "r1": { en: "Enter your room code, then press the unlock key at the bottom right. Same ritual as the entrance. You're practically a professional now.", ja: "お部屋の暗証番号を入力して、右下の解錠キーを押します。エントランスと同じ手順です。もう、ほぼプロですね。", zh: "输入房间密码，再按右下角的解锁键。和入口一样的步骤。您现在几乎是专业人士了。", ko: "객실 비밀번호를 입력하고 오른쪽 아래 잠금 해제 버튼을 누르세요. 입구와 같은 순서예요. 이제 거의 프로시네요." },
  "r2": { en: "From the inside, grip the knob. Slightly tilted means locked. Turn it to the left, counterclockwise, until it lies flat. Click. Unlocked. Then open the door. The entrance turns right, your room turns left. I don't design doors. I just report them.", ja: "中から開けるときは、つまみを持ちます。少し斜めは施錠中。左へ、反時計回りに、水平になるまで回します。カチッ。これで解錠、あとはドアを開けるだけです。エントランスは右、お部屋は左。ドアを設計したのは私ではありません。ご報告するだけです。", zh: "从室内开门时，先握住旋钮。稍微倾斜是上锁状态。向左、逆时针转，直到变成水平。咔嗒一声，解锁了，然后开门就行。入口向右，房间向左。门不是我设计的，我只负责报告。", ko: "안에서 열 때는 손잡이를 잡으세요. 약간 기울어진 건 잠긴 상태예요. 가로가 될 때까지 왼쪽, 시계 반대 방향으로 돌리세요. 딸깍. 잠금 해제, 이제 문을 열면 돼요. 입구는 오른쪽, 객실은 왼쪽. 문은 제가 설계하지 않았어요. 보고만 할 뿐이에요." },
  "r3": { en: "To check the lock: slightly tilted means locked. Horizontal means unlocked. Tilted, safe. Flat, open. Easy.", ja: "鍵の確認方法です。少し斜めなら施錠、水平なら解錠。斜めは安全、水平は開いている。簡単です。", zh: "确认门锁：稍微倾斜是已上锁，水平横向是已解锁。斜的安全，平的打开。很简单。", ko: "잠금 확인 방법이에요. 약간 기울어져 있으면 잠김, 가로면 잠금 해제. 기울면 안전, 가로면 열림. 쉽죠." }
};
export const guideAudio = (k: GuideKey) => `/cabin/audio/ai/guide-${k}.mp3`;
export const GUIDE_T: Record<GLang, Record<string, string>> = {
  zh: { t1: "室外开门", d1: "📱 平时用手机开门最方便。手机没电时：输入密码，再按右下角的解锁键。", t2: "室内开门", d2: "用手握住白色旋钮，向右转动。", t3: "15 秒自动上锁", d3: "关门后，15 秒自动上锁。", snap: "📸 请用手机拍下这个画面", c1: "输入密码 → 按解锁键", c2: "握住 → 向右转 → 竖起＝解锁", c3: "关门 15 秒后自动上锁", qr: "保存到手机", top: "入门指南", t4: "房间：输入密码", d4: "输入房间密码，再按右下角的解锁键。", t5: "房间：室内开门", d5: "用手握住旋钮，向左（逆时针）转动。", h5: "※ 入口是向右转，房间是向左转", t6: "确认门锁", d6: "稍微倾斜 = 已上锁；水平横向 = 已解锁。", tilt: "稍微倾斜", flat: "水平横向", c4: "房间密码 → 解锁键", c5: "握住 → 向左转 → 水平＝解锁", c6: "斜 = 上锁 / 平 = 解锁", ent: "入口", rm: "房间", t7: "注意：入口和房间正好相反", d7: "外观一样的旋钮，入口是「横向＝上锁」，房间是「横向＝解锁」。", c7: "⚠ 与入口相反", t8: "最可靠：用手机开锁", d8: "扫描二维码，入口和房间都能一键开锁，不用记密码。", k1: "入口钥匙", k2: "房间", rec: "推荐" , p21: "握住白色旋钮（横向＝上锁中）" , p22: "向右转（顺时针・1/4 圈）" , p23: "竖起来即解锁 → 开门" , p51: "握住旋钮（稍斜＝上锁中）" , p52: "向左转（逆时针）" , p53: "变水平即解锁 → 开门" , tr: "向右 ↻", tl: "向左 ↺" },
  ja: { t1: "外から開ける", d1: "📱 ふだんはスマホで開けるのがおすすめ。スマホの電池が切れたときは：暗証番号を入力し、右下の解錠キーを押します。", t2: "中から開ける", d2: "白いつまみを持って、右に回します。", t3: "15 秒で自動ロック", d3: "ドアを閉めると、15 秒で自動で鍵がかかります。", snap: "📸 この画面をスマホで撮影してください", c1: "番号を入力 → 解錠キー", c2: "持つ → 右へ回す → 縦で解錠", c3: "閉めると 15 秒で自動ロック", qr: "スマホに保存", top: "入り方ガイド", t4: "お部屋：番号を入力", d4: "お部屋の暗証番号を入力し、右下の解錠キーを押します。", t5: "お部屋：中から開ける", d5: "つまみを持って、左（反時計回り）に回します。", h5: "※ エントランスは右、お部屋は左です", t6: "鍵の確認", d6: "少し斜め＝施錠、水平＝解錠です。", tilt: "少し斜め", flat: "水平", c4: "部屋の番号 → 解錠キー", c5: "持つ → 左へ回す → 水平で解錠", c6: "斜め＝施錠 / 水平＝解錠", ent: "エントランス", rm: "お部屋", t7: "注意：エントランスとお部屋は逆", d7: "見た目は同じつまみでも、エントランスは「横＝施錠」、お部屋は「横＝解錠」です。", c7: "⚠ エントランスとは逆", t8: "いちばん確実なのはスマホの鍵", d8: "QR を読み込めば、エントランスもお部屋もワンタップで開けられます。番号を覚えなくて大丈夫です。", k1: "エントランスの鍵", k2: "お部屋", rec: "おすすめ" , p21: "白いつまみを持つ（横＝施錠中）" , p22: "右へ回す（時計回り・1/4 回転）" , p23: "縦になったら解錠 → ドアを開ける" , p51: "つまみを持つ（少し斜め＝施錠中）" , p52: "左へ回す（反時計回り）" , p53: "水平になったら解錠 → ドアを開ける" , tr: "右へ ↻", tl: "左へ ↺" },
  en: { t1: "Unlock from outside", d1: "📱 Your phone is the easiest key. If its battery runs out: enter the code, then press the bottom-right unlock key.", t2: "Unlock from inside", d2: "Grip the white knob and turn it clockwise.", t3: "Auto-lock in 15 s", d3: "Close the door. It locks automatically after 15 seconds.", snap: "📸 Please take a photo of this screen", c1: "Enter code → unlock key", c2: "Grip → turn right → upright = open", c3: "Auto-locks 15 s after closing", qr: "Save to phone", top: "ENTRANCE GUIDE", t4: "Room: enter the code", d4: "Enter your room code, then press the bottom-right unlock key.", t5: "Room: unlock from inside", d5: "Turn the knob to the left (counterclockwise) by hand.", h5: "* Entrance turns right, your room turns left", t6: "Check the lock", d6: "Slightly tilted = locked. Horizontal = unlocked.", tilt: "Slightly tilted", flat: "Horizontal", c4: "Room code → unlock key", c5: "Grip → turn left → flat = open", c6: "Tilted = locked / flat = open", ent: "ENTRANCE", rm: "ROOM", t7: "Careful: entrance and room are opposite", d7: "Same-looking knob — at the entrance, horizontal = locked; in your room, horizontal = unlocked.", c7: "⚠ Opposite of the entrance", t8: "Easiest: your phone is the key", d8: "Scan the codes to unlock the entrance and your room with one tap — no codes to remember.", k1: "Entrance key", k2: "Your room", rec: "RECOMMENDED" , p21: "Grip the white knob (horizontal = locked)" , p22: "Turn it right (clockwise, a quarter turn)" , p23: "Upright = unlocked → open the door" , p51: "Grip the knob (slightly tilted = locked)" , p52: "Turn it left (counterclockwise)" , p53: "Flat = unlocked → open the door" , tr: "RIGHT ↻", tl: "LEFT ↺" },
  ko: { t1: "밖에서 문 열기", d1: "📱 평소에는 휴대폰으로 여는 게 가장 편해요. 배터리가 없을 때는: 비밀번호 입력 후 오른쪽 아래 잠금 해제 버튼을 누르세요.", t2: "안에서 문 열기", d2: "흰색 손잡이를 잡고 오른쪽으로 돌리세요.", t3: "15초 후 자동 잠금", d3: "문을 닫으면 15초 후 자동으로 잠깁니다.", snap: "📸 이 화면을 휴대폰으로 찍어 주세요", c1: "비밀번호 → 잠금 해제", c2: "잡기 → 오른쪽 → 세로＝해제", c3: "닫으면 15초 후 자동 잠금", qr: "휴대폰에 저장", top: "출입 안내", t4: "객실: 비밀번호 입력", d4: "객실 비밀번호 입력 후 오른쪽 아래 잠금 해제 버튼을 누르세요.", t5: "객실: 안에서 열기", d5: "손잡이를 왼쪽(시계 반대 방향)으로 돌리세요.", h5: "※ 입구는 오른쪽, 객실은 왼쪽", t6: "잠금 확인", d6: "약간 기울어짐 = 잠김, 가로 = 잠금 해제.", tilt: "약간 기울어짐", flat: "가로 상태", c4: "객실 비밀번호 → 잠금 해제", c5: "잡기 → 왼쪽 → 가로＝해제", c6: "기울면 잠김 / 가로면 열림", ent: "입구", rm: "객실", t7: "주의: 입구와 객실은 반대", d7: "같은 모양의 손잡이지만, 입구는 「가로＝잠김」, 객실은 「가로＝잠금 해제」예요.", c7: "⚠ 입구와 반대", t8: "가장 확실한 방법: 휴대폰 열쇠", d8: "QR을 스캔하면 입구와 객실을 한 번의 탭으로 열 수 있어요. 비밀번호를 외울 필요 없어요.", k1: "입구 열쇠", k2: "객실", rec: "추천" , p21: "흰색 손잡이를 잡기 (가로＝잠김)" , p22: "오른쪽으로 돌리기 (시계 방향・1/4)" , p23: "세로가 되면 해제 → 문 열기" , p51: "손잡이를 잡기 (약간 기울어짐＝잠김)" , p52: "왼쪽으로 돌리기 (시계 반대 방향)" , p53: "가로가 되면 해제 → 문 열기" , tr: "오른쪽 ↻", tl: "왼쪽 ↺" },
};
/** お部屋の開け方のガイドがある部屋 (今は夏だけ。他の部屋は開け方が違うので、分かったら足す) */
export type RoomGuide = "natsu";
export const roomGuideOf = (slug: string | null | undefined): RoomGuide | null => (/summer|natsu|natu/i.test(String(slug || "")) ? "natsu" : null);

/* ---------------- チェックイン QR の画面 ---------------- */
/** チェックインのページ (ポスター「CHECK-IN REQUIRED BY JAPANESE LAW」の QR と同じ) */
export const CHECKIN_DEFAULT_URL = "https://crane-nest-cmn2.vercel.app";
/** お客さん用 Wi-Fi (電波が弱い・ローミングが遅いときに先につないでもらう) */
export const GUEST_WIFI = { ssid: "Crane Nest_Guest", pass: "RemenberPassport1234" };
export const wifiQrText = () => `WIFI:T:WPA;S:${GUEST_WIFI.ssid.replace(/([\\;,:"])/g, "\\$1")};P:${GUEST_WIFI.pass.replace(/([\\;,:"])/g, "\\$1")};;`;
export const WIFI_T: Record<GLang, { btn: string; title: string; steps: string[]; ssid: string; pass: string; ck: string }> = {
  ja: { btn: "Wi-Fi につなぐ", title: "スマホで読む · Wi-Fi に接続", steps: ["スマホのカメラで QR を読む", "「接続」をタップ", "つながったらチェックインへ"], ssid: "ネットワーク名", pass: "パスワード", ck: "チェックインへ" },
  zh: { btn: "连接 Wi-Fi", title: "用手机扫码 · 连接 Wi-Fi", steps: ["用手机相机扫描二维码", "点击「加入网络」", "连上后再办理入住"], ssid: "网络名称", pass: "密码", ck: "去办理入住" },
  en: { btn: "Connect to Wi-Fi", title: "Scan with your phone · Wi-Fi", steps: ["Scan the code with your phone camera", "Tap “Join” / “Connect”", "Then continue to check-in"], ssid: "Network", pass: "Password", ck: "Go to check-in" },
  ko: { btn: "Wi-Fi 연결", title: "휴대폰으로 스캔 · Wi-Fi 연결", steps: ["휴대폰 카메라로 QR 스캔", "「연결」 탭", "연결되면 체크인으로"], ssid: "네트워크 이름", pass: "비밀번호", ck: "체크인으로" },
};
export const CHECKIN_T: Record<GLang, [string, string[]]> = {
  zh: ["用手机扫码 · 办理入住", ["用手机相机扫描二维码", "拍摄护照并填写信息", "提交后即可完成入住"]],
  ja: ["スマホで読む · チェックイン", ["スマホのカメラで QR を読む", "パスポートを撮影して入力", "送信すればチェックイン完了"]],
  en: ["Scan with your phone · Check-in", ["Scan the code with your phone camera", "Take a photo of your passport", "Submit — you're checked in"]],
  ko: ["휴대폰으로 스캔 · 체크인", ["휴대폰 카메라로 QR 스캔", "여권 촬영 후 입력", "제출하면 체크인 완료"]],
};
