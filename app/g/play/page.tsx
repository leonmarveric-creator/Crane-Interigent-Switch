import NfcPlay from "@/components/nfc/NfcPlay";
import { roomGuideOf } from "@/lib/cabinAiTalk";

/** NFC ページの「ASTRAEA の声で聞く」: 車内 iPad と同じ説明 (写真・字幕・声) をスマホで流す。?k=toilet|lock&l=ja|en|zh|ko&r=部屋 */
export default function Page({ searchParams }: { searchParams: { k?: string; l?: string; r?: string } }) {
  // 鍵: 夏のお部屋はテンキー + つまみのガイド、春・秋・冬はつまみのガイド
  const k = searchParams.k === "ent" ? "ent" : searchParams.k === "lock" ? (roomGuideOf(searchParams.r) === "natsu" ? "room" : "lock") : "toilet";
  const l = ["ja", "en", "zh", "ko"].includes(searchParams.l || "") ? (searchParams.l as "ja" | "en" | "zh" | "ko") : "en";
  return <NfcPlay k={k} lang={l} back={searchParams.r ? `/g/${encodeURIComponent(searchParams.r)}?s=${k === "toilet" ? "wc" : k === "ent" ? "ent" : "key"}` : `/g/lounge?s=${k === "ent" ? "ent" : "wc"}`} />;
}
