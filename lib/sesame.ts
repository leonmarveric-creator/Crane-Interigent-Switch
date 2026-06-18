import { AesCmac } from "aes-cmac";

/**
 * Sesame 5 / candyhouse Web API クライアント。
 *
 * 署名(sign)の生成手順 (公式仕様):
 *   1. UNIX時刻(秒) を符号なし32bit リトルエンディアンで4byteに変換
 *   2. index0(最下位byte)を捨て、続く3byte([1..4))を取り出す
 *   3. デバイスの secret_key (16byte) を鍵に AES-CMAC を計算
 *   4. 結果16byteを hex 文字列化 -> これが sign
 *
 * cmd コード:  82 = LOCK(施錠) / 83 = UNLOCK(解錠) / 88 = TOGGLE
 */

export const SESAME_CMD = { LOCK: 82, UNLOCK: 83, TOGGLE: 88 } as const;
export type SesameCmd = (typeof SESAME_CMD)[keyof typeof SESAME_CMD];

const SESAME_ENDPOINT = (uuid: string) =>
  `https://app.candyhouse.co/api/sesame2/${uuid}/cmd`;

async function generateSign(secretKeyHex: string): Promise<string> {
  const key = Buffer.from(secretKeyHex, "hex"); // 16 byte
  const epochSec = Math.floor(Date.now() / 1000);

  const ts = Buffer.alloc(4);
  ts.writeUInt32LE(epochSec, 0);
  const message = ts.subarray(1, 4); // index0(LSB)を捨て、続く3byte

  const cmac = new AesCmac(key);
  const mac = await cmac.calculate(message); // Promise<Uint8Array> (16byte)
  return Buffer.from(mac).toString("hex");
}

export interface SesameCreds {
  deviceUuid: string;
  secretKey: string; // hex
  apiKey: string;
}

/**
 * Sesameへコマンド送信。history は誰が操作したかのラベル(base64)。
 */
export async function sendSesameCommand(
  creds: SesameCreds,
  cmd: SesameCmd,
  historyLabel = "Guest App"
): Promise<{ ok: boolean; status: number }> {
  const sign = await generateSign(creds.secretKey);
  const history = Buffer.from(historyLabel).toString("base64");

  const res = await fetch(SESAME_ENDPOINT(creds.deviceUuid), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": creds.apiKey,
    },
    body: JSON.stringify({ cmd, history, sign }),
    cache: "no-store",
  });

  // candyhouse は成功時 200 を返す。
  return { ok: res.ok, status: res.status };
}
