// =========================================================
// し尿タンク — 再評価＋通知＋レスポンス整形（サーバ専用）
//   データ変更（手動補正 / Airbnb同期 / メール取り込み）のあとに呼び、
//   現在水量を再計算して 80% 超過なら WxPusher + Email 通知する。
//
//   「跨ぎ」の判定は state.alerted フラグで行う:
//     - 超過中 かつ 未通知 → 通知して alerted=true
//     - 未超過 かつ 通知済 → alerted=false（訂正で下回ったら再通知できる）
//   これによりどの変更経路でも多重通知を防げる。
// =========================================================
import {
  alertLineLiters, cautionLineLiters, smellLineLiters, forecastDays, remainingLiters,
  statusFor, tankPct, isOdorSeason, guestNightsToLiters,
} from "./tank";
import { getTankState, setAlerted, upcomingDailyGuests } from "./tankStore";
import { dispatchTankAlerts } from "./tankAlerts";
import type { AlertResult } from "./tankAlerts";

export type TankStateWithSummary = Awaited<ReturnType<typeof getTankState>> & {
  summary: {
    pct: number;
    status: ReturnType<typeof statusFor>;
    alertLine: number;
    cautionLine: number;
    smellLine: number;        // 匂いが出始める実測ライン(L)
    odorSeason: boolean;      // 夏(6〜9月)の早め警告モードか
    remainingLiters: number;
    upcomingGuestsPerDay: number;
    forecastDays: number | null; // 警告ラインまでの予測日数
    // 「何泊/何人でここまで来たか」= 前回汲み取り以降の累計
    totalGuestNights: number; // 延べ人泊（現在水量に相当）
    daysSinceEmptied: number; // 前回汲み取りからの経過日数
    guestNightsToAlert: number; // 警告ラインまであと何人泊
    guestNightsToSmell: number; // 匂いラインまであと何人泊
  };
};

// JST基準の「今日」から前回汲み取り日までの経過日数
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function daysBetweenJst(fromDateStr: string): number {
  const today = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
  const a = new Date(fromDateStr + "T00:00:00Z").getTime();
  const b = new Date(today + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

// 状態にサマリー（%、状態区分、残り猶予、予測、延べ人泊 等）を付与
export async function buildResponse(
  state: Awaited<ReturnType<typeof getTankState>>
): Promise<TankStateWithSummary> {
  const now = new Date();
  const upcoming = await upcomingDailyGuests();
  const alertLine = alertLineLiters(state.capacityLiters, now);
  const smellLine = smellLineLiters(state.capacityLiters);
  const totalGuestNights = state.logs.reduce((acc, l) => acc + (l.guests || 0), 0);
  return {
    ...state,
    summary: {
      pct: Math.round(tankPct(state.currentLiters, state.capacityLiters)),
      status: statusFor(state.currentLiters, state.capacityLiters, now),
      alertLine,
      cautionLine: cautionLineLiters(state.capacityLiters, now),
      smellLine,
      odorSeason: isOdorSeason(now),
      remainingLiters: remainingLiters(state.currentLiters, state.capacityLiters),
      upcomingGuestsPerDay: Math.round(upcoming * 10) / 10,
      forecastDays: forecastDays(
        state.currentLiters,
        state.capacityLiters,
        upcoming,
        state.litersPerGuestPerDay,
        alertLine // 警告ラインまでの日数
      ),
      totalGuestNights,
      daysSinceEmptied: daysBetweenJst(state.lastEmptiedDate),
      guestNightsToAlert: guestNightsToLiters(state.currentLiters, alertLine, state.litersPerGuestPerDay),
      guestNightsToSmell: guestNightsToLiters(state.currentLiters, smellLine, state.litersPerGuestPerDay),
    },
  };
}

// 再計算して必要なら通知。通知結果（送ったか）を併せて返す。
export async function evaluateAndAlert(): Promise<{
  response: TankStateWithSummary;
  alert: AlertResult | null;
}> {
  const state = await getTankState();
  const alertLine = alertLineLiters(state.capacityLiters);
  const over = state.currentLiters >= alertLine;

  let alert: AlertResult | null = null;
  if (over && !state.alerted) {
    alert = await dispatchTankAlerts({
      currentLiters: state.currentLiters,
      capacityLiters: state.capacityLiters,
      alertLine,
      pct: tankPct(state.currentLiters, state.capacityLiters),
      status: statusFor(state.currentLiters, state.capacityLiters),
    });
    await setAlerted(true);
  } else if (!over && state.alerted) {
    await setAlerted(false);
  }

  const fresh = await getTankState();
  return { response: await buildResponse(fresh), alert };
}
