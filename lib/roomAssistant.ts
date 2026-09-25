/**
 * 部屋ごとの AI アシスタント (ハイテクUI の動画に描かれたキャラクター)。
 *   「あなたの名前は？」で名乗る (画面はフルネーム、声は下の名前だけ)。ASTRALIS は部屋全体のシステム、アシスタントはその部屋の案内役。
 *   ※ テストから直接読み込むので、このファイルは相対 import をしない。
 */
export type Season = "spring" | "summer" | "autumn" | "winter" | null;
export type RoomAssistant = { name: string; room: string; voice: string; season: Season };

const LIST: { match: RegExp; a: RoomAssistant }[] = [
  { match: /aki|autumn|秋/i, a: { name: "KUREHA AKARI", room: "AKI 秋", voice: "I am Akari, your room assistant.", season: "autumn" } },
  { match: /haru|spring|春/i, a: { name: "TURUNE SAKURA", room: "HARU 春", voice: "I am Sakura, your room assistant.", season: "spring" } },
  { match: /natu|natsu|summer|夏/i, a: { name: "HISUI MIO", room: "NATSU 夏", voice: "I am Mio, your room assistant.", season: "summer" } },
  { match: /fuyu|winter|冬/i, a: { name: "SETSUI GEKKA", room: "FUYU 冬", voice: "I am Gekka, your room assistant.", season: "winter" } },
  { match: /ume|梅/i, a: { name: "KOUBAI AYANO", room: "UME 梅", voice: "I am Ayano, your room assistant.", season: null } },
  { match: /take|竹/i, a: { name: "HARUKA SUGETSU", room: "TAKE 竹", voice: "I am Sugetsu, your room assistant.", season: null } },
  { match: /matsu|松/i, a: { name: "MATSUNO SEIRIN", room: "MATSU 松", voice: "I am Seirin, your room assistant.", season: null } },
  { match: /hayashi|林|forest/i, a: { name: "MORISAKI KOTOHA", room: "HAYASHI 林", voice: "I am Kotoha, your room assistant.", season: null } },
  { match: /(^|[-_\s])ni($|[-_\s])|hasu|lotus|荷|^he$/i, a: { name: "RENKA AYANO", room: "HE 荷", voice: "I am Ayano, your room assistant.", season: null } },
];

/** 部屋の slug / 表示名からアシスタントを探す。見つからなければ null (システム名 ASTRALIS で名乗る)。 */
export function roomAssistant(slug: string, roomName = ""): RoomAssistant | null {
  const keys = [slug.replace(/^room-/, ""), roomName];
  for (const k of keys) {
    for (const x of LIST) if (k && x.match.test(k)) return x.a;
  }
  return null;
}
