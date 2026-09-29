/** 回送モード (ゲストなし) の ASTRAEA → キャプテン (お父さん) のセリフ。声は英語 (public/cabin/audio/dh/<key>.mp3)、字幕は日本語 */
export const DH_LINES: Record<string, { en: string; ja: string }> = {
  boot: { en: "Hello, Captain. Co-pilot online. Today's mission: collect our guests and bring them home. Coffee is, as always, your department.", ja: "こんにちは、キャプテン。コパイロット起動。本日の任務：ゲストをお迎えして、無事にお連れすること。コーヒーは、いつもどおりキャプテンのご担当です。" },
  early: { en: "Captain, the flight is running early. You may hurry slightly. Within the speed limit, of course.", ja: "キャプテン、便は早く着く見込みです。少しだけ急いでも構いません。もちろん制限速度の範囲で。" },
  late: { en: "Captain, the flight is delayed. We have time. Relax your shoulders.", ja: "キャプテン、便は遅れています。時間はあります。肩の力を抜いてください。" },
  landed: { en: "The flight has landed. Passport control usually takes a while. We have time for a dignified entrance.", ja: "便が着陸しました。入国審査にはふつう少し時間がかかります。堂々とお出迎えする時間があります。" },
  roomOk: { en: "The room is ready. Lights and air-con are standing by. I feel like I've arrived already.", ja: "お部屋の準備はできています。照明とエアコンも待機中。私はもう着いた気分です。" },
  roomWarn: { en: "Captain, the room hasn't been prepared yet. You can prepare it from your phone.", ja: "キャプテン、お部屋の準備がまだです。スマホから準備できます。" },
  checkWarn: { en: "One small thing needs your attention. It's on the screen. Not urgent. Just noted.", ja: "ひとつだけ確認をお願いします。画面に出ています。急ぎではありません。念のため。" },
  boostIn: { en: "Sky Gate boost engaged. Captain, the sky is all yours.", ja: "スカイゲート・ブースト起動。キャプテン、空は貸し切りです。" },
  boostMid: { en: "Above Osaka Bay. Well, on a bridge. It feels the same.", ja: "大阪湾の上空…ではなく、橋の上です。気分は同じです。" },
  boostOut: { en: "Boost complete. Smooth landing. Nicely done.", ja: "ブースト完了。着陸成功。お見事でした。" },
  limit: { en: "Captain, speed is not part of the show.", ja: "キャプテン、速度は演出に含まれていません。" },
  // 速度 (80 / 100 / 120 km/h・2 つからランダム)
  spd80a: { en: "Eighty, Captain. The engine is humming. I am humming too. Internally.", ja: "80 キロです、キャプテン。エンジンが鼻歌を歌っています。私も歌っています。心の中で。" },
  spd80b: { en: "Eighty. Nice and steady, Captain. Let's keep it exactly this nice.", ja: "80 キロ。いい感じです、キャプテン。このいい感じのままでいきましょう。" },
  spd100a: { en: "One hundred, Captain. Impressive. Now let's be impressive at a slightly lower number.", ja: "100 キロ、キャプテン。お見事です。では、もう少し低い数字でお見事になりましょう。" },
  spd100b: { en: "One hundred. Captain, the guests aren't even in the car yet. There's no need to impress me.", ja: "100 キロ。キャプテン、まだゲストは乗っていません。私を感心させる必要はありませんよ。" },
  spd120a: { en: "One twenty, Captain. This is a guesthouse car, not a launch sequence. Easing off would be lovely.", ja: "120 キロ、キャプテン。これは宿の車で、発射シーケンスではありません。少しゆるめていただけると嬉しいです。" },
  spd100c: { en: "One hundred. Captain, the guests are gone. There's no one left to impress. Except me. And I'm impressed. Slow down.", ja: "100 キロ。キャプテン、ゲストはもう降りました。見せる相手はいません。私以外は。もう十分感心しました。ゆっくりで。" },
  spd120b: { en: "Captain. One hundred and twenty. I'm reporting this to headquarters. Just kidding. Unless you keep going.", ja: "キャプテン、120 キロです。本部に報告します。冗談です。このまま続けたら、本当に。" },
  spd140a: { en: "Captain. One hundred and forty. I've run the numbers. The numbers say slow down. So do I.", ja: "キャプテン、140 キロです。計算しました。答えは「減速」です。私も同意見です。" },
  spd140b: { en: "One forty, Captain. That's not driving, that's low-altitude flight. Please bring us back down to the road. Seriously this time.", ja: "140 キロ、キャプテン。それは運転ではなく低空飛行です。道路に戻ってきてください。今回は本気です。" },
  // 静かな時間が続いたら (約 70 秒)。go = 迎えに行く途中、back = 帰り道、どちらにもないものは両方
  idle1: { en: "Captain, all systems nominal. Your coffee status, however, is unknown.", ja: "キャプテン、全システム正常。ただしコーヒーの状況は不明です。" },
  idle2: { en: "You drive, I worry. It's a good system, Captain.", ja: "キャプテンは運転、私は心配担当。いい役割分担です。" },
  idle3: { en: "Quiet road. A perfect time for a deep breath, Captain. I'd take one too, if I had lungs.", ja: "静かな道です。深呼吸のチャンスですよ、キャプテン。私も肺があれば一緒に。" },
  idle4: { en: "Room check complete. The futons are ready. The futons are always ready.", ja: "お部屋チェック完了。お布団は準備万端です。お布団はいつでも準備万端です。" },
  go1: { en: "Reminder: smile at the arrival gate. First impressions are ninety percent of hospitality. I made that number up.", ja: "到着口では笑顔で。第一印象はおもてなしの 9 割です。この数字は私が作りました。" },
  go2: { en: "Scanning the sky. Lots of planes. Only one of them matters to us today.", ja: "上空をスキャン中。飛行機がたくさん。今日大事なのは、そのうちの 1 機だけです。" },
  go3: { en: "Estimated guest condition: tired, but happy. We'll take care of the tired part.", ja: "ゲストの予想コンディション：疲れているけど嬉しい。疲れのほうは私たちで何とかしましょう。" },
  back1: { en: "Mission accomplished, Captain. And the best part of any mission is the drive home.", ja: "任務完了です、キャプテン。どんな任務も、一番いいところは帰り道です。" },
  back2: { en: "The car is quieter now. I miss them already. Please don't tell anyone.", ja: "車内が静かになりました。もう寂しいです。誰にも言わないでください。" },
  near: { en: "Arriving soon. The welcome board is ready. Your smile, please.", ja: "まもなく到着。お出迎えボードの準備ができています。笑顔をお願いします。" },
  board: { en: "Welcome board on screen. Hold me up high, Captain. I'm very visible.", ja: "お出迎えボードを表示しました。高く掲げてください、キャプテン。私はとても目立ちます。" },
  done: { en: "Mission complete. Guests delivered safely. Nicely done, Captain.", ja: "任務完了。ゲストを無事にお送りしました。お見事でした、キャプテン。" },
  forgot: { en: "Before we head home, please check the back seats and the trunk for anything left behind.", ja: "帰る前に、後部座席とトランクに忘れ物がないか確認をお願いします。" },
  home: { en: "Welcome back to base, Captain. Rest well. I'll be here.", ja: "基地に帰還しました、キャプテン。ゆっくり休んでください。私はここにいます。" },
};
/** 速度のひと言。spd100b は迎えに行く途中だけ、spd100c は帰り道だけ */
export const DH_SPD: Record<number, string[]> = { 80: ["spd80a", "spd80b"], 100: ["spd100a", "spd100b", "spd100c"], 120: ["spd120a", "spd120b"], 140: ["spd140a", "spd140b"] };
export const dhSpdFor = (lv: number, back: boolean) => (DH_SPD[lv] ?? []).filter((k) => (back ? k !== "spd100b" : k !== "spd100c"));
export const DH_IDLE = { both: ["idle1", "idle2", "idle3", "idle4"], go: ["go1", "go2", "go3"], back: ["back1", "back2"] };
export const dhAudio = (k: string) => `/cabin/audio/dh/${k}.mp3`;
/** 便名 (IATA: CI152) → 上空レーダーのコールサイン (ICAO: CAL152) */
const ICAO: Record<string, string> = { CI: "CAL", BR: "EVA", CX: "CPA", UO: "HKE", HX: "CRK", JL: "JAL", NH: "ANA", MM: "APJ", GK: "JJP", IT: "TTW", KE: "KAL", OZ: "AAR", "7C": "JJA", TW: "TWB", LJ: "JNA", ZE: "ESR", JX: "SJX", CA: "CCA", MU: "CES", CZ: "CSN", HO: "DKH", FM: "CSH", SQ: "SIA", TR: "TGW", TG: "THA", VN: "HVN", VJ: "VJC", PR: "PAL", "5J": "CEB", MH: "MAS", D7: "XAX", AK: "AXM", FD: "AIQ", QF: "QFA", UA: "UAL", DL: "DAL", AA: "AAL", EK: "UAE", QR: "QTR", KL: "KLM", AF: "AFR", LH: "DLH", FI: "ICE", HA: "HAL", NZ: "ANZ", "9C": "CQH", "3K": "JSA", SL: "TLM", BX: "ABL" };
export function callsignOf(flightNo: string | null | undefined): string | null {
  const m = String(flightNo || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/);
  if (!m) return null; const pre = ICAO[m[1]]; return pre ? pre + String(Number(m[2])) : null;
}
