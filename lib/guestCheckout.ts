/**
 * ゲストのチェックアウト (サーバー側)。
 *   お部屋の操作画面 (/room) とコンシェルジュ (/g) のどちらから押しても、ここで 1 つの記録にする。
 *   1) 同意の記録 (guest_checkouts) → 2) 予約に guest_checkout_at → 3) 起床アラームを止める → 4) 電源 OFF (外出と同じ) → 5) みんなの声
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeRoomRequest } from "@/lib/auth";
import { resolveGuestKey } from "@/lib/smartkey";
import { executeDeviceAction, logDevice } from "@/lib/deviceControl";
import { CO_T, CHECKOUT_POLICY_VERSION, checkoutWindow, coLang, plainText } from "@/lib/checkoutText";
import { isMissingColumn } from "@/lib/stayTimes";
import { saveCheer, type CheerInput } from "@/lib/guestCheers";

export interface CoReservation { id: string; check_out: string; guest_checkout_at?: string | null; guest_lang?: string | null }
export interface CoStay { room: any; reservation: CoReservation; via: "room" | "concierge" }

/** このスマホのゲストが、この部屋の予約の本人か (お部屋の PIN か、エントランス・コンシェルジュの 4 桁)。 */
export async function findCheckoutStay(roomSlug: string): Promise<CoStay | null> {
  const slug = decodeURIComponent(roomSlug || "").trim().toLowerCase();
  const stay = await authorizeRoomRequest(slug).catch(() => null);
  if (stay) return { room: stay.room, reservation: stay.reservation, via: "room" };

  const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!room) return null;
  const { data: ents } = await supabaseAdmin.from("entrances").select("slug, building").eq("is_active", true).order("slug")
    .then((r) => r, () => ({ data: null } as any));
  const list = (ents ?? []) as any[];
  const ent = list.find((e) => (e.building || "Crane Nest") === (room.building || "Crane Nest")) ?? list[0] ?? null;
  if (!ent) return null;
  const ctx = await resolveGuestKey(ent.slug).catch(() => null);
  if (!ctx?.reservation || !ctx.room || ctx.room.id !== room.id) return null;
  const r = ctx.reservation as any;
  const ok = ctx.state === "active" || (ctx.state === "expired" && !!r.guest_checkout_at);
  if (!ok) return null;
  return { room, reservation: { id: r.id, check_out: r.check_out, guest_checkout_at: r.guest_checkout_at ?? null, guest_lang: r.guest_lang ?? null }, via: "concierge" };
}

export type CheckoutResult =
  | { ok: true; at: string; already?: boolean; powerOk: boolean | null }
  | { ok: false; error: "NOT_YET" | "SQL_NEEDED" | "SAVE_FAILED" };

export async function performCheckout(
  s: CoStay,
  input: { lang?: unknown; items?: unknown; via?: unknown; cheer?: CheerInput | null; ua?: string | null; ip?: string | null },
  nowMs = Date.now(),
): Promise<CheckoutResult> {
  const r = s.reservation;
  if (r.guest_checkout_at) return { ok: true, at: r.guest_checkout_at, already: true, powerOk: null };
  if (!checkoutWindow(r.check_out, nowMs).open) return { ok: false, error: "NOT_YET" };

  const L = coLang(input.lang), t = CO_T[L];
  const items = Array.isArray(input.items)
    ? Array.from(new Set((input.items as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < t.items.length))).sort()
    : [];
  const via = input.via === "concierge" || input.via === "room" ? input.via : s.via;
  const at = new Date(nowMs).toISOString();

  // 1) 同意の記録 (先に残す)
  const ins = await supabaseAdmin.from("guest_checkouts").insert({
    reservation_id: r.id, room_id: s.room.id, checked_out_at: at, via, lang: L,
    items_total: t.items.length, items_checked: items, items_text: t.items.map((x) => x[1]),
    policy_version: CHECKOUT_POLICY_VERSION, policy_text: plainText(t.policy), agree_text: t.agree,
    user_agent: (input.ua ?? "").slice(0, 300) || null, ip: (input.ip ?? "").slice(0, 64) || null,
  });
  if (ins.error) {
    // 同じ予約で 2 回目 (別のスマホから同時に) → 済みとして扱う
    if ((ins.error as any).code === "23505") return { ok: true, at, already: true, powerOk: null };
    if ((ins.error as any).code === "42P01" || isMissingColumn(ins.error)) return { ok: false, error: "SQL_NEEDED" };
    console.error("guest_checkouts insert", ins.error);
    return { ok: false, error: "SAVE_FAILED" };
  }

  // 2) 予約に「チェックアウト済み」
  const up = await supabaseAdmin.from("reservations").update({ guest_checkout_at: at }).eq("id", r.id).is("guest_checkout_at", null);
  if (up.error) {
    console.error("reservations guest_checkout_at", up.error);
    return { ok: false, error: isMissingColumn(up.error) ? "SQL_NEEDED" : "SAVE_FAILED" };
  }

  // 3) まだ鳴っていない起床アラームは止める (退室後に灯りがつかないように)
  try { await supabaseAdmin.from("alarms").delete().eq("reservation_id", r.id).is("triggered_at", null); } catch { /* ignore */ }

  // 4) 電源 OFF (外出と同じ: エアコン + 照明 + ギャラクシー + NEST + 和風ライト)
  let powerOk: boolean | null = null, powerErr: string | null = null;
  try {
    const p = await executeDeviceAction(s.room, "away", `Checkout:${r.id.slice(0, 8)}`);
    powerOk = !!p.ok; powerErr = p.ok ? null : String(p.error ?? "FAILED");
  } catch (e) { powerOk = false; powerErr = String((e as Error)?.message ?? e).slice(0, 200); }
  await logDevice({ room_id: s.room.id, reservation_id: r.id, action: "checkout", source: "guest", success: powerOk === true });
  try { await supabaseAdmin.from("guest_checkouts").update({ power_ok: powerOk, power_error: powerErr }).eq("reservation_id", r.id); } catch { /* ignore */ }

  // 5) みんなの声 (お母さんの画面へ。選ばなかったゲストも「平安 踏上 旅途」として 1 件)
  await saveCheer(r.id, s.room.id ?? null, L, input.cheer ?? null);

  return { ok: true, at, powerOk };
}

/** 管理画面用: 予約 ID → チェックアウトの記録 (テーブルが無ければ空) */
export async function loadCheckoutRecords(reservationIds: string[]): Promise<Record<string, {
  at: string; via: string; lang: string; checked: number; total: number; powerOk: boolean | null; policy: string;
}>> {
  const out: Record<string, any> = {};
  if (!reservationIds.length) return out;
  try {
    const { data, error } = await supabaseAdmin.from("guest_checkouts")
      .select("reservation_id, checked_out_at, via, lang, items_checked, items_total, power_ok, policy_text")
      .in("reservation_id", reservationIds);
    if (error) return out;
    for (const x of (data ?? []) as any[]) {
      out[x.reservation_id] = {
        at: x.checked_out_at, via: x.via, lang: x.lang,
        checked: (x.items_checked ?? []).length, total: x.items_total ?? 0, powerOk: x.power_ok ?? null, policy: x.policy_text ?? "",
      };
    }
  } catch { /* ignore */ }
  return out;
}
