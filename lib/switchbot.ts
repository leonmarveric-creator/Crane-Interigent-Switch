import crypto from "crypto";

/**
 * SwitchBot OpenAPI v1.1 クライアント。
 * 認証: HMAC-SHA256 署名をヘッダに付与。token / secret はサーバ専用。
 */

const BASE = "https://api.switch-bot.com/v1.1";

interface SwitchBotCreds {
  token: string;
  secret: string;
}

function authHeaders({ token, secret }: SwitchBotCreds) {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const sign = crypto
    .createHmac("sha256", secret)
    .update(token + t + nonce)
    .digest("base64");

  return {
    Authorization: token,
    sign,
    t,
    nonce,
    "Content-Type": "application/json; charset=utf8",
  };
}

async function sendCommand(
  creds: SwitchBotCreds,
  deviceId: string,
  body: { command: string; parameter?: string; commandType?: string }
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const res = await fetch(`${BASE}/devices/${deviceId}/commands`, {
    method: "POST",
    headers: authHeaders(creds),
    body: JSON.stringify({ commandType: "command", parameter: "default", ...body }),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => null);
  // SwitchBotは body.statusCode === 100 が成功
  const ok = res.ok && (payload as any)?.statusCode === 100;
  return { ok, status: res.status, payload };
}

/** デバイス一覧を取得 (管理画面でID確認用)。 */
export async function listDevices(creds: SwitchBotCreds): Promise<{
  error: string | null;
  deviceList: { deviceId: string; deviceName: string; deviceType: string }[];
  infraredRemoteList: { deviceId: string; deviceName: string; remoteType: string }[];
}> {
  try {
    const res = await fetch(`${BASE}/devices`, {
      headers: authHeaders(creds),
      cache: "no-store",
    });
    const json = await res.json();
    if (json?.statusCode !== 100) {
      return { error: json?.message || `status ${json?.statusCode}`, deviceList: [], infraredRemoteList: [] };
    }
    return {
      error: null,
      deviceList: json.body?.deviceList ?? [],
      infraredRemoteList: json.body?.infraredRemoteList ?? [],
    };
  } catch (e: any) {
    return { error: e?.message || "fetch failed", deviceList: [], infraredRemoteList: [] };
  }
}

/** 仮想IRエアコン: ON / OFF。setAllで温度等の細かい指定も可能。 */
export function acTurnOn(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOn" });
}
export function acTurnOff(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOff" });
}
/** 温度/モード/風量指定 (例: 26度, 冷房, 自動, ON) */
export function acSetAll(
  creds: SwitchBotCreds,
  deviceId: string,
  opts: { temp: number; mode: 1 | 2 | 3 | 4 | 5; fan: 1 | 2 | 3 | 4; power: "on" | "off" }
) {
  // parameter = "{temp},{mode},{fan},{power}"  mode:2=冷房 5=暖房
  return sendCommand(creds, deviceId, {
    command: "setAll",
    parameter: `${opts.temp},${opts.mode},${opts.fan},${opts.power}`,
  });
}

/**
 * 汎用デバイス: ON / OFF。
 * SwitchBot Bot / Plug Mini などの物理デバイスも仮想IRも turnOn/turnOff で動く。
 * ギャラクシーモード (プラネタリウムプロジェクター) はこれを使用。
 */
export function deviceTurnOn(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOn" });
}
export function deviceTurnOff(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOff" });
}

/** 仮想IR照明: ON / OFF。光目覚ましもこれを使用。 */
export function lightTurnOn(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOn" });
}
export function lightTurnOff(creds: SwitchBotCreds, deviceId: string) {
  return sendCommand(creds, deviceId, { command: "turnOff" });
}

export type { SwitchBotCreds };
