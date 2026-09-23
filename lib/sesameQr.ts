/**
 * Sesame アプリの「鍵をシェア」QR (ssm://UI?t=sk&sk=...&n=...) を読み取る。
 * 依存なしの純粋関数 (ブラウザ / サーバ / テストで共通)。
 *
 * sk は Base64URL。デコード後のバイト列:
 *   99バイト (Sesame 3/4/5 など):
 *     [0] 機種  [1..17) シークレットキー  [17..81) 公開鍵  [81..83) keyIndex  [83..99) UUID
 *   39バイト (Bot 2 / Bot 3 など OS3 の短い形式):
 *     [0] 機種  [1..17) シークレットキー  [17..21) 公開鍵  [21..23) keyIndex  [23..39) UUID
 *   16バイト: シークレットキーのみ (UUID は Sesame アプリの端末情報で確認して手入力)
 * 形式は公式非公開のため、UUID が取れない場合は手入力で補えるようにしている。
 */

export interface SesameQrResult {
  secretKey: string;          // 32桁 hex (小文字)
  deviceUuid: string | null;  // 8-4-4-4-12 (大文字) / 取れない形式なら null
  name: string | null;        // QR に入っている鍵の名前 (あれば)
  model: number | null;
  format: "99" | "39" | "16";
}

function b64urlToBytes(s: string): Uint8Array {
  // URLの「+」が空白に化けていても戻す
  let b = s.trim().replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  while (b.length % 4) b += "=";
  if (typeof atob === "function") {
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b, "base64"));
}

const hex = (u: Uint8Array) => Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");

export function formatUuid(v: string): string | null {
  const h = v.replace(/[^0-9a-f]/gi, "");
  if (h.length !== 32) return null;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
}

/** QR の文字列 (ssm://… または sk の値だけ) を解析。読めなければ null。 */
export function parseSesameQr(text: string): SesameQrResult | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  let sk: string | null = null;
  let name: string | null = null;
  const q = raw.indexOf("?");
  if (/^ssm:/i.test(raw) || q >= 0) {
    const params = raw.slice(q + 1).split("&");
    for (const p of params) {
      const i = p.indexOf("=");
      if (i < 0) continue;
      const k = p.slice(0, i);
      // "+" はBase64の文字として残す (decodeURIComponent は %xx のみ変換)
      let v = p.slice(i + 1);
      try { v = decodeURIComponent(v); } catch { /* keep */ }
      if (k === "sk") sk = v;
      if (k === "n") name = v || null;
    }
  } else {
    sk = raw;
  }
  if (!sk) return null;

  let bytes: Uint8Array;
  try { bytes = b64urlToBytes(sk); } catch { return null; }

  if (bytes.length >= 99) {
    return {
      model: bytes[0], secretKey: hex(bytes.slice(1, 17)),
      deviceUuid: formatUuid(hex(bytes.slice(83, 99))), name, format: "99",
    };
  }
  if (bytes.length >= 39) {
    return {
      model: bytes[0], secretKey: hex(bytes.slice(1, 17)),
      deviceUuid: formatUuid(hex(bytes.slice(23, 39))), name, format: "39",
    };
  }
  if (bytes.length === 16) {
    return { model: null, secretKey: hex(bytes), deviceUuid: null, name, format: "16" };
  }
  return null;
}
