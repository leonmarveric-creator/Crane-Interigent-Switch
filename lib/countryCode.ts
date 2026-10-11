/**
 * パスポート登録の「国籍」(自由な書き方) → 国コード (ISO 3166 の 2 文字)。
 *   "IT" / "ITA" / "Italy" / "Italian" / "イタリア" / "意大利" / "이탈리아" などを受け付ける。わからなければ null。
 */
import { CHEER_COUNTRIES } from "@/lib/cheerText";

/** 3 文字コード → 2 文字 (よく来る国と、パスポートでよく使われるもの) */
const A3: Record<string, string> = {
  JPN: "JP", CHN: "CN", TWN: "TW", HKG: "HK", MAC: "MO", KOR: "KR", THA: "TH", VNM: "VN", IDN: "ID", PHL: "PH", MYS: "MY", SGP: "SG", IND: "IN",
  KHM: "KH", MNG: "MN", NPL: "NP", LKA: "LK", BGD: "BD", PAK: "PK", KAZ: "KZ", GBR: "GB", IRL: "IE", FRA: "FR", BEL: "BE", DEU: "DE",
  AUT: "AT", CHE: "CH", ITA: "IT", ESP: "ES", PRT: "PT", NLD: "NL", SWE: "SE", NOR: "NO", DNK: "DK", FIN: "FI", POL: "PL", CZE: "CZ", HUN: "HU",
  GRC: "GR", ROU: "RO", UKR: "UA", RUS: "RU", USA: "US", CAN: "CA", MEX: "MX", BRA: "BR", ARG: "AR", CHL: "CL", COL: "CO", PER: "PE",
  AUS: "AU", NZL: "NZ", TUR: "TR", ARE: "AE", SAU: "SA", EGY: "EG", ISR: "IL", QAT: "QA", MAR: "MA", ZAF: "ZA", KEN: "KE", NGA: "NG",
};
/** 国籍の言い方 (英語の形容詞など) */
const DEMONYM: Record<string, string> = {
  japanese: "JP", chinese: "CN", taiwanese: "TW", "hong kong": "HK", hongkonger: "HK", macanese: "MO", korean: "KR", "south korean": "KR",
  thai: "TH", vietnamese: "VN", indonesian: "ID", filipino: "PH", philippine: "PH", malaysian: "MY", singaporean: "SG", indian: "IN",
  british: "GB", english: "GB", scottish: "GB", welsh: "GB", irish: "IE", french: "FR", belgian: "BE", german: "DE", austrian: "AT", swiss: "CH",
  italian: "IT", spanish: "ES", portuguese: "PT", dutch: "NL", swedish: "SE", norwegian: "NO", danish: "DK", finnish: "FI", polish: "PL",
  czech: "CZ", hungarian: "HU", greek: "GR", romanian: "RO", ukrainian: "UA", russian: "RU", american: "US", canadian: "CA", mexican: "MX",
  brazilian: "BR", argentine: "AR", argentinian: "AR", chilean: "CL", colombian: "CO", peruvian: "PE", australian: "AU", "new zealander": "NZ",
  turkish: "TR", emirati: "AE", saudi: "SA", egyptian: "EG", israeli: "IL", qatari: "QA", moroccan: "MA", "south african": "ZA", kenyan: "KE", nigerian: "NG",
  "united states": "US", usa: "US", "u.s.a.": "US", uk: "GB", "united kingdom": "GB", "great britain": "GB", "republic of korea": "KR", "korea, republic of": "KR",
  "taiwan, province of china": "TW", "hong kong sar": "HK", "people's republic of china": "CN", prc: "CN", "viet nam": "VN", "russian federation": "RU",
  中国大陆: "CN", 中國: "CN", 台灣: "TW", 香港特别行政区: "HK", 韩国: "KR", 韓国: "KR", 美国: "US", 英国: "GB",
};

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").replace(/[。．.]$/, "");
let NAMES: Map<string, string> | null = null;
/** 国名 (英語・日本語・中文・繁體・韓国語) → コード。Intl の国名表から作る */
function names(): Map<string, string> {
  if (NAMES) return NAMES;
  const m = new Map<string, string>();
  const codes = new Set<string>([...CHEER_COUNTRIES.map((c) => c[0]), ...Object.values(A3)]);
  // 英語・日本語・中文・韓国語と、それぞれの国の言葉 (Italia / Deutschland / España …)
  for (const loc of ["en", "ja", "zh-CN", "zh-TW", "ko", "es", "fr", "de", "it", "pt", "th", "vi", "id", "ru", "ar", "tr", "nl", "pl", "sv", "da", "nb", "fi", "cs", "hu", "el", "ro", "uk", "he", "ms", "fil"]) {
    let dn: Intl.DisplayNames | null = null;
    try { dn = new Intl.DisplayNames([loc], { type: "region" }); } catch { dn = null; }
    if (!dn) continue;
    for (const c of codes) { const n = dn.of(c); if (n && n !== c) m.set(norm(n), c); }
  }
  NAMES = m;
  return m;
}

/** 1 つの言葉だけで判定 (含まれているか、は見ない) */
function exact(seg: string): string | null {
  const s = norm(seg);
  if (!s) return null;
  const up = s.toUpperCase();
  if (/^[A-Z]{3}$/.test(up) && A3[up]) return A3[up];
  return DEMONYM[s] ?? names().get(s) ?? null;
}

/**
 * 住所から国を読む: 最後の部分から順に「国名だけ」の部分を探す
 *   例 "12 Via Roma, 00100 Rome, Italy" → IT / "東京都…" のように国名が無ければ null
 *   (途中の地名 "New Mexico" などを国と間違えないよう、まずは区切った 1 つずつで完全一致)
 */
export function countryFromAddress(addr: string): string | null {
  const segs = addr.split(/[,，、\n\r;／/|]+/).map((x) => x.trim()).filter(Boolean).reverse();
  for (const seg of segs) {
    const c = exact(seg) ?? exact(seg.replace(/[0-9\-\s]{3,}/g, " ").trim()); // 郵便番号まじり
    if (c) return c;
  }
  // 最後の部分に国名が含まれている (例 "Italia 00100")
  const last = norm(segs[0] ?? "");
  for (const [n, c] of names()) if (n.length >= 4 && last.includes(n)) return c;
  return null;
}

export function toCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("address:")) return countryFromAddress(raw.slice(8));
  const s = norm(String(raw));
  if (!s) return null;
  const up = s.toUpperCase();
  if (/^[A-Z]{2}$/.test(up)) return up === "UK" ? "GB" : up;
  if (/^[A-Z]{3}$/.test(up) && A3[up]) return A3[up];
  if (DEMONYM[s]) return DEMONYM[s];
  const byName = names().get(s);
  if (byName) return byName;
  // 「Italy (Italian)」「イタリア共和国」のような書き方: 国名が含まれていれば
  for (const [n, c] of names()) if (n.length >= 2 && s.includes(n)) return c;
  for (const [n, c] of Object.entries(DEMONYM)) if (n.length >= 4 && s.includes(n)) return c;
  return null;
}
