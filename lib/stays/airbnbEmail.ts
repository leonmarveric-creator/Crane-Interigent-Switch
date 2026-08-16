// =========================================================
// Airbnb 予約メールの解析（純関数・サーバ/テスト両用）
//   件名＋本文から、便槽計算に必要な情報を抽出する:
//     - 予約番号（confirmation code）… キャンセルと突き合わせる一意キー
//     - 宿泊人数（大人＋子供）
//     - チェックイン / チェックアウト日
//     - ステータス（confirmed / cancelled）
//
//   日本語・英語の代表的なフォーマットに対応。Airbnbのテンプレートは
//   随時変わるため、実メールに合わせて正規表現を追記できるよう分割している。
//   （メールスキャン方式の宿命として、フォーマット変更時は要メンテ）
// =========================================================

export interface ParsedReservation {
  source: "airbnb";
  code: string; // 予約番号（一意キー）
  guests: number | null; // 抽出できなければ null
  checkIn: string | null; // YYYY-MM-DD
  checkOut: string | null; // YYYY-MM-DD
  status: "confirmed" | "cancelled";
}

// ---- ステータス判定（件名優先・堅牢版） ----
//   実際の受信箱には「予約リマインダー」「保留中」「RE:（メッセージ返信）」など
//   "予約" を含むが確定/キャンセルではないメールが多数混ざる。また確定メール本文には
//   「キャンセルポリシー」という語が入るため、本文で単純に "キャンセル" を探すと
//   確定を誤ってキャンセル扱いしてしまう。→ まず件名で判定し、本文は補助に留める。
function detectStatus(
  subject: string,
  body: string
): "confirmed" | "cancelled" | null {
  const s = subject || "";

  // 明確に無視すべき種別（件名で除外）: リマインダー / 保留 / メッセージ返信 / 入金・領収
  if (
    /reminder|リマインダー|保留|pending|on hold|new message|メッセージ|受信トレイ|payout|入金|送金|領収|receipt|review|レビュー|評価/i.test(
      s
    )
  ) {
    return null;
  }
  // 件名にRE:/FW: が付く返信・転送（ゲストとのやり取り）は予約イベントではない
  if (/^\s*(re|fw|fwd)\s*[:：]/i.test(s)) return null;

  // 件名でキャンセル / 確定を判定（Airbnbの件名は明確）
  if (/cancel|キャンセル|取消|取り消/i.test(s)) return "cancelled";
  if (/予約確定|予約が確定|reservation confirmed|booking confirmed|booked|instant book/i.test(s)) {
    return "confirmed";
  }

  // 件名で判定できない場合のみ本文を補助的に見る。
  //   キャンセルは「キャンセルされました/was cancelled」等の“実行済み”表現のみ採用し、
  //   「キャンセルポリシー」誤検出を避ける。
  const b = body || "";
  if (/キャンセルされ|ご予約はキャンセル|has been cancel|was cancel|reservation cancelled/i.test(b)) {
    return "cancelled";
  }
  if (/予約が確定|予約確定|reservation confirmed|booking confirmed/i.test(b)) {
    return "confirmed";
  }
  return null;
}

// ---- 予約番号 ----
//   ラベル付き（Confirmation code / 確認コード / 予約コード）を最優先。
//   なければ Airbnb コード風トークン（英数字9〜10桁, HM始まり等）をフォールバック。
function extractCode(text: string): string | null {
  // 1) ラベル付き（確定メール）: 「確認コード HMxxxx」
  const labeled =
    text.match(/(?:confirmation code|confirmation|確認コード|予約番号|予約コード)[\s:：#]*([A-Z0-9]{6,12})/i);
  if (labeled) return labeled[1].toUpperCase();
  // 2) ご予約（…）/ご予約(...)の括弧内（キャンセルメールのインライン表記）
  const paren = text.match(/(?:ご予約|予約|reservation)\s*[（(]\s*([A-Z0-9]{8,12})\s*[）)]/i);
  if (paren) return paren[1].toUpperCase();
  // 3) HM始まりのコード（Airbnb確認コードの慣例）
  const hm = text.match(/\b(HM[A-Z0-9]{6,10})\b/);
  if (hm) return hm[1].toUpperCase();
  // 4) 予約詳細URL内のコード（/reservation/details/HMxxxx や ?code=）
  const url =
    text.match(/reservation(?:s)?\/(?:details\/)?([A-Z0-9]{8,12})/i) ||
    text.match(/[?&]code=([A-Z0-9]{8,12})/i);
  if (url) return url[1].toUpperCase();
  return null;
}

// ---- 人数 ----
//   "3 guests" / "大人2名 子供1名" / "Guests: 2 adults, 1 child" などを合算。
//   英語は「数字→ラベル」(3 adults)、日本語は「ラベル→数字」(大人3) の両順に対応。
function matchCount(text: string, labels: string): number | null {
  // 数字が先（英語）例: "2 adults"。改行をまたいで手前の日付の数字を拾わないよう
  // 区切りはスペース/タブのみ・数文字に限定する。
  let m = text.match(new RegExp(`(\\d+)[ \\t]{0,3}(?:${labels})`, "i"));
  if (m) return parseInt(m[1], 10);
  // ラベルが先（日本語）例: "大人4名"
  m = text.match(new RegExp(`(?:${labels})[ \\t:：]{0,3}(\\d+)`, "i"));
  if (m) return parseInt(m[1], 10);
  return null;
}

function extractGuests(text: string): number | null {
  let total = 0;
  let found = false;

  const adults = matchCount(text, "adults?|大人"); // 大人
  if (adults !== null) { total += adults; found = true; }

  const kids = matchCount(text, "children|child|kids?|子供|子ども|こども"); // 子供
  if (kids !== null) { total += kids; found = true; }

  const infants = matchCount(text, "infants?|幼児|乳幼児"); // 幼児（安全側で含める）
  if (infants !== null) { total += infants; found = true; }

  if (found) return total;

  // 上記が無ければ総数表記。"3 guests" / "Guests: 3" / "3名" / "宿泊人数 3" の
  // 数字先・ラベル先の両順に対応（matchCountが両方を試す）。
  const g = matchCount(text, "guests?|名様?|人|宿泊(?:者|人数)?");
  if (g !== null) return g;

  return null;
}

// ---- 日付ユーティリティ ----
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 年が省略された場合の補完：today基準で、月が過去すぎるなら翌年扱い
function inferYear(month: number, day: number, today: Date): number {
  const y = today.getUTCFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day));
  // 4ヶ月以上過去なら翌年の予約とみなす
  const diffDays = (candidate.getTime() - today.getTime()) / 86400000;
  if (diffDays < -120) return y + 1;
  return y;
}

// 1つの日付文字列を YYYY-MM-DD に正規化（対応形式は複数）
export function parseDate(input: string, today: Date = new Date()): string | null {
  const s = input.trim();

  // 2026-07-25 / 2026/7/25
  let m = s.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  // 7月25日（年なし・日本語）
  m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const month = +m[1], day = +m[2];
    return `${inferYear(month, day, today)}-${pad(month)}-${pad(day)}`;
  }

  // Jul 25, 2026 / July 25 2026 / Jul 25
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = +m[2];
    const year = m[3] ? +m[3] : inferYear(month, day, today);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // 25 Jul 2026 / 25 July
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = +m[1];
    const year = m[3] ? +m[3] : inferYear(month, day, today);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return null;
}

// チェックイン/アウトの抽出。
//   ラベル付き（Check-in / チェックイン, Checkout / チェックアウト）を第一候補にするが、
//   実メールは表組みで「チェックイン チェックアウト（ラベル）→ 7月23日 7月30日（日付）」の
//   ように "ラベルがまとまってから日付がまとまる" 並びになることがある。この場合
//   「チェックアウト」ラベルの直後がチェックイン日になり、IN=OUT の0泊予約になってしまう。
//   → ラベル抽出は OUT>IN を満たすときだけ採用し、そうでなければ本文中の日付を
//     "出現順" に集め、最初をIN・その後でINより後の最初の日付をOUTとする。
function extractDates(
  text: string,
  today: Date
): { checkIn: string | null; checkOut: string | null } {
  const inLabel = text.match(/(?:check[\s-]?in|チェックイン|ご到着|到着日)[\s:：]*([^\n]{0,40})/i);
  const outLabel = text.match(/(?:check[\s-]?out|チェックアウト|ご出発|出発日)[\s:：]*([^\n]{0,40})/i);
  const labelIn = inLabel ? parseDate(inLabel[1], today) : null;
  const labelOut = outLabel ? parseDate(outLabel[1], today) : null;

  // ラベル抽出が妥当（OUT が IN より後）ならそれを採用
  if (labelIn && labelOut && labelOut > labelIn) {
    return { checkIn: labelIn, checkOut: labelOut };
  }

  // フォールバック: 本文中の日付を "出現順" に収集（重複も残す）
  const found: string[] = [];
  const re =
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s+\d{4})?)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text)) && found.length < 12) {
    const d = parseDate(mm[1], today);
    if (d) found.push(d);
  }

  // IN: ラベルのIN、無ければ最初に出た日付
  const checkIn = labelIn || found[0] || null;
  // OUT: INより後に出る最初の日付（出現順）。ラベルのOUTがINより後ならそれを優先。
  let checkOut: string | null = null;
  if (checkIn) checkOut = found.find((d) => d > checkIn) ?? null;
  if (labelOut && checkIn && labelOut > checkIn) checkOut = labelOut;

  return { checkIn, checkOut };
}

// ---- メイン ----
export function parseAirbnbEmail(
  subject: string,
  body: string,
  today: Date = new Date()
): ParsedReservation | null {
  const text = `${subject}\n${body}`;

  const status = detectStatus(subject, body);
  if (!status) return null; // 予約確定/キャンセル以外（リマインダー・保留・メッセージ等）は無視

  const code = extractCode(text);
  if (!code) return null; // 一意キーが無いと突き合わせできないため無視

  const guests = extractGuests(text);
  const { checkIn, checkOut } = extractDates(text, today);

  return { source: "airbnb", code, guests, checkIn, checkOut, status };
}
