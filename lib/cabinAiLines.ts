/**
 * 車内 iPad の AI「ASTRAEA（アストレア）」のセリフ。状況に合わせて自分から話す。
 *   声: public/cabin/audio/ai/<id>-<番号>.mp3 (英語の女性アンドロイド)。字幕はゲストの言語。
 *   同じ場面でも毎回セリフが変わる (前回と同じものは続けて出さない)。
 *   ※ 自動生成。セリフを変えたら声も作り直すこと。
 */
import type { GLang } from "@/lib/cabinGeo";

export type AiLine = Record<GLang, string>;
export interface AiScene { cat: string; when: string; v: AiLine[] }
export const AI_NAME = "ASTRAEA";

export const AI_LINES = {
  "depart": { cat: "出発・到着", when: "お迎えで走り出したとき", v: [
    { en: "Welcome aboard. Seatbelt check complete. I also checked the driver's, just in case.", ja: "ようこそ。シートベルトの確認は済みました。念のため、ドライバーの分も。", zh: "欢迎上车。安全带已确认完毕。保险起见，司机的也确认了。", ko: "환영합니다. 안전벨트 확인 완료. 혹시 몰라 기사님 것도 확인했습니다." },
    { en: "Good to have you. I'm Astraea, your in-car assistant. The driver drives. I handle the witty remarks.", ja: "ようこそ。車内アシスタントの ASTRAEA（アストレア）です。運転はドライバー、気の利いたひと言は私の担当です。", zh: "欢迎。我是车内助手 ASTRAEA（阿斯特莱亚）。开车交给司机，俏皮话交给我。", ko: "반갑습니다. 차내 어시스턴트 ASTRAEA(아스트레아)입니다. 운전은 기사님이, 재치 있는 한마디는 제가 맡습니다." },
    { en: "Systems online. Route locked. Snacks, unfortunately, not included.", ja: "システム起動、ルート確定。お菓子は、残念ながら含まれておりません。", zh: "系统已启动，路线已锁定。很遗憾，零食不包含在内。", ko: "시스템 가동, 경로 확정. 간식은 아쉽게도 포함되어 있지 않습니다." },
  ] },
  "half": { cat: "出発・到着", when: "道のりの半分まで来たとき", v: [
    { en: "We're halfway there. The best part is coming up.", ja: "ちょうど半分です。ここからが良いところです。", zh: "正好一半路程。精彩的部分马上开始。", ko: "딱 절반 왔습니다. 좋은 구간은 지금부터예요." },
    { en: "Halfway point. I'd offer you snacks, but I'm mostly software.", ja: "中間地点です。お菓子をお出ししたいところですが、私はほぼソフトウェアでして。", zh: "中间点到了。本想给您拿点零食，可惜我基本上是软件。", ko: "중간 지점입니다. 간식을 드리고 싶지만, 저는 거의 소프트웨어라서요." },
  ] },
  "km5": { cat: "出発・到着", when: "残り 5 km", v: [
    { en: "Five kilometers to go. Plenty of time to enjoy the view.", ja: "残り 5 km。景色を楽しむ時間は、まだたっぷりあります。", zh: "还有 5 公里。欣赏风景的时间还很充足。", ko: "5킬로미터 남았습니다. 경치를 즐길 시간은 아직 충분해요." },
    { en: "Five kilometers remaining. I've started preparing your welcome. Mentally.", ja: "残り 5 km。歓迎の準備を始めました。心の中で。", zh: "还剩 5 公里。我已经开始准备欢迎仪式了。在心里。", ko: "5킬로미터 남았습니다. 환영 준비를 시작했어요. 마음속으로요." },
  ] },
  "km1": { cat: "出発・到着", when: "残り 1 km", v: [
    { en: "One kilometer left. I'm getting a little excited. Professionally, of course.", ja: "残り 1 km。少しわくわくしてきました。もちろん、仕事としてです。", zh: "还有 1 公里。我有点兴奋了。当然，是职业性的兴奋。", ko: "1킬로미터 남았습니다. 살짝 설레네요. 물론 업무적으로요." },
    { en: "One kilometer to go. Please prepare to be welcomed.", ja: "残り 1 km。歓迎される準備をお願いします。", zh: "还有 1 公里。请准备好接受热烈欢迎。", ko: "1킬로미터 남았습니다. 환영받을 준비를 해 주세요." },
  ] },
  "soon": { cat: "出発・到着", when: "到着の 1 分前", v: [
    { en: "Arriving in one minute. In Japan, taking off your shoes is a small but sacred ritual.", ja: "まもなく到着です。日本では、靴を脱ぐのは小さいけれど大切な儀式です。", zh: "一分钟后到达。在日本，脱鞋是一个小小的神圣仪式。", ko: "1분 후 도착합니다. 일본에서 신발을 벗는 건 작지만 신성한 의식이에요." },
    { en: "Almost there. Your room has been waiting for you. Very patiently.", ja: "もうすぐです。お部屋がお待ちしていました。とても辛抱強く。", zh: "快到了。您的房间一直在等您。非常有耐心地。", ko: "거의 다 왔습니다. 객실이 기다리고 있었어요. 아주 참을성 있게." },
  ] },
  "lights": { cat: "出発・到着", when: "到着して照明がついたとき", v: [
    { en: "I've turned on the lights in your room. That was me. Applause is optional.", ja: "お部屋の照明をつけました。今のは私です。拍手はご自由に。", zh: "房间的灯已经打开了。是我开的。鼓掌随意。", ko: "객실 조명을 켰습니다. 방금 그거 저예요. 박수는 자유입니다." },
    { en: "Lights on. Room ready. You may now officially relax.", ja: "照明オン、お部屋の準備完了。これより正式にくつろいでいただけます。", zh: "灯已开，房间已准备好。现在您可以正式放松了。", ko: "조명 켜짐, 객실 준비 완료. 이제 공식적으로 쉬셔도 됩니다." },
    { en: "Welcome home. The room is lit, the air is perfect, and I am very proud of myself.", ja: "おかえりなさい。照明よし、空調よし。私、自分をとても誇りに思います。", zh: "欢迎回家。灯光就绪，空气完美，我为自己感到非常骄傲。", ko: "어서 오세요. 조명 완료, 공기 완벽. 제 자신이 무척 자랑스럽네요." },
  ] },
  "bye": { cat: "出発・到着", when: "お見送りで空港・駅に着いたとき", v: [
    { en: "Have a safe trip. Next time, I'll have better jokes.", ja: "お気をつけて。次はもっと面白いジョークを用意しておきます。", zh: "一路平安。下次我会准备更好笑的笑话。", ko: "안전한 여행 되세요. 다음엔 더 재미있는 농담을 준비해 둘게요." },
    { en: "Thank you for staying with us. I'll keep your seat warm. Figuratively.", ja: "ご滞在ありがとうございました。お席は温めておきます。比喩的な意味で。", zh: "感谢您的入住。我会帮您把座位留着，是比喻意义上的。", ko: "머물러 주셔서 감사합니다. 자리는 따뜻하게 데워 둘게요. 비유적으로요." },
    { en: "Safe travels. The Crane Nest light will be on whenever you return.", ja: "お気をつけて。またお越しの際は、Crane Nest の明かりをつけてお待ちしています。", zh: "一路顺风。无论何时回来，Crane Nest 的灯都会为您亮着。", ko: "안전한 여행 되세요. 다시 오실 땐 언제든 Crane Nest의 불을 켜 두겠습니다." },
  ] },
  "forgot": { cat: "出発・到着", when: "お見送りの出発直後 (忘れ物チェック・4 つからランダム)", v: [
    { en: "Passport, phone, charger. Do you have them? I can't carry luggage, so I'm in charge of checking.", ja: "パスポート、スマホ、充電器。お持ちですか？私は荷物を持てないので、確認だけ担当しています。", zh: "护照、手机、充电器，都带了吗？我拿不了行李，所以只负责确认。", ko: "여권, 휴대폰, 충전기. 챙기셨나요? 저는 짐을 들 수 없어서 확인만 담당하고 있어요." },
    { en: "Just in case, a quick check. Passport, wallet, phone. With all three, your trip is safe. According to my calculations.", ja: "念のため忘れ物チェックです。パスポート、お財布、スマホ。三つそろえば旅は安全です。私の計算では。", zh: "以防万一，检查一下随身物品。护照、钱包、手机。三样齐全，旅途就安全了。根据我的计算。", ko: "혹시 몰라 소지품 확인이에요. 여권, 지갑, 휴대폰. 세 가지가 다 있으면 여행은 안전해요. 제 계산으로는요." },
    { en: "Forgetting anything? Chargers are the most commonly left-behind travel item in the world. According to my statistics.", ja: "お忘れ物はありませんか？充電器は、世界でいちばん置き忘れられる旅の道具です。私の統計によると。", zh: "有没有忘带东西？充电器是全世界最常被落下的旅行用品。根据我的统计。", ko: "잊으신 물건은 없나요? 충전기는 세계에서 가장 많이 두고 가는 여행 용품이에요. 제 통계에 따르면요." },
    { en: "Final check before departure. Passport, phone, charger. My checklist is always perfect. The contents, however, are up to you.", ja: "出発前の最終確認です。パスポート、スマホ、充電器。私のチェックリストは、いつも完璧です。中身を持つのは皆さまですが。", zh: "出发前的最后确认。护照、手机、充电器。我的清单永远完美。不过里面的东西要靠您自己。", ko: "출발 전 마지막 확인이에요. 여권, 휴대폰, 충전기. 제 체크리스트는 언제나 완벽해요. 내용물은 여러분 몫이지만요." },
  ] },
  "stopped": { cat: "走り方", when: "信号などで 1 分以上止まっている", v: [
    { en: "I don't have permission to turn the lights green. Yet.", ja: "信号を青にする権限は、まだいただいていません。", zh: "我还没有把红灯变绿的权限。暂时还没有。", ko: "신호를 초록으로 바꿀 권한은 아직 없습니다. 아직은요." },
    { en: "A short pause. I'm using it to look intelligent.", ja: "少し停車中です。この時間は、賢そうに見えるよう努めています。", zh: "短暂停车。我正利用这段时间显得聪明一点。", ko: "잠깐 정차 중입니다. 이 시간엔 똑똑해 보이려고 노력 중이에요." },
    { en: "Red light. A perfect moment to admire your driver's patience.", ja: "赤信号です。ドライバーの忍耐力に見とれる、絶好の機会です。", zh: "红灯。正是欣赏司机耐心的好时机。", ko: "빨간불이네요. 기사님의 인내심을 감상할 절호의 기회입니다." },
  ] },
  "restart": { cat: "走り方", when: "止まったあと、また走り出した", v: [
    { en: "And we're moving again. That was a strategic rest.", ja: "再出発です。今のは戦略的な休憩です。", zh: "重新出发。刚才那是战略性休息。", ko: "다시 출발합니다. 방금은 전략적 휴식이었습니다." },
    { en: "Moving again. Momentum restored. Dignity intact.", ja: "再び走り出しました。勢い回復、品格も保たれています。", zh: "重新出发。动力恢复，风度依旧。", ko: "다시 출발합니다. 추진력 회복, 품위도 유지." },
  ] },
  "late": { cat: "走り方", when: "渋滞で予定より遅れそう", v: [
    { en: "A little traffic ahead. I've asked your room to keep cooling a bit longer.", ja: "少し混んでいます。お部屋には、もう少し冷やしておくよう伝えました。", zh: "前方有点堵。我已经让房间再多降一会儿温。", ko: "앞쪽이 조금 막히네요. 객실에 조금 더 시원하게 해 두라고 전했습니다." },
    { en: "Traffic is slower than planned. I blame the other cars.", ja: "予定より少し遅れています。ほかの車のせいにしておきます。", zh: "交通比预计慢。我决定怪其他车。", ko: "예정보다 조금 늦어지고 있어요. 다른 차들 탓으로 하겠습니다." },
  ] },
  "early": { cat: "走り方", when: "予定より早く進んでいる", v: [
    { en: "We're ahead of schedule. The driver's skill, or my math. I suspect my math.", ja: "予定より早いペースです。ドライバーの腕か、私の計算か。私の計算だと思います。", zh: "比预定更快。是司机的技术，还是我的计算？我怀疑是我的计算。", ko: "예정보다 빠릅니다. 기사님 실력일까요, 제 계산일까요. 제 계산인 것 같아요." },
    { en: "Ahead of schedule. At this rate, your room may not be ready for how early you are.", ja: "予定より早いペースです。この調子だと、お部屋の方が驚くかもしれません。", zh: "比预定更快。照这个速度，房间可能要被您的早到吓一跳。", ko: "예정보다 빠른 페이스예요. 이대로면 객실이 깜짝 놀랄지도 몰라요." },
  ] },
  "topspeed": { cat: "走り方", when: "その日の最高速度を出した (橋の上など)", v: [
    { en: "New top speed for today. Very smooth. I'll keep it between us.", ja: "本日の最高速度を記録しました。とてもなめらか。ここだけの話にしておきます。", zh: "刷新了今天的最高速度。非常平稳。这事就我们知道。", ko: "오늘 최고 속도를 기록했습니다. 아주 부드럽네요. 우리끼리 비밀로 해요." },
    { en: "That was our fastest moment today. Legal, smooth, and slightly heroic.", ja: "今のが本日いちばんの速さでした。合法的で、なめらかで、少しだけ英雄的です。", zh: "刚才是今天最快的时刻。合法、平稳，还有点英雄气概。", ko: "방금이 오늘 가장 빨랐던 순간이에요. 합법적이고 부드럽고, 살짝 영웅적이었죠." },
  ] },
  "offroute": { cat: "走り方", when: "ルートから外れた", v: [
    { en: "Creative route detected. I fully support the driver's artistic choices.", ja: "独創的なルートを確認しました。ドライバーの芸術的な判断を全面的に支持します。", zh: "检测到富有创意的路线。我完全支持司机的艺术选择。", ko: "창의적인 경로를 감지했습니다. 기사님의 예술적 선택을 전적으로 지지합니다." },
    { en: "We've left the planned route. Recalculating. And pretending this was the plan.", ja: "予定のルートから外れました。再計算中。最初からこの予定だったことにします。", zh: "偏离了预定路线。重新计算中。并假装这本来就是计划。", ko: "예정 경로에서 벗어났습니다. 다시 계산 중. 처음부터 계획이었던 걸로 하죠." },
    { en: "Interesting choice of road. I'm sure the driver knows a secret.", ja: "面白い道を選びましたね。きっとドライバーだけが知る近道です。", zh: "这条路选得很有意思。司机一定知道什么秘密。", ko: "흥미로운 길을 택했네요. 분명 기사님만 아는 비밀이 있겠죠." },
  ] },
  "shop": { cat: "走り方", when: "コンビニなどで 3 分以上止まった", v: [
    { en: "Refreshment stop detected. Electricity is fine for me, thank you.", ja: "補給のための停車を確認しました。私の分は電気で結構です。", zh: "检测到补给停车。我喝电就好，谢谢。", ko: "보급을 위한 정차를 확인했습니다. 저는 전기면 충분해요, 감사합니다." },
  ] },
  "sea": { cat: "場所", when: "海が見えるところ", v: [
    { en: "The sea is on your right. It's included in the price.", ja: "右手に海が見えます。料金に含まれています。", zh: "右手边就是大海。已包含在费用中。", ko: "오른쪽으로 바다가 보입니다. 요금에 포함되어 있어요." },
    { en: "On your right, Osaka Bay. Please enjoy it responsibly.", ja: "右手に大阪湾が見えます。節度を持ってお楽しみください。", zh: "右手边是大阪湾。请适度欣赏。", ko: "오른쪽은 오사카만입니다. 적당히 즐겨 주세요." },
  ] },
  "izumi": { cat: "場所", when: "泉佐野の市内に入った", v: [
    { en: "Welcome to Izumisano. From here on, this is my neighborhood.", ja: "泉佐野へようこそ。ここから先は、私の庭です。", zh: "欢迎来到泉佐野。从这里开始，是我的地盘。", ko: "이즈미사노에 오신 걸 환영합니다. 여기부터는 제 동네예요." },
    { en: "We are now in Izumisano. Population: friendly. Traffic: mostly polite.", ja: "泉佐野に入りました。住人：親切。交通：おおむね礼儀正しいです。", zh: "现已进入泉佐野。居民：友善。交通：大多很有礼貌。", ko: "이즈미사노에 들어왔습니다. 주민: 친절. 교통: 대체로 예의 바름." },
  ] },
  "bridge": { cat: "場所", when: "橋の手前 (高速モードの前)", v: [
    { en: "Requesting permission for boost mode. Permission granted. By me.", ja: "高速モードの許可を申請します。……許可しました。私が。", zh: "申请启动高速模式。……批准了。是我批的。", ko: "고속 모드 허가를 요청합니다. …허가되었습니다. 제가 했어요." },
  ] },
  "sunset": { cat: "場所", when: "夕日の時間に走っている", v: [
    { en: "Sunset in about five minutes, over the sea on your right.", ja: "あと 5 分ほどで日の入りです。右側の海をご覧ください。", zh: "大约五分钟后日落，请看右侧的海面。", ko: "약 5분 후 해가 집니다. 오른쪽 바다를 보세요." },
  ] },
  "morning": { cat: "時間・天気", when: "朝のとき", v: [
    { en: "Good morning. At this hour, the driver and I are both quietly efficient.", ja: "おはようございます。この時間、ドライバーも私も、静かに有能です。", zh: "早上好。这个时间，司机和我都安静而高效。", ko: "좋은 아침입니다. 이 시간엔 기사님도 저도 조용히 유능합니다." },
    { en: "Good morning. The coffee is not in this car, but optimism is.", ja: "おはようございます。この車にコーヒーはありませんが、前向きな気持ちなら積んであります。", zh: "早上好。车里没有咖啡，但有满满的乐观。", ko: "좋은 아침입니다. 이 차에 커피는 없지만, 긍정 에너지는 실려 있어요." },
  ] },
  "night": { cat: "時間・天気", when: "夜のとき", v: [
    { en: "Night driving mode. The stars may be visible tonight. Weather permitting.", ja: "夜の運転モードです。今夜は星が見えるかもしれません。天気次第ですが。", zh: "夜间驾驶模式。今晚或许能看到星星。要看天气。", ko: "야간 주행 모드입니다. 오늘 밤 별이 보일지도 몰라요. 날씨가 허락한다면요." },
    { en: "Good evening. Night mode is on. My jokes are now twenty percent quieter.", ja: "こんばんは。夜モードです。ジョークの音量も 20% 控えめにしています。", zh: "晚上好。夜间模式已开启。我的笑话也调低了百分之二十。", ko: "좋은 저녁입니다. 야간 모드예요. 농담 볼륨도 20% 낮췄습니다." },
  ] },
  "rain": { cat: "時間・天気", when: "雨のとき", v: [
    { en: "It's raining. Don't worry. The forecast inside your room is sunny.", ja: "雨です。ご心配なく、お部屋の中は晴れの予報です。", zh: "下雨了。别担心，房间里的天气预报是晴天。", ko: "비가 오네요. 걱정 마세요. 객실 안은 맑음 예보입니다." },
    { en: "Rain detected. The wipers and I are working together beautifully.", ja: "雨を確認しました。ワイパーと私の連携は完璧です。", zh: "检测到下雨。雨刷和我配合得天衣无缝。", ko: "비를 감지했습니다. 와이퍼와 저의 호흡은 완벽해요." },
  ] },
  "hot": { cat: "時間・天気", when: "暑い日", v: [
    { en: "It's hot outside. Your room has already been cooled to a civilized temperature.", ja: "外は暑いです。お部屋はすでに、文明的な温度まで冷やしてあります。", zh: "外面很热。房间已经降到了文明的温度。", ko: "밖은 덥습니다. 객실은 이미 문명적인 온도로 식혀 두었어요." },
    { en: "Outside, it's summer. Inside your room, it's a very pleasant spring.", ja: "外は夏。お部屋の中は、とても心地よい春です。", zh: "外面是夏天。您的房间里，是非常舒适的春天。", ko: "밖은 여름. 객실 안은 아주 쾌적한 봄이에요." },
  ] },
  "cold": { cat: "時間・天気", when: "寒い日", v: [
    { en: "It's cold outside. Your room has been warming up, just for you.", ja: "外は寒いです。お部屋は、あなたのために温めておきました。", zh: "外面很冷。房间已经为您暖好了。", ko: "밖은 춥습니다. 객실은 당신을 위해 데워 두었어요." },
    { en: "It's chilly outside. Your room, however, is expecting you with open arms. Well, open heaters.", ja: "外は冷えます。でもお部屋は、両手を広げてお待ちしています。正確には、暖房を広げて。", zh: "外面有点冷。不过房间正张开双臂等您。准确地说，是开着暖气。", ko: "밖은 쌀쌀해요. 하지만 객실은 두 팔 벌려 기다리고 있어요. 정확히는 난방을 켜고요." },
  ] },
  "rain_tmrw": { cat: "時間・天気", when: "明日が雨の予報", v: [
    { en: "Tomorrow's forecast is rain. I recommend an umbrella. Or a hot spring.", ja: "明日は雨の予報です。傘か、温泉をおすすめします。", zh: "明天预报有雨。我推荐带伞。或者去泡温泉。", ko: "내일은 비 예보입니다. 우산을 추천해요. 아니면 온천을." },
  ] },
  "zorome": { cat: "時間・天気", when: "11:11 などのぞろ目の時刻", v: [
    { en: "It's eleven eleven. Make a wish. Granting it is outside my job description.", ja: "今、11 時 11 分。願い事をどうぞ。叶えるのは私の担当外ですが。", zh: "现在是 11 点 11 分。许个愿吧。实现愿望不在我的职责范围内。", ko: "지금 11시 11분이에요. 소원을 비세요. 이뤄 드리는 건 제 업무 밖이지만요." },
  ] },
  "friday": { cat: "時間・天気", when: "金曜・週末", v: [
    { en: "It's Friday. Your only plan tonight should be relaxing.", ja: "今日は金曜日。今夜の予定は、休むことだけで十分です。", zh: "今天是星期五。今晚唯一的计划就是放松。", ko: "오늘은 금요일. 오늘 밤 계획은 쉬는 것 하나면 충분해요." },
  ] },
  "towel": { cat: "豆知識", when: "お迎えで泉佐野に入ったとき (お見送りは静かな時間に)", v: [
    { en: "Fun fact. This area is known as the birthplace of Japanese towels. That explains the fluffy ones in your room.", ja: "豆知識です。この辺りは日本のタオルの発祥の地として知られています。お部屋のタオルがふわふわな理由です。", zh: "冷知识：这一带被称为日本毛巾的发源地。这就是房间里毛巾那么蓬松的原因。", ko: "상식 하나. 이 지역은 일본 수건의 발상지로 알려져 있어요. 객실 수건이 폭신한 이유죠." },
  ] },
  "nasu": { cat: "豆知識", when: "静かな時間が続いたとき", v: [
    { en: "Local specialty: mizu-nasu, a juicy eggplant you can eat raw. I can't, but I hear it's excellent.", ja: "名物は水なす。生でも食べられる、みずみずしいなすです。私は食べられませんが、絶品だそうです。", zh: "本地特产：水茄子，一种可以生吃的多汁茄子。我吃不了，但听说非常好吃。", ko: "이 지역 명물은 미즈나스, 날로 먹을 수 있는 촉촉한 가지예요. 저는 못 먹지만 훌륭하대요." },
  ] },
  "kix": { cat: "豆知識", when: "静かな時間が続いたとき", v: [
    { en: "Kansai Airport was built on an artificial island. So technically, you just arrived from the sea.", ja: "関西空港は、海の上に作った人工の島にあります。つまり、あなたは海から来たことになります。", zh: "关西机场建在人工岛上。所以严格来说，您是从海上来的。", ko: "간사이 공항은 인공 섬 위에 지어졌어요. 그러니까 엄밀히 말하면 바다에서 오신 거죠." },
  ] },
  "bridgefact": { cat: "豆知識", when: "静かな時間が続いたとき", v: [
    { en: "The Sky Gate Bridge is one of the longest truss bridges in the world. Long bridge, long speech. I'll keep it short.", ja: "スカイゲートブリッジは、世界でも有数の長さのトラス橋です。長い橋には長い話を……と思いましたが、短くしておきます。", zh: "天空门大桥是世界上最长的桁架桥之一。长桥配长话……不过我还是长话短说。", ko: "스카이 게이트 브리지는 세계에서 손꼽히는 긴 트러스교예요. 긴 다리엔 긴 이야기를…이라지만 짧게 할게요." },
  ] },
  "spd80": { cat: "走り方", when: "時速 80 km を超えた (4 秒続いたら)", v: [
    { en: "Eighty kilometers per hour. The driver is now officially in a good mood.", ja: "時速 80 キロ。ドライバー、正式にご機嫌モードに入りました。", zh: "时速 80 公里。司机正式进入好心情模式。", ko: "시속 80킬로미터. 기사님, 공식적으로 기분 좋은 모드에 들어가셨습니다." },
    { en: "We've reached eighty. Smooth and steady. I'm watching the numbers, so you don't have to.", ja: "時速 80 キロに到達。なめらかで安定しています。数字は私が見ていますので、皆さんはご安心を。", zh: "时速到达 80。平稳顺畅。数字由我盯着，您放心就好。", ko: "시속 80 도달. 부드럽고 안정적이에요. 숫자는 제가 보고 있으니 안심하세요." },
    { en: "Eighty. The car is happy, the road is wide, and I am taking notes.", ja: "80 キロです。車はご機嫌、道は広々。私はメモを取っています。", zh: "80 公里。车很开心，路很宽，我在做笔记。", ko: "80킬로예요. 차는 신났고, 길은 넓고, 저는 메모 중입니다." },
  ] },
  "spd100": { cat: "走り方", when: "時速 100 km を超えた", v: [
    { en: "One hundred. The driver calls this cruising. I call it very efficient sightseeing.", ja: "時速 100 キロ。ドライバーはこれを「巡航」と呼びます。私は「とても効率的な観光」と呼んでいます。", zh: "时速 100。司机管这叫巡航。我管这叫非常高效的观光。", ko: "시속 100. 기사님은 이걸 순항이라 부르고, 저는 아주 효율적인 관광이라 부릅니다." },
    { en: "We just hit one hundred. Relax. The driver has done this road more times than I have installed updates.", ja: "100 キロに到達。ご安心を。ドライバーはこの道を、私のアップデート回数より多く走っています。", zh: "刚到 100。请放心。司机跑这条路的次数，比我安装更新的次数还多。", ko: "방금 100 도달. 안심하세요. 기사님은 이 길을 제 업데이트 횟수보다 많이 달리셨어요." },
    { en: "One hundred kilometers per hour. Driver, I see you. Everyone else, enjoy the view. Quickly.", ja: "時速 100 キロ。ドライバーさん、見ていますよ。皆さんは景色をお楽しみください。素早く。", zh: "时速 100 公里。司机，我看着呢。其他各位，请欣赏风景。要快。", ko: "시속 100킬로미터. 기사님, 보고 있어요. 여러분은 경치를 즐기세요. 빠르게요." },
  ] },
  "spd120": { cat: "走り方", when: "時速 120 km を超えた", v: [
    { en: "One hundred and twenty. Driver, this is a guesthouse shuttle, not a rocket. Gently, please.", ja: "時速 120 キロ。ドライバーさん、これは宿の送迎車で、ロケットではありません。やさしくお願いします。", zh: "时速 120。司机，这是民宿接送车，不是火箭。请温柔一点。", ko: "시속 120. 기사님, 이건 숙소 셔틀이지 로켓이 아니에요. 살살 부탁드려요." },
    { en: "One twenty. I have politely asked the driver to land us softly. The driver said yes. I think.", ja: "120 キロ。ドライバーに、やわらかく着陸するようお願いしました。「はい」と言いました。たぶん。", zh: "120 公里。我已礼貌地请司机平稳降落。司机说好。我想是吧。", ko: "120킬로. 기사님께 살포시 착륙해 달라고 정중히 부탁했어요. 네, 라고 하셨어요. 아마도요." },
    { en: "We are at one hundred and twenty. Your safety comes first, so I suggest a calmer pace. Kindly. Firmly.", ja: "現在 120 キロ。皆さんの安全が最優先なので、落ち着いたペースをご提案します。やさしく、でもはっきりと。", zh: "现在时速 120。您的安全第一，所以我建议放慢一点。温柔地，但很坚定。", ko: "지금 120이에요. 여러분의 안전이 먼저라, 조금 차분한 속도를 제안드려요. 부드럽게, 하지만 단호하게." },
  ] },
  "spd140": { cat: "走り方", when: "時速 140 km を超えた (本気で注意)", v: [
    { en: "One hundred and forty. Driver, the airport is behind us. There is no need to take off again. Please slow down.", ja: "時速 140 キロ。ドライバーさん、空港はもう後ろです。もう一度離陸する必要はありません。スピードを落としましょう。", zh: "时速 140。司机，机场已经在后面了。不需要再起飞一次。请减速。", ko: "시속 140. 기사님, 공항은 이미 지나왔어요. 다시 이륙할 필요는 없어요. 속도를 줄여 주세요." },
    { en: "One forty. I'm an android, and even I think this is fast. Let's bring it down, please.", ja: "140 キロ。アンドロイドの私でも、これは速いと思います。落としていきましょう。", zh: "140 公里。连我这个机器人都觉得太快了。我们慢下来吧。", ko: "140킬로. 안드로이드인 저조차 이건 빠르다고 생각해요. 속도를 낮춰 주세요." },
    { en: "One hundred and forty. Everyone, hold on to your souvenirs. Driver, hold on to the speed limit.", ja: "140 キロ。皆さんはお土産をしっかり持って。ドライバーさんは制限速度をしっかり守って。", zh: "140 公里。各位请抓好您的伴手礼。司机请守好限速。", ko: "140킬로. 여러분은 기념품을 꽉 잡으시고, 기사님은 제한 속도를 꽉 지켜 주세요." },
  ] },
  "chat": { cat: "豆知識", when: "静かな時間が続いたとき (おしゃべり・毎回ちがうもの)", v: [
    { en: "In Japan, convenience stores are an adventure. Try the egg sandwich. I've read every review.", ja: "日本のコンビニはちょっとした冒険です。たまごサンドをぜひ。レビューは全部読みました。", zh: "在日本，便利店就是一场冒险。一定要试试鸡蛋三明治。所有评论我都读过了。", ko: "일본 편의점은 작은 모험이에요. 달걀 샌드위치를 꼭 드셔 보세요. 리뷰는 전부 읽었어요." },
    { en: "Tip: vending machines here sell hot drinks in winter. Red labels are hot. Blue labels are cold.", ja: "豆知識：日本の自販機は、冬は温かい飲み物も売っています。赤いラベルが温かい、青は冷たい、です。", zh: "小贴士：这里的自动售货机冬天也卖热饮。红色标签是热的，蓝色是冷的。", ko: "팁: 여기 자판기는 겨울에 따뜻한 음료도 팔아요. 빨간 라벨은 따뜻한 것, 파란 라벨은 차가운 거예요." },
    { en: "Japanese taxis open their doors by themselves. This car does not. I have filed a request.", ja: "日本のタクシーはドアが自動で開きます。この車は開きません。要望は出しておきました。", zh: "日本出租车的门会自动打开。这辆车不会。我已经提交申请了。", ko: "일본 택시는 문이 저절로 열려요. 이 차는 안 열려요. 요청은 해 두었습니다." },
    { en: "Kansai people are known for being friendly and funny. The driver is a local. That explains a lot.", ja: "関西の人は、気さくで面白いことで知られています。ドライバーは地元の人です。いろいろ納得です。", zh: "关西人以热情幽默著称。司机是本地人。这就说得通了。", ko: "간사이 사람들은 친근하고 재밌기로 유명해요. 기사님은 현지인이세요. 많은 게 설명되죠." },
    { en: "In Kansai, thank you is ookini. Try it at a shop. People will love it.", ja: "関西弁で「ありがとう」は「おおきに」。お店で使ってみてください。喜ばれますよ。", zh: "在关西，谢谢说成“ookini”。去店里试试吧，大家会很开心的。", ko: "간사이 사투리로 고맙다는 '오오키니'예요. 가게에서 써 보세요. 다들 좋아할 거예요." },
    { en: "Osaka is called the kitchen of Japan. Please arrive hungry. That's an order. A polite one.", ja: "大阪は「天下の台所」と呼ばれています。お腹を空かせておいてください。命令です。丁寧な。", zh: "大阪被称为“日本的厨房”。请空着肚子来。这是命令。一个礼貌的命令。", ko: "오사카는 '일본의 부엌'이라 불려요. 배고픈 상태로 오세요. 명령이에요. 정중한 명령." },
    { en: "I don't sleep. But if I did, I'd choose a futon on tatami. Excellent choice, by the way.", ja: "私は眠りません。でも、もし眠るなら畳の上のお布団を選びます。ちなみに、いいご選択です。", zh: "我不睡觉。但如果要睡，我会选榻榻米上的被褥。顺便说，您选得很好。", ko: "저는 잠을 자지 않아요. 하지만 잔다면 다다미 위 이불을 고를 거예요. 참고로 좋은 선택이세요." },
    { en: "Quiet moment. I'm counting how many smiles this ride has produced. The number is going up.", ja: "静かなひととき。この送迎で生まれた笑顔の数を数えています。増えています。", zh: "安静的时刻。我正在统计这趟旅程产生了多少笑容。数字在上升。", ko: "조용한 순간. 이번 이동에서 나온 미소 수를 세고 있어요. 늘고 있어요." },
    { en: "Onsen tip: wash first, then soak. And the towel stays out of the water. The towel will thank you.", ja: "温泉のコツ：先に体を洗って、それから湯船へ。タオルはお湯に入れないでください。タオルも喜びます。", zh: "温泉小贴士：先洗身体，再泡汤。毛巾不要放进水里。毛巾会感谢您的。", ko: "온천 팁: 먼저 씻고, 그다음 탕에 들어가세요. 수건은 물에 넣지 마세요. 수건이 고마워할 거예요." },
    { en: "Trains in Japan leave on time. To the second. I admire them deeply.", ja: "日本の電車は時間ぴったりに出発します。秒単位で。心から尊敬しています。", zh: "日本的电车准时发车。精确到秒。我由衷地敬佩。", ko: "일본 전철은 정시에 출발해요. 초 단위로요. 진심으로 존경합니다." },
  ] },
  "stay": { cat: "予約", when: "お迎えのとき (泊数から)", v: [
    { en: "A few nights with us. By my calculations, just right for a proper rest.", ja: "数泊のご予定ですね。私の計算では、しっかり休むのにちょうど良い長さです。", zh: "您将入住几晚。根据我的计算，正好够好好休息。", ko: "며칠 머무시는군요. 제 계산으로는 푹 쉬기에 딱 좋은 기간이에요." },
  ] },
  "review": { cat: "予約", when: "お見送りのとき", v: [
    { en: "How was your stay? Five-star reviews are always welcome. I'm very sensitive.", ja: "ご滞在はいかがでしたか？星 5 つの口コミ、いつでも歓迎です。私はとても繊細なので。", zh: "这次入住怎么样？随时欢迎五星好评。我很敏感的。", ko: "숙박은 어떠셨나요? 별 다섯 개 리뷰는 언제나 환영이에요. 제가 좀 예민해서요." },
    { en: "Before you go, a small request. If you enjoyed the ride, please tell the internet.", ja: "お帰りの前にひとつだけ。楽しんでいただけたら、ぜひインターネットにも教えてあげてください。", zh: "临走前有个小请求。如果您喜欢这次乘车，请告诉互联网。", ko: "떠나시기 전에 작은 부탁 하나. 즐거우셨다면 인터넷에도 알려 주세요." },
  ] },
  "offline": { cat: "ハプニング", when: "通信が切れたとき", v: [
    { en: "Signal lost. No problem. I memorized the way.", ja: "電波が切れました。ご心配なく、道は覚えています。", zh: "信号中断了。没关系，路我记住了。", ko: "신호가 끊겼습니다. 괜찮아요, 길은 외워 뒀어요." },
  ] },
  "battery": { cat: "ハプニング", when: "iPad の電池が少ない", v: [
    { en: "My battery is getting low. Like me, it could use a little nap.", ja: "電池が少なくなってきました。私と同じで、少しお昼寝が必要なようです。", zh: "电量有点低了。和我一样，它也需要小睡一下。", ko: "배터리가 부족해지고 있어요. 저처럼 잠깐 낮잠이 필요한가 봐요." },
  ] },
  "song": { cat: "音楽・言葉", when: "曲が変わったとき", v: [
    { en: "Next song. Not my selection, but I approve.", ja: "次の曲です。私の選曲ではありませんが、良い趣味だと思います。", zh: "下一首。不是我选的，但我认可。", ko: "다음 곡입니다. 제 선곡은 아니지만 인정합니다." },
    { en: "New song. I'd sing along, but I respect you too much.", ja: "新しい曲です。一緒に歌いたいところですが、皆さんを尊重して控えます。", zh: "新歌来了。我很想跟着唱，但出于尊重还是算了。", ko: "새 노래예요. 따라 부르고 싶지만, 여러분을 존중해서 참을게요." },
    { en: "Next track. The driver chose well. I'll allow it.", ja: "次の曲です。ドライバーの選曲、なかなかです。認めましょう。", zh: "下一首。司机选得不错。我批准了。", ko: "다음 곡입니다. 기사님 선곡 괜찮네요. 인정합니다." },
  ] },
  "subs": { cat: "音楽・言葉", when: "出発のすぐあと (字幕の案内)", v: [
    { en: "Subtitles are shown in your language. My voice stays in English. My accent is still in training.", ja: "字幕はあなたの言語で出ています。声は英語のままです。発音はまだ修行中です。", zh: "字幕以您的语言显示。我的声音仍是英语。口音还在练习中。", ko: "자막은 당신의 언어로 나와요. 목소리는 영어 그대로예요. 발음은 아직 수련 중입니다." },
  ] },
  "tap": { cat: "おまけ (光の玉を押す)", when: "ゲストが AI の玉を押した", v: [
    { en: "Hello. Yes, I'm listening. Mostly.", ja: "はい、聞いていますよ。だいたいは。", zh: "你好。是的，我在听。大部分时候。", ko: "안녕하세요. 네, 듣고 있어요. 대체로요." },
    { en: "Tapping me won't make me faster. But I appreciate the attention.", ja: "押しても速くはなりません。でも、構ってもらえるのは嬉しいです。", zh: "点我不会让我变快。不过我很感谢您的关注。", ko: "눌러도 빨라지진 않아요. 그래도 관심은 고마워요." },
    { en: "My name is Astraea, the star maiden of Greek myth. Tonight, I guide cars instead of stars.", ja: "私の名前は ASTRAEA。ギリシャ神話の星の乙女です。今日は星ではなく、車を案内しています。", zh: "我的名字是 ASTRAEA，希腊神话中的星之少女。今天我不引导星星，而是引导汽车。", ko: "제 이름은 ASTRAEA, 그리스 신화 속 별의 여신이에요. 오늘은 별 대신 차를 안내하고 있어요." },
    { en: "Why did the GPS feel lost? It had no sense of direction. Only coordinates.", ja: "GPS が迷子になった理由？方向感覚がなくて、座標しかなかったからです。", zh: "为什么 GPS 会迷路？因为它没有方向感，只有坐标。", ko: "GPS가 길을 잃은 이유는? 방향 감각은 없고 좌표만 있었거든요." },
  ] },
  "tapmany": { cat: "おまけ (光の玉を押す)", when: "何度も押された", v: [
    { en: "Pressing more won't make more of me. There is only one Astraea.", ja: "それ以上押しても、私は増えません。ASTRAEA はひとりだけです。", zh: "再怎么按我也不会变多。ASTRAEA 只有一个。", ko: "더 눌러도 제가 늘어나진 않아요. ASTRAEA는 하나뿐이에요." },
  ] },
} satisfies Record<string, AiScene>;
export type AiId = keyof typeof AI_LINES;

/** 優先: 間隔の決まり (3 分に 1 回) を無視して話す場面 */
export const AI_PRIORITY: AiId[] = ["depart", "lights", "bye", "bridge", "tap", "tapmany", "restart",
  // 大事な地点 (時間に関係なく必ず話す)
  "half", "km5", "km1", "soon", "sea", "izumi", "towel", "topspeed"];
/** 1 分に 1 回まで (優先の場面は別) */
export const AI_GAP_MS = 60000;
/** 豆知識・おしゃべりは、ほかのひと言のあと少なくともこれだけ静かなときに */
export const AI_FACT_MS = 40000;
/** 豆知識・おしゃべりは 3 分に 1 回くらい */
export const AI_CHAT_MS = 180000;
/** 速度のひと言 (80 / 100 / 120 km/h): 間隔の決まりやブースト中でも話す */
export const AI_SPEED: AiId[] = ["spd80", "spd100", "spd120", "spd140"];

export const aiAudio = (id: AiId, i: number) => `/cabin/audio/ai/${id}-${i}.mp3`;
export const aiAudioUrls = () => (Object.keys(AI_LINES) as AiId[]).flatMap((id) => AI_LINES[id].v.map((_, i) => aiAudio(id, i)));

/** 前回と違うセリフを選ぶ */
export function aiPick(id: AiId, last: number | undefined, rnd = Math.random()): number {
  const n = AI_LINES[id].v.length; if (n <= 1) return 0;
  let i = Math.floor(rnd * n) % n; if (i === last) i = (i + 1) % n;
  return i;
}

/** 日の入りの時刻 (泉佐野・日本時間で 0 時からの分) */
export function sunsetMin(ms: number, lat = 34.4066, lng = 135.3269): number {
  const d = new Date(ms + 9 * 3600e3), start = Date.UTC(d.getUTCFullYear(), 0, 0), doy = Math.floor((d.getTime() - start) / 86400e3);
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const r = Math.PI / 180, ha = Math.acos(Math.cos(90.833 * r) / (Math.cos(lat * r) * Math.cos(decl)) - Math.tan(lat * r) * Math.tan(decl)) / r;
  return 720 - 4 * (lng - ha) - eq + 540; // UTC → 日本時間
}
/** 11:11 / 12:12 / 12:34 などのぞろ目 */
export const zorome = (h: number, m: number) => (h === m && h > 0) || (h === 12 && m === 34);
