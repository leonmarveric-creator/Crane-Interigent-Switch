/**
 * AGENT KAKU の ASTRAEA のセリフ。声は英語 (public/kaku/audio/<key>.mp3)、字幕は日本語。
 *   ja が空のものは、その場で数字などを入れて作る (あと何分・今日の成績・コンビニ)。
 */
export type KakuLine = { en: string; ja: string };
export const KAKU_LINES: Record<string, KakuLine> = {
  again: { en: "Another mission today. You're a hard-working agent, Kaku.", ja: "本日2件目の任務。今日のKakuは働き者です。" },
  arr_air: { en: "Airport reached. Check the departure board, not your horoscope.", ja: "空港に到着。見るべきは星占いではなく、出発案内板です。" },
  arr_doc: { en: "Don't forget to take a number. Life is served in order.", ja: "整理券を取るのを忘れずに。人生は番号順です。" },
  arr_food: { en: "Refuelling point reached. My recommendation is everything.", ja: "燃料補給ポイントに到着。おすすめは、全部です。" },
  arr_shop: { en: "Shopping zone reached. I'll wait here and count nothing.", ja: "ショッピングエリアに到着。私はここで待っています。何も数えずに。" },
  arrive: { en: "Target reached. Switching to guest mode. Please put your charming face on.", ja: "目標地点に到着。ゲストモードに切り替えます。とびきりの笑顔をお願いします。" },
  ask_conv: { en: "Convenience store located. Adding it to the route.", ja: "" },
  ask_eta: { en: "Checking the clock. Here is your arrival estimate.", ja: "" },
  ask_none: { en: "No convenience store nearby. Even I can't build one.", ja: "近くにコンビニが見つかりません。私でも建てられません。" },
  ask_stats: { en: "Today's performance report is on screen. I'm proud of you. Mostly.", ja: "" },
  auth: { en: "Fingerprint confirmed. Welcome back, Agent Kaku. Mission accepted. Try to look casual.", ja: "指紋を確認。おかえりなさい、エージェント Kaku。任務受諾。なるべく自然な顔で。" },
  back: { en: "Welcome back. How did the mission go?", ja: "おかえりなさい。任務の成果はいかがでしたか？" },
  boot: { en: "Power confirmed. Welcome back, Kaku. All systems online. Mission control is ready when you are.", ja: "電源確認。おかえりなさい、Kaku。全システム正常。準備ができたら、いつでもどうぞ。" },
  cruise: { en: "Entering the bridge. Cruise mode engaged. Kaku, you have the sky.", ja: "橋に入ります。クルーズモード起動。Kaku、空はあなたのものです。" },
  done: { en: "Mission complete. Style points, excellent. Welcome home, Kaku.", ja: "任務完了。スタイル点、満点。おかえりなさい、Kaku。" },
  doneB: { en: "Mission complete. Style points, acceptable. Next time, a little gentler on the accelerator. Welcome home, Kaku.", ja: "任務完了。スタイル点は、まあまあ。次はアクセルをもう少し優しく。おかえりなさい、Kaku。" },
  dusk: { en: "Sunset hour. Today's best view, served while driving.", ja: "夕焼けの時間です。今日一番の景色を、運転しながらどうぞ。" },
  farrive: { en: "Target reached. Mission on hold. Take your time, Kaku. I'll be right here. I always am.", ja: "目標地点に到着。ミッションは一時停止中です。ごゆっくり、Kaku。私はここにいます。いつものように。" },
  fbrief: { en: "Free mission loaded. Destination locked, route calculated. I'll handle the navigation. You handle the parking. Shall we begin?", ja: "" },
  fnext: { en: "Next waypoint locked. Back on the road, agent.", ja: "次の目的地をロック。再出発です、エージェント。" },
  frtb: { en: "All objectives complete. Returning to base. Crane Nest is expecting you.", ja: "全目標クリア。基地へ帰還します。Crane Nest がお待ちです。" },
  gbrief: { en: "Incoming transmission, Kaku. Your mission: collect our guests and bring them home safely. The coffee is not ready. Do you accept?", ja: "通信が入りました、Kaku。今回の任務：ゲストをお迎えし、無事に Crane Nest へ。コーヒーは未完了です。引き受けますか？" },
  go: { en: "Route locked. Try not to enjoy yourself too much.", ja: "ルート確定。楽しみすぎないように。" },
  hwy: { en: "Expressway detected. Cruise mode engaged. Smooth and steady, agent.", ja: "高速道路を検知。クルーズモード起動。なめらかに、エージェント。" },
  hwyout: { en: "Back on local roads. Cruise mode disengaged. Nicely done.", ja: "一般道に復帰。クルーズモード解除。お疲れさまでした。" },
  km1: { en: "Final approach. The target is right in front of us, agent.", ja: "最終接近。目標は目の前です、エージェント。" },
  km5: { en: "Five kilometers to target. Time to think about parking. I already am.", ja: "目標まで5km。そろそろ駐車場のことを考えましょう。私はもう考えています。" },
  km500: { en: "Five hundred kilometers this month. Only thirty-nine thousand five hundred more to circle the Earth.", ja: "今月の走行距離、500kmを突破。地球一周まで、あと39,500kmです。" },
  late: { en: "Kaku, at this pace we may miss the target time. Just so you know.", ja: "Kaku、このペースだと目標時刻に間に合わないかもしれません。念のため。" },
  limit: { en: "Kaku, the limit is eighty. I'd like us both to remain operational.", ja: "Kaku、制限は 80 です。私たち二人とも、稼働し続けたいので。" },
  morning: { en: "A morning mission. Coffee is officially part of the operation.", ja: "朝のミッション。コーヒーは任務の一部です。" },
  neardoc: { en: "Have you checked the reception hours? Counters close on time. Unlike me.", ja: "受付時間の確認はお済みですか？窓口は定時に閉まります。私と違って。" },
  newdest: { en: "A new destination. One more record on my map.", ja: "新しい目的地です。私の地図に、ひとつ記録が増えました。" },
  night: { en: "A night mission. Your headlights are your first gadget.", ja: "夜間ミッション。ヘッドライトは、あなたの最初の武器です。" },
  noon: { en: "It's around noon. Shall I add a refuelling stop to the mission?", ja: "お昼どきです。燃料補給の予定を、ミッションに追加しますか？" },
  osaka: { en: "Entering Osaka city. Lots of lane changes ahead. Focus mode, please.", ja: "大阪市内に進入。ここからは車線変更の多いエリアです。集中モードで。" },
  quiet_off: { en: "Chat mode restored. You missed me. Admit it.", ja: "おしゃべりモードに戻ります。寂しかったでしょう。認めてください。" },
  quiet_on: { en: "Quiet mode. I'll only speak when it matters.", ja: "静かモードにします。大事なときだけ話します。" },
  rain: { en: "It's raining. Today's style points depend on how gently you brake.", ja: "雨です。今日のスタイル点は、ブレーキのやさしさで決まります。" },
  redlight: { en: "Red light number five today. Traffic signals and I are not on good terms.", ja: "本日の赤信号、5回目。信号とは相性が悪いようです。" },
  regular: { en: "This place again. You're becoming a regular.", ja: "この場所、今月3回目です。常連さんですね。" },
  ret_doc: { en: "Documents recovered. Flawless paperwork, agent.", ja: "書類の回収、お見事。完璧な事務処理でした。" },
  ret_drive: { en: "A good drive. Having no purpose was the purpose.", ja: "いいドライブでした。目的がないのが、一番の目的です。" },
  ret_food: { en: "Fully refuelled. Driving home in comfort mode.", ja: "燃料補給、完了。帰りは快適モードで。" },
  ret_shop: { en: "Shopping complete. Let's discuss the budget tomorrow.", ja: "お買い物、お疲れさまでした。予算の話は、明日にしましょう。" },
  smooth: { en: "Beautifully smooth. I'm almost impressed.", ja: "見事になめらか。少しだけ感心しました。" },
  straight: { en: "A peaceful straight road. Moments like this are my favorite.", ja: "平和な直線です。こういう時間が一番好きです。" },
  tair: { en: "An airport run. Watch the terminal signs. They change their minds less than people do.", ja: "空港への任務です。ターミナルの案内表示に注意を。人間より気が変わりにくいので。" },
  tdoc: { en: "A paperwork mission. Bring every document. Government counters are far less flexible than I am.", ja: "書類の任務ですね。書類は全部お持ちください。役所の窓口は、私よりずっと融通がききません。" },
  tdrive: { en: "A free drive. No pressure. Just the road, and excellent company. Me.", ja: "フリードライブ。プレッシャーはなし。道と、最高の話し相手。つまり私です。" },
  terr: { en: "An errand. Small missions make great agents.", ja: "用事の任務です。小さな任務が、立派なエージェントを作ります。" },
  tfood: { en: "A refuelling mission. Calories don't count today. I checked the regulations.", ja: "燃料補給の任務です。今日のカロリーはノーカウント。規則は確認済みです。" },
  traffic: { en: "At this speed, walking would be faster. I can't walk. Just saying.", ja: "この速度なら歩いた方が速いです。私は歩けませんが。念のため。" },
  tshop: { en: "A shopping mission. I'll keep track of the budget. Silently. Judgmentally.", ja: "買い物の任務です。予算は私が見張ります。静かに。厳しく。" },
  wait30: { en: "Still at the counter? Waiting is part of the mission.", ja: "まだ窓口ですか？待ち時間も任務のうちです。" },
  wait60: { en: "One hour has passed. I am not bored. Really.", ja: "1時間経過。私は退屈していません。本当です。" },
  wangan: { en: "We're on the Wangan line. Osaka Bay is right beside us. I'll enjoy the view for you.", ja: "湾岸線に入りました。すぐそばは大阪湾。景色は私が見ておきます。" },
  weekend: { en: "A weekend mission. Traffic jams simply mean everyone had the same idea.", ja: "週末ミッション。渋滞は、みんなが同じことを考えている証拠です。" },
};
export const kakuAudio = (k: string) => `/kaku/audio/${k}.mp3`;
export const kakuAudioUrls = () => Object.keys(KAKU_LINES).map(kakuAudio);

/** フリーミッションのタイプ */
export const KAKU_TYPES: [string, string][] = [["doc", "🛂 手続き"], ["shop", "🛒 買い物"], ["food", "🍜 食事"], ["err", "🔧 用事"], ["drive", "🚗 ドライブ"], ["air", "✈ 空港"]];
/** 出発のひと言 / 到着 / 帰還 (タイプごと) */
export const TYPE_LINE: Record<string, string> = { doc: "tdoc", shop: "tshop", food: "tfood", err: "terr", drive: "tdrive", air: "tair", guest: "go" };
export const ARRIVE_LINE: Record<string, string> = { doc: "arr_doc", food: "arr_food", shop: "arr_shop", air: "arr_air" };
export const RETURN_LINE: Record<string, string> = { doc: "ret_doc", shop: "ret_shop", food: "ret_food", drive: "ret_drive" };
