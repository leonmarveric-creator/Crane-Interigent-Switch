"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

/** ゲストが自由に書いたひとことを承認 (お母さんの画面に流す)。zh = 中文訳 (任意) */
export async function approveCheer(id: string, zh: string): Promise<{ ok: boolean }> {
  requireAdmin();
  const { error } = await supabaseAdmin.from("guest_cheers")
    .update({ free_status: "approved", free_zh: String(zh ?? "").trim().slice(0, 300) || null, seen_at: null }).eq("id", id);
  revalidatePath("/admin");
  return { ok: !error };
}

/** 流さない */
export async function hideCheer(id: string): Promise<{ ok: boolean }> {
  requireAdmin();
  const { error } = await supabaseAdmin.from("guest_cheers").update({ free_status: "hidden" }).eq("id", id);
  revalidatePath("/admin");
  return { ok: !error };
}
