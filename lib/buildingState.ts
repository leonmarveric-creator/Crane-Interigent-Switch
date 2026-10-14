/**
 * 管理画面「LIVE」: 建物の今の状態 (どの明かり・エアコンがついているか)。決まりごとだけ (画面は components/admin/LiveBuilding.tsx)。
 *   ① 操作の記録 (device_logs): このシステムから送った操作。SwitchBot への通信は増えない
 *   ③ SwitchBot からの知らせ (Webhook → device_state): 電球・プラグなどは、壁スイッチやアプリで変えた分も分かる
 *   どちらも、新しいほうを使う。エアコン・シーリングライト (赤外線リモコン) は ① だけ (状態を返せない機器)。
 *   空室なのについている → 「つけっぱなし」の注意。
 */
export type Part = "ceil" | "wa" | "ac" | "galaxy" | "nest";
export type AcMode = "cool" | "heat" | "on";
export interface PartState { on: boolean; at: number; src: "log" | "hook"; mode?: AcMode; source?: string }
export type Occ = "stay" | "soon" | "vacant";
export interface RoomLive {
  id: string; slug: string; name: string; holo: string | null; occ: Occ;
  parts: Partial<Record<Part, PartState>>;
  /** その部屋にある機器 (無いものは画面に出さない) */
  has: Part[];
  alert: boolean;
}

/** ① 操作 → それぞれの機器がどうなるか (lib/deviceControl.ts の場面と同じ。null = 変えない) */
const ON = true, OFF = false;
export const ACTION_EFFECT: Record<string, Partial<Record<Part, boolean>>> = {
  light_on: { ceil: ON }, light_off: { ceil: OFF },
  ac_on: { ac: ON }, ac_off: { ac: OFF }, ac_comfort: { ac: ON },
  wafu_on: { wa: ON }, wafu_off: { wa: OFF }, wafu_on_warm: { wa: ON }, wafu_mode: { wa: ON, ceil: OFF, galaxy: OFF, nest: OFF },
  wafu_prewake: { wa: ON }, wafu_wake_auto_off: { wa: OFF },
  galaxy_on: { galaxy: ON, ceil: OFF, nest: OFF, wa: OFF }, galaxy_off: { galaxy: OFF },
  nest_on: { nest: ON, ceil: OFF, galaxy: OFF, wa: OFF }, nest_off: { nest: OFF },
  welcome: { ac: ON, ceil: ON }, welcome_cozy: { ac: ON, wa: ON, ceil: OFF, galaxy: OFF, nest: OFF },
  normal: { ceil: ON, galaxy: OFF, nest: OFF, wa: OFF },
  dream_fade: { wa: ON, ceil: OFF, galaxy: OFF, nest: OFF },
  good_night: { ceil: OFF, galaxy: OFF, nest: OFF, wa: OFF },
  away: { ac: OFF, ceil: OFF, galaxy: OFF, nest: OFF, wa: OFF },
};
/** Dream Fade は 30 分で消える */
export const DREAM_FADE_MS = 31 * 60000;
/** 自動の明かり (宿泊中の部屋のつけっぱなし注意は出さない) */
export const PARTS: Part[] = ["ceil", "wa", "ac", "galaxy", "nest"];

const acModeAt = (ms: number): AcMode => { const mo = new Date(ms + 9 * 3600e3).getUTCMonth() + 1; return mo >= 5 && mo <= 10 ? "cool" : "heat"; };

/** ① 操作の記録 (新しい順でも古い順でもよい) から、機器ごとの最後の状態 */
export function fromLogs(logs: { action: string; created_at: string; source?: string | null; success?: boolean | null }[], now = Date.now()): Partial<Record<Part, PartState>> {
  const out: Partial<Record<Part, PartState>> = {};
  const list = logs.filter((l) => l.success !== false && ACTION_EFFECT[l.action]).map((l) => ({ ...l, t: Date.parse(l.created_at) })).filter((l) => Number.isFinite(l.t)).sort((a, b) => a.t - b.t);
  for (const l of list) {
    const eff = ACTION_EFFECT[l.action];
    for (const p of Object.keys(eff) as Part[]) {
      const st: PartState = { on: !!eff[p], at: l.t, src: "log", source: l.source ?? undefined };
      if (p === "ac" && st.on) st.mode = l.action === "ac_on" ? "on" : acModeAt(l.t);
      out[p] = st;
    }
  }
  // Dream Fade は 30 分たったら消えている
  const lastDream = list.filter((l) => l.action === "dream_fade").pop();
  if (lastDream && out.wa?.on && out.wa.at === lastDream.t && now - lastDream.t > DREAM_FADE_MS) out.wa = { on: false, at: lastDream.t + DREAM_FADE_MS, src: "log", source: "cron" };
  return out;
}

/** ③ SwitchBot の知らせ (device_state の行) で上書き (新しいときだけ) */
export function withHooks(parts: Partial<Record<Part, PartState>>, ids: Partial<Record<Part, string | null>>, hooks: { device_id: string; power: string | null; updated_at: string }[]): Partial<Record<Part, PartState>> {
  const out = { ...parts };
  const norm = (s: string) => s.replace(/[^0-9a-f]/gi, "").toUpperCase();
  for (const p of PARTS) {
    const id = ids[p]; if (!id || id.includes("-")) continue; // 赤外線リモコン (ハイフン入り) は知らせが来ない
    const h = hooks.find((x) => norm(x.device_id) === norm(id)); if (!h || !h.power) continue;
    const t = Date.parse(h.updated_at); if (!Number.isFinite(t)) continue;
    if (!out[p] || t >= out[p]!.at) out[p] = { on: /^on$/i.test(h.power), at: t, src: "hook" };
  }
  return out;
}

/** 宿泊の状態: いま滞在中 / 6 時間以内に到着 / 空室 */
export function occupancy(res: { check_in: string; check_out: string; status?: string | null; guest_checkout_at?: string | null }[], now = Date.now()): Occ {
  let soon = false;
  for (const r of res) {
    if (r.status && r.status !== "active") continue;
    const ci = Date.parse(r.check_in), co = Date.parse(r.check_out); if (!Number.isFinite(ci) || !Number.isFinite(co)) continue;
    const left = r.guest_checkout_at ? Date.parse(r.guest_checkout_at) : null;
    if (ci <= now && now < co && !(left && left <= now)) return "stay";
    if (ci > now && ci - now < 6 * 3600e3) soon = true;
  }
  return soon ? "soon" : "vacant";
}

/** 空室なのについている (到着予定の部屋はお迎えでエアコンをつけるので注意しない) */
export function needsAlert(occ: Occ, parts: Partial<Record<Part, PartState>>): boolean {
  return occ === "vacant" && PARTS.some((p) => parts[p]?.on);
}
