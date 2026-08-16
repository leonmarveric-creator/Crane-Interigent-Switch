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
import { alertLineLiters, forecastDays, remainingLiters, statusFor, tankPct } from "./tank";
import { getTankState, setAlerted, upcomingDailyGuests } from "./tankStore";
import { dispatchTankAlerts } from "./tankAlerts";
import type { AlertResult } from "./tankAlerts";

export type TankStateWithSummary = Awaited<ReturnType<typeof getTankState>> & {
  summary: {
    pct: number;
    status: ReturnType<typeof statusFor>;
    alertLine: number;
    remainingLiters: number;
    upcomingGuestsPerDay: number;
    forecastDays: number | null;
  };
};

// 状態にサマリー（%、状態区分、残り猶予、予測日数）を付与
export async function buildResponse(
  state: Awaited<ReturnType<typeof getTankState>>
): Promise<TankStateWithSummary> {
  const upcoming = await upcomingDailyGuests();
  return {
    ...state,
    summary: {
      pct: Math.round(tankPct(state.currentLiters, state.capacityLiters)),
      status: statusFor(state.currentLiters, state.capacityLiters),
      alertLine: alertLineLiters(state.capacityLiters),
      remainingLiters: remainingLiters(state.currentLiters, state.capacityLiters),
      upcomingGuestsPerDay: Math.round(upcoming * 10) / 10,
      forecastDays: forecastDays(
        state.currentLiters,
        state.capacityLiters,
        upcoming,
        state.litersPerGuestPerDay
      ),
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
