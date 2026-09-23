"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { formatUuid } from "@/lib/sesameQr";

/**
 * Sesame 一覧（鍵の台帳）の登録・割り当て。
 * 割り当て時は UUID / シークレット / APIキーを rooms / entrances の既存列へコピーするので、
 * 解錠処理 (deviceControl / smartkey) は従来の列をそのまま使える。
 */

type Res = { ok: boolean; error?: string };

async function getLock(id: string) {
  const { data } = await supabaseAdmin.from("sesame_locks").select("*").eq("id", id).maybeSingle();
  return data;
}

const credsOf = (l: any) => ({
  sesame_device_uuid: l?.device_uuid ?? null,
  sesame_secret_key: l?.secret_key ?? null,
  sesame_api_key: l?.api_key || process.env.SESAME_API_KEY || null,
});

/** 鍵の情報が変わったら、割り当て先の部屋・エントランスにも反映。 */
async function propagate(lockId: string) {
  const l = await getLock(lockId);
  if (!l) return;
  await supabaseAdmin.from("rooms").update(credsOf(l)).eq("sesame_lock_id", lockId);
  await supabaseAdmin.from("entrances").update(credsOf(l)).eq("sesame_lock_id", lockId);
}

/** Sesame を追加 / 更新。シークレット・APIキーは空欄なら変更しない。 */
export async function saveSesameLock(formData: FormData): Promise<Res> {
  requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const uuidRaw = String(formData.get("device_uuid") || "").trim();
  const secret = String(formData.get("secret_key") || "").replace(/\s/g, "").toLowerCase();
  const apiKey = String(formData.get("api_key") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;

  if (!name) return { ok: false, error: "名前を入力してください" };
  const device_uuid = formatUuid(uuidRaw);
  if (!device_uuid) return { ok: false, error: "UUID の形式が正しくありません（32桁の英数字）" };
  if (secret && !/^[0-9a-f]{32}$/.test(secret)) return { ok: false, error: "シークレットキーは32桁の16進数です" };

  if (id) {
    const row: Record<string, unknown> = { name, device_uuid, note };
    if (secret) row.secret_key = secret;
    if (apiKey) row.api_key = apiKey;
    const { error } = await supabaseAdmin.from("sesame_locks").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "同じ UUID の Sesame が既に登録されています" : error.message };
    await propagate(id);
  } else {
    if (!secret) return { ok: false, error: "シークレットキーを入力してください" };
    // APIキー未入力なら、登録済みの鍵と同じキーを使う (アカウント共通のことが多い)
    let api_key: string | null = apiKey || null;
    if (!api_key) {
      const { data: other } = await supabaseAdmin
        .from("sesame_locks").select("api_key").not("api_key", "is", null).limit(1).maybeSingle();
      api_key = other?.api_key ?? null;
    }
    const { error } = await supabaseAdmin.from("sesame_locks").insert({ name, device_uuid, secret_key: secret, api_key, note });
    if (error) return { ok: false, error: error.code === "23505" ? "同じ UUID の Sesame が既に登録されています" : error.message };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** Sesame を一覧から削除 (どこにも割り当てられていない場合のみ)。 */
export async function deleteSesameLock(id: string): Promise<Res> {
  requireAdmin();
  const [{ count: r }, { count: e }] = await Promise.all([
    supabaseAdmin.from("rooms").select("id", { count: "exact", head: true }).eq("sesame_lock_id", id),
    supabaseAdmin.from("entrances").select("id", { count: "exact", head: true }).eq("sesame_lock_id", id),
  ]);
  if ((r ?? 0) + (e ?? 0) > 0) return { ok: false, error: "部屋かエントランスに割り当て中です。先に割り当てを外してください" };
  const { error } = await supabaseAdmin.from("sesame_locks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** 部屋に Sesame を割り当て (空なら外す)。 */
export async function assignRoomLock(formData: FormData): Promise<Res> {
  requireAdmin();
  const room_id = String(formData.get("room_id") || "");
  const lock_id = String(formData.get("lock_id") || "");
  if (!room_id) return { ok: false, error: "NO_ROOM" };
  if (lock_id === "__keep") return { ok: true };

  if (!lock_id) {
    await supabaseAdmin.from("rooms").update({
      sesame_lock_id: null, sesame_device_uuid: null, sesame_secret_key: null, sesame_api_key: null,
    }).eq("id", room_id);
  } else {
    const l = await getLock(lock_id);
    if (!l) return { ok: false, error: "Sesame が見つかりません" };
    const { error } = await supabaseAdmin.from("rooms").update({ sesame_lock_id: l.id, ...credsOf(l) }).eq("id", room_id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** エントランスに Sesame を割り当て (空なら外す)。 */
export async function assignEntranceLock(entranceId: string, lockId: string): Promise<Res> {
  requireAdmin();
  if (!entranceId || lockId === "__keep") return { ok: true };
  if (!lockId) {
    await supabaseAdmin.from("entrances").update({
      sesame_lock_id: null, sesame_device_uuid: null, sesame_secret_key: null, sesame_api_key: null,
    }).eq("id", entranceId);
  } else {
    const l = await getLock(lockId);
    if (!l) return { ok: false, error: "Sesame が見つかりません" };
    const { error } = await supabaseAdmin.from("entrances").update({ sesame_lock_id: l.id, ...credsOf(l) }).eq("id", entranceId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin");
  return { ok: true };
}
