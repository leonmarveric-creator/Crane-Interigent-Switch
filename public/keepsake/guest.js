/* 旅の記念 (ゲスト用 /k/<token>): 招待くじ → 当選の演出 → 申し込み (ART / Records / Cheers) → 完成品を見る
   window.KS = { token, cabin, name, lang, gifts, status, cardGiven, orders, examples, settings, expires, qr } */
(function () {
  "use strict";
  var KS = window.KS || {}, $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var LANGS = ["en", "zh", "ko", "ja"], LN = { en: "English", zh: "中文", ko: "한국어", ja: "日本語" };
  var lang = LANGS.indexOf(KS.lang) >= 0 ? KS.lang : "en";
  try { var savedLang = localStorage.getItem("ks.lang"); if (LANGS.indexOf(savedLang) >= 0) lang = savedLang; } catch (e) { /* ignore */ }

  var TX = {
    en: {
      nm: "{n}", inv: "A Special Invitation", from: "from Crane Nest", tapEnv: "Tap the envelope to open", later: "Later (driver: show the QR only)",
      letter: "Thank you for staying at Crane Nest.<br>As a keepsake of your journey,<br>you are invited to a special draw.", draw: "Draw now",
      yours: "{n}'s draw", openCap: "Open the capsule", tapCap: "▲ Tap the capsule", won: "YOU WON!", next: "Next gift ▸", receive: "Receive",
      congr: "Congratulations, {n}", forYou: "For {n}", thanks: "Thank you for staying with us. We hope to see you again.",
      cardHand: "Your driver will hand it to you now.<br>Which one? It is a surprise.", qrApply: "Scan with your phone to send your photo and memories.", qrLater: "Scan later with your phone to draw.", valid: "Valid for 30 days", drawHere: "Your draw is here",
      v_inv: "A special invitation has arrived for you.", v_draw: "Tap the capsule. Let us see what awaits you.", v_win: "Congratulations. You have won a gift from Crane Nest.", v_end: "It is yours. Thank you for staying with us. Have a safe journey.",
      g_art: "We turn your photo into an illustration of your journey", g_rec: "An original song, made only for your trip", g_card: "One Japanese Pokémon card. Which one? It is a surprise", cardName: "Pokémon Card",
      hub1: "Your", hub2: "Keepsakes", hubLd: "Gifts from Crane Nest, to remember this journey.", apply: "Apply", making: "In progress", ready: "Ready", view: "View",
      cardWait: "Handed to you by your driver", cardDone: "Received", paid: "Paid", cheersS: "A celebration dance video, from across the world",
      back: "‹ Back", artLd: "We turn your photo into an illustration of your journey. Slide left and right to compare.", which: "Which moment?", start: "Start of the trip", end: "End of the trip",
      pick: "Choose one photo", pickTap: "📷 Tap to choose a photo", pickTip: "A photo with clear faces turns out best", picked: "✓ Photo selected (tap to change)", words: "Words to include (optional)", wordsPh: "e.g. 2026 Osaka · Family trip",
      contact: "Where can we tell you when it is ready? (optional)", contactPh: "Email / WeChat / LINE / WhatsApp", submit: "Apply with this", sending: "Sending…",
      nArt: "· Ready by: the next day (a little longer when busy)<br>· Your photo is used only to make the illustration and is deleted 30 days after delivery<br>· Free — a gift from Crane Nest",
      okArt: "✓ We have received your request.<br>We will make your illustration. When it is ready, it appears on this page.",
      recLd: "We write one song only for your trip, with your names and memories in the lyrics.", style: "Music styles you like (any number)", style2: "Other style (optional)", style2Ph: "e.g. bright and acoustic",
      names: "Names to sing", namesPh: "e.g. Mei, Ken", mem: "Words, places, things that happened", memPh: "e.g. First time in Japan. The sunset at Rinku was beautiful. We ate takoyaki three times.", lyr: "Language of the lyrics",
      nRec: "· Ready by: the next day<br>· We cannot imitate a specific singer or song<br>· Free — a gift from Crane Nest", okRec: "✓ We have received your request.<br>We will write your song. When it is ready, you can listen on this page.",
      cheLd: "Performers across the sea hold up your name and photo, and celebrate you with song and dance. For birthdays, anniversaries, and travel memories.",
      occ: "What are we celebrating?", occs: ["🎂 Birthday", "💍 Anniversary", "🛬 Welcome to Japan", "🛫 Trip memory", "🎓 Congratulations", "💌 Thank you"],
      who: "Name of the person to celebrate", whoPh: "e.g. Mei", msg: "Message to hold up", msgPh: "e.g. Happy Birthday Mei! Welcome to Japan", photoOpt: "Choose one photo (optional)", photoOptTip: "The performers hold up this photo",
      nChe: "· Ready in: 3–5 days (after you leave, it appears on this page)<br>· We cannot accept hurtful or inappropriate messages<br>· Payment: our staff will contact you before we start",
      okChe: "✓ We have received your request.<br>Our staff will contact you about payment. The video appears on this page when it arrives.", price: "Price",
      resT: "Your keepsake is ready", save: "Save / open", openLink: "Open", keep: "This page is valid until {d}. Please save it so you can come back.", copy: "Copy the link to this page", copied: "✓ Copied",
      errSend: "Could not send. Please check your connection and try again.", errBig: "The photo could not be read. Please choose another one.", expT: "This invitation has ended", expB: "Thank you for staying at Crane Nest.", noneT: "Invitation not found",
    },
    ja: {
      nm: "{n} 様", inv: "特別なご招待", from: "Crane Nest より", tapEnv: "封筒をタップして開く", later: "あとで（運転手用：QR だけお渡しする）",
      letter: "Crane Nest にお越しいただき、ありがとうございます。<br>旅の記念に、<br>特別なくじにご招待します。", draw: "くじを引く",
      yours: "{n} のくじ", openCap: "カプセルを開けてください", tapCap: "▲ カプセルをタップ", won: "当選！", next: "次の贈りものを見る ▸", receive: "受け取る",
      congr: "おめでとうございます、{n}", forYou: "{n} へ", thanks: "ご滞在ありがとうございました。またのお越しをお待ちしています。",
      cardHand: "運転手がお渡しします。<br>何が出るかはお楽しみ。", qrApply: "スマホで読んで、写真や思い出を送ってください。", qrLater: "あとでスマホで読んで、くじを引いてください。", valid: "30 日間有効", drawHere: "くじはこちらから",
      v_inv: "特別なご招待が届いています。", v_draw: "カプセルをタップしてください。何が待っているか、見てみましょう。", v_win: "おめでとうございます。Crane Nest からの贈りものが当たりました。", v_end: "あなたのものです。ご滞在ありがとうございました。どうぞお気をつけて。",
      g_art: "あなたの写真を、旅の記念イラストにお作りします", g_rec: "あなただけの旅の歌を 1 曲お作りします", g_card: "日本のポケモンカードを 1 枚プレゼント。何が出るかはお楽しみ", cardName: "ポケモンカード",
      hub1: "旅の", hub2: "記念", hubLd: "この旅を思い出に。Crane Nest からの贈りものです。", apply: "申し込む", making: "お作りしています", ready: "出来上がり", view: "見る",
      cardWait: "運転手が手渡しします", cardDone: "お渡し済み", paid: "有料", cheersS: "世界から届く、お祝いのダンス動画",
      back: "‹ 戻る", artLd: "あなたの写真を、旅の記念イラストにお作りします。左右に動かして、仕上がりを比べてみてください。", which: "どちらの記念にしますか", start: "旅の始まり", end: "旅の終わり",
      pick: "写真を 1 枚選ぶ", pickTap: "📷 タップして写真を選ぶ", pickTip: "顔がはっきり写った写真がきれいに仕上がります", picked: "✓ 写真を選びました（タップで変更）", words: "入れたい言葉（任意）", wordsPh: "例：2026 Osaka · Family trip",
      contact: "出来上がりのご連絡先（任意）", contactPh: "メール / WeChat / LINE / WhatsApp", submit: "この内容で申し込む", sending: "送信中…",
      nArt: "・お渡しの目安：翌日まで（混み合うときは少しお時間をいただきます）<br>・写真は作成のためだけに使い、お渡しから 30 日後に削除します<br>・無料（Crane Nest からの贈りものです）",
      okArt: "✓ お申し込みを受け付けました。<br>イラストをお作りします。出来上がったら、このページに届きます。",
      recLd: "あなたの旅だけの歌を 1 曲お作りします。お名前や思い出を歌詞に入れます。", style: "好きな曲のスタイル（いくつでも）", style2: "ほかのスタイル（任意）", style2Ph: "例：アコースティックで明るく",
      names: "歌に入れたい名前", namesPh: "例：Mei, Ken", mem: "入れたい言葉・場所・出来事", memPh: "例：初めての日本。りんくうの夕日がきれいだった。たこ焼きを 3 回食べた。", lyr: "歌詞の言語",
      nRec: "・お渡しの目安：翌日まで<br>・特定の歌手や曲に似せるご注文はお受けできません<br>・無料（Crane Nest からの贈りものです）", okRec: "✓ お申し込みを受け付けました。<br>歌をお作りします。出来上がったら、このページでお聴きいただけます。",
      cheLd: "海の向こうのパフォーマーが、あなたのお名前と写真を掲げて、歌とダンスでお祝いします。誕生日、記念日、旅の思い出に。",
      occ: "何のお祝いですか", occs: ["🎂 誕生日", "💍 記念日", "🛬 ようこそ日本へ", "🛫 旅の思い出", "🎓 お祝い", "💌 ありがとう"],
      who: "お祝いする方のお名前", whoPh: "例：Mei", msg: "掲げてほしいメッセージ", msgPh: "例：Happy Birthday Mei! Welcome to Japan", photoOpt: "写真を 1 枚選ぶ（任意）", photoOptTip: "パフォーマーが掲げる写真です",
      nChe: "・お渡しの目安：3〜5 日（ご出発後は、このページに届きます）<br>・ほかの方を傷つける内容や不適切な言葉はお受けできません<br>・お支払い：作成の前に、スタッフからご連絡します",
      okChe: "✓ お申し込みを受け付けました。<br>お支払いについてスタッフからご連絡します。動画が届いたら、このページでご覧いただけます。", price: "料金",
      resT: "出来上がりました", save: "保存する・開く", openLink: "開く", keep: "このページは {d} まで見られます。あとで戻れるように保存してください。", copy: "このページのリンクをコピー", copied: "✓ コピーしました",
      errSend: "送信できませんでした。通信を確認して、もう一度お試しください。", errBig: "写真を読めませんでした。別の写真をお選びください。", expT: "このご招待は終了しました", expB: "Crane Nest にご滞在いただき、ありがとうございました。", noneT: "ご招待が見つかりません",
    },
    zh: {
      nm: "{n}", inv: "特别邀请", from: "来自 Crane Nest", tapEnv: "点击信封打开", later: "稍后（司机用：只给二维码）",
      letter: "感谢您入住 Crane Nest。<br>作为旅途的纪念，<br>诚邀您参加特别抽奖。", draw: "开始抽奖",
      yours: "{n} 的抽奖", openCap: "请打开扭蛋", tapCap: "▲ 点击扭蛋", won: "中奖了！", next: "看下一份礼物 ▸", receive: "领取",
      congr: "恭喜您，{n}", forYou: "致 {n}", thanks: "感谢您的入住，期待再次相见。",
      cardHand: "司机现在交给您。<br>是哪一张？敬请期待。", qrApply: "用手机扫码，发送照片和回忆。", qrLater: "稍后用手机扫码抽奖。", valid: "30 天内有效", drawHere: "从这里抽奖",
      v_inv: "您收到了一份特别邀请。", v_draw: "请点击扭蛋，看看里面有什么。", v_win: "恭喜您，抽中了 Crane Nest 的礼物。", v_end: "它是您的了。感谢您的入住，祝您旅途平安。",
      g_art: "把您的照片画成旅行纪念插画", g_rec: "为您的旅行创作一首专属歌曲", g_card: "赠送一张日本宝可梦卡牌。是哪一张？敬请期待", cardName: "宝可梦卡牌",
      hub1: "旅行", hub2: "纪念", hubLd: "Crane Nest 送给您的礼物，留住这段旅程。", apply: "去申请", making: "制作中", ready: "已完成", view: "查看",
      cardWait: "由司机当面交给您", cardDone: "已领取", paid: "付费", cheersS: "来自世界的庆祝舞蹈视频",
      back: "‹ 返回", artLd: "把您的照片画成旅行纪念插画。左右滑动，对比效果。", which: "纪念哪个时刻？", start: "旅程的开始", end: "旅程的结束",
      pick: "选择一张照片", pickTap: "📷 点击选择照片", pickTip: "脸部清晰的照片效果更好", picked: "✓ 已选择照片（点击更换）", words: "想加入的文字（可选）", wordsPh: "例：2026 Osaka · Family trip",
      contact: "完成后如何通知您？（可选）", contactPh: "邮箱 / 微信 / LINE / WhatsApp", submit: "提交申请", sending: "发送中…",
      nArt: "・预计交付：次日（繁忙时稍晚）<br>・照片仅用于制作，交付 30 天后删除<br>・免费（Crane Nest 的礼物）",
      okArt: "✓ 已收到您的申请。<br>我们将为您制作插画，完成后会显示在本页面。",
      recLd: "为您的旅行创作一首专属歌曲，把名字和回忆写进歌词。", style: "喜欢的音乐风格（可多选）", style2: "其他风格（可选）", style2Ph: "例：明快的原声吉他",
      names: "想唱进歌里的名字", namesPh: "例：Mei, Ken", mem: "想加入的话、地点、发生的事", memPh: "例：第一次来日本。临空城的夕阳很美。吃了三次章鱼烧。", lyr: "歌词语言",
      nRec: "・预计交付：次日<br>・无法模仿特定歌手或歌曲<br>・免费（Crane Nest 的礼物）", okRec: "✓ 已收到您的申请。<br>我们将为您创作歌曲，完成后可在本页面收听。",
      cheLd: "大洋彼岸的表演者举着您的名字和照片，用歌舞为您庆祝。适合生日、纪念日和旅行回忆。",
      occ: "庆祝什么？", occs: ["🎂 生日", "💍 纪念日", "🛬 欢迎来日本", "🛫 旅行回忆", "🎓 祝贺", "💌 感谢"],
      who: "被庆祝的人的名字", whoPh: "例：Mei", msg: "想举起的留言", msgPh: "例：Happy Birthday Mei! Welcome to Japan", photoOpt: "选择一张照片（可选）", photoOptTip: "表演者会举起这张照片",
      nChe: "・预计交付：3–5 天（离开后会显示在本页面）<br>・不接受伤害他人或不当的内容<br>・付款：制作前工作人员会与您联系",
      okChe: "✓ 已收到您的申请。<br>工作人员会就付款与您联系。视频完成后可在本页面观看。", price: "价格",
      resT: "已为您完成", save: "保存 / 打开", openLink: "打开", keep: "本页面有效期至 {d}。请保存，以便日后查看。", copy: "复制本页链接", copied: "✓ 已复制",
      errSend: "发送失败，请检查网络后重试。", errBig: "无法读取照片，请换一张。", expT: "此邀请已结束", expB: "感谢您入住 Crane Nest。", noneT: "未找到邀请",
    },
    ko: {
      nm: "{n} 님", inv: "특별한 초대", from: "Crane Nest 드림", tapEnv: "봉투를 눌러 열어 주세요", later: "나중에 (기사용: QR만 전달)",
      letter: "Crane Nest를 찾아 주셔서 감사합니다.<br>여행의 기념으로,<br>특별한 추첨에 초대합니다.", draw: "추첨하기",
      yours: "{n}의 추첨", openCap: "캡슐을 열어 주세요", tapCap: "▲ 캡슐을 누르세요", won: "당첨!", next: "다음 선물 보기 ▸", receive: "받기",
      congr: "축하합니다, {n}", forYou: "{n}께", thanks: "머물러 주셔서 감사합니다. 다시 뵙기를 기다리겠습니다.",
      cardHand: "기사가 지금 전해 드립니다.<br>무엇이 나올지는 비밀입니다.", qrApply: "휴대폰으로 스캔해 사진과 추억을 보내 주세요.", qrLater: "나중에 휴대폰으로 스캔해 추첨하세요.", valid: "30일간 유효", drawHere: "추첨은 여기에서",
      v_inv: "특별한 초대가 도착했습니다.", v_draw: "캡슐을 눌러 주세요. 무엇이 기다리는지 볼까요.", v_win: "축하합니다. Crane Nest의 선물에 당첨되셨습니다.", v_end: "당신의 것입니다. 머물러 주셔서 감사합니다. 안전한 여행 되세요.",
      g_art: "사진을 여행 기념 일러스트로 만들어 드립니다", g_rec: "당신만의 여행 노래를 한 곡 만들어 드립니다", g_card: "일본 포켓몬 카드 1장 선물. 무엇이 나올지는 비밀", cardName: "포켓몬 카드",
      hub1: "여행의", hub2: "기념", hubLd: "이 여행을 기억하도록, Crane Nest가 드리는 선물입니다.", apply: "신청하기", making: "제작 중", ready: "완성", view: "보기",
      cardWait: "기사가 직접 전해 드립니다", cardDone: "전달 완료", paid: "유료", cheersS: "세계에서 도착하는 축하 댄스 영상",
      back: "‹ 뒤로", artLd: "사진을 여행 기념 일러스트로 만들어 드립니다. 좌우로 움직여 비교해 보세요.", which: "어느 순간을 기념할까요?", start: "여행의 시작", end: "여행의 끝",
      pick: "사진 1장 선택", pickTap: "📷 눌러서 사진 선택", pickTip: "얼굴이 또렷한 사진이 예쁘게 나옵니다", picked: "✓ 사진을 선택했습니다 (눌러서 변경)", words: "넣고 싶은 문구 (선택)", wordsPh: "예: 2026 Osaka · Family trip",
      contact: "완성되면 어디로 알려 드릴까요? (선택)", contactPh: "이메일 / WeChat / LINE / WhatsApp", submit: "이 내용으로 신청", sending: "보내는 중…",
      nArt: "・전달 예정: 다음 날까지 (바쁠 때는 조금 더 걸립니다)<br>・사진은 제작에만 사용하며 전달 30일 후 삭제합니다<br>・무료 (Crane Nest의 선물)",
      okArt: "✓ 신청을 받았습니다.<br>일러스트를 만들어 드립니다. 완성되면 이 페이지에 도착합니다.",
      recLd: "당신의 여행만을 위한 노래를 한 곡 만들어 드립니다. 이름과 추억을 가사에 담습니다.", style: "좋아하는 음악 스타일 (여러 개 가능)", style2: "다른 스타일 (선택)", style2Ph: "예: 밝은 어쿠스틱",
      names: "노래에 넣을 이름", namesPh: "예: Mei, Ken", mem: "넣고 싶은 말·장소·있었던 일", memPh: "예: 첫 일본 여행. 린쿠의 노을이 아름다웠다. 타코야키를 세 번 먹었다.", lyr: "가사 언어",
      nRec: "・전달 예정: 다음 날까지<br>・특정 가수나 곡을 흉내 내는 주문은 받을 수 없습니다<br>・무료 (Crane Nest의 선물)", okRec: "✓ 신청을 받았습니다.<br>노래를 만들어 드립니다. 완성되면 이 페이지에서 들으실 수 있습니다.",
      cheLd: "바다 건너의 퍼포머가 이름과 사진을 들고 노래와 춤으로 축하합니다. 생일, 기념일, 여행의 추억에.",
      occ: "무엇을 축하하나요?", occs: ["🎂 생일", "💍 기념일", "🛬 일본에 오신 것을 환영", "🛫 여행의 추억", "🎓 축하", "💌 감사"],
      who: "축하받을 분의 이름", whoPh: "예: Mei", msg: "들어 줄 메시지", msgPh: "예: Happy Birthday Mei! Welcome to Japan", photoOpt: "사진 1장 선택 (선택)", photoOptTip: "퍼포머가 드는 사진입니다",
      nChe: "・전달 예정: 3–5일 (출발 후에는 이 페이지에 도착합니다)<br>・타인에게 상처가 되거나 부적절한 내용은 받을 수 없습니다<br>・결제: 제작 전에 직원이 연락드립니다",
      okChe: "✓ 신청을 받았습니다.<br>결제에 대해 직원이 연락드립니다. 영상이 도착하면 이 페이지에서 보실 수 있습니다.", price: "요금",
      resT: "완성되었습니다", save: "저장 / 열기", openLink: "열기", keep: "이 페이지는 {d}까지 볼 수 있습니다. 나중에 돌아올 수 있도록 저장해 주세요.", copy: "이 페이지 링크 복사", copied: "✓ 복사했습니다",
      errSend: "보내지 못했습니다. 연결을 확인하고 다시 시도해 주세요.", errBig: "사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.", expT: "이 초대는 종료되었습니다", expB: "Crane Nest에 머물러 주셔서 감사합니다.", noneT: "초대를 찾을 수 없습니다",
    },
  };
  var T = TX[lang];
  var nm = function () { return T.nm.replace("{n}", esc(KS.name || "Guest")); };
  var SVI = { art: "🎨", rec: "🎵", card: "🃏", cheers: "🌍" };
  var SVN = function (k) { return k === "art" ? "Crane Journey ART" : k === "rec" ? "Crane Nest Records" : k === "cheers" ? "Cheers Around the World" : T.cardName; };
  var app = $("#app");

  if (KS.gone) { app.innerHTML = '<div class="exp"><b>' + (KS.gone === "expired" ? T.expT : T.noneT) + "</b>" + T.expB + "</div>"; return; }

  var gifts = (KS.gifts || []).filter(function (g) { return SVI[g]; });
  var orders = KS.orders || [];
  var api = "/api/keepsake/" + encodeURIComponent(KS.token);

  /* ================= くじ ================= */
  var AC = null, timers = [], va = null, sbT = 0, busy = false, idx = 0;
  var later = function (f, ms) { timers.push(setTimeout(f, ms)); };
  var vib = function (p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* ignore */ } };
  function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch (e) { /* ignore */ } return AC; }
  function tone(f, t, d, v, type, to) {
    var c = ac(); if (!c) return; v = v == null ? .12 : v;
    var o = c.createOscillator(), g = c.createGain(), T0 = c.currentTime + t; o.type = type || "triangle"; o.frequency.setValueAtTime(f, T0); if (to) o.frequency.exponentialRampToValueAtTime(to, T0 + d);
    g.gain.setValueAtTime(0, T0); g.gain.linearRampToValueAtTime(v, T0 + .02); g.gain.exponentialRampToValueAtTime(.0001, T0 + d); o.connect(g).connect(c.destination); o.start(T0); o.stop(T0 + d + .05);
  }
  function noise(t, d, v, hp) {
    var c = ac(); if (!c) return; var n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
    for (var i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = "highpass"; f.frequency.value = hp; g.gain.value = v; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + t);
  }
  var drum = function () { for (var i = 0; i < 22; i++) tone(120 + i * 9, i * .055, .06, .07, "square"); };
  var boom = function () { tone(90, 0, .9, .3, "sine", 38); noise(0, .5, .25, 1500); };
  var fanfare = function () { [[523, 0], [659, .14], [784, .28], [1047, .44], [784, .62], [1047, .76]].forEach(function (a) { tone(a[0], a[1], .5, .11); tone(a[0] * 2, a[1], .4, .04, "sine"); }); [1319, 1568, 2093].forEach(function (f, i) { tone(f, .95 + i * .07, 1.4, .06, "sine"); }); };
  var chime = function () { [1568, 2093, 2637].forEach(function (f, i) { tone(f, i * .09, .9, .07, "sine"); }); };
  function say(k) {
    try { if (va) va.pause(); va = new Audio("/keepsake/voice/gv_" + k + ".mp3"); va.play().catch(function () { }); } catch (e) { /* ignore */ }
    var s = $("#sub"); s.innerHTML = "<small>ASTRAEA</small>" + T["v_" + k]; s.classList.add("on"); clearTimeout(sbT); sbT = setTimeout(function () { s.classList.remove("on"); }, 4600);
  }
  var cv, g2, P = [], raf = 0;
  function size() { if (!cv) return; cv.width = cv.clientWidth * 2; cv.height = cv.clientHeight * 2; }
  function burst(n) { var W = cv.width, H = cv.height, C = ["#ffd58a", "#fff", "#7fd4ff", "#ff8fa3", "#9af0bd", "#c9a4ff", "#ffb46b"]; for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 8 + Math.random() * 26; P.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, w: 10 + Math.random() * 12, h: 6 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .5, c: C[i % C.length], l: 1 }); } if (!raf) raf = requestAnimationFrame(step); }
  function rain(n) { var W = cv.width, C = ["#ffd58a", "#fff", "#ffe6a8"]; for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: -20 - Math.random() * 400, vx: (Math.random() - .5) * 3, vy: 4 + Math.random() * 5, w: 8 + Math.random() * 8, h: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: C[i % 3], l: 1, rn: 1 }); if (!raf) raf = requestAnimationFrame(step); }
  function step() {
    g2.clearRect(0, 0, cv.width, cv.height); P = P.filter(function (p) { return p.y < cv.height + 40 && p.l > 0; });
    for (var i = 0; i < P.length; i++) { var p = P[i]; p.x += p.vx; p.y += p.vy; if (!p.rn) { p.vx *= .985; p.vy = p.vy * .985 + .55; } p.r += p.vr; if (p.y > cv.height * .8) p.l -= .02; g2.save(); g2.translate(p.x, p.y); g2.rotate(p.r); g2.globalAlpha = Math.max(0, p.l); g2.fillStyle = p.c; g2.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); g2.restore(); }
    raf = P.length ? requestAnimationFrame(step) : 0;
  }
  function sv(k) { return { i: SVI[k], n: SVN(k), d: T["g_" + k] }; }

  function lottery() {
    var st = document.createElement("div"); st.className = "st show"; st.id = "st";
    st.innerHTML = '<div class="rays" id="rays"></div>' +
      '<div class="env" id="env"><p><b>' + T.inv + "</b>" + T.from + '</p><div class="ev" id="ev"><div class="bd"></div><div class="fl"></div><div class="sl">鶴</div><div class="to"><small>TO</small>' + esc(KS.name || "Guest") + "</div></div><p>" + T.tapEnv + "</p>" + (KS.cabin ? '<div class="ltr"><button id="ltr">' + T.later + "</button></div>" : "") + "</div>" +
      '<div class="let" id="let"><small>SPECIAL INVITATION</small><h4>' + nm() + "</h4><p>" + T.letter + '</p><button id="ltB">' + T.draw + "</button></div>" +
      '<div class="sub" id="sub"></div><div class="fin" id="fin"></div>' +
      '<div class="ttl" id="ttl"><small>SPECIAL INVITATION</small><b>' + T.yours.replace("{n}", nm()) + "</b><span>" + T.openCap + "</span></div>" +
      '<div class="cap idle" id="cap"><i class="t"></i><i class="b"></i></div><div class="tap" id="tap">' + T.tapCap + "</div>" +
      '<div class="glow" id="glow"></div><canvas id="cf"></canvas>' +
      '<div class="win" id="win"><small>CONGRATULATIONS</small><b>' + T.won + "</b></div>" +
      '<div class="pers" id="pers"></div><div class="cnt" id="cnt"></div><button class="nx" id="nx"></button>';
    document.body.appendChild(st);
    cv = $("#cf"); g2 = cv.getContext("2d"); size(); addEventListener("resize", size);
    $("#ev").onclick = function () {
      if ($("#ev").classList.contains("op")) return; ac(); $("#ev").classList.add("op"); tone(660, 0, .5, .08, "sine"); tone(990, .12, .7, .06, "sine"); vib(60);
      later(function () { $("#env").classList.add("off"); $("#let").classList.add("on"); say("inv"); }, 800);
    };
    $("#ltB").onclick = function () { $("#let").className = "let off"; tone(784, 0, .4, .07, "sine"); later(function () { say("draw"); }, 500); };
    if (KS.cabin) $("#ltr").onclick = function () { $("#env").classList.add("off"); fin(true); };
    $("#cap").onclick = start; $("#tap").onclick = start;
    $("#nx").onclick = function () {
      $("#nx").classList.remove("on"); $("#cnt").classList.remove("on");
      if (idx < gifts.length - 1) { var c = $("#pers").firstChild; c.className = "card out"; tone(500, 0, .2, .06, "sine", 900); later(function () { show(idx + 1); }, 450); }
      else { say("end"); tone(1047, 0, .6, .08, "sine"); if (KS.cabin) fin(false); else later(function () { st.classList.remove("show"); hub(); }, 600); }
    };
  }
  function start() {
    if (busy) return; busy = true; ac(); size();
    // 引いたことを記録 (通信できなくても演出は続ける。次に開いたときにもう一度引ける)
    fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "draw" }) }).catch(function () { });
    KS.status = "drawn";
    $("#tap").style.display = "none"; $("#ttl").style.opacity = 0; $("#st").classList.add("dim");
    $("#cap").className = "cap shk"; drum(); vib([40, 40, 40, 40, 40, 40, 60, 40, 80, 40, 120]);
    later(function () { $("#cap").className = "cap opn"; $("#glow").classList.add("on"); boom(); vib(350); }, 1300);
    later(function () { $("#st").className = "st show gold"; $("#rays").classList.add("on"); burst(150); fanfare(); $("#cap").style.display = "none"; }, 1750);
    later(function () { $("#win").classList.add("on"); vib([60, 50, 60, 50, 200]); }, 2100); later(function () { say("win"); }, 3400);
    later(function () { show(0); }, 2500); later(function () { rain(70); }, 3200);
  }
  function show(k) {
    idx = k; var s = sv(gifts[k]), pe = $("#pers"); pe.classList.add("on");
    pe.innerHTML = '<div class="card in"><div class="fc"><small>YOU WON</small><i>' + s.i + "</i><b>" + s.n + "</b><span>" + s.d + '</span><em>CRANE NEST · IZUMISANO</em></div><div class="bk">鶴</div></div>';
    var c = pe.firstChild; for (var i = 0; i < 7; i++) (function (i) { later(function () { tone(700 + i * 90, 0, .09, .05, "sine"); }, i * 330); })(i);
    later(function () { chime(); vib([30, 40, 90]); burst(40); }, 3000);
    later(function () { c.classList.remove("in"); c.classList.add("sw"); $("#cnt").textContent = gifts.length > 1 ? (k + 1) + " / " + gifts.length : ""; $("#cnt").classList.add("on"); $("#nx").textContent = k < gifts.length - 1 ? T.next : T.receive; $("#nx").classList.add("on"); }, 3250);
  }
  /* 車内 iPad の最後の画面: カードの手渡し + スマホで読む QR */
  function fin(skip) {
    var hand = gifts.indexOf("card") >= 0 && !KS.cardGiven, dig = gifts.filter(function (k) { return k !== "card"; });
    var qr = KS.qr ? '<img src="' + KS.qr + '" alt="QR">' : "";
    $("#fin").innerHTML = "<h4>" + (skip ? T.forYou : T.congr).replace("{n}", nm()) + '</h4><div class="bx">' +
      (!skip && hand ? '<div class="b1"><i>🃏</i><b>' + T.cardName + "</b>" + T.cardHand + "</div>" : "") +
      (skip || dig.length ? '<div class="b1">' + qr + "<b>" + (skip ? T.drawHere : dig.map(SVN).join(" ・ ")) + "</b>" + (skip ? T.qrLater : T.qrApply) + "<br><small>" + T.valid + "</small></div>" : "") +
      "</div><small>" + T.thanks + "</small>";
    $("#fin").classList.add("on");
  }

  /* ================= 記念のページ (申し込み・完成品) ================= */
  var pg = null, cur = 0;
  var ord = function (k) { return orders.filter(function (o) { return o.kind === k; })[0] || null; };
  function go(id) { pg.querySelectorAll(".v").forEach(function (v) { v.classList.toggle("on", v.id === id); }); scrollTo(0, 0); }
  function tile(k, sub, cls) {
    var o = ord(k), tag = !o ? '<u>' + T.apply + "</u>" : o.status === "done" ? '<u class="d">' + T.ready + "</u>" : '<u class="w">' + T.making + "</u>";
    return '<button class="tile ' + (o && o.status === "done" ? "rdy" : cls || "") + '" data-open="' + k + '"><i>' + SVI[k] + "</i><span><b>" + SVN(k) + "</b><small>" + sub + "</small></span>" + tag + "</button>";
  }
  function hub() {
    if (!pg) { pg = document.createElement("div"); pg.className = "pg show"; app.appendChild(pg); }
    var d = KS.expires ? new Date(KS.expires).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
    var st = KS.settings || {}, h = "";
    h += '<div class="lg">' + LANGS.map(function (l) { return '<button data-l="' + l + '" class="' + (l === lang ? "on" : "") + '">' + LN[l] + "</button>"; }).join("") + "</div>";
    h += '<div class="v on" id="vHome"><div class="br">CRANE NEST</div><h2>' + T.hub1 + " <em>" + T.hub2 + '</em></h2><p class="ld">' + nm() + "<br>" + T.hubLd + "</p>";
    if (gifts.indexOf("art") >= 0) h += tile("art", T.g_art, "g");
    if (gifts.indexOf("rec") >= 0) h += tile("rec", T.g_rec, "g");
    if (gifts.indexOf("card") >= 0) h += '<button class="tile" disabled><i>🃏</i><span><b>' + T.cardName + "</b><small>" + T.g_card + "</small></span><u class=\"" + (KS.cardGiven ? "d" : "w") + '">' + (KS.cardGiven ? T.cardDone : T.cardWait) + "</u></button>";
    if (st.cheersOn || ord("cheers")) h += "<h3>" + T.paid.toUpperCase() + "</h3>" + tile("cheers", T.cheersS + (st.cheersPrice ? " · " + esc(st.cheersPrice) : ""), "");
    h += '<div class="ft">' + T.keep.replace("{d}", d) + '<button id="cp">' + T.copy + "</button></div></div>";
    h += '<div class="v" id="vArt"></div><div class="v" id="vRec"></div><div class="v" id="vChe"></div><div class="v" id="vRes"></div>';
    pg.innerHTML = h;
    pg.querySelectorAll("[data-l]").forEach(function (b) { b.onclick = function () { try { localStorage.setItem("ks.lang", b.dataset.l); } catch (e) { /* ignore */ } lang = b.dataset.l; T = TX[lang]; hub(); }; });
    pg.querySelectorAll("[data-open]").forEach(function (b) { b.onclick = function () { open(b.dataset.open); }; });
    $("#cp").onclick = function () { var u = location.origin + location.pathname; var done = function () { $("#cp").textContent = T.copied; }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt("", u); }); else prompt("", u); };
  }
  function open(k) {
    var o = ord(k);
    if (o) return result(o);
    if (k === "art") formArt(); else if (k === "rec") formRec(); else formChe();
  }
  var backBtn = function () { return '<button class="bkb" data-back>' + T.back + "</button>"; };
  function wireBack(v) { v.querySelector("[data-back]").onclick = function () { hub(); }; }

  /* 完成品 / 作成中 */
  function result(o) {
    var v = $("#vRes"), h = backBtn() + '<div class="br">' + (o.kind === "art" ? "CRANE JOURNEY" : o.kind === "rec" ? "CRANE NEST" : "CHEERS") + "</div><h2><em>" + (o.kind === "art" ? "ART" : o.kind === "rec" ? "Records" : "Around the World") + "</em></h2>";
    if (o.status !== "done") h += '<div class="ok">' + (o.kind === "art" ? T.okArt : o.kind === "rec" ? T.okRec : T.okChe) + "</div>";
    else {
      h += '<p class="ld">' + T.resT + "</p>";
      (o.results || []).forEach(function (f) {
        if (!f.url) return;
        var m = /^image\//.test(f.type) ? '<img src="' + f.url + '" alt="">' : /^audio\//.test(f.type) ? '<audio controls preload="metadata" src="' + f.url + '"></audio>' : /^video\//.test(f.type) ? '<video controls playsinline preload="metadata" src="' + f.url + '"></video>' : "";
        h += '<div class="rs">' + m + '<a href="' + f.url + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + T.save + "</a></div>";
      });
      if (o.link) h += '<div class="rs"><a href="' + esc(o.link) + '" target="_blank" rel="noopener">' + T.openLink + " ↗</a></div>";
    }
    v.innerHTML = h; wireBack(v); go("vRes");
  }

  /* 写真: 長辺 2000px の JPEG に縮めて送る (通信量と上限のため) */
  function shrink(file, cb) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function (b) { cb(b && b.size < 3800000 ? b : null); }, "image/jpeg", .88);
    };
    im.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    im.src = url;
  }
  function photoBox(id, tap, tip) { return '<label class="up" id="' + id + '"><span>' + tap + "<br><small>" + tip + '</small></span><input type="file" accept="image/*"></label>'; }
  function wirePhoto(id, onPick) {
    var box = $("#" + id), inp = box.querySelector("input");
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      shrink(f, function (b) {
        if (!b) { box.querySelector("span").innerHTML = '<span style="color:#ffb3b3">' + T.errBig + "</span>"; onPick(null); return; }
        box.querySelector("span").innerHTML = '<img src="' + URL.createObjectURL(b) + '" alt="">' + T.picked; onPick(b);
      });
    };
  }
  function send(kind, payload, photo, btn, errEl, okHtml) {
    btn.disabled = true; var old = btn.textContent; btn.textContent = T.sending; errEl.innerHTML = "";
    var fd = new FormData(); fd.append("op", "order"); fd.append("kind", kind); fd.append("payload", JSON.stringify(payload)); if (photo) fd.append("photo", photo, "photo.jpg");
    fetch(api, { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) throw new Error(j && j.error || "ERR");
      orders = j.orders || orders.concat([{ kind: kind, status: "new", payload: payload, results: [] }]);
      result(ord(kind));
    }).catch(function () { btn.disabled = false; btn.textContent = old; errEl.innerHTML = '<div class="er">' + T.errSend + "</div>"; });
  }
  var val = function (id) { return ($("#" + id).value || "").trim(); };
  function pickOne(id) { var box = $("#" + id); box.querySelectorAll("button").forEach(function (b) { b.onclick = function () { box.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); }; }); return function () { return box.querySelector(".on").dataset.v; }; }
  var whichBox = function (id) { return "<h3>" + T.which + '</h3><div class="ch" id="' + id + '"><button data-v="start"><b>🛬</b>' + T.start + '</button><button data-v="end" class="on"><b>🛫</b>' + T.end + "</button></div>"; };
  var contactBox = function (id) { return '<label class="f">' + T.contact + '</label><input class="t" id="' + id + '" maxlength="120" placeholder="' + T.contactPh + '">'; };

  function formArt() {
    var v = $("#vArt"), EX = KS.examples || [];
    v.innerHTML = backBtn() + '<div class="br">CRANE JOURNEY</div><h2><em>ART</em></h2><p class="ld">' + T.artLd + "</p>" +
      (EX.length ? '<div class="ba" id="ba"><img id="exB" alt=""><img id="exA" class="af" alt=""><span class="tg l">PHOTO</span><span class="tg r">ART</span><div class="hd"></div></div><div class="dots" id="dots"></div><div class="capx" id="capx"></div>' : "") +
      whichBox("aK") + "<h3>" + T.pick + "</h3>" + photoBox("aUp", T.pickTap, T.pickTip) +
      '<label class="f">' + T.words + '</label><input class="t" id="aM" maxlength="80" placeholder="' + T.wordsPh + '">' + contactBox("aC") +
      '<button class="go" id="aGo" disabled>' + T.submit + '</button><div id="aEr"></div><p class="nt">' + T.nArt + "</p>";
    wireBack(v);
    if (EX.length) {
      var draw = function () {
        cur = Math.min(cur, EX.length - 1); var e = EX[cur]; $("#exB").src = e.before; $("#exA").src = e.after; $("#capx").textContent = e.caption || "";
        $("#dots").innerHTML = EX.length > 1 ? EX.map(function (x, k) { return '<button class="' + (k === cur ? "on" : "") + '" data-k="' + k + '"><img src="' + x.after + '" alt=""></button>'; }).join("") : "";
        $("#dots").querySelectorAll("button").forEach(function (b) { b.onclick = function () { cur = +b.dataset.k; draw(); }; });
      };
      draw();
      var ba = $("#ba"), dn = false, mv = function (e) { var r = ba.getBoundingClientRect(); ba.style.setProperty("--x", Math.max(4, Math.min(96, (e.clientX - r.left) / r.width * 100)) + "%"); };
      ba.onpointerdown = function (e) { dn = true; try { ba.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } mv(e); }; ba.onpointermove = function (e) { if (dn) mv(e); }; ba.onpointerup = ba.onpointercancel = function () { dn = false; };
    }
    var kind = pickOne("aK"), photo = null;
    wirePhoto("aUp", function (b) { photo = b; $("#aGo").disabled = !b; });
    $("#aGo").onclick = function () { send("art", { when: kind(), words: val("aM"), contact: val("aC"), lang: lang }, photo, $("#aGo"), $("#aEr")); };
    go("vArt");
  }
  function formRec() {
    var v = $("#vRec"), ST = ["Pop", "Rock", "Ballad", "City pop", "Jazz", "R&B", "EDM", "Acoustic", "Hip-hop", "Japanese style"];
    v.innerHTML = backBtn() + '<div class="br">CRANE NEST</div><h2><em>Records</em></h2><p class="ld">' + T.recLd + "</p>" + whichBox("rK") +
      "<h3>" + T.style + '</h3><div class="chips" id="rS">' + ST.map(function (s) { return "<button>" + s + "</button>"; }).join("") + "</div>" +
      '<label class="f">' + T.style2 + '</label><input class="t" id="rS2" maxlength="80" placeholder="' + T.style2Ph + '">' +
      '<label class="f">' + T.names + '</label><input class="t" id="rN" maxlength="80" placeholder="' + T.namesPh + '">' +
      '<label class="f">' + T.mem + '</label><textarea class="t" id="rM" maxlength="600" placeholder="' + T.memPh + '"></textarea>' +
      '<label class="f">' + T.lyr + '</label><select class="t" id="rL">' + ["English", "中文", "한국어", "日本語"].map(function (s, i) { return "<option" + (LANGS[i] === lang ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>" + contactBox("rC") +
      '<button class="go" id="rGo" disabled>' + T.submit + '</button><div id="rEr"></div><p class="nt">' + T.nRec + "</p>";
    wireBack(v);
    var kind = pickOne("rK"), chk = function () { $("#rGo").disabled = !($("#rS").querySelector(".on") || val("rS2")) || !val("rN"); };
    $("#rS").querySelectorAll("button").forEach(function (b) { b.onclick = function () { b.classList.toggle("on"); chk(); }; });
    $("#rS2").oninput = chk; $("#rN").oninput = chk;
    $("#rGo").onclick = function () {
      var st = [].map.call($("#rS").querySelectorAll(".on"), function (b) { return b.textContent; });
      send("rec", { when: kind(), styles: st, style2: val("rS2"), names: val("rN"), memories: val("rM"), lyrics: $("#rL").value, contact: val("rC"), lang: lang }, null, $("#rGo"), $("#rEr"));
    };
    go("vRec");
  }
  function formChe() {
    var v = $("#vChe"), st = KS.settings || {};
    v.innerHTML = backBtn() + '<div class="br">CHEERS</div><h2>Around the <em>World</em></h2><p class="ld">' + T.cheLd + "</p>" +
      (st.cheersNote ? '<div class="sup">🤝 ' + esc(st.cheersNote) + "</div>" : "") + (st.cheersPrice ? '<p class="pr">' + T.price + "： " + esc(st.cheersPrice) + "</p>" : "") +
      "<h3>" + T.occ + '</h3><div class="chips" id="cO">' + T.occs.map(function (s, i) { return '<button data-v="' + i + '" class="' + (i ? "" : "on") + '">' + s + "</button>"; }).join("") + "</div>" +
      '<label class="f">' + T.who + '</label><input class="t" id="cN" maxlength="60" placeholder="' + T.whoPh + '">' +
      '<label class="f">' + T.msg + '</label><input class="t" id="cM" maxlength="120" placeholder="' + T.msgPh + '">' +
      "<h3>" + T.photoOpt + "</h3>" + photoBox("cUp", T.pickTap, T.photoOptTip) + contactBox("cC") +
      '<button class="go" id="cGo" disabled>' + T.submit + '</button><div id="cEr"></div><p class="nt">' + T.nChe + "</p>";
    wireBack(v);
    var occ = pickOne("cO"), photo = null, chk = function () { $("#cGo").disabled = !val("cN") || !val("cM"); };
    wirePhoto("cUp", function (b) { photo = b; }); $("#cN").oninput = chk; $("#cM").oninput = chk;
    $("#cGo").onclick = function () { send("cheers", { occasion: TX.en.occs[+occ()], name: val("cN"), message: val("cM"), contact: val("cC"), lang: lang }, photo, $("#cGo"), $("#cEr")); };
    go("vChe");
  }

  /* ================= はじまり ================= */
  if (KS.cabin) { lottery(); if (KS.status === "drawn") { $("#env").classList.add("off"); fin(false); } }
  else if (KS.status === "drawn") hub();
  else lottery();
})();
