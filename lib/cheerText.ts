/**
 * 「みんなの声」: チェックアウトの最後に、ゲストが言葉のかけらを選んで送るひとこと。
 *   ありがとう (A) × よかったこと (B) × これから (C)。どれも前向きな言葉だけ (お母さんの画面に流す)。
 *   ゲストが選んだ国の言葉で届け、お母さんの画面では中文訳を下に付ける。
 *   依存なしの純粋なファイル (サーバー・ブラウザ共通)。言葉を足すときは末尾に足す (番号で保存しているため並び替えない)
 */
export const CHEER_LANGS = ["en", "ja", "zh", "zt", "ko", "es", "fr", "de", "it", "pt", "th", "vi", "id", "ru", "ar", "tr"] as const;
export type CheerLang = (typeof CHEER_LANGS)[number];
type Phrase = Record<CheerLang, string>;

export const CHEER_A: Phrase[] = [
  {"en": "Thank you for everything.", "ja": "いろいろとありがとうございました。", "zh": "谢谢你做的一切。", "zt": "謝謝你做的一切。", "ko": "모든 것에 감사드려요.", "es": "Gracias por todo.", "fr": "Merci pour tout.", "de": "Danke für alles.", "it": "Grazie di tutto.", "pt": "Obrigado por tudo.", "th": "ขอบคุณสำหรับทุกอย่าง", "vi": "Cảm ơn vì tất cả.", "id": "Terima kasih untuk semuanya.", "ru": "Спасибо за всё.", "ar": "شكرًا على كل شيء.", "tr": "Her şey için teşekkürler."},
  {"en": "Thank you for the warm welcome.", "ja": "あたたかいおもてなしをありがとうございました。", "zh": "谢谢你热情的款待。", "zt": "謝謝你熱情的款待。", "ko": "따뜻하게 맞아 주셔서 감사해요.", "es": "Gracias por la cálida bienvenida.", "fr": "Merci pour l'accueil chaleureux.", "de": "Danke für den herzlichen Empfang.", "it": "Grazie per la calorosa accoglienza.", "pt": "Obrigado pela recepção calorosa.", "th": "ขอบคุณที่ต้อนรับอย่างอบอุ่น", "vi": "Cảm ơn vì sự đón tiếp nồng hậu.", "id": "Terima kasih atas sambutan hangatnya.", "ru": "Спасибо за тёплый приём.", "ar": "شكرًا على الاستقبال الحار.", "tr": "Sıcak karşılamanız için teşekkürler."},
  {"en": "Thank you for taking such good care of us.", "ja": "本当によくしていただき、ありがとうございました。", "zh": "谢谢你这么用心地照顾我们。", "zt": "謝謝你這麼用心地照顧我們。", "ko": "정성껏 챙겨 주셔서 감사해요.", "es": "Gracias por cuidarnos tan bien.", "fr": "Merci d'avoir si bien pris soin de nous.", "de": "Danke, dass Sie sich so gut um uns gekümmert haben.", "it": "Grazie per esservi presi così cura di noi.", "pt": "Obrigado por cuidarem tão bem de nós.", "th": "ขอบคุณที่ดูแลพวกเราเป็นอย่างดี", "vi": "Cảm ơn vì đã chăm sóc chúng tôi chu đáo.", "id": "Terima kasih sudah merawat kami dengan baik.", "ru": "Спасибо, что так хорошо о нас позаботились.", "ar": "شكرًا لاهتمامكم الرائع بنا.", "tr": "Bizimle bu kadar iyi ilgilendiğiniz için teşekkürler."},
  {"en": "Thank you to whoever cleaned our room.", "ja": "お部屋を掃除してくださった方、ありがとうございます。", "zh": "谢谢打扫房间的那位。", "zt": "謝謝打掃房間的那位。", "ko": "방을 청소해 주신 분께 감사드려요.", "es": "Gracias a quien limpió nuestra habitación.", "fr": "Merci à la personne qui a nettoyé notre chambre.", "de": "Danke an die Person, die unser Zimmer gereinigt hat.", "it": "Grazie a chi ha pulito la nostra camera.", "pt": "Obrigado a quem limpou o nosso quarto.", "th": "ขอบคุณคนที่ทำความสะอาดห้องให้พวกเรา", "vi": "Cảm ơn người đã dọn phòng cho chúng tôi.", "id": "Terima kasih untuk yang membersihkan kamar kami.", "ru": "Спасибо тому, кто убирал наш номер.", "ar": "شكرًا لمن نظّف غرفتنا.", "tr": "Odamızı temizleyen kişiye teşekkürler."},
  {"en": "Thank you so much!", "ja": "本当にありがとうございました！", "zh": "太谢谢了！", "zt": "太謝謝了！", "ko": "정말 감사합니다!", "es": "¡Muchísimas gracias!", "fr": "Merci beaucoup !", "de": "Vielen herzlichen Dank!", "it": "Grazie mille!", "pt": "Muito obrigado!", "th": "ขอบคุณมากๆ เลย!", "vi": "Cảm ơn rất nhiều!", "id": "Terima kasih banyak!", "ru": "Огромное спасибо!", "ar": "شكرًا جزيلًا!", "tr": "Çok teşekkürler!"},
  {"en": "We had a wonderful stay.", "ja": "とても素敵な滞在でした。", "zh": "我们度过了很美好的时光。", "zt": "我們度過了很美好的時光。", "ko": "정말 멋진 숙박이었어요.", "es": "Tuvimos una estancia maravillosa.", "fr": "Nous avons passé un séjour merveilleux.", "de": "Wir hatten einen wunderbaren Aufenthalt.", "it": "Abbiamo trascorso un soggiorno meraviglioso.", "pt": "Tivemos uma estadia maravilhosa.", "th": "พวกเราพักที่นี่อย่างมีความสุขมาก", "vi": "Chúng tôi đã có kỳ nghỉ tuyệt vời.", "id": "Kami menginap dengan sangat menyenangkan.", "ru": "Мы прекрасно провели время.", "ar": "كانت إقامتنا رائعة.", "tr": "Harika bir konaklama geçirdik."},
];
export const CHEER_B: Phrase[] = [
  {"en": "The room was spotless.", "ja": "お部屋がとてもきれいでした。", "zh": "房间一尘不染。", "zt": "房間一塵不染。", "ko": "방이 정말 깨끗했어요.", "es": "La habitación estaba impecable.", "fr": "La chambre était impeccable.", "de": "Das Zimmer war blitzsauber.", "it": "La camera era pulitissima.", "pt": "O quarto estava impecável.", "th": "ห้องสะอาดมาก", "vi": "Phòng rất sạch sẽ.", "id": "Kamarnya bersih sekali.", "ru": "Номер был безупречно чистым.", "ar": "كانت الغرفة نظيفة تمامًا.", "tr": "Oda tertemizdi."},
  {"en": "It felt just like home.", "ja": "まるで我が家のようでした。", "zh": "就像回到了家一样。", "zt": "就像回到了家一樣。", "ko": "집에 온 것 같았어요.", "es": "Nos sentimos como en casa.", "fr": "On s'y sentait comme à la maison.", "de": "Es fühlte sich an wie zu Hause.", "it": "Ci siamo sentiti come a casa.", "pt": "Sentimo-nos em casa.", "th": "รู้สึกเหมือนอยู่บ้านเลย", "vi": "Cảm giác như ở nhà vậy.", "id": "Rasanya seperti di rumah sendiri.", "ru": "Мы чувствовали себя как дома.", "ar": "شعرنا وكأننا في بيتنا.", "tr": "Kendimizi evimizde gibi hissettik."},
  {"en": "You can feel the care in every detail.", "ja": "細かいところまで心づかいを感じました。", "zh": "每个细节都感受得到用心。", "zt": "每個細節都感受得到用心。", "ko": "작은 부분까지 정성이 느껴졌어요.", "es": "Se nota el cariño en cada detalle.", "fr": "On sent l'attention dans chaque détail.", "de": "Man spürt die Sorgfalt in jedem Detail.", "it": "Si sente la cura in ogni dettaglio.", "pt": "Dá para sentir o carinho em cada detalhe.", "th": "สัมผัสได้ถึงความใส่ใจในทุกรายละเอียด", "vi": "Có thể cảm nhận sự chu đáo trong từng chi tiết.", "id": "Perhatiannya terasa di setiap detail.", "ru": "Забота чувствуется в каждой детали.", "ar": "يمكن الشعور بالاهتمام في كل التفاصيل.", "tr": "Her ayrıntıda özen hissediliyor."},
  {"en": "We slept so well.", "ja": "ぐっすり眠れました。", "zh": "我们睡得特别好。", "zt": "我們睡得特別好。", "ko": "정말 푹 잤어요.", "es": "Dormimos muy bien.", "fr": "Nous avons très bien dormi.", "de": "Wir haben wunderbar geschlafen.", "it": "Abbiamo dormito benissimo.", "pt": "Dormimos muito bem.", "th": "นอนหลับสบายมาก", "vi": "Chúng tôi ngủ rất ngon.", "id": "Kami tidur nyenyak sekali.", "ru": "Мы отлично выспались.", "ar": "نمنا نومًا هانئًا.", "tr": "Çok güzel uyuduk."},
  {"en": "The room was so cozy and warm.", "ja": "お部屋があたたかくて居心地がよかったです。", "zh": "房间又温馨又舒服。", "zt": "房間又溫馨又舒服。", "ko": "방이 아늑하고 따뜻했어요.", "es": "La habitación era muy acogedora.", "fr": "La chambre était chaleureuse et confortable.", "de": "Das Zimmer war gemütlich und warm.", "it": "La camera era accogliente e calda.", "pt": "O quarto era aconchegante.", "th": "ห้องอบอุ่นและน่าอยู่มาก", "vi": "Phòng ấm cúng và dễ chịu.", "id": "Kamarnya hangat dan nyaman.", "ru": "В номере было уютно и тепло.", "ar": "كانت الغرفة دافئة ومريحة.", "tr": "Oda çok sıcak ve rahattı."},
  {"en": "Everything was perfectly prepared.", "ja": "すべてが完璧に準備されていました。", "zh": "一切都准备得很完美。", "zt": "一切都準備得很完美。", "ko": "모든 것이 완벽하게 준비되어 있었어요.", "es": "Todo estaba perfectamente preparado.", "fr": "Tout était parfaitement préparé.", "de": "Alles war perfekt vorbereitet.", "it": "Tutto era preparato alla perfezione.", "pt": "Tudo estava perfeitamente preparado.", "th": "ทุกอย่างเตรียมไว้อย่างสมบูรณ์แบบ", "vi": "Mọi thứ đều được chuẩn bị hoàn hảo.", "id": "Semuanya disiapkan dengan sempurna.", "ru": "Всё было идеально подготовлено.", "ar": "كان كل شيء مُعدًّا بشكل مثالي.", "tr": "Her şey kusursuz hazırlanmıştı."},
  {"en": "It was the best part of our trip.", "ja": "旅でいちばんの思い出になりました。", "zh": "这是我们旅行中最美好的回忆。", "zt": "這是我們旅行中最美好的回憶。", "ko": "여행에서 가장 좋은 추억이 됐어요.", "es": "Fue lo mejor de nuestro viaje.", "fr": "C'était le meilleur moment de notre voyage.", "de": "Es war das Highlight unserer Reise.", "it": "È stata la parte più bella del nostro viaggio.", "pt": "Foi a melhor parte da nossa viagem.", "th": "เป็นความทรงจำที่ดีที่สุดของทริปนี้", "vi": "Đây là kỷ niệm đẹp nhất của chuyến đi.", "id": "Ini bagian terbaik dari perjalanan kami.", "ru": "Это было лучшее в нашей поездке.", "ar": "كانت أجمل ما في رحلتنا.", "tr": "Gezimizin en güzel kısmıydı."},
  {"en": "The bathroom was sparkling clean.", "ja": "お風呂や洗面台がぴかぴかでした。", "zh": "浴室和洗手台都闪闪发亮。", "zt": "浴室和洗手台都閃閃發亮。", "ko": "욕실이 반짝반짝 깨끗했어요.", "es": "El baño estaba reluciente.", "fr": "La salle de bain était étincelante.", "de": "Das Bad war strahlend sauber.", "it": "Il bagno era splendente.", "pt": "O banheiro estava brilhando.", "th": "ห้องน้ำสะอาดเอี่ยม", "vi": "Phòng tắm sạch bóng.", "id": "Kamar mandinya bersih berkilau.", "ru": "Ванная сияла чистотой.", "ar": "كان الحمام نظيفًا ولامعًا.", "tr": "Banyo pırıl pırıldı."},
];
export const CHEER_C: Phrase[] = [
  {"en": "We will definitely come back.", "ja": "またぜひ泊まりに来ます。", "zh": "我们一定会再来的。", "zt": "我們一定會再來的。", "ko": "꼭 다시 올게요.", "es": "Volveremos sin duda.", "fr": "Nous reviendrons, c'est sûr.", "de": "Wir kommen ganz bestimmt wieder.", "it": "Torneremo sicuramente.", "pt": "Com certeza voltaremos.", "th": "จะกลับมาพักอีกแน่นอน", "vi": "Chắc chắn chúng tôi sẽ quay lại.", "id": "Kami pasti akan kembali.", "ru": "Мы обязательно вернёмся.", "ar": "سنعود بالتأكيد.", "tr": "Kesinlikle tekrar geleceğiz."},
  {"en": "Keep up the great work!", "ja": "これからもがんばってください！", "zh": "工作加油！", "zt": "工作加油！", "ko": "앞으로도 힘내세요!", "es": "¡Sigan así!", "fr": "Continuez comme ça !", "de": "Machen Sie weiter so!", "it": "Continuate così!", "pt": "Continuem assim!", "th": "สู้ๆ นะ!", "vi": "Hãy tiếp tục cố gắng nhé!", "id": "Semangat terus!", "ru": "Так держать!", "ar": "استمروا في هذا العمل الرائع!", "tr": "Böyle devam edin!"},
  {"en": "Wishing you happy days.", "ja": "毎日が楽しい日でありますように。", "zh": "祝你每天都开开心心。", "zt": "祝你每天都開開心心。", "ko": "매일 행복하시길 바라요.", "es": "Les deseo días muy felices.", "fr": "Je vous souhaite de beaux jours.", "de": "Ich wünsche Ihnen viele schöne Tage.", "it": "Vi auguro giornate felici.", "pt": "Desejo-lhes dias felizes.", "th": "ขอให้มีความสุขทุกวันนะ", "vi": "Chúc bạn mỗi ngày đều vui vẻ.", "id": "Semoga harimu selalu bahagia.", "ru": "Желаю вам счастливых дней.", "ar": "أتمنى لكم أيامًا سعيدة.", "tr": "Size mutlu günler dilerim."},
  {"en": "See you again!", "ja": "また会いましょう！", "zh": "下次见！", "zt": "下次見！", "ko": "또 만나요!", "es": "¡Hasta la próxima!", "fr": "À bientôt !", "de": "Bis zum nächsten Mal!", "it": "Alla prossima!", "pt": "Até a próxima!", "th": "แล้วพบกันใหม่นะ!", "vi": "Hẹn gặp lại!", "id": "Sampai jumpa lagi!", "ru": "До новой встречи!", "ar": "إلى اللقاء!", "tr": "Tekrar görüşmek üzere!"},
  {"en": "Please take care of yourself.", "ja": "どうぞお体を大切に。", "zh": "请保重身体。", "zt": "請保重身體。", "ko": "건강 잘 챙기세요.", "es": "Cuídense mucho.", "fr": "Prenez bien soin de vous.", "de": "Passen Sie gut auf sich auf.", "it": "Abbiate cura di voi.", "pt": "Cuidem-se bem.", "th": "ดูแลสุขภาพด้วยนะ", "vi": "Giữ gìn sức khỏe nhé.", "id": "Jaga kesehatan, ya.", "ru": "Берегите себя.", "ar": "اعتنوا بأنفسكم.", "tr": "Kendinize iyi bakın."},
  {"en": "We are cheering for you!", "ja": "いつも応援しています！", "zh": "我们一直为你加油！", "zt": "我們一直為你加油！", "ko": "항상 응원할게요!", "es": "¡Les mandamos mucho ánimo!", "fr": "On vous encourage !", "de": "Wir drücken Ihnen die Daumen!", "it": "Facciamo il tifo per voi!", "pt": "Estamos torcendo por vocês!", "th": "เป็นกำลังใจให้เสมอ!", "vi": "Chúng tôi luôn ủng hộ bạn!", "id": "Kami selalu mendukungmu!", "ru": "Мы болеем за вас!", "ar": "نحن نشجعكم دائمًا!", "tr": "Hep sizin yanınızdayız!"},
];

/** [国コード, 地域 (1 アジア 2 ヨーロッパ 3 アメリカ大陸 4 オセアニア 5 中東・アフリカ), 届ける言葉] */
export const CHEER_COUNTRIES: [string, number, CheerLang][] = [
  ["JP", 1, "ja"], ["CN", 1, "zh"], ["TW", 1, "zt"], ["HK", 1, "zt"], ["MO", 1, "zt"], ["KR", 1, "ko"], ["TH", 1, "th"], ["VN", 1, "vi"], ["ID", 1, "id"], ["PH", 1, "en"],
  ["MY", 1, "en"], ["SG", 1, "en"], ["IN", 1, "en"], ["KH", 1, "en"], ["MN", 1, "en"], ["NP", 1, "en"], ["LK", 1, "en"], ["BD", 1, "en"], ["PK", 1, "en"], ["KZ", 1, "ru"],
  ["GB", 2, "en"], ["IE", 2, "en"], ["FR", 2, "fr"], ["BE", 2, "fr"], ["DE", 2, "de"], ["AT", 2, "de"], ["CH", 2, "de"], ["IT", 2, "it"], ["ES", 2, "es"], ["PT", 2, "pt"],
  ["NL", 2, "en"], ["SE", 2, "en"], ["NO", 2, "en"], ["DK", 2, "en"], ["FI", 2, "en"], ["PL", 2, "en"], ["CZ", 2, "en"], ["HU", 2, "en"], ["GR", 2, "en"], ["RO", 2, "en"],
  ["UA", 2, "ru"], ["RU", 2, "ru"],
  ["US", 3, "en"], ["CA", 3, "en"], ["MX", 3, "es"], ["BR", 3, "pt"], ["AR", 3, "es"], ["CL", 3, "es"], ["CO", 3, "es"], ["PE", 3, "es"],
  ["AU", 4, "en"], ["NZ", 4, "en"],
  ["TR", 5, "tr"], ["AE", 5, "ar"], ["SA", 5, "ar"], ["EG", 5, "ar"], ["IL", 5, "en"], ["QA", 5, "ar"], ["MA", 5, "ar"], ["ZA", 5, "en"], ["KE", 5, "en"], ["NG", 5, "en"],
];
export const CHEER_POPULAR = ["US", "CN", "TW", "HK", "KR", "AU", "GB", "FR", "DE", "SG", "TH", "PH", "CA", "IT", "ES"];

/** 国 → 届ける言葉 (知らない国は、ゲストが画面で使った言葉) */
export function cheerLangFor(country: string | null | undefined, uiLang: string): CheerLang {
  const c = CHEER_COUNTRIES.find((x) => x[0] === String(country ?? "").toUpperCase());
  if (c) return c[2];
  const u = String(uiLang || "").toLowerCase();
  return u.startsWith("zh") ? "zh" : (CHEER_LANGS as readonly string[]).includes(u) ? (u as CheerLang) : "en";
}

const noSpace = (l: CheerLang) => l === "ja" || l === "zh" || l === "zt" || l === "th";
/** 選んだ番号から、その言葉の文にする (選ばなかった欄は飛ばす) */
export function cheerText(p: { a: number | null; b: number | null; c: number | null }, lang: CheerLang): string {
  const parts = [p.a == null ? null : CHEER_A[p.a], p.b == null ? null : CHEER_B[p.b], p.c == null ? null : CHEER_C[p.c]]
    .filter(Boolean).map((x) => (x as Phrase)[lang]);
  return parts.join(noSpace(lang) ? (lang === "th" ? " " : "") : " ");
}

/** 受け取った番号を確かめる (範囲外は「選ばなかった」) */
export const cheerIdx = (v: unknown, n: number): number | null => {
  const i = Number(v);
  return v === null || v === undefined || v === "" || !Number.isInteger(i) || i < 0 || i >= n ? null : i;
};
export const isCheerCountry = (c: unknown) => CHEER_COUNTRIES.some((x) => x[0] === String(c ?? "").toUpperCase());

/** チェックアウト画面「最後にひとこと」の文字 (ゲストの画面の言葉) */
export const CHEER_UI = {
  ja: { t1: "最後にひとこと（任意）", t2: "えらぶだけで、Crane Nest のスタッフに届きます。", tC: "どちらから来ましたか？", tA: "ありがとう", tB: "よかったこと", tCc: "これから", tP: "スタッフに届くメッセージ", empty: "上から選ぶと、ここにメッセージができます", shuf: "🎲 おまかせで選ぶ", tF: "自由に書く", tFn: "自由に書いた内容は、スタッフが確認してから届けます。", send: "送ってチェックアウトへ", skip: "書かずに進む", isYou: "{C} からですか？", tapYes: "はい", chg: "変更", otherC: "ほかの国をえらぶ", search: "国名で検索（日本語・英語どちらでも）", none: "見つかりません", R: ["よく来る国", "アジア", "ヨーロッパ", "アメリカ大陸", "オセアニア", "中東・アフリカ"] },
  en: { t1: "A few words before you go (optional)", t2: "Just tap — your message goes to the Crane Nest staff.", tC: "Where are you from?", tA: "Thank you", tB: "What we loved", tCc: "Wishes", tP: "Your message to the staff", empty: "Tap above to build your message", shuf: "🎲 Pick for me", tF: "Write your own", tFn: "Free messages are delivered after our staff reads them.", send: "Send and check out", skip: "Skip", isYou: "Are you from {C}?", tapYes: "Yes", chg: "Change", otherC: "Choose another country", search: "Search country (any language)", none: "No match", R: ["Popular", "Asia", "Europe", "Americas", "Oceania", "Middle East & Africa"] },
  zh: { t1: "最后留一句话（可选）", t2: "点一点就能送给 Crane Nest 的工作人员。", tC: "您来自哪里？", tA: "感谢", tB: "喜欢的地方", tCc: "祝福", tP: "送给工作人员的话", empty: "在上面选择，这里就会出现留言", shuf: "🎲 随机帮我选", tF: "自己写", tFn: "自己写的内容，工作人员确认后才会送达。", send: "送出并退房", skip: "不写，继续", isYou: "您来自{C}吗？", tapYes: "是的", chg: "更改", otherC: "选择其他国家或地区", search: "搜索国家（中文或英文都可以）", none: "没有找到", R: ["常见", "亚洲", "欧洲", "美洲", "大洋洲", "中东和非洲"] },
  ko: { t1: "마지막으로 한마디 (선택)", t2: "누르기만 하면 Crane Nest 스태프에게 전해져요.", tC: "어디에서 오셨나요?", tA: "감사", tB: "좋았던 점", tCc: "응원", tP: "스태프에게 전해질 메시지", empty: "위에서 고르면 여기에 메시지가 만들어져요", shuf: "🎲 알아서 골라 주기", tF: "직접 쓰기", tFn: "직접 쓴 내용은 스태프가 확인한 뒤 전해집니다.", send: "보내고 체크아웃", skip: "쓰지 않고 진행", isYou: "{C}에서 오셨나요?", tapYes: "네", chg: "변경", otherC: "다른 나라 선택", search: "나라 이름으로 검색 (어느 언어든 OK)", none: "찾을 수 없어요", R: ["자주 오는 나라", "아시아", "유럽", "아메리카", "오세아니아", "중동·아프리카"] },
};
