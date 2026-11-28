/**
 * WxPusher のお知らせの送り先 (サーバー専用)。管理画面 → ツール →「スマホへのお知らせ」で設定する。
 *   保存先: app_settings.wx_recipients (migration_notify.sql)。1 人ずつ: 名前・UID・言語・受け取るお知らせ
 *   まだ誰も登録していないときは、今までどおり環境変数 WXPUSHER_UIDS に送る
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NotifyTopic = "trip" | "tank" | "auto" | "key";
export const NOTIFY_TOPICS: NotifyTopic[] = ["trip", "tank", "auto", "key"];
export interface Recipient { name: string; uid: string; lang: "ja" | "zh"; topics: NotifyTopic[] }
export interface NotifySettings { recipients: Recipient[]; tripMin: number; missing: boolean }

const clean = (v: any): Recipient[] => (Array.isArray(v) ? v : []).map((r: any) => ({
  name: String(r?.name ?? "").slice(0, 40),
  uid: String(r?.uid ?? "").trim().slice(0, 80),
  lang: r?.lang === "zh" ? "zh" : "ja",
  topics: (Array.isArray(r?.topics) ? r.topics : []).filter((t: any) => NOTIFY_TOPICS.includes(t)),
})).filter((r) => /^UID_[A-Za-z0-9]+$/.test(r.uid)).slice(0, 20) as Recipient[];

let cache: { at: number; v: NotifySettings } | null = null;
export async function getNotifySettings(fresh = false): Promise<NotifySettings> {
  if (!fresh && cache && Date.now() - cache.at < 60e3) return cache.v;
  let v: NotifySettings = { recipients: [], tripMin: 30, missing: true };
  try {
    const { data, error } = await supabaseAdmin.from("app_settings").select("wx_recipients, wx_trip_min").eq("id", 1).maybeSingle();
    if (!error) { const d: any = data ?? {}; const m = Number(d.wx_trip_min); v = { recipients: clean(d.wx_recipients), tripMin: m >= 5 && m <= 180 ? m : 30, missing: false }; }
  } catch { /* 未設定 */ }
  cache = { at: Date.now(), v };
  return v;
}
export async function saveNotifySettings(recipients: Recipient[], tripMin: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from("app_settings").update({ wx_recipients: clean(recipients), wx_trip_min: Math.max(5, Math.min(180, Math.round(tripMin) || 30)) }).eq("id", 1);
  cache = null;
  return error ? { ok: false, error: /column|schema/i.test(error.message) ? "SETUP" : error.message } : { ok: true };
}
/** そのお知らせを受け取る人 (言語ごと)。null = 誰も登録していない (環境変数の送り先を使う) */
export async function recipientsFor(topic: NotifyTopic): Promise<Recipient[] | null> {
  const s = await getNotifySettings();
  if (!s.recipients.length) return null;
  return s.recipients.filter((r) => r.topics.includes(topic));
}

/** 同じお知らせを 2 回送らないための記録。初めてなら true (記録の表が無いときは false = 送らない) */
export async function claimNotify(key: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from("notify_log").insert({ key: key.slice(0, 200) });
    return !error;
  } catch { return false; }
}
export async function unclaimNotify(key: string) { try { await supabaseAdmin.from("notify_log").delete().eq("key", key.slice(0, 200)); } catch { /* */ } }
