import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadDriverData } from "@/lib/driverData";
import { jstDay, jstTime } from "@/lib/driverLogic";
import { KS_BUCKET, KS_VALID_DAYS, cleanGifts, isKsToken, isUuid, ksExt, ksLinks, ksMissing, ksSettings, ksTypeOk, ksUpload, newKsToken, toInvite, toOrder } from "@/lib/keepsake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const ms = (s: string) => Date.parse(s);

/** GUEST BOARD (スタッフ): 滞在中のゲスト・招待・申し込み・見本・設定 をまとめて返す */
export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  // ?qr=<合言葉>: ゲストに読んでもらう QR (くじ・記念ページ)
  const qr = req.nextUrl.searchParams.get("qr");
  if (qr) return isKsToken(qr) ? J({ ok: true, qr: await QRCode.toDataURL(`${req.nextUrl.origin}/k/${qr}`, { margin: 2, width: 520, errorCorrectionLevel: "M" }) }) : J({ ok: false, error: "TOKEN" });
  const now = Date.now(), today = jstDay(now);
  const d = await loadDriverData(now);
  const room = new Map(d.cabin.rooms.map((r) => [r.id, r]));
  // チェックイン日が今日まで & まだチェックアウトから 6 時間たっていない予約
  const res = d.res.filter((r) => jstDay(r.checkIn) <= today && ms(r.checkOut) > now - 6 * 3600e3);
  const ids = res.map((r) => r.id);
  const [notesQ, alarmsQ, invQ] = await Promise.all([
    ids.length ? supabaseAdmin.from("reservations").select("id, note").in("id", ids) : Promise.resolve({ data: [] as any[], error: null }),
    ids.length ? supabaseAdmin.from("alarms").select("reservation_id, fire_at, wake_mode, is_enabled, triggered_at").in("reservation_id", ids).eq("is_enabled", true).gte("fire_at", new Date(now - 3600e3).toISOString()).order("fire_at") : Promise.resolve({ data: [] as any[], error: null }),
    supabaseAdmin.from("keepsake_invites").select("*").order("created_at", { ascending: false }).limit(300),
  ]);
  const setup = ksMissing((invQ as any).error);
  const note = new Map<string, string>((((notesQ as any).data ?? []) as any[]).map((x) => [x.id, String(x.note || "")]));
  const alarm = new Map<string, any>();
  for (const a of (((alarmsQ as any).data ?? []) as any[])) if (!a.triggered_at && !alarm.has(a.reservation_id)) alarm.set(a.reservation_id, a);
  const invites = setup ? [] : (((invQ as any).data ?? []) as any[]).map(toInvite);
  const invByRes = new Map(invites.map((i) => [i.resId, i]));
  const invById = new Map(invites.map((i) => [i.id, i]));
  const ordQ = setup ? { data: [] as any[] } : await supabaseAdmin.from("keepsake_orders").select("*").order("created_at", { ascending: false }).limit(200);
  const orders = (((ordQ as any).data ?? []) as any[]).map(toOrder);
  // ゲストの写真は、お渡しから 30 日たったら消す
  const old = orders.filter((o) => o.photoPath && o.deliveredAt && now - ms(o.deliveredAt) > KS_VALID_DAYS * 86400e3);
  if (old.length) {
    await supabaseAdmin.storage.from(KS_BUCKET).remove(old.map((o) => o.photoPath!)).catch(() => {});
    await supabaseAdmin.from("keepsake_orders").update({ photo_path: null }).in("id", old.map((o) => o.id));
    for (const o of old) o.photoPath = null;
  }
  const exQ = setup ? { data: [] as any[] } : await supabaseAdmin.from("keepsake_examples").select("*").order("sort").order("created_at");
  const exRows = (((exQ as any).data ?? []) as any[]);
  const links = await ksLinks([...orders.flatMap((o) => [o.photoPath || "", ...o.results.map((f) => f.path)]), ...exRows.flatMap((e) => [e.before_path, e.after_path])]);

  const guests = res.map((r) => {
    const drop = r.drop ?? null, rm = room.get(r.roomId);
    // 出発の時刻: 送迎の日 + 出発したい時刻 (日本時間)。無ければチェックアウト
    let depMs = ms(r.checkOut), depSet = false;
    if (drop?.date && drop.departAt) { const t = Date.parse(`${drop.date}T${drop.departAt.slice(0, 5)}:00+09:00`); if (!isNaN(t)) { depMs = t; depSet = true; } }
    const inv = invByRes.get(r.id) ?? null;
    const al = alarm.get(r.id);
    return {
      id: r.id, room: rm?.kanji ?? "", name: drop?.names?.[0] || r.guest || "Guest", lang: r.lang,
      checkIn: r.checkIn, checkOut: r.checkOut, today: jstDay(r.checkIn) === today, depMs, depSet,
      arr: { place: r.pickupPlace, at: r.pickupAt, none: r.pickupNone, flightNo: r.flightNo, status: r.flightInfo?.status ?? null, delay: r.flightInfo?.delayMin ?? null },
      dep: drop ? { dest: drop.dest, terminal: drop.terminal, date: drop.date, at: drop.departAt ? drop.departAt.slice(0, 5) : null, flightAt: drop.flightAt ? jstTime(drop.flightAt) : null, pax: drop.pax, L: drop.large, S: drop.small, sp: drop.special } : null,
      names: drop?.names ?? [], pax: drop?.pax ?? 0, dropId: drop?.id ?? null,
      alarm: al ? { at: al.fire_at, mode: al.wake_mode } : null, note: note.get(r.id) || "",
      invite: inv ? { token: inv.token, gifts: inv.gifts, status: inv.status, cardGiven: !!inv.cardGivenAt, orders: orders.filter((o) => o.inviteId === inv.id).map((o) => ({ kind: o.kind, status: o.status })) } : null,
    };
  }).sort((a, b) => a.depMs - b.depMs);

  return J({
    ok: true, setup, now, guests,
    orders: orders.map((o) => { const i = invById.get(o.inviteId); return { id: o.id, kind: o.kind, payload: o.payload, status: o.status, createdAt: o.createdAt, deliveredAt: o.deliveredAt, link: o.link, name: i?.name ?? "", room: i?.room ?? "", token: i?.token ?? "", photo: o.photoPath ? links[o.photoPath] ?? null : null, results: o.results.map((f) => ({ ...f, url: links[f.path] ?? null })) }; }),
    examples: exRows.map((e) => ({ id: e.id, caption: e.caption || "", before: links[e.before_path] ?? null, after: links[e.after_path] ?? null })),
    settings: await ksSettings(),
  });
}

export async function POST(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const ct = req.headers.get("content-type") || "";
  const fail = (e: any) => J({ ok: false, error: ksMissing(e) ? "SETUP" : String(e?.message || e) });

  /* ---- ファイルつき (見本の追加・完成品 4MB まで) ---- */
  if (ct.includes("multipart/form-data")) {
    const f = await req.formData().catch(() => null); if (!f) return J({ ok: false, error: "FORM" });
    const op = String(f.get("op") || "");
    if (op === "exAdd") {
      const b = f.get("before"), a = f.get("after");
      if (!(b instanceof Blob) || !(a instanceof Blob) || !/^image\//.test(b.type) || !/^image\//.test(a.type)) return J({ ok: false, error: "IMAGE" });
      const id = crypto.randomUUID();
      const bp = `examples/${id}-b.${ksExt(b.type)}`, ap = `examples/${id}-a.${ksExt(a.type)}`;
      const e1 = await ksUpload(bp, b, b.type), e2 = e1 ? null : await ksUpload(ap, a, a.type);
      if (e1 || e2) return J({ ok: false, error: /bucket/i.test(String(e1 || e2)) ? "SETUP" : e1 || e2 });
      const { count } = await supabaseAdmin.from("keepsake_examples").select("id", { count: "exact", head: true });
      const { error } = await supabaseAdmin.from("keepsake_examples").insert({ id, before_path: bp, after_path: ap, caption: String(f.get("caption") || "").slice(0, 80), sort: count ?? 0 });
      return error ? fail(error) : J({ ok: true });
    }
    if (op === "orderFile") {
      const id = String(f.get("id") || ""), file = f.get("file");
      if (!isUuid(id) || !(file instanceof Blob) || !ksTypeOk(file.type)) return J({ ok: false, error: "FILE" });
      const name = String((file as any).name || "file").slice(0, 80);
      const path = `orders/${id}/result-${Date.now()}.${ksExt(file.type, name)}`;
      const e = await ksUpload(path, file, file.type); if (e) return J({ ok: false, error: e });
      return addFile(id, { path, name, type: file.type });
    }
    return J({ ok: false, error: "OP" });
  }

  const b = await req.json().catch(() => ({}));
  /* ---- 招待 ---- */
  if (b.op === "invite" && isUuid(b.resId)) {
    const gifts = cleanGifts(b.gifts); if (!gifts.length) return J({ ok: false, error: "GIFTS" });
    const { data: ex, error: e0 } = await supabaseAdmin.from("keepsake_invites").select("*").eq("reservation_id", b.resId).maybeSingle();
    if (e0) return fail(e0);
    if (ex) {
      if (ex.status === "drawn") return J({ ok: false, error: "DRAWN" });
      const { error } = await supabaseAdmin.from("keepsake_invites").update({ gifts }).eq("id", ex.id);
      return error ? fail(error) : J({ ok: true, token: ex.token });
    }
    const { data: r } = await supabaseAdmin.from("reservations").select("id, check_out, guest_lang").eq("id", b.resId).maybeSingle();
    if (!r) return J({ ok: false, error: "RESERVATION" });
    const token = newKsToken();
    const { error } = await supabaseAdmin.from("keepsake_invites").insert({
      reservation_id: b.resId, token, gifts, guest_name: String(b.name || "").slice(0, 60) || null, lang: r.guest_lang ?? null, room_kanji: String(b.room || "").slice(0, 4) || null,
      expires_at: new Date(Math.max(Date.now(), Date.parse(r.check_out)) + KS_VALID_DAYS * 86400e3).toISOString(),
    });
    return error ? fail(error) : J({ ok: true, token });
  }
  if (b.op === "cancel" && isUuid(b.resId)) {
    const { data: ex } = await supabaseAdmin.from("keepsake_invites").select("id").eq("reservation_id", b.resId).maybeSingle();
    if (!ex) return J({ ok: true });
    const { count } = await supabaseAdmin.from("keepsake_orders").select("id", { count: "exact", head: true }).eq("invite_id", ex.id);
    if (count) return J({ ok: false, error: "HAS_ORDERS" });
    const { error } = await supabaseAdmin.from("keepsake_invites").delete().eq("id", ex.id);
    return error ? fail(error) : J({ ok: true });
  }
  if (b.op === "card" && isUuid(b.resId)) {
    const { error } = await supabaseAdmin.from("keepsake_invites").update({ card_given_at: b.given === false ? null : new Date().toISOString() }).eq("reservation_id", b.resId);
    return error ? fail(error) : J({ ok: true });
  }
  /* ---- 設定 (Cheers Around the World) ---- */
  if (b.op === "settings") {
    const { error } = await supabaseAdmin.from("keepsake_settings").upsert({ id: 1, cheers_on: b.cheersOn === true, cheers_price: String(b.cheersPrice || "").slice(0, 60), cheers_note: String(b.cheersNote || "").slice(0, 400) });
    return error ? fail(error) : J({ ok: true });
  }
  /* ---- 見本 ---- */
  if (b.op === "exCaption" && isUuid(b.id)) {
    const { error } = await supabaseAdmin.from("keepsake_examples").update({ caption: String(b.caption || "").slice(0, 80) }).eq("id", b.id);
    return error ? fail(error) : J({ ok: true });
  }
  if (b.op === "exMove" && isUuid(b.id)) {
    const { data, error } = await supabaseAdmin.from("keepsake_examples").select("id").order("sort").order("created_at");
    if (error) return fail(error);
    const list = (data ?? []).map((x: any) => x.id as string), i = list.indexOf(b.id), j = i + (b.dir === "up" ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return J({ ok: true });
    [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) await supabaseAdmin.from("keepsake_examples").update({ sort: k }).eq("id", list[k]);
    return J({ ok: true });
  }
  if (b.op === "exDelete" && isUuid(b.id)) {
    const { data } = await supabaseAdmin.from("keepsake_examples").select("before_path, after_path").eq("id", b.id).maybeSingle();
    const { error } = await supabaseAdmin.from("keepsake_examples").delete().eq("id", b.id);
    if (error) return fail(error);
    if (data) await supabaseAdmin.storage.from(KS_BUCKET).remove([data.before_path, data.after_path]).catch(() => {});
    return J({ ok: true });
  }
  /* ---- 申し込み: 完成品 ---- */
  if (b.op === "signUpload" && isUuid(b.id)) {
    const type = String(b.type || ""), name = String(b.name || "file").slice(0, 80);
    if (!ksTypeOk(type)) return J({ ok: false, error: "FILE" });
    const path = `orders/${b.id}/result-${Date.now()}.${ksExt(type, name)}`;
    const { data, error } = await supabaseAdmin.storage.from(KS_BUCKET).createSignedUploadUrl(path);
    return error || !data ? J({ ok: false, error: error?.message || "SIGN" }) : J({ ok: true, path, url: data.signedUrl });
  }
  if (b.op === "orderAddFile" && isUuid(b.id) && typeof b.path === "string" && b.path.startsWith(`orders/${b.id}/`)) return addFile(b.id, { path: b.path, name: String(b.name || "file").slice(0, 80), type: String(b.type || "") });
  if (b.op === "orderRemoveFile" && isUuid(b.id) && typeof b.path === "string") {
    const { data } = await supabaseAdmin.from("keepsake_orders").select("result_paths").eq("id", b.id).maybeSingle();
    const list = (Array.isArray(data?.result_paths) ? data!.result_paths : []).filter((x: any) => x?.path !== b.path);
    const { error } = await supabaseAdmin.from("keepsake_orders").update({ result_paths: list }).eq("id", b.id);
    if (!error && b.path.startsWith(`orders/${b.id}/`)) await supabaseAdmin.storage.from(KS_BUCKET).remove([b.path]).catch(() => {});
    return error ? fail(error) : J({ ok: true });
  }
  if (b.op === "orderDone" && isUuid(b.id)) {
    const done = b.done !== false;
    const link = typeof b.link === "string" && /^https:\/\//.test(b.link.trim()) ? b.link.trim().slice(0, 500) : null;
    const up: any = { status: done ? "done" : "new", delivered_at: done ? new Date().toISOString() : null };
    if ("link" in b) up.result_link = link;
    const { data, error } = await supabaseAdmin.from("keepsake_orders").update(up).eq("id", b.id).select("invite_id").maybeSingle();
    if (error) return fail(error);
    // お渡しから 30 日は見られるように、期限をのばす
    if (done && data?.invite_id) {
      const until = new Date(Date.now() + KS_VALID_DAYS * 86400e3).toISOString();
      await supabaseAdmin.from("keepsake_invites").update({ expires_at: until }).eq("id", data.invite_id).lt("expires_at", until);
    }
    return J({ ok: true });
  }
  return J({ ok: false, error: "OP" });
}

async function addFile(id: string, file: { path: string; name: string; type: string }) {
  const { data, error } = await supabaseAdmin.from("keepsake_orders").select("result_paths").eq("id", id).maybeSingle();
  if (error || !data) return J({ ok: false, error: error?.message || "ORDER" });
  const list = [...(Array.isArray(data.result_paths) ? data.result_paths : []), file];
  const u = await supabaseAdmin.from("keepsake_orders").update({ result_paths: list }).eq("id", id);
  return u.error ? J({ ok: false, error: u.error.message }) : J({ ok: true });
}
