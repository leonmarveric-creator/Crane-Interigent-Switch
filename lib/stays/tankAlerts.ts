// =========================================================
// し尿タンク — 警告通知（WxPusher）※サーバ専用
//   累積水量が警告ライン（既定480L / 80%）を超えたときに WxPusher へ通知する。
//   （Switch版はメール通知を持たず WxPusher のみ。メールを足す場合は
//     Nest版 tankAlerts.ts の sendEmail を参照して nodemailer を追加する）
//
//   環境変数:
//     WXPUSHER_APP_TOKEN … WxPusher 標準推送アプリの appToken
//     WXPUSHER_UIDS      … 家族UID（複数はカンマ区切り）
//     WXPUSHER_SPT       … 簡易推送トークン（UID方式の代わりに使う場合）
//     VACUUM_CONTACT     … バキュームカー業者の連絡先（文面に埋め込む）
// =========================================================
import { sendWxPusher, type WxPusherSendResult } from "../wxpusher";
import { TankStatus, roundL } from "./tank";

export interface AlertPayload {
  currentLiters: number;
  capacityLiters: number;
  alertLine: number;
  pct: number;
  status: TankStatus;
  test?: boolean;
}

export interface AlertResult {
  wxpusher: WxPusherSendResult;
}

// 業者連絡先（環境変数で上書き可能）
function vacuumContact(): string {
  return process.env.VACUUM_CONTACT || "バキュームカー業者：〇〇環境サービス TEL 0000-00-0000";
}

// ---- 共通の文面 ----
function buildTitle(p: AlertPayload): string {
  return p.test ? "【便槽テスト】通知設定の確認" : "【便槽警告】汲み取り手配のお願い";
}

function buildLines(p: AlertPayload): string[] {
  if (p.test) {
    return [
      "これは便槽通知の動作確認です。実際の汲み取り手配ではありません。",
      `現在の水量：${roundL(p.currentLiters)} L / ${p.capacityLiters} L（${Math.round(p.pct)}%）`,
      `警告ライン：${p.alertLine} L`,
      "WxPusher の通知設定が正しく届くか確認してください。",
      vacuumContact(),
    ];
  }

  return [
    "し尿タンクが汲み取り手配の警告ラインに達しました（匂いが出る前に手配してください）。",
    `現在の水量：${roundL(p.currentLiters)} L / ${p.capacityLiters} L（${Math.round(p.pct)}%）`,
    `警告ライン：${p.alertLine} L を超過`,
    "至急バキュームカーの手配をお願いします。",
    vacuumContact(),
  ];
}

// ---------------------------------------------------------
// 通知: WxPusher — 家族UID向け
// ---------------------------------------------------------
async function sendTankWxPusher(p: AlertPayload): Promise<AlertResult["wxpusher"]> {
  return sendWxPusher({
    title: buildTitle(p),
    content: [buildTitle(p), "", ...buildLines(p)].join("\n"),
  });
}

// ---------------------------------------------------------
// 公開API：WxPusher へ通知
// ---------------------------------------------------------
export async function dispatchTankAlerts(p: AlertPayload): Promise<AlertResult> {
  const wxpusher = await sendTankWxPusher(p).catch(
    (e): WxPusherSendResult => ({ ok: false, error: String(e) })
  );
  return { wxpusher };
}
