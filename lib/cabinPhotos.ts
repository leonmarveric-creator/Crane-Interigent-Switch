/** 車内 iPad の部屋の写真 (最初から入っている 4 枚)。ブラウザ・サーバ共通 */
export type Spot = [number, number] | null;
export interface CabinSpots { ac: Spot; lamp: Spot; wifi: Spot }

/** public/cabin/rooms/r1〜r4.webp と、写真の上のエアコン・照明・Wi-Fi の位置 (写真の左上からの %) */
export const BUILTIN_PHOTOS: Record<string, { src: string; spots: CabinSpots }> = {
  r1: { src: "/cabin/rooms/r1.webp", spots: { ac: [42, 23], lamp: [45, 50], wifi: [86, 46] } },
  r2: { src: "/cabin/rooms/r2.webp", spots: { ac: null, lamp: [20, 66], wifi: [72, 50] } },
  r3: { src: "/cabin/rooms/r3.webp", spots: { ac: [73, 15], lamp: [17, 60], wifi: [60, 43] } },
  r4: { src: "/cabin/rooms/r4.webp", spots: { ac: [48, 18], lamp: [66, 57], wifi: null } },
};
/** 部屋 → 最初の写真 (春=1枚目、夏=4枚目、秋=3枚目、冬=2枚目。設定から入れ替えられる) */
export const DEFAULT_PHOTO: [RegExp, string][] = [[/spring|haru/, "r1"], [/summer|natsu|natu/, "r4"], [/autumn|aki/, "r3"], [/winter|fuyu/, "r2"]];
