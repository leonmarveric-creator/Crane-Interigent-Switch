// =============================================================================
//  SwitchBot デバイスID一覧取得スクリプト
//  使い方 (Macのターミナル):
//    SWITCHBOT_TOKEN=あなたのトークン SWITCHBOT_SECRET=あなたのシークレット \
//      node scripts/list-switchbot-devices.mjs
//
//  出力された deviceId を rooms.switchbot_ac_device_id /
//  switchbot_light_device_id に登録する。
//  ※ エアコン・照明は「仮想赤外線リモコン」として infraredRemoteList に出ます。
// =============================================================================
import crypto from "crypto";

const token = process.env.SWITCHBOT_TOKEN;
const secret = process.env.SWITCHBOT_SECRET;

if (!token || !secret) {
  console.error("❌ SWITCHBOT_TOKEN と SWITCHBOT_SECRET を環境変数で渡してください。");
  console.error("   例: SWITCHBOT_TOKEN=xxx SWITCHBOT_SECRET=yyy node scripts/list-switchbot-devices.mjs");
  process.exit(1);
}

const t = Date.now().toString();
const nonce = crypto.randomUUID();
const sign = crypto.createHmac("sha256", secret).update(token + t + nonce).digest("base64");

const res = await fetch("https://api.switch-bot.com/v1.1/devices", {
  headers: { Authorization: token, sign, t, nonce, "Content-Type": "application/json" },
});
const json = await res.json();

if (json.statusCode !== 100) {
  console.error("❌ APIエラー:", JSON.stringify(json, null, 2));
  process.exit(1);
}

const { deviceList = [], infraredRemoteList = [] } = json.body;

console.log("\n===== 物理デバイス (Hub等) =====");
for (const d of deviceList) {
  console.log(`${d.deviceName.padEnd(24)}  ${d.deviceType.padEnd(16)}  id=${d.deviceId}`);
}

console.log("\n===== 仮想赤外線リモコン (エアコン・照明はここ) =====");
for (const d of infraredRemoteList) {
  console.log(`${(d.deviceName || "").padEnd(24)}  ${(d.remoteType || "").padEnd(20)}  id=${d.deviceId}`);
}

console.log("\n👉 エアコン(Air Conditioner)と照明(Light/DIY Light)の id を控えてください。\n");
