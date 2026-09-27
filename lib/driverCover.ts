/**
 * 車内の音楽: アルバムカバー。
 *   ・MP3 の中のカバー画像 (ID3 の APIC / PIC) を取り出す
 *   ・アップロード前にスマホの中で 800×800 の正方形に縮める (WebP。Safari など WebP を作れない端末は JPEG)
 *   元の大きい画像は保存しない。1 枚 60〜90KB ほど。
 */
export const COVER_SIZE = 800;

const syncsafe = (b: Uint8Array, i: number) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

/** ID3 タグ全体の長さ (タグがなければ 0)。先頭 10 バイトあれば分かる */
export function id3Size(head: Uint8Array): number {
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return 0; // "ID3"
  return 10 + syncsafe(head, 6) + (head[5] & 0x10 ? 10 : 0);
}

/** ID3 タグ (先頭から) の中のカバー画像を取り出す。なければ null */
export function extractId3Cover(b: Uint8Array): { mime: string; data: Uint8Array } | null {
  const size = id3Size(b); if (!size) return null;
  const ver = b[3]; const end = Math.min(size, b.length);
  let i = 10;
  if (b[5] & 0x40) i += ver === 4 ? syncsafe(b, 10) : be32(b, 10) + 4; // 拡張ヘッダー
  const skipText = (p: number, enc: number) => {
    if (enc === 1 || enc === 2) { while (p + 1 < end && !(b[p] === 0 && b[p + 1] === 0)) p += 2; return p + 2; }
    while (p < end && b[p] !== 0) p++; return p + 1;
  };
  while (i + (ver === 2 ? 6 : 10) <= end) {
    if (ver === 2) {
      const id = String.fromCharCode(b[i], b[i + 1], b[i + 2]); const len = (b[i + 3] << 16) | (b[i + 4] << 8) | b[i + 5];
      if (!/^[A-Z0-9]{3}$/.test(id) || !len) break;
      const s = i + 6;
      if (id === "PIC") {
        const enc = b[s]; const fmt = String.fromCharCode(b[s + 1], b[s + 2], b[s + 3]).toUpperCase();
        const p = skipText(s + 5, enc);
        return { mime: fmt === "PNG" ? "image/png" : "image/jpeg", data: b.slice(p, s + len) };
      }
      i = s + len; continue;
    }
    const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    const len = ver === 4 ? syncsafe(b, i + 4) : be32(b, i + 4);
    if (!/^[A-Z0-9]{4}$/.test(id) || !len) break;
    const s = i + 10;
    if (id === "APIC") {
      const enc = b[s]; let p = s + 1; let mime = "";
      while (p < end && b[p] !== 0) mime += String.fromCharCode(b[p++]);
      p += 1;          // mime の終わり
      p += 1;          // 画像の種類
      p = skipText(p, enc); // 説明
      const m = mime.toLowerCase();
      return { mime: m.includes("png") ? "image/png" : m.startsWith("image/") ? m : "image/jpeg", data: b.slice(p, s + len) };
    }
    i = s + len;
  }
  return null;
}

/** MP3 ファイルからカバー画像を取り出す (タグの部分だけ読む) */
export async function mp3Cover(file: Blob): Promise<Blob | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const size = id3Size(head); if (!size || size > 20 * 1024 * 1024) return null;
    const tag = new Uint8Array(await file.slice(0, size).arrayBuffer());
    const c = extractId3Cover(tag); if (!c || c.data.length < 100) return null;
    return new Blob([c.data as BlobPart], { type: c.mime });
  } catch { return null; }
}

/** 画像を 800×800 の正方形 (真ん中を切り抜き) に縮める。WebP → だめなら JPEG */
export async function compressCover(img: Blob): Promise<{ blob: Blob; ext: "webp" | "jpg" } | null> {
  try {
    let src: CanvasImageSource & { width: number; height: number };
    try { src = await createImageBitmap(img); }
    catch {
      const url = URL.createObjectURL(img);
      src = await new Promise<HTMLImageElement>((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = url; });
    }
    const w = src.width, h = src.height, side = Math.min(w, h); if (!side) return null;
    const out = Math.min(COVER_SIZE, side);
    const c = document.createElement("canvas"); c.width = out; c.height = out;
    const g = c.getContext("2d"); if (!g) return null;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
    const to = (type: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
    const webp = await to("image/webp", 0.8);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
    const jpg = await to("image/jpeg", 0.82);
    return jpg ? { blob: jpg, ext: "jpg" } : null;
  } catch { return null; }
}

/** 部屋の写真 (車内 iPad 用) を 4:3 に切り抜いて 横 1280px まで縮める。WebP → だめなら JPEG */
export async function compressRoomPhoto(img: Blob, maxW = 1280): Promise<{ blob: Blob; ext: "webp" | "jpg" } | null> {
  try {
    let src: CanvasImageSource & { width: number; height: number };
    try { src = await createImageBitmap(img); }
    catch {
      const url = URL.createObjectURL(img);
      src = await new Promise<HTMLImageElement>((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = url; });
    }
    const w = src.width, h = src.height; if (!w || !h) return null;
    // 4:3 に (はみ出す方を真ん中で切る)
    let sw = w, sh = Math.round((w * 3) / 4); if (sh > h) { sh = h; sw = Math.round((h * 4) / 3); }
    const ow = Math.min(maxW, sw), oh = Math.round((ow * 3) / 4);
    const c = document.createElement("canvas"); c.width = ow; c.height = oh;
    const g = c.getContext("2d"); if (!g) return null;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, ow, oh);
    const to = (type: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
    const webp = await to("image/webp", 0.76);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
    const jpg = await to("image/jpeg", 0.8);
    return jpg ? { blob: jpg, ext: "jpg" } : null;
  } catch { return null; }
}
