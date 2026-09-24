/**
 * スタッフ画面「备忘」タブ: ゲストに送る定型メッセージ。
 *  - お母さんには中国語 (と日本語) で「どんな内容か」を表示
 *  - ゲストの言語 (英語 / 中文 / 日本語 / 한국어) を選んでコピー
 *  - 時間などは予約ごとに違うので、決め打ちの時刻は入れない
 */
export type GuestLang = "en" | "zh" | "ja" | "ko";
export const GUEST_LANGS: { k: GuestLang; label: string }[] = [
  { k: "en", label: "English" }, { k: "zh", label: "中文" }, { k: "ja", label: "日本語" }, { k: "ko", label: "한국어" },
];

export interface Template {
  id: string;
  emoji: string;
  title: { zh: string; ja: string };   // お母さん用の見出し
  about: { zh: string; ja: string };   // どんな内容か
  text: Record<GuestLang, string>;
}

export const TEMPLATES: Template[] = [
  {
    id: "welcome", emoji: "👋",
    title: { zh: "欢迎（入住前）", ja: "ようこそ（到着前）" },
    about: { zh: "感谢预订，问到达时间", ja: "予約のお礼と到着時間の確認" },
    text: {
      en: "Hello! Thank you very much for booking with us 😊\nWe are looking forward to welcoming you.\nCould you please let us know your estimated arrival time?\nIf you have any questions, feel free to message us anytime.",
      zh: "您好！非常感谢您的预订 😊\n我们很期待您的到来。\n方便告诉我们您大概几点到达吗？\n有任何问题，随时给我们留言就好。",
      ja: "こんにちは！ご予約ありがとうございます 😊\nお会いできるのを楽しみにしています。\nおおよその到着時間を教えていただけますか？\nご不明な点があれば、いつでもメッセージしてください。",
      ko: "안녕하세요! 예약해 주셔서 정말 감사합니다 😊\n만나 뵙기를 기대하고 있습니다.\n대략적인 도착 시간을 알려주실 수 있을까요?\n궁금한 점이 있으시면 언제든지 메시지 주세요.",
    },
  },
  {
    id: "arrival", emoji: "🗝️",
    title: { zh: "入住当天", ja: "チェックイン当日" },
    about: { zh: "房间准备好了，欢迎入住", ja: "お部屋の準備ができました" },
    text: {
      en: "Good news! Your room is ready 🌸\nPlease use the smart key link / door code we sent you to enter.\nWe hope you have a wonderful stay. If you need anything, just let us know!",
      zh: "好消息！您的房间已经准备好了 🌸\n请使用我们发给您的智能钥匙链接 / 门锁密码进入。\n祝您入住愉快，有需要随时告诉我们！",
      ja: "お部屋の準備ができました 🌸\nお送りしたスマートキーのリンク / 暗証番号でお入りください。\nすてきなご滞在になりますように。何かあればお気軽にご連絡ください！",
      ko: "객실 준비가 완료되었습니다 🌸\n보내드린 스마트키 링크 / 도어 비밀번호로 들어가 주세요.\n즐거운 시간 보내시고, 필요한 것이 있으면 언제든지 말씀해 주세요!",
    },
  },
  {
    id: "early", emoji: "🧳",
    title: { zh: "提前到了（房间还在打扫）", ja: "早く着いた（まだ清掃中）" },
    about: { zh: "请稍等，打扫好了马上通知", ja: "清掃中なので少し待ってもらう" },
    text: {
      en: "Thank you for arriving early! We are still cleaning the room right now.\nWe will send you a message as soon as it is ready. Thank you for your patience 🙏",
      zh: "感谢您提前到达！房间现在还在打扫中。\n打扫好了我们会马上通知您，请稍等一下 🙏",
      ja: "早めにお越しいただきありがとうございます！ただいまお部屋を清掃中です。\n準備ができしだい、すぐにご連絡しますので、少々お待ちください 🙏",
      ko: "일찍 도착해 주셔서 감사합니다! 지금 객실을 청소하고 있습니다.\n준비되는 대로 바로 연락드릴게요. 조금만 기다려 주세요 🙏",
    },
  },
  {
    id: "checkout", emoji: "⏰",
    title: { zh: "退房提醒（前一天）", ja: "チェックアウトのお知らせ（前日）" },
    about: { zh: "明天退房，请关灯关空调", ja: "明日チェックアウト、電気とエアコンをOFFに" },
    text: {
      en: "Thank you for staying with us! Just a reminder that check-out is tomorrow.\nBefore leaving, please turn off the lights and air conditioner and make sure the door is locked.\nWe hope you enjoyed your stay 😊",
      zh: "感谢您的入住！提醒您明天就要退房了。\n离开前请关灯、关空调，并确认门已经锁好。\n希望您住得开心 😊",
      ja: "ご滞在ありがとうございます！明日はチェックアウトの日です。\nお出かけ前に、電気とエアコンを消して、ドアの施錠をご確認ください。\n楽しいご滞在になっていたらうれしいです 😊",
      ko: "머물러 주셔서 감사합니다! 내일이 체크아웃 날이라 안내드립니다.\n나가시기 전에 전등과 에어컨을 끄시고 문이 잠겼는지 확인해 주세요.\n즐거운 시간이 되셨기를 바랍니다 😊",
    },
  },
  {
    id: "reply", emoji: "💬",
    title: { zh: "收到了，马上回复", ja: "確認しました（すぐ返信）" },
    about: { zh: "告诉客人：已收到，稍后回复", ja: "受け取ったので少し待ってもらう" },
    text: {
      en: "Thank you for your message! We have received it and will get back to you shortly 🙏",
      zh: "谢谢您的留言！我们已经收到了，稍后马上回复您 🙏",
      ja: "メッセージありがとうございます！確認しましたので、少々お待ちください 🙏",
      ko: "메시지 감사합니다! 확인했으니 곧 답변 드리겠습니다 🙏",
    },
  },
  {
    id: "lost", emoji: "🔎",
    title: { zh: "找到遗留物品", ja: "忘れ物が見つかりました" },
    about: { zh: "打扫时找到了东西，问怎么处理", ja: "清掃中に見つけた物をどうするか聞く" },
    text: {
      en: "Hello! While cleaning the room, we found an item that may belong to you.\nWould you like us to keep it or send it to you? Please let us know 😊",
      zh: "您好！我们打扫房间时发现了一件可能是您的物品。\n请问需要我们帮您保管，还是寄给您呢？😊",
      ja: "こんにちは！お部屋の清掃中に、お忘れ物と思われる物が見つかりました。\nお預かりしておくか、お送りするか、ご希望を教えてください 😊",
      ko: "안녕하세요! 객실 청소 중에 손님의 물건으로 보이는 것을 발견했습니다.\n보관해 드릴까요, 아니면 보내 드릴까요? 알려 주세요 😊",
    },
  },
  {
    id: "thanks", emoji: "💐",
    title: { zh: "感谢入住（退房后）", ja: "ご宿泊のお礼（退室後）" },
    about: { zh: "谢谢，请帮忙写好评", ja: "お礼とレビューのお願い" },
    text: {
      en: "Thank you so much for staying with us! It was a pleasure to have you 😊\nIf you enjoyed your stay, we would be very happy if you could leave a review.\nHave a safe trip, and we hope to see you again!",
      zh: "非常感谢您的入住！能接待您是我们的荣幸 😊\n如果您住得满意，希望您能帮我们写个好评。\n祝您旅途平安，期待再次见到您！",
      ja: "ご宿泊いただき、本当にありがとうございました 😊\n楽しんでいただけたなら、レビューを書いていただけるととてもうれしいです。\nお気をつけて。またお会いできるのを楽しみにしています！",
      ko: "머물러 주셔서 정말 감사합니다! 모실 수 있어서 기뻤습니다 😊\n즐거우셨다면 후기를 남겨 주시면 정말 감사하겠습니다.\n안전한 여행 되시고, 또 뵙기를 바랍니다!",
    },
  },
];
