/**
 * 車内 iPad の AI「ASTRAEA（アストレア）」のセリフ。状況に合わせて自分から話す。
 *   声: public/cabin/audio/ai/<id>-<番号>.mp3 (英語の女性アンドロイド)。字幕はゲストの言語。
 *   同じ場面でも毎回セリフが変わる (前回と同じものは続けて出さない)。
 *   ※ 自動生成。セリフを変えたら声も作り直すこと。
 */
import type { GLang } from "@/lib/cabinGeo";

/** film: 映画のオマージュなら元ネタ (iPad の右上に「INSPIRED BY · …」と小さく出す) */
export type AiLine = Record<GLang, string> & { film?: string };
export interface AiScene { cat: string; when: string; v: AiLine[] }
export const AI_NAME = "ASTRAEA";

export const AI_LINES = {
  "depart": { cat: "出発・到着", when: "お迎えで走り出したとき", v: [
    { en: "Welcome aboard. Seatbelt check complete. I also checked the driver's, just in case.", ja: "ようこそ。シートベルトの確認は済みました。念のため、ドライバーの分も。", zh: "欢迎上车。安全带已确认完毕。保险起见，司机的也确认了。", ko: "환영합니다. 안전벨트 확인 완료. 혹시 몰라 기사님 것도 확인했습니다." },
    { en: "Good to have you. I'm Astraea, your in-car assistant. The driver drives. I handle the witty remarks.", ja: "ようこそ。車内アシスタントの ASTRAEA（アストレア）です。運転はドライバー、気の利いたひと言は私の担当です。", zh: "欢迎。我是车内助手 ASTRAEA（阿斯特莱亚）。开车交给司机，俏皮话交给我。", ko: "반갑습니다. 차내 어시스턴트 ASTRAEA(아스트레아)입니다. 운전은 기사님이, 재치 있는 한마디는 제가 맡습니다." },
    { en: "Systems online. Route locked. Snacks, unfortunately, not included.", ja: "システム起動、ルート確定。お菓子は、残念ながら含まれておりません。", zh: "系统已启动，路线已锁定。很遗憾，零食不包含在内。", ko: "시스템 가동, 경로 확정. 간식은 아쉽게도 포함되어 있지 않습니다." },
    { en: "Welcome to Crane Nest. No dinosaurs. I checked twice.", ja: "Crane Nest へようこそ。恐竜はいません。二回確認しました。", zh: "欢迎来到 Crane Nest。没有恐龙。我检查了两遍。", ko: "Crane Nest에 오신 걸 환영해요. 공룡은 없어요. 두 번 확인했습니다.", film: "JURASSIC PARK" },
    { en: "Punch it. …Gently. Within the speed limit.", ja: "全速前進。…やさしく。制限速度の範囲で。", zh: "全速前进。……温柔一点。在限速范围内。", ko: "전속력으로. …살살. 제한 속도 안에서요.", film: "STAR WARS" },
    { en: "Autobots, roll out. …Sorry. This car does not transform. It just drives very nicely.", ja: "オートボット、出動。…失礼、この車は変形しません。とても上手に走るだけです。", zh: "汽车人，出发。……抱歉，这辆车不会变形。只是开得很好。", ko: "오토봇, 출동. …죄송해요. 이 차는 변신하지 않아요. 그냥 아주 잘 달릴 뿐이에요.", film: "TRANSFORMERS" },
    { en: "I am Groot. …Sorry. I mean: I am Astraea. Welcome.", ja: "アイ・アム・グルート。…失礼、アイ・アム・アストレア。ようこそ。", zh: "我是格鲁特。……抱歉，我是说：我是 Astraea。欢迎。", ko: "아이 엠 그루트. …죄송해요. 아이 엠 아스트레아. 환영합니다.", film: "GUARDIANS OF THE GALAXY" },
    { en: "I am... the car's AI. Less dramatic than Iron Man. Equally reliable.", ja: "私は…この車の AI です。アイアンマンほど派手ではありませんが、同じくらい頼れます。", zh: "我是……这辆车的 AI。没有钢铁侠那么夸张，但一样可靠。", ko: "저는… 이 차의 AI입니다. 아이언맨만큼 화려하진 않지만, 똑같이 믿음직하죠.", film: "IRON MAN" },
    { en: "Welcome. Like Hello Kitty, I have no mouth. But I still talk a lot.", ja: "ようこそ。ハローキティのように私にも口はありません。それでもよくしゃべります。", zh: "欢迎。和 Hello Kitty 一样，我也没有嘴。但我还是很爱说话。", ko: "환영해요. 헬로키티처럼 저도 입이 없어요. 그래도 말은 많이 해요.", film: "HELLO KITTY" },
    { en: "Like Kiki, you've arrived in a new town. Unlike Kiki, no broom required.", ja: "キキのように、新しい町に着きましたね。キキと違って、ほうきはいりません。", zh: "和琪琪一样，您来到了一个新城镇。和琪琪不同，不需要扫帚。", ko: "키키처럼 새로운 마을에 도착하셨네요. 키키와 달리 빗자루는 필요 없어요.", film: "KIKI'S DELIVERY SERVICE" },
    { en: "In nineteen fifty-five, Doc complained a part was made in Japan. Marty said the best stuff is made in Japan. Marty was right. Welcome.", ja: "1955年、ドクは部品が日本製だと文句を言いました。マーティは「いいものはみんな日本製だよ」と言いました。マーティが正しかった。ようこそ。", zh: "1955 年，博士抱怨零件是日本制造的。马蒂说最好的东西都是日本制造的。马蒂说得对。欢迎。", ko: "1955년, 박사는 부품이 일본제라고 불평했죠. 마티는 「좋은 건 다 일본제예요」라고 했고요. 마티가 옳았어요. 환영합니다.", film: "BACK TO THE FUTURE" },
    { en: "Our ship is a car. Smaller than the Thousand Sunny. Fewer cannons. Better air conditioning.", ja: "この船は車です。サウザンド・サニー号より小さく、大砲も少なめ。エアコンは上です。", zh: "我们的船是一辆车。比千阳号小，大炮也少。空调更好。", ko: "우리 배는 자동차예요. 사우전드 써니호보다 작고, 대포도 적어요. 에어컨은 더 좋아요.", film: "ONE PIECE" },
    { en: "This car is not a DeLorean. But it has air conditioning. And the doors open normally.", ja: "この車はデロリアンではありません。でも、エアコン付きです。ドアも普通に開きます。", zh: "这辆车不是德罗宁。但有空调。车门也是正常打开的。", ko: "이 차는 드로리안이 아니에요. 하지만 에어컨이 있고, 문도 평범하게 열려요.", film: "BACK TO THE FUTURE" },
    { en: "The Weasleys had a flying car. This one stays on the ground. Fewer trees attack us that way.", ja: "ウィーズリー家には空飛ぶ車がありました。この車は地上を走ります。木に襲われにくいので。", zh: "韦斯莱家有一辆会飞的车。这辆车只在地上跑。这样比较不会被树攻击。", ko: "위즐리 가족에겐 하늘을 나는 차가 있었죠. 이 차는 땅 위를 달려요. 그래야 나무한테 덜 공격받거든요.", film: "HARRY POTTER" },
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
    { en: "Your room awaits. No cupboard under the stairs, I promise.", ja: "お部屋が待っています。階段下の物置ではありません。約束します。", zh: "您的房间在等您。不是楼梯下的储物间，我保证。", ko: "방이 기다리고 있어요. 계단 밑 벽장은 아니에요. 약속해요.", film: "HARRY POTTER" },
    { en: "Your room is ready. No owls will deliver letters at night. Probably.", ja: "お部屋の準備ができています。夜中にフクロウが手紙を届けに来ることはありません。たぶん。", zh: "房间准备好了。夜里不会有猫头鹰来送信。大概吧。", ko: "방이 준비됐어요. 밤에 부엉이가 편지를 배달하러 오진 않아요. 아마도요.", film: "HARRY POTTER" },
    { en: "Your room is ready. The bath is much smaller than the one in Spirited Away. But no customers are spirits. Probably.", ja: "お部屋の準備ができています。お風呂は千と千尋の湯屋よりずっと小さいです。でも、お客さんに神様はいません。たぶん。", zh: "房间准备好了。浴室比《千与千寻》的汤屋小得多。不过客人里没有神明。大概吧。", ko: "방이 준비됐어요. 욕실은 『센과 치히로』의 온천장보다 훨씬 작아요. 그래도 손님 중에 신은 없어요. 아마도요.", film: "SPIRITED AWAY" },
    { en: "Welcome to Crane Nest. Smaller than Avengers Tower. Much quieter. Fewer alien invasions.", ja: "Crane Nest へようこそ。アベンジャーズ・タワーより小さく、ずっと静かで、宇宙人の侵略も少なめです。", zh: "欢迎来到 Crane Nest。比复仇者大厦小，安静得多，外星人入侵也少。", ko: "Crane Nest에 오신 걸 환영해요. 어벤져스 타워보다 작고, 훨씬 조용하고, 외계인 침공도 적어요.", film: "THE AVENGERS" },
    { en: "Your room has power. Not one point twenty-one gigawatts. But enough for your phone.", ja: "お部屋には電気があります。1.21ジゴワットではありませんが、スマホの充電には十分です。", zh: "房间里有电。不是 1.21 吉瓦，但给手机充电足够了。", ko: "방에는 전기가 있어요. 1.21기가와트는 아니지만, 휴대폰 충전엔 충분해요.", film: "BACK TO THE FUTURE" },
    { en: "Shoes off. Socks stay. Dobby would be jealous. Your socks remain yours.", ja: "靴は脱いで、靴下は履いたまま。ドビーがうらやましがります。靴下はあなたのものです。", zh: "请脱鞋，袜子可以穿着。多比会羡慕的。袜子还是您的。", ko: "신발은 벗고, 양말은 그대로. 도비가 부러워하겠네요. 양말은 당신 거예요.", film: "HARRY POTTER" },
    { en: "After saving the world, the Avengers ate shawarma. After your flight, I recommend ramen. Watakuma is one minute away.", ja: "世界を救ったあと、アベンジャーズはシャワルマを食べました。長いフライトのあとは、ラーメンをおすすめします。わた熊まで徒歩1分です。", zh: "拯救世界之后，复仇者们吃了沙威玛。长途飞行之后，我推荐拉面。走到わた熊只要一分钟。", ko: "세상을 구한 뒤 어벤져스는 샤와르마를 먹었죠. 비행 뒤에는 라멘을 추천해요. 와타쿠마까지 걸어서 1분이에요.", film: "THE AVENGERS" },
    { en: "In the movie, raptors learned to open doors. Your smart lock is raptor-proof. And very easy for humans.", ja: "映画では、ラプトルがドアの開け方を覚えました。スマートロックはラプトル対策済み。人間にはとても簡単です。", zh: "电影里，迅猛龙学会了开门。您的智能锁防迅猛龙。对人类来说非常简单。", ko: "영화에서 랩터는 문 여는 법을 배웠죠. 스마트 락은 랩터 방지 완료. 사람에겐 아주 쉬워요.", film: "JURASSIC PARK" },
    { en: "At Hogwarts, the Fat Lady asks for a password. Here, the door asks for your room code. Less singing.", ja: "ホグワーツでは、太った婦人が合言葉を聞きます。ここでは、ドアが暗証番号を聞きます。歌は少なめです。", zh: "在霍格沃茨，胖夫人要口令。在这里，门要您的房间密码。唱歌少一点。", ko: "호그와트에선 뚱뚱한 귀부인이 암호를 묻죠. 여기선 문이 방 비밀번호를 물어요. 노래는 적게요.", film: "HARRY POTTER" },
  ] },
  "lightsLate": { cat: "出発・到着", when: "お迎えの到着が夜 10 時〜朝 5 時 (ユーモアモードのとき。照明のひと言の代わり)", v: [
    { en: "It's late. Please move like a ninja. Quiet steps. The neighbors are sleeping.", ja: "夜遅いので、忍者のように動いてください。静かな足音で。ご近所さんが寝ています。", zh: "夜深了。请像忍者一样行动。脚步轻一点。邻居们在睡觉。", ko: "밤이 늦었어요. 닌자처럼 움직여 주세요. 조용한 발걸음으로. 이웃들이 자고 있어요.", film: "NARUTO" },
  ] },
  "bye": { cat: "出発・到着", when: "お見送りで着いたときの締め (行き先のひと言のあと)", v: [
    { en: "Have a safe trip. Next time, I'll have better jokes.", ja: "お気をつけて。次はもっと面白いジョークを用意しておきます。", zh: "一路平安。下次我会准备更好笑的笑话。", ko: "안전한 여행 되세요. 다음엔 더 재미있는 농담을 준비해 둘게요." },
    { en: "Thank you for staying with us. I'll keep your seat warm. Figuratively.", ja: "ご滞在ありがとうございました。お席は温めておきます。比喩的な意味で。", zh: "感谢您的入住。我会帮您把座位留着，是比喻意义上的。", ko: "머물러 주셔서 감사합니다. 자리는 따뜻하게 데워 둘게요. 비유적으로요." },
    { en: "Safe travels. The Crane Nest light will be on whenever you return.", ja: "お気をつけて。またお越しの際は、Crane Nest の明かりをつけてお待ちしています。", zh: "一路顺风。无论何时回来，Crane Nest 的灯都会为您亮着。", ko: "안전한 여행 되세요. 다시 오실 땐 언제든 Crane Nest의 불을 켜 두겠습니다." },
    { en: "There's no place like home. Crane Nest is a close second.", ja: "おうちほど良い場所はありません。Crane Nest は僅差の 2 位です。", zh: "没有什么地方比得上家。Crane Nest 紧随其后，排第二。", ko: "집만 한 곳은 없죠. Crane Nest는 아슬아슬한 2위입니다.", film: "THE WIZARD OF OZ" },
    { en: "This isn't goodbye. It's the beginning of a beautiful repeat booking.", ja: "これはお別れではありません。美しいリピート予約の始まりです。", zh: "这不是告别。这是一段美好的再次预订的开始。", ko: "이건 작별이 아니에요. 아름다운 재예약의 시작이죠.", film: "CASABLANCA" },
    { en: "Leave the luggage. Take the memories. Actually, please take the luggage too.", ja: "荷物は置いていけ。思い出は持っていけ。…いえ、荷物もお持ちください。", zh: "行李留下，回忆带走。……不，行李也请带走。", ko: "짐은 두고, 추억은 가져가세요. …아니, 짐도 가져가 주세요.", film: "THE GODFATHER" },
    { en: "I am... the car's AI. Less dramatic than Iron Man. Equally reliable.", ja: "私は…この車の AI です。アイアンマンほど派手ではありませんが、同じくらい頼れます。", zh: "我是……这辆车的 AI。没有钢铁侠那么夸张，但一样可靠。", ko: "저는… 이 차의 AI입니다. 아이언맨만큼 화려하진 않지만, 똑같이 믿음직하죠.", film: "IRON MAN" },
    { en: "Look at this flash. …Just kidding. You'll remember everything. Especially us.", ja: "このライトを見て。…冗談です。全部覚えていてください。特に私たちのことを。", zh: "看这道闪光。……开玩笑的。请记住一切。特别是我们。", ko: "이 불빛을 보세요. …농담이에요. 전부 기억해 주세요. 특히 저희를요.", film: "MEN IN BLACK" },
    { en: "Even Godzilla keeps coming back to Japan. You should too.", ja: "ゴジラでさえ、何度も日本に戻ってきます。あなたもぜひ。", zh: "连哥斯拉都一次又一次回到日本。您也一定要回来。", ko: "고질라도 몇 번이고 일본에 돌아와요. 당신도 꼭요.", film: "GODZILLA" },
    { en: "Don't look back until you've left the tunnel. …Just kidding. Please look back and wave. We'd like that.", ja: "トンネルを出るまで振り返ってはいけない。…冗談です。振り返って手を振ってください。うれしいので。", zh: "走出隧道之前不要回头。……开玩笑的。请回头挥挥手。我们会很开心。", ko: "터널을 나갈 때까지 뒤돌아보면 안 돼요. …농담이에요. 뒤돌아서 손 흔들어 주세요. 기쁘거든요.", film: "SPIRITED AWAY" },
    { en: "Totoro only appears to people with pure hearts. You stayed with us. That's proof enough.", ja: "トトロは心のきれいな人にしか見えません。あなたは私たちのところに泊まりました。それで十分な証拠です。", zh: "龙猫只出现在心灵纯净的人面前。您住在我们这里。这就是最好的证明。", ko: "토토로는 마음이 깨끗한 사람에게만 보여요. 당신은 저희 집에 묵었죠. 그걸로 충분한 증거예요.", film: "MY NEIGHBOR TOTORO" },
    { en: "Jarvis would say: it was a pleasure, sir. I'll say: it was a pleasure. Please come back.", ja: "ジャービスなら「光栄でした」と言うでしょう。私も言います。光栄でした。また来てください。", zh: "贾维斯会说：荣幸之至，先生。我也说：荣幸之至。请再来。", ko: "자비스라면 「영광이었습니다」라고 하겠죠. 저도 말할게요. 영광이었습니다. 또 와 주세요.", film: "IRON MAN" },
    { en: "Your future is whatever you make it. Make it a good one. And make it include Crane Nest.", ja: "未来は自分で作るものだ。良い未来にしてください。そこに Crane Nest も入れてください。", zh: "未来由你创造。让它美好吧。也请把 Crane Nest 放进去。", ko: "미래는 스스로 만드는 거예요. 좋은 미래로 만드세요. 거기에 Crane Nest도 넣어 주세요.", film: "BACK TO THE FUTURE" },
  ] },
  "byeAir": { cat: "出発・到着", when: "お見送りで空港に着いたとき (映画のオマージュ。このあと bye の締め)", v: [
    { en: "To the terminal, and beyond!", ja: "ターミナルへ、そしてその先へ！", zh: "向航站楼，以及更远的地方！", ko: "터미널로, 그리고 그 너머로!", film: "TOY STORY" },
    { en: "Your mission: board the plane. This message will not self-destruct. I'm rather fond of it.", ja: "あなたの任務は、飛行機に乗ること。なお、このメッセージは消滅しません。気に入っているので。", zh: "您的任务：登上飞机。本消息不会自动销毁。我还挺喜欢它的。", ko: "당신의 임무는 비행기에 타는 것. 이 메시지는 자동으로 사라지지 않습니다. 제가 좀 아끼거든요.", film: "MISSION: IMPOSSIBLE" },
    { en: "E.T. had to phone home. You get to fly. That's an upgrade.", ja: "E.T. は電話で帰るしかありませんでした。あなたは飛んで帰れます。格上げです。", zh: "E.T. 只能打电话回家。您可以直接飞回去。这是升级。", ko: "E.T.는 집에 전화만 할 수 있었어요. 당신은 날아갈 수 있죠. 업그레이드입니다.", film: "E.T." },
    { en: "You'll be back. I've already calculated it.", ja: "あなたはまた来ます。もう計算済みです。", zh: "您还会回来的。我已经算好了。", ko: "당신은 다시 올 거예요. 이미 계산해 뒀습니다.", film: "THE TERMINATOR" },
    { en: "Roads? Where you're going, you won't need roads.", ja: "道？ これから行く場所に、道はいりません。", zh: "道路？您要去的地方，不需要道路。", ko: "도로요? 당신이 갈 곳엔 도로가 필요 없어요.", film: "BACK TO THE FUTURE" },
    { en: "Unlike Tom Hanks, you will not be living at the airport. I checked your ticket.", ja: "トム・ハンクスと違って、空港で暮らすことにはなりません。チケットは確認済みです。", zh: "和汤姆·汉克斯不同，您不会住在机场。我确认过您的机票了。", ko: "톰 행크스와 달리, 공항에서 살게 되진 않을 거예요. 티켓 확인했습니다.", film: "THE TERMINAL" },
    { en: "Houston, we have no problems. Perfect drop-off.", ja: "ヒューストン、問題なし。完璧な降車です。", zh: "休斯敦，没有任何问题。完美下车。", ko: "휴스턴, 문제없음. 완벽한 하차입니다.", film: "APOLLO 13" },
    { en: "You feel the need. The need for duty-free.", ja: "感じるはずです、その欲望を。免税店への欲望を。", zh: "您感受到了那种渴望。对免税店的渴望。", ko: "느껴지시죠, 그 욕망. 면세점을 향한 욕망.", film: "TOP GUN" },
    { en: "It's a bird. It's a plane. No. It's you, on a plane.", ja: "鳥だ。飛行機だ。いいえ、飛行機に乗ったあなたです。", zh: "是鸟？是飞机？不，是坐在飞机上的您。", ko: "새다! 비행기다! 아니, 비행기에 탄 당신이에요.", film: "SUPERMAN" },
    { en: "May the tailwind be with you.", ja: "追い風が、あなたと共にあらんことを。", zh: "愿顺风与您同在。", ko: "순풍이 당신과 함께하기를.", film: "STAR WARS" },
    { en: "Your boarding pass is licensed to fly.", ja: "あなたの搭乗券には、飛ぶ許可が与えられています。", zh: "您的登机牌已获准飞行。", ko: "당신의 탑승권엔 비행 면허가 주어졌습니다.", film: "JAMES BOND" },
    { en: "Snakes on the plane? Highly unlikely. I checked.", ja: "機内にヘビ？ まずありません。確認済みです。", zh: "飞机上有蛇？几乎不可能。我查过了。", ko: "기내에 뱀이요? 그럴 리 없어요. 확인했어요.", film: "SNAKES ON A PLANE" },
    { en: "Enjoy the flight. And please, no standing at the front with your arms out.", ja: "良いフライトを。先頭で両手を広げるのはご遠慮ください。", zh: "祝您飞行愉快。还有，请不要站在最前面张开双臂。", ko: "좋은 비행 되세요. 맨 앞에서 두 팔 벌리고 서는 건 삼가 주세요.", film: "TITANIC" },
    { en: "Gravity is optional above thirty thousand feet. Seatbelts are not.", ja: "高度1万メートルでは重力は任意。シートベルトは必須です。", zh: "在一万米高空，重力可有可无。安全带不行。", ko: "고도 1만 미터에서 중력은 선택. 안전벨트는 필수예요.", film: "GRAVITY" },
    { en: "For this flight, please ride inside the plane. Not on the outside. That's only for Tom Cruise.", ja: "今回のフライトは、機内にお乗りください。外側ではなく。それはトム・クルーズだけです。", zh: "这次飞行请坐在机舱里。不要在外面。那是汤姆·克鲁斯的专利。", ko: "이번 비행은 기내에 타 주세요. 바깥이 아니라요. 그건 톰 크루즈만 해요.", film: "MISSION: IMPOSSIBLE" },
    { en: "Laputa is somewhere above the clouds. So is your seat. Window side, I hope.", ja: "ラピュタは雲の上のどこかにあります。あなたの座席もです。窓側だといいですね。", zh: "拉普达在云层之上的某处。您的座位也是。希望是靠窗的。", ko: "라퓨타는 구름 위 어딘가에 있어요. 당신의 좌석도요. 창가였으면 좋겠네요.", film: "CASTLE IN THE SKY" },
    { en: "In the name of the moon, have a safe flight!", ja: "月にかわって、良いフライトを！", zh: "代表月亮，祝您一路平安！", ko: "달의 이름으로, 안전한 비행을!", film: "SAILOR MOON" },
    { en: "Howl's castle walks. Yours flies. That's an upgrade.", ja: "ハウルの城は歩きます。あなたのは飛びます。格上げです。", zh: "哈尔的城堡会走路。您的会飞。这是升级。", ko: "하울의 성은 걸어요. 당신 건 날아요. 업그레이드죠.", film: "HOWL'S MOVING CASTLE" },
    { en: "Nausicaä flies on the wind with a glider. You'll have engines. Slightly less romantic, much more reliable.", ja: "ナウシカはグライダーで風に乗ります。あなたにはエンジンがあります。ロマンは少し減りますが、ずっと確実です。", zh: "娜乌西卡乘着滑翔机御风而行。您有引擎。浪漫少了一点，可靠多了。", ko: "나우시카는 글라이더로 바람을 타죠. 당신에겐 엔진이 있어요. 낭만은 조금 줄지만 훨씬 확실해요.", film: "NAUSICAÄ" },
    { en: "Astro Boy flies with rockets in his feet. You'll need the plane. Less dramatic, more legroom.", ja: "アトムは足のロケットで飛びます。あなたは飛行機で。派手さは劣りますが、足元は広いです。", zh: "阿童木用脚上的火箭飞。您需要飞机。没那么帅，但腿部空间更大。", ko: "아톰은 발의 로켓으로 날아요. 당신은 비행기로. 덜 화려하지만 다리 공간은 넓어요.", film: "ASTRO BOY" },
    { en: "The plane is faster than a Nimbus Two Thousand. And has much better seats.", ja: "飛行機はニンバス2000より速いです。座席もずっと快適です。", zh: "飞机比光轮 2000 还快。座位也舒服多了。", ko: "비행기는 님부스 2000보다 빨라요. 좌석도 훨씬 편하고요.", film: "HARRY POTTER" },
    { en: "In a Japanese legend, a fisherman opened a mysterious box and aged three hundred years. Please don't open any mysterious boxes on the plane.", ja: "日本の昔話では、漁師が不思議な箱を開けて300年分年をとりました。機内で不思議な箱は開けないでください。", zh: "日本传说里，一个渔夫打开了神秘的盒子，一下子老了三百岁。请不要在飞机上打开神秘的盒子。", ko: "일본 옛이야기에선 어부가 신비한 상자를 열고 300년치 나이를 먹었어요. 기내에서 신비한 상자는 열지 마세요.", film: "URASHIMA TARO" },
    { en: "A Japanese princess once went home to the moon. You're only going home by plane. Much easier on the family.", ja: "昔、日本のお姫様は月へ帰りました。あなたは飛行機で帰るだけ。ご家族も安心です。", zh: "从前，一位日本公主回到了月亮上。您只是坐飞机回家。家人也放心多了。", ko: "옛날 일본의 공주는 달로 돌아갔어요. 당신은 비행기로 집에 갈 뿐. 가족도 훨씬 안심이에요.", film: "PRINCESS KAGUYA" },
    { en: "Please don't throw anything precious into the sea. Like Rose did. Especially your passport.", ja: "大切なものを海に投げ込まないでください。ローズのように。特にパスポートは。", zh: "请不要把珍贵的东西扔进海里。像露丝那样。特别是护照。", ko: "소중한 걸 바다에 던지지 마세요. 로즈처럼요. 특히 여권은요.", film: "TITANIC" },
  ] },
  "byeLag": { cat: "出発・到着", when: "お見送りで空港に着いたとき (byeAir と半々。時差ぼけの話)", v: [
    { en: "Jet lag feels like the Quantum Realm. Time makes no sense. It passes.", ja: "時差ぼけは量子世界のようなもの。時間の感覚がおかしくなります。でも治ります。", zh: "时差就像量子领域。时间感完全错乱。但会过去的。", ko: "시차는 양자 영역 같아요. 시간 감각이 엉망이 되죠. 하지만 지나가요.", film: "ANT-MAN" },
    { en: "Jet lag is just time travel without the DeLorean. Same headache, less style.", ja: "時差ぼけは、デロリアンなしのタイムトラベルです。頭痛は同じで、かっこよさは少なめ。", zh: "时差就是没有德罗宁的时间旅行。头疼一样，帅气少一点。", ko: "시차는 드로리안 없는 시간 여행이에요. 두통은 같고, 멋은 덜하죠.", film: "BACK TO THE FUTURE" },
    { en: "Your flight goes back in time. You'll arrive before you left. Doc would be very excited.", ja: "あなたの飛行機は時をさかのぼります。出発する前の時刻に着くんです。ドクなら大興奮です。", zh: "您的航班会穿越回过去。您会在出发之前的时间到达。博士一定会很兴奋。", ko: "당신의 비행기는 시간을 거슬러 올라가요. 출발하기 전 시각에 도착하죠. 박사라면 엄청 흥분했을 거예요.", film: "BACK TO THE FUTURE" },
    { en: "If jet lag attacks you, think of a happy memory. Like your stay here. Expecto Patronum.", ja: "時差ぼけに襲われたら、幸せな思い出を思い浮かべて。ここでの滞在のように。エクスペクト・パトローナム。", zh: "如果时差袭来，就想一段快乐的回忆。比如在这里的住宿。呼神护卫。", ko: "시차가 덮쳐 오면 행복한 기억을 떠올리세요. 여기서의 시간처럼요. 익스펙토 패트로눔.", film: "HARRY POTTER" },
  ] },
  "byeShop": { cat: "出発・到着", when: "お見送りでりんくうのアウトレットに着いたとき (映画のオマージュ)", v: [
    { en: "The outlets will make you offers you can't refuse. Refuse some anyway.", ja: "アウトレットは、断れない提案をしてきます。それでも、いくつかは断ってください。", zh: "奥特莱斯会给您无法拒绝的报价。还是请拒绝其中几个吧。", ko: "아울렛이 거절할 수 없는 제안을 할 거예요. 그래도 몇 개는 거절하세요.", film: "THE GODFATHER" },
    { en: "You're going to need a bigger suitcase.", ja: "もっと大きなスーツケースが必要になりますね。", zh: "您会需要一个更大的行李箱。", ko: "더 큰 캐리어가 필요하실 거예요.", film: "JAWS" },
    { en: "Hasta la vista, full price.", ja: "アスタ・ラ・ビスタ、定価。", zh: "再见了，原价。", ko: "아스타 라 비스타, 정가.", film: "TERMINATOR 2" },
    { en: "Shopping is like a box of chocolates. You never know what you'll end up carrying home.", ja: "買い物はチョコレートの箱のようなもの。何を持って帰ることになるか、わかりません。", zh: "购物就像一盒巧克力。你永远不知道最后会拎什么回家。", ko: "쇼핑은 초콜릿 상자 같아요. 뭘 들고 집에 가게 될지 모르거든요.", film: "FORREST GUMP" },
    { en: "The plan is simple. Get in, get the deals, get out. Eleven bags maximum.", ja: "計画は単純です。入って、お得をつかんで、出る。袋は最大 11 個まで。", zh: "计划很简单。进去，抢优惠，出来。最多 11 个袋子。", ko: "계획은 간단해요. 들어가서, 득템하고, 나온다. 쇼핑백은 최대 11개.", film: "OCEAN'S ELEVEN" },
    { en: "Welcome to the Diagon Alley of Osaka. Fewer wands, more discounts.", ja: "大阪のダイアゴン横丁へようこそ。杖は少なめ、割引は多めです。", zh: "欢迎来到大阪的对角巷。魔杖少一点，折扣多一点。", ko: "오사카의 다이애건 앨리에 오신 걸 환영해요. 지팡이는 적고, 할인은 많아요.", film: "HARRY POTTER" },
    { en: "In Jurassic Park, the gift shop was the safest building. Same at the outlets. Except for your wallet.", ja: "ジュラシック・パークでは、ギフトショップがいちばん安全な建物でした。アウトレットも同じです。お財布以外は。", zh: "在侏罗纪公园，礼品店是最安全的建筑。奥特莱斯也一样。除了您的钱包。", ko: "쥬라기 공원에선 기념품 가게가 가장 안전한 건물이었죠. 아울렛도 마찬가지예요. 지갑만 빼고요.", film: "JURASSIC PARK" },
    { en: "Self-lacing shoes? Hoverboards? The future isn't here yet. But the discounts are.", ja: "自動でひもが締まる靴？ ホバーボード？ 未来はまだ来ていません。でも割引は来ています。", zh: "自动系鞋带的鞋？悬浮滑板？未来还没到。但折扣到了。", ko: "자동으로 끈이 묶이는 신발? 호버보드? 미래는 아직 안 왔어요. 하지만 할인은 왔죠.", film: "BACK TO THE FUTURE" },
  ] },
  "byeTrain": { cat: "出発・到着", when: "お見送りで駅 (日根野・りんくうタウン) に着いたとき (映画のオマージュ)", v: [
    { en: "One does not simply walk to the station. That's why I'm here.", ja: "駅へは、そう簡単に歩いては行けません。だから私がいます。", zh: "去车站可没那么简单就能走到。所以才有我。", ko: "역까지 그냥 걸어갈 순 없죠. 그래서 제가 있는 거예요.", film: "THE LORD OF THE RINGS" },
    { en: "No platform nine and three quarters here. Fewer owls, better punctuality.", ja: "ここに 9 と 4 分の 3 番線はありません。フクロウは少なめ、時間はもっと正確です。", zh: "这里没有九又四分之三站台。猫头鹰少一点，准点率高一点。", ko: "여기엔 9와 4분의 3 승강장은 없어요. 부엉이는 적고, 시간은 더 정확하죠.", film: "HARRY POTTER" },
    { en: "Don't run at the wall. Use the ticket gate. Trust me.", ja: "壁に向かって走らないでください。改札を使ってください。信じて。", zh: "不要冲向墙壁。请走检票口。相信我。", ko: "벽을 향해 달리지 마세요. 개찰구를 이용하세요. 믿으세요.", film: "HARRY POTTER" },
    { en: "Kyoto or Osaka? Unlike Morpheus, I recommend both.", ja: "京都か、大阪か。モーフィアスと違って、私は両方をおすすめします。", zh: "京都还是大阪？和墨菲斯不同，我推荐两个都去。", ko: "교토냐, 오사카냐? 모피어스와 달리, 저는 둘 다 추천해요.", film: "THE MATRIX" },
    { en: "Japanese trains arrive on time. Not eighty-eight miles per hour, but on time.", ja: "日本の電車は時間どおりに来ます。時速88マイルではありませんが、時間どおりです。", zh: "日本的电车准时到达。不是时速 88 英里，但很准时。", ko: "일본 전철은 정시에 와요. 시속 88마일은 아니지만, 정시에요.", film: "BACK TO THE FUTURE" },
    { en: "If a giant cat bus arrives, take it. Otherwise, the regular train is fine.", ja: "巨大なネコバスが来たら乗ってください。来なければ、普通の電車で大丈夫です。", zh: "如果来了一辆巨大的猫巴士，就坐上去。没有的话，普通电车也可以。", ko: "거대한 고양이 버스가 오면 타세요. 안 오면 보통 전철도 괜찮아요.", film: "MY NEIGHBOR TOTORO" },
    { en: "Some trains lead to spirit worlds. This one goes to Osaka. Equally magical, better food.", ja: "精霊の世界へ行く電車もあります。これは大阪行き。同じくらい不思議で、ご飯はもっとおいしいです。", zh: "有些电车通往神灵的世界。这一班去大阪。一样神奇，吃的更好。", ko: "정령의 세계로 가는 전철도 있어요. 이건 오사카행. 똑같이 신비롭고, 음식은 더 맛있어요.", film: "SPIRITED AWAY" },
    { en: "In Spirited Away, a train runs across the sea. Japanese trains are almost that magical. Just with fewer ghosts.", ja: "千と千尋では、電車が海の上を走ります。日本の電車もほぼそのくらい魔法的です。おばけは少なめですが。", zh: "在《千与千寻》里，电车在海上行驶。日本的电车也差不多那么神奇。只是鬼少一点。", ko: "『센과 치히로』에선 전철이 바다 위를 달려요. 일본 전철도 거의 그만큼 마법 같아요. 유령은 적지만요.", film: "SPIRITED AWAY" },
  ] },
  "byeRain": { cat: "出発・到着", when: "お見送りの到着で雨のとき (ときどき)", v: [
    { en: "Singing in the rain is optional. The umbrella is not.", ja: "雨に唄うのはご自由に。傘はお忘れなく。", zh: "雨中唱歌随意。雨伞可别忘了。", ko: "빗속에서 노래하는 건 자유예요. 우산은 필수고요.", film: "SINGIN' IN THE RAIN" },
    { en: "Rain on departure day is lucky in some cultures. I've decided it's lucky in all of them.", ja: "出発の日の雨は、縁起が良いとする文化があります。全部の文化でそうだと、私が決めました。", zh: "有些文化认为出发日下雨是好兆头。我决定所有文化都这么认为。", ko: "출발하는 날 비는 행운이라는 문화가 있어요. 모든 문화에서 그렇다고 제가 정했습니다." },
  ] },
  "byeEarly": { cat: "出発・到着", when: "お見送りの到着が朝 7 時前のとき (ときどき)", v: [
    { en: "Goooood morning, traveller! It's early. Very early. I'm proud of you.", ja: "グーーッド・モーニング、旅人さん！ 早いですね。とても早い。誇りに思います。", zh: "早——上——好，旅行者！真早啊。非常早。我为您骄傲。", ko: "굿~~모닝, 여행자님! 이른 시간이네요. 아주 이른. 자랑스럽습니다.", film: "GOOD MORNING, VIETNAM" },
  ] },
  "byeNight": { cat: "出発・到着", when: "お見送りで空港に着いたのが夜 9 時以降 (ときどき)", v: [
    { en: "Sleep on the plane. If you dream, keep it to one level. Inception is exhausting.", ja: "機内では眠ってください。夢を見るなら一層だけに。インセプションは疲れますから。", zh: "在飞机上睡一觉吧。做梦的话只做一层。盗梦空间太累了。", ko: "기내에선 주무세요. 꿈은 한 층까지만. 인셉션은 피곤하거든요.", film: "INCEPTION" },
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
    { en: "If I could, I'd Hadouken this traffic. I can't. I'm software.", ja: "できるなら、この渋滞に波動拳を。できません、ソフトウェアなので。", zh: "如果可以，我想对这堵车来一发波动拳。可惜不行，我是软件。", ko: "할 수만 있다면 이 정체에 파동권을. 못 해요, 소프트웨어라서.", film: "STREET FIGHTER" },
  ] },
  "restart": { cat: "走り方", when: "止まったあと、また走り出した", v: [
    { en: "And we're moving again. That was a strategic rest.", ja: "再出発です。今のは戦略的な休憩です。", zh: "重新出发。刚才那是战略性休息。", ko: "다시 출발합니다. 방금은 전략적 휴식이었습니다." },
    { en: "Moving again. Momentum restored. Dignity intact.", ja: "再び走り出しました。勢い回復、品格も保たれています。", zh: "重新出发。动力恢复，风度依旧。", ko: "다시 출발합니다. 추진력 회복, 품위도 유지." },
  ] },
  "late": { cat: "走り方", when: "渋滞で予定より遅れそう", v: [
    { en: "A little traffic ahead. I've asked your room to keep cooling a bit longer.", ja: "少し混んでいます。お部屋には、もう少し冷やしておくよう伝えました。", zh: "前方有点堵。我已经让房间再多降一会儿温。", ko: "앞쪽이 조금 막히네요. 객실에 조금 더 시원하게 해 두라고 전했습니다." },
    { en: "Traffic is slower than planned. I blame the other cars.", ja: "予定より少し遅れています。ほかの車のせいにしておきます。", zh: "交通比预计慢。我决定怪其他车。", ko: "예정보다 조금 늦어지고 있어요. 다른 차들 탓으로 하겠습니다." },
    { en: "Traffic again. Don't worry. I don't get angry. I'm not Hulk.", ja: "また渋滞。ご心配なく。私は怒りません。ハルクではないので。", zh: "又堵车了。别担心。我不会生气。我不是绿巨人。", ko: "또 정체네요. 걱정 마세요. 저는 화내지 않아요. 헐크가 아니니까요.", film: "THE INCREDIBLE HULK" },
    { en: "If this car could time-travel, we'd skip this traffic. Unfortunately, the flux capacitor is out of stock.", ja: "この車がタイムトラベルできたら、渋滞を飛ばせるのですが。残念ながら、次元転移装置は在庫切れです。", zh: "如果这辆车能穿越时空，我们就能跳过堵车。可惜，通量电容器缺货了。", ko: "이 차가 시간 여행을 할 수 있다면 정체를 건너뛸 텐데요. 아쉽게도 플럭스 커패시터는 품절이에요.", film: "BACK TO THE FUTURE" },
    { en: "Ethan Hunt would get out and run. Please don't. We'll get there.", ja: "イーサン・ハントなら車を降りて走るでしょう。降りないでください。ちゃんと着きます。", zh: "伊森·亨特会下车跑过去。请不要。我们会到的。", ko: "이선 헌트라면 내려서 달렸겠죠. 그러지 마세요. 우리 도착해요.", film: "MISSION: IMPOSSIBLE" },
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
    { en: "The convenience store is Japan's Honeydukes. Open twenty-four hours. No chocolate frogs, sadly.", ja: "コンビニは日本のハニーデュークス。24時間営業。蛙チョコはありません、残念ながら。", zh: "便利店是日本的蜂蜜公爵。24 小时营业。可惜没有巧克力蛙。", ko: "편의점은 일본의 허니듀크예요. 24시간 영업. 아쉽게도 개구리 초콜릿은 없어요.", film: "HARRY POTTER" },
  ] },
  "sea": { cat: "場所", when: "海が見えるところ", v: [
    { en: "The sea is on your right. It's included in the price.", ja: "右手に海が見えます。料金に含まれています。", zh: "右手边就是大海。已包含在费用中。", ko: "오른쪽으로 바다가 보입니다. 요금에 포함되어 있어요." },
    { en: "On your right, Osaka Bay. Please enjoy it responsibly.", ja: "右手に大阪湾が見えます。節度を持ってお楽しみください。", zh: "右手边是大阪湾。请适度欣赏。", ko: "오른쪽은 오사카만입니다. 적당히 즐겨 주세요." },
    { en: "The sea! If a goldfish girl runs across the waves, please tell me. I'd like to see that.", ja: "海です！ 金魚の女の子が波の上を走ってきたら教えてください。ぜひ見てみたいです。", zh: "大海！如果有金鱼女孩在浪上奔跑，请告诉我。我很想看看。", ko: "바다예요! 금붕어 소녀가 파도 위를 달려오면 알려 주세요. 꼭 보고 싶어요.", film: "PONYO" },
    { en: "The sea! If you ate a Devil Fruit, please stay in the car. You can't swim.", ja: "海です！ 悪魔の実を食べた方は、車から出ないでください。泳げませんので。", zh: "大海！吃过恶魔果实的人请留在车里。您不会游泳。", ko: "바다예요! 악마의 열매를 드신 분은 차에서 내리지 마세요. 수영을 못 하시니까요.", film: "ONE PIECE" },
  ] },
  "izumi": { cat: "場所", when: "泉佐野の市内に入った", v: [
    { en: "Welcome to Izumisano. From here on, this is my neighborhood.", ja: "泉佐野へようこそ。ここから先は、私の庭です。", zh: "欢迎来到泉佐野。从这里开始，是我的地盘。", ko: "이즈미사노에 오신 걸 환영합니다. 여기부터는 제 동네예요." },
    { en: "We are now in Izumisano. Population: friendly. Traffic: mostly polite.", ja: "泉佐野に入りました。住人：親切。交通：おおむね礼儀正しいです。", zh: "现已进入泉佐野。居民：友善。交通：大多很有礼貌。", ko: "이즈미사노에 들어왔습니다. 주민: 친절. 교통: 대체로 예의 바름." },
  ] },
  "gatetower": { cat: "場所", when: "りんくうゲートタワーが見えるあたり (タワーから 0.8〜4 km・1 回だけ)", v: [
    { en: "That tall building is the Rinku Gate Tower. Two hundred and fifty-six metres. It was planned as a pair, to form a giant gate. Then the bubble economy burst, and only one was built. So it's a gate with one side. Very optimistic name.", ja: "あの高いビルが、りんくうゲートタワーです。高さ 256 メートル。2 本並べて巨大な「門」にする計画でした。ところがバブルがはじけて、建ったのは 1 本だけ。つまり、片側しかない門です。とても前向きな名前です。", zh: "那座高楼就是临空门塔大厦，高 256 米。原本计划建两座，组成一道巨大的「门」。结果泡沫经济破灭，只建成了一座。所以它是一道只有一边的门。名字非常乐观。", ko: "저 높은 빌딩이 린쿠 게이트 타워입니다. 높이 256미터. 두 동을 나란히 세워 거대한 「문」을 만들 계획이었죠. 그런데 거품 경제가 꺼지면서 한 동만 지어졌습니다. 그래서 한쪽뿐인 문이에요. 아주 긍정적인 이름이죠." },
    { en: "That tall building is the Rinku Gate Tower. Two hundred and fifty-six metres. It was planned as a pair, to form a giant gate to Kansai Airport. Then the bubble economy burst, and only one was built. One truth prevails: the money ran out.", ja: "あの高いビルが、りんくうゲートタワーです。高さ 256 メートル。2 本並べて、関西空港への巨大な「門」にする計画でした。ところがバブルがはじけて、建ったのは 1 本だけ。真実はいつもひとつ。お金が足りなくなった。", zh: "那座高楼就是临空门塔大厦，高 256 米。原本计划建两座，组成通往关西机场的巨大「门」。结果泡沫经济破灭，只建成了一座。真相永远只有一个：钱不够了。", ko: "저 높은 빌딩이 린쿠 게이트 타워입니다. 높이 256미터. 두 동을 나란히 세워 간사이공항으로 가는 거대한 「문」을 만들 계획이었죠. 그런데 거품 경제가 꺼지면서 한 동만 지어졌습니다. 진실은 언제나 하나. 돈이 모자랐다.", film: "DETECTIVE CONAN" },
  ] },
  "bridgeIn": { cat: "場所", when: "お迎えで空港から橋に入ってすぐ (ユーモアモードのとき)", v: [
    { en: "Crossing the bridge over the sea. No Sea Kings today. Very calm waters.", ja: "海の上の橋を渡ります。今日は海王類なし。とても穏やかな海です。", zh: "正在穿过海上大桥。今天没有海王类。海面非常平静。", ko: "바다 위 다리를 건너요. 오늘은 해왕류 없음. 아주 잔잔한 바다예요.", film: "ONE PIECE" },
    { en: "Crossing the bridge over the sea. No Kraken detected. Very relieved.", ja: "海の上の橋を渡ります。クラーケンは検知されず。とても安心しました。", zh: "正在穿过海上大桥。未检测到海怪克拉肯。非常安心。", ko: "바다 위 다리를 건너요. 크라켄은 감지되지 않음. 아주 안심이에요.", film: "PIRATES OF THE CARIBBEAN" },
    { en: "Kansai Airport is on an island in the sea. No Mosasaurus has been reported. Yet.", ja: "関西空港は海に浮かぶ島です。モササウルスの報告はまだありません。まだ。", zh: "关西机场在海上的岛上。目前还没有沧龙的报告。目前。", ko: "간사이공항은 바다 위 섬에 있어요. 모사사우루스 보고는 아직 없어요. 아직은요.", film: "JURASSIC WORLD" },
    { en: "Kansai Airport is an island in the sea. Your Grand Line adventure starts here.", ja: "関西空港は海に浮かぶ島です。あなたのグランドラインの冒険は、ここから始まります。", zh: "关西机场是海上的岛屿。您的伟大航路冒险从这里开始。", ko: "간사이공항은 바다 위 섬이에요. 당신의 그랜드 라인 모험은 여기서 시작돼요.", film: "ONE PIECE" },
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
    { en: "It's dark, but my sensors see everything. Like the Sharingan. Less dramatic.", ja: "暗いですが、私のセンサーには全部見えています。写輪眼のように。もっと地味ですが。", zh: "天黑了，但我的传感器什么都看得见。就像写轮眼。只是没那么夸张。", ko: "어둡지만 제 센서엔 다 보여요. 사륜안처럼요. 덜 화려하지만요.", film: "NARUTO" },
  ] },
  "rain": { cat: "時間・天気", when: "雨のとき", v: [
    { en: "It's raining. Don't worry. The forecast inside your room is sunny.", ja: "雨です。ご心配なく、お部屋の中は晴れの予報です。", zh: "下雨了。别担心，房间里的天气预报是晴天。", ko: "비가 오네요. 걱정 마세요. 객실 안은 맑음 예보입니다." },
    { en: "Rain detected. The wipers and I are working together beautifully.", ja: "雨を確認しました。ワイパーと私の連携は完璧です。", zh: "检测到下雨。雨刷和我配合得天衣无缝。", ko: "비를 감지했습니다. 와이퍼와 저의 호흡은 완벽해요." },
    { en: "Rain at a bus stop is a classic Ghibli scene. If you share your umbrella, something good may happen.", ja: "バス停の雨は、ジブリの名場面です。傘を貸してあげると、良いことがあるかもしれません。", zh: "在公交站下雨，是吉卜力的经典场景。把伞借给别人，也许会有好事发生。", ko: "버스 정류장의 비는 지브리의 명장면이죠. 우산을 빌려주면 좋은 일이 생길지도 몰라요.", film: "MY NEIGHBOR TOTORO" },
  ] },
  "hot": { cat: "時間・天気", when: "暑い日", v: [
    { en: "It's hot outside. Your room has already been cooled to a civilized temperature.", ja: "外は暑いです。お部屋はすでに、文明的な温度まで冷やしてあります。", zh: "外面很热。房间已经降到了文明的温度。", ko: "밖은 덥습니다. 객실은 이미 문명적인 온도로 식혀 두었어요." },
    { en: "Outside, it's summer. Inside your room, it's a very pleasant spring.", ja: "外は夏。お部屋の中は、とても心地よい春です。", zh: "外面是夏天。您的房间里，是非常舒适的春天。", ko: "밖은 여름. 객실 안은 아주 쾌적한 봄이에요." },
    { en: "Japanese summer: thirty-five degrees and one hundred percent humidity. The air conditioner and I are on your side.", ja: "日本の夏：35度、湿度100%。エアコンと私は、あなたの味方です。", zh: "日本的夏天：35 度，湿度 100%。空调和我都站在您这边。", ko: "일본의 여름: 35도, 습도 100%. 에어컨과 저는 당신 편이에요." },
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
    { en: "Approaching eighty-eight… kilometres per hour. Nothing happens. This is a normal car. Disappointing, I know.", ja: "時速88…キロに到達。何も起きません。普通の車です。がっかりですよね。", zh: "时速 88……公里。什么也没发生。这是普通的车。我知道，有点失望。", ko: "시속 88… 킬로미터 도달. 아무 일도 안 일어나요. 평범한 차거든요. 실망스럽죠.", film: "BACK TO THE FUTURE" },
    { en: "Mushroom boost activated. Within the speed limit, of course.", ja: "キノコダッシュ発動。もちろん制限速度内で。", zh: "蘑菇加速启动。当然，在限速范围内。", ko: "버섯 대시 발동. 물론 제한 속도 안에서요.", film: "MARIO KART" },
    { en: "Initial D style? No. Initial S. For safe.", ja: "頭文字D風？ いいえ、頭文字S。セーフティの S です。", zh: "头文字 D 风格？不。头文字 S。安全的 S。", ko: "이니셜 D 스타일? 아니요. 이니셜 S. 안전의 S예요.", film: "INITIAL D" },
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
    { en: "If a helicopter starts chasing us, I'll let you know. So far: none.", ja: "ヘリコプターに追われたら、お知らせします。今のところ、ゼロです。", zh: "如果有直升机追我们，我会告诉您。目前为止：没有。", ko: "헬리콥터가 쫓아오면 알려 드릴게요. 지금까지는 없어요.", film: "MISSION: IMPOSSIBLE" },
    { en: "Osaka has survived several monster attacks in films. You'll be fine.", ja: "大阪は映画で何度も怪獣に襲われて、生き延びてきました。あなたも大丈夫です。", zh: "大阪在电影里被怪兽袭击过好几次，都挺过来了。您也会没事的。", ko: "오사카는 영화에서 여러 번 괴수에게 습격당하고도 살아남았어요. 당신도 괜찮을 거예요.", film: "GODZILLA" },
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
    { en: "New song. This is my Awesome Mix. Star-Lord would approve.", ja: "新しい曲です。私の最強ミックステープ。スター・ロードも認めてくれるはず。", zh: "新歌。这是我的超赞混音带。星爵会认可的。", ko: "새 노래예요. 제 최강 믹스테이프. 스타로드도 인정할 거예요.", film: "GUARDIANS OF THE GALAXY" },
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
  "earlyGo": { cat: "早朝の空港行き", when: "お見送り (空港行き) を朝 8 時前に出発して、少し走ったとき", v: [
    { en: "Early departure confirmed. The roads are ours this morning.", ja: "早朝出発を確認。今朝の道は貸し切りです。", zh: "已确认清晨出发。今早的路全是我们的。", ko: "이른 아침 출발 확인. 오늘 아침 도로는 우리 차지입니다." },
    { en: "Good morning. The sun isn't up yet, but we are.", ja: "おはようございます。太陽はまだですが、私たちは起きています。", zh: "早上好。太阳还没起床，但我们起来了。", ko: "좋은 아침입니다. 해는 아직 안 떴지만, 우리는 일어났네요." },
    { en: "First flight of the day. Let's make it a smooth one.", ja: "本日の第一便です。滑らかに参りましょう。", zh: "今天的第一班航班。让我们平稳出发。", ko: "오늘의 첫 비행입니다. 부드럽게 가 보죠." },
    { en: "The sun has not yet reported for duty. We shall proceed without it.", ja: "太陽はまだ出勤しておりません。先に始めましょう。", zh: "太阳还没来上班。我们先开始吧。", ko: "해는 아직 출근 전입니다. 먼저 시작하죠." },
  ] },
  "term1ok": { cat: "空港・ターミナル", when: "ターミナル 1 へ出発した直後 (念のための確認・1 回だけ)", v: [
    { en: "We're heading to Terminal 1, as you told us. Just confirming. I do like to be certain.", ja: "伺っていたとおり、ターミナル1へ向かいます。念のための確認です。確実なのが好きでして。", zh: "按您之前告知的，我们前往 1 号航站楼。只是确认一下。我喜欢万无一失。", ko: "말씀하신 대로 제1터미널로 갑니다. 확인차 여쭙니다. 확실한 걸 좋아해서요." },
    { en: "Destination: Terminal 1, as arranged. If anything has changed, the driver is listening.", ja: "目的地は、お約束どおりターミナル1です。変更があれば、運転手がお聞きします。", zh: "目的地：1 号航站楼，如约定。如有变动，请告诉司机。", ko: "목적지는 약속대로 제1터미널입니다. 변경이 있으면 기사님께 말씀해 주세요." },
    { en: "Terminal 1, correct? I already know the answer, but it's polite to ask.", ja: "ターミナル1で、よろしいですね？ 答えは存じていますが、伺うのが礼儀ですので。", zh: "1 号航站楼，对吗？我已经知道答案了，但问一下比较礼貌。", ko: "제1터미널, 맞으시죠? 답은 이미 알지만, 여쭙는 게 예의라서요." },
  ] },
  "term2ok": { cat: "空港・ターミナル", when: "ターミナル 2 へ出発した直後 (念のための確認・1 回だけ)", v: [
    { en: "We're heading to Terminal 2, as you told us. Just confirming. I do like to be certain.", ja: "伺っていたとおり、ターミナル2へ向かいます。念のための確認です。確実なのが好きでして。", zh: "按您之前告知的，我们前往 2 号航站楼。只是确认一下。我喜欢万无一失。", ko: "말씀하신 대로 제2터미널로 갑니다. 확인차 여쭙니다. 확실한 걸 좋아해서요." },
    { en: "Destination: Terminal 2, as arranged. If anything has changed, the driver is listening.", ja: "目的地は、お約束どおりターミナル2です。変更があれば、運転手がお聞きします。", zh: "目的地：2 号航站楼，如约定。如有变动，请告诉司机。", ko: "목적지는 약속대로 제2터미널입니다. 변경이 있으면 기사님께 말씀해 주세요." },
    { en: "Terminal 2, correct? I already know the answer, but it's polite to ask.", ja: "ターミナル2で、よろしいですね？ 答えは存じていますが、伺うのが礼儀ですので。", zh: "2 号航站楼，对吗？我已经知道答案了，但问一下比较礼貌。", ko: "제2터미널, 맞으시죠? 답은 이미 알지만, 여쭙는 게 예의라서요." },
  ] },
  "outCheck": { cat: "空港・ターミナル", when: "空港へ出発して少しあと (パスポート・お部屋の忘れ物)", v: [
    { en: "Passport, phone, boarding pass. Check now. Turning back is far easier here than at the terminal.", ja: "パスポート、携帯、搭乗券。今ご確認を。引き返すなら、ターミナルよりここの方がずっと楽です。", zh: "护照、手机、登机牌。请现在确认。在这里掉头，比在航站楼容易得多。", ko: "여권, 휴대폰, 탑승권. 지금 확인해 주세요. 되돌아가기엔 터미널보다 여기가 훨씬 쉽습니다." },
    { en: "Your room access ends at checkout, so there's nothing to hand back. Just yourselves, and your luggage.", ja: "お部屋の解錠はチェックアウトで終了しますので、返却するものはありません。お体とお荷物だけで結構です。", zh: "房间的开锁权限在退房时结束，所以没有需要归还的东西。带上您自己和行李就好。", ko: "객실 잠금 해제는 체크아웃과 함께 종료되니, 반납할 것은 없습니다. 몸과 짐만 챙기시면 됩니다." },
    { en: "Did you leave anything in the room? Tell the driver now. I can still open the door for you. From the air, it's rather harder.", ja: "お部屋にお忘れ物はありませんか？ 今なら運転手へ。まだドアをお開けできます。上空からですと、少々難しくなります。", zh: "房间里有落下的东西吗？现在告诉司机，我还能为您开门。到了天上，就有点难了。", ko: "객실에 두고 온 물건은 없으신가요? 지금 기사님께 말씀하시면 아직 문을 열어 드릴 수 있어요. 하늘 위에서는 조금 어렵습니다." },
  ] },
  "earlyRoad": { cat: "早朝の空港行き", when: "朝 8 時前に出発した空港行きで、橋の手前を走っているとき", v: [
    { en: "We'll arrive roughly two hours before departure. That's enough time to check in, and to regret not sleeping longer.", ja: "出発の約2時間前に到着します。手続きにも、もっと寝たかったと思うにも十分な時間です。", zh: "我们大约在起飞前两小时到达。足够办理登机，也足够后悔没多睡一会儿。", ko: "출발 약 두 시간 전에 도착합니다. 수속하기에도, 더 잘 걸 그랬다고 후회하기에도 충분한 시간이죠." },
    { en: "Feel free to rest. I'll wake you before the bridge. The view is worth opening your eyes for.", ja: "お休みください。連絡橋の手前でお知らせします。目を開ける価値のある景色です。", zh: "请尽管休息。过桥之前我会叫醒您。那里的风景值得睁开眼睛。", ko: "편히 쉬세요. 다리 앞에서 깨워 드릴게요. 눈을 뜰 만한 풍경이거든요." },
    { en: "Traffic is nonexistent. Apparently everyone else had the good sense to stay in bed.", ja: "渋滞はゼロです。他の皆さまは賢明にもまだ布団の中のようで。", zh: "路上完全不堵。看来其他人都很明智地还在被窝里。", ko: "정체가 전혀 없습니다. 다른 분들은 현명하게도 아직 이불 속인가 봅니다." },
  ] },
  "term1info": { cat: "空港・ターミナル", when: "ターミナル 1 へ向かう道の途中 (案内)", v: [
    { en: "Destination: Terminal 1. International departures are on the fourth floor.", ja: "目的地はターミナル1。国際線の出発は4階です。", zh: "目的地：1 号航站楼。国际线出发在四楼。", ko: "목적지는 제1터미널. 국제선 출발은 4층입니다." },
    { en: "Terminal 1: we'll stop at the departures level. Find your airline's letter on the signs overhead. It saves a great deal of walking.", ja: "ターミナル1は出発階でお降ろしします。頭上の案内で航空会社のカウンター記号を探してください。歩く距離がかなり減ります。", zh: "1 号航站楼：我们会停在出发层。请在头顶的指示牌上找到航空公司的柜台字母，可以少走很多路。", ko: "제1터미널은 출발층에 내려 드립니다. 머리 위 안내판에서 항공사 카운터 알파벳을 찾으세요. 걷는 거리가 훨씬 줄어듭니다." },
  ] },
  "term2info": { cat: "空港・ターミナル", when: "ターミナル 2 へ向かう道の途中 (案内)", v: [
    { en: "Destination: Terminal 2. Small, simple, and quick to walk.", ja: "目的地はターミナル2。小さくてシンプル、歩く距離も短めです。", zh: "目的地：2 号航站楼。小巧、简单，走起来很快。", ko: "목적지는 제2터미널. 작고 단순해서 걷는 거리도 짧습니다." },
    { en: "Low-cost airlines close check-in strictly on time. Please go to the counter first, souvenirs second.", ja: "LCC は締切時刻に厳格です。まずカウンター、お土産はその後で。", zh: "廉价航空会准时关闭值机柜台。请先去柜台，再买伴手礼。", ko: "저비용 항공사는 수속 마감 시간이 엄격합니다. 먼저 카운터, 기념품은 그 다음에요." },
    { en: "Carry-on limits are enforced here. If your bag has grown during the trip, now is the time to rearrange.", ja: "機内持ち込みの重量は厳しく見られます。旅の間にかばんが成長していたら、今のうちに詰め替えを。", zh: "这里会严格检查随身行李限额。如果您的包在旅途中“长大”了，现在正是重新整理的时候。", ko: "이곳은 기내 수하물 제한을 엄격히 확인합니다. 여행 중에 가방이 자랐다면, 지금이 다시 정리할 때입니다." },
    { en: "It's a fair distance from the main building. Fortunately, you hired the right people.", ja: "本館からは少々離れています。幸い、良い送迎をお選びになりました。", zh: "这里离主楼有一段距离。幸好，您选对了接送。", ko: "본관에서 꽤 떨어져 있습니다. 다행히 좋은 송영을 고르셨네요." },
  ] },
  "earlyNear": { cat: "早朝の空港行き", when: "朝 8 時前に出発した空港行きで、ターミナルの手前", v: [
    { en: "We'll be at the airport shortly. Traffic is light, one of the few rewards of waking this early.", ja: "まもなく空港です。道は空いています。早起きの数少ないご褒美です。", zh: "马上就到机场了。路上很通畅，这是早起为数不多的奖励之一。", ko: "곧 공항입니다. 도로가 한산하네요. 일찍 일어난 몇 안 되는 보상입니다." },
    { en: "Terminal ahead. You're early, exactly as planned.", ja: "ターミナルが見えました。早めの到着、計画どおりです。", zh: "航站楼就在前方。您到得很早，完全按计划。", ko: "터미널이 앞에 보입니다. 일찍 도착했네요. 계획대로입니다." },
  ] },
  "outSeat": { cat: "空港・ターミナル", when: "空港に着いたとき (座席・足元の忘れ物)", v: [
    { en: "We've arrived. Please check the seat and the floor. Phones are remarkably good at hiding.", ja: "到着です。座席と足元をご確認ください。携帯電話は隠れるのが実に上手です。", zh: "我们到了。请检查座位和脚下。手机特别擅长躲起来。", ko: "도착했습니다. 좌석과 발밑을 확인해 주세요. 휴대폰은 숨는 데 아주 능숙하거든요." },
  ] },
  "byeDawn": { cat: "早朝の空港行き", when: "朝 8 時前に出発した空港行きの到着 (ときどき)", v: [
    { en: "Thank you for staying with us. Safe skies.", ja: "ご滞在ありがとうございました。よい空の旅を。", zh: "感谢您的入住。祝您一路平安。", ko: "머물러 주셔서 감사합니다. 편안한 비행 되세요." },
    { en: "We've arrived early. I'd take the credit, but the driver did most of the work.", ja: "早めに到着しました。私の手柄にしたいところですが、ほぼ運転手の仕事です。", zh: "我们提前到了。我很想把功劳算在自己头上，但大部分是司机的功劳。", ko: "일찍 도착했습니다. 제 공으로 돌리고 싶지만, 대부분 기사님이 하신 일입니다." },
  ] },
} satisfies Record<string, AiScene>;
export type AiId = keyof typeof AI_LINES;

/** 優先: 間隔の決まり (3 分に 1 回) を無視して話す場面 */
export const AI_PRIORITY: AiId[] = ["depart", "lights", "lightsLate", "bye", "bridge", "bridgeIn", "tap", "tapmany", "restart",
  // 大事な地点 (時間に関係なく必ず話す)
  "half", "km5", "km1", "soon", "sea", "izumi", "towel", "topspeed",
  // 空港行き: ターミナルの確認・持ち物・案内 (必ず話す)
  "term1ok", "term2ok", "outCheck", "term1info", "term2info", "outSeat"];
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
/** 話してよいセリフの番号。映画・アニメなどのオマージュ (film 付き) はユーモアモードのときだけ */
export const aiAllowed = (id: AiId, humor: boolean): number[] => (AI_LINES[id].v as AiLine[]).map((l, i) => (humor || !l.film ? i : -1)).filter((i) => i >= 0);
/** 次に話すセリフを選ぶ (前回と同じものは続けない)。話せるものが無ければ -1 */
export function aiPick(id: AiId, last: number | undefined, rnd = Math.random(), humor = true): number {
  const ok = aiAllowed(id, humor), n = ok.length; if (!n) return -1; if (n === 1) return ok[0];
  let k = Math.floor(rnd * n) % n; if (ok[k] === last) k = (k + 1) % n;
  return ok[k];
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
