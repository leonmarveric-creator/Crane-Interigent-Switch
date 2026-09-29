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
  near: { en: "Arriving soon. The welcome board is ready. Your smile, please.", ja: "まもなく到着。お出迎えボードの準備ができています。笑顔をお願いします。" },
  board: { en: "Welcome board on screen. Hold me up high, Captain. I'm very visible.", ja: "お出迎えボードを表示しました。高く掲げてください、キャプテン。私はとても目立ちます。" },
  done: { en: "Mission complete. Guests delivered safely. Nicely done, Captain.", ja: "任務完了。ゲストを無事にお送りしました。お見事でした、キャプテン。" },
  forgot: { en: "Before we head home, please check the back seats and the trunk for anything left behind.", ja: "帰る前に、後部座席とトランクに忘れ物がないか確認をお願いします。" },
  home: { en: "Welcome back to base, Captain. Rest well. I'll be here.", ja: "基地に帰還しました、キャプテン。ゆっくり休んでください。私はここにいます。" },
};
export const dhAudio = (k: string) => `/cabin/audio/dh/${k}.mp3`;
/** 便名 (IATA: CI152) → 上空レーダーのコールサイン (ICAO: CAL152) */
const ICAO: Record<string, string> = { CI: "CAL", BR: "EVA", CX: "CPA", UO: "HKE", HX: "CRK", JL: "JAL", NH: "ANA", MM: "APJ", GK: "JJP", IT: "TTW", KE: "KAL", OZ: "AAR", "7C": "JJA", TW: "TWB", LJ: "JNA", ZE: "ESR", JX: "SJX", CA: "CCA", MU: "CES", CZ: "CSN", HO: "DKH", FM: "CSH", SQ: "SIA", TR: "TGW", TG: "THA", VN: "HVN", VJ: "VJC", PR: "PAL", "5J": "CEB", MH: "MAS", D7: "XAX", AK: "AXM", FD: "AIQ", QF: "QFA", UA: "UAL", DL: "DAL", AA: "AAL", EK: "UAE", QR: "QTR", KL: "KLM", AF: "AFR", LH: "DLH", FI: "ICE", HA: "HAL", NZ: "ANZ", "9C": "CQH", "3K": "JSA", SL: "TLM", BX: "ABL" };
export function callsignOf(flightNo: string | null | undefined): string | null {
  const m = String(flightNo || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/);
  if (!m) return null; const pre = ICAO[m[1]]; return pre ? pre + String(Number(m[2])) : null;
}
