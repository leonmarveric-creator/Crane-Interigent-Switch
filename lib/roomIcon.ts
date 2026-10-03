/**
 * 部屋のイラスト (NFC / QR のゲスト用ガイド /g/[部屋] の左上)。
 *   ・最初から入っているもの: 春・夏・秋・冬 (public/nfc/rooms/)
 *   ・HIROSHI DRIVE の設定からアップロードすると、そちらが優先 (Storage driver-music の rooms/icon-<部屋 ID>-<時刻>.webp)。
 *     DB の列は使わない (SQL を足さなくてよいように)。アップロードしたものが無ければ最初の絵、それも無ければ漢字のまま
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "driver-music", DIR = "rooms";
export const BUILTIN_ICON: Record<string, string> = { "春": "/nfc/rooms/haru.webp", "夏": "/nfc/rooms/natsu.webp", "秋": "/nfc/rooms/aki.webp", "冬": "/nfc/rooms/fuyu.webp" };
export const iconPrefix = (roomId: string) => `icon-${roomId}-`;
export const isIconPath = (roomId: string, path: string) => path.startsWith(`${DIR}/${iconPrefix(roomId)}`) && /\.(webp|jpg)$/.test(path) && !path.includes("..");

/** アップロードしたイラスト (新しい順)。無ければ [] */
export async function uploadedIcons(roomId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).list(DIR, { search: iconPrefix(roomId), limit: 20 });
  return (data ?? []).map((f) => f.name).filter((n) => n.startsWith(iconPrefix(roomId))).sort().reverse().map((n) => `${DIR}/${n}`);
}
/** ガイドに出すイラストの URL と、アップロードしたものかどうか */
export async function roomIcon(roomId: string, kanji: string): Promise<{ url: string | null; custom: boolean }> {
  try {
    const up = await uploadedIcons(roomId);
    if (up.length) return { url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(up[0]).data.publicUrl, custom: true };
  } catch { /* 読めなければ最初の絵 */ }
  return { url: BUILTIN_ICON[kanji] ?? null, custom: false };
}
