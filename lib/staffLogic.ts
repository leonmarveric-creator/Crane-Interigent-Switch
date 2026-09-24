/**
 * スタッフ画面 (/staff) の純粋ロジック。DB・Next に依存しないのでテスト可能。
 *  - 部屋の状態 (滞在中 / 清掃待ち / 空室)
 *  - 早期チェックイン / レイトチェックアウトの妥当性チェック
 *  - 1週間の入れ替え予定
 *  - ゲストへの案内文
 */

export interface StaffRoom {
  id: string; slug: string; name: string; building: string;
  cleaned_at: string | null; has_lock: boolean;
  has_light?: boolean;        // 照明 / 和風ライトなど、ライト系の機器がある
}
export interface StaffRes {
  id: string;
  room_id: string;            // 実際に泊まる部屋 (客室割り当て済みならそちら)
  guest_name: string | null;
  lang: string;
  pin: string | null;
  status: string;             // active / completed (cancelled は含めない)
  check_in: string;           // Airbnb / 手動の元の時刻
  check_out: string;
  early_checkin_at: string | null;
  late_checkout_at: string | null;
}

export const effIn = (r: StaffRes) => r.early_checkin_at || r.check_in;
export const effOut = (r: StaffRes) => r.late_checkout_at || r.check_out;
const ms = (iso: string) => new Date(iso).getTime();

/* ---------------- 日本時間の日付ヘルパ ---------------- */
const JST = 9 * 3600e3;
/** ISO → 日本時間の "YYYY-MM-DD" */
export const jstDay = (iso: string | number) => new Date(new Date(iso).getTime() + JST).toISOString().slice(0, 10);
/** 日本時間の "YYYY-MM-DD" + "HH:MM" → ISO */
export const jstAt = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+09:00`).toISOString();
/** ISO → 日本時間の "HH:MM" */
export const jstTime = (iso: string) => new Date(ms(iso) + JST).toISOString().slice(11, 16);
/** "YYYY-MM-DD" に n 日足す */
export const addDays = (day: string, n: number) => new Date(ms(`${day}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/* ---------------- 部屋の状態 ---------------- */
export type RoomStatus = "staying" | "dirty" | "vacant";
export interface RoomState {
  status: RoomStatus;
  current: StaffRes | null;   // 今泊まっている予約
  lastOut: StaffRes | null;   // 直近に退室した予約
  next: StaffRes | null;      // 次に来る予約
  /** 清掃完了が押されず、チェックイン時刻が来たので自動で完了扱いにした時刻 */
  autoCleanedAt: string | null;
}

/** 標準のチェックイン時刻 (日本時間)。この時刻を過ぎたら清掃は自動で完了扱い。 */
export const AUTO_CLEAN_TIME = "15:00";

/**
 * 退室した部屋が「自動で清掃完了」になる時刻。
 *  - 退室した日の 15:00 (チェックイン時刻)
 *  - 次のゲストが早期チェックインでそれより早く来るなら、その時刻
 *  - レイトチェックアウトで 15:00 を過ぎて退室したなら、退室時刻
 */
export function autoCleanTime(lastOut: StaffRes, next: StaffRes | null): string {
  const out = ms(effOut(lastOut));
  let at = Math.max(ms(jstAt(jstDay(effOut(lastOut)), AUTO_CLEAN_TIME)), out);
  if (next && ms(effIn(next)) >= out && ms(effIn(next)) < at) at = ms(effIn(next));
  return new Date(at).toISOString();
}

/**
 * 🔵 staying … 今だれかが泊まっている (早期/レイト込み)
 * 🔴 dirty   … 退室後、まだ「清掃完了」が押されていない (チェックイン時刻までの間だけ)
 * ⚪ vacant  … それ以外 (清掃済み・空室・チェックイン時刻が来て自動で完了扱い)
 */
export function roomState(room: StaffRoom, all: StaffRes[], nowMs: number): RoomState {
  const mine = all.filter((r) => r.room_id === room.id);
  const current = mine.find((r) => ms(effIn(r)) <= nowMs && nowMs < ms(effOut(r))) ?? null;
  const past = mine.filter((r) => ms(effOut(r)) <= nowMs).sort((a, b) => ms(effOut(b)) - ms(effOut(a)));
  const lastOut = past[0] ?? null;
  const next = mine.filter((r) => ms(effIn(r)) > nowMs).sort((a, b) => ms(effIn(a)) - ms(effIn(b)))[0] ?? null;
  let status: RoomStatus = "vacant";
  let autoCleanedAt: string | null = null;
  if (current) status = "staying";
  else if (lastOut && (!room.cleaned_at || ms(room.cleaned_at) < ms(effOut(lastOut)))) {
    // 押し忘れても大丈夫: チェックイン時刻が来たら自動で完了扱い
    const nextAfterOut = mine.filter((r) => ms(effIn(r)) >= ms(effOut(lastOut)) && r.id !== lastOut.id)
      .sort((a, b) => ms(effIn(a)) - ms(effIn(b)))[0] ?? null;
    const auto = autoCleanTime(lastOut, nextAfterOut);
    if (nowMs >= ms(auto)) autoCleanedAt = auto;
    else status = "dirty";
  }
  return { status, current, lastOut, next, autoCleanedAt };
}

/** "3小時20分" などの残り時間 (分単位で返す)。 */
export const minutesUntil = (iso: string, nowMs: number) => Math.max(0, Math.round((ms(iso) - nowMs) / 60000));

/* ---------------- 早期チェックイン / レイトチェックアウト ---------------- */
export type ShiftError = "BAD_TIME" | "NOT_EARLIER" | "NOT_LATER" | "OVERLAP_PREV" | "OVERLAP_NEXT";

/**
 * 早期チェックイン時刻を決める。チェックイン日と同じ日の hh:mm。
 *  - 元のチェックインより前であること
 *  - 同じ部屋の前のゲストの (実際の) チェックアウトより後であること
 */
export function planEarlyCheckin(res: StaffRes, hhmm: string, all: StaffRes[]):
  { ok: true; at: string } | { ok: false; error: ShiftError; conflict?: StaffRes } {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return { ok: false, error: "BAD_TIME" };
  const at = jstAt(jstDay(res.check_in), hhmm);
  if (ms(at) >= ms(res.check_in)) return { ok: false, error: "NOT_EARLIER" };
  const prev = all
    .filter((r) => r.id !== res.id && r.room_id === res.room_id && ms(effIn(r)) < ms(res.check_in) && ms(effOut(r)) > ms(at))
    .sort((a, b) => ms(effOut(b)) - ms(effOut(a)))[0];
  if (prev) return { ok: false, error: "OVERLAP_PREV", conflict: prev };
  return { ok: true, at };
}

/**
 * レイトチェックアウト時刻を決める。チェックアウト日と同じ日の hh:mm。
 *  - 元のチェックアウトより後であること
 *  - 同じ部屋の次のゲストの (実際の) チェックインより前であること
 */
export function planLateCheckout(res: StaffRes, hhmm: string, all: StaffRes[]):
  { ok: true; at: string } | { ok: false; error: ShiftError; conflict?: StaffRes } {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return { ok: false, error: "BAD_TIME" };
  const at = jstAt(jstDay(res.check_out), hhmm);
  if (ms(at) <= ms(res.check_out)) return { ok: false, error: "NOT_LATER" };
  const next = all
    .filter((r) => r.id !== res.id && r.room_id === res.room_id && ms(effOut(r)) > ms(res.check_out) && ms(effIn(r)) < ms(at))
    .sort((a, b) => ms(effIn(a)) - ms(effIn(b)))[0];
  if (next) return { ok: false, error: "OVERLAP_NEXT", conflict: next };
  return { ok: true, at };
}

/* ---------------- 1週間の予定 ---------------- */
export interface DayRoomPlan { room: StaffRoom; out: StaffRes | null; in: StaffRes | null; turnover: boolean }
export interface DayPlan { day: string; rooms: DayRoomPlan[]; cleanings: number }

/** 日ごとに「退室 / 入室 / 入れ替え(清掃)」のある部屋を並べる。 */
export function weekPlan(rooms: StaffRoom[], all: StaffRes[], startDay: string, days = 7): DayPlan[] {
  const out: DayPlan[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(startDay, i);
    const list: DayRoomPlan[] = [];
    for (const room of rooms) {
      const mine = all.filter((r) => r.room_id === room.id);
      const o = mine.find((r) => jstDay(effOut(r)) === day) ?? null;
      const n = mine.find((r) => jstDay(effIn(r)) === day) ?? null;
      if (o || n) list.push({ room, out: o, in: n, turnover: !!o && !!n });
    }
    out.push({ day, rooms: list, cleanings: list.filter((x) => x.out).length });
  }
  return out;
}

/* ---------------- ゲストへの案内文 ---------------- */
export function guestMessage(p: {
  lang: string; guestName: string | null; roomName: string; checkIn: string; checkOut: string;
  early: boolean; late: boolean; pin: string | null; entranceUrl: string | null; roomUrl: string;
}): string {
  const inT = jstTime(p.checkIn), outT = jstTime(p.checkOut);
  const d = (iso: string) => { const x = jstDay(iso); return `${Number(x.slice(5, 7))}/${Number(x.slice(8, 10))}`; };
  const L = (p.lang || "en").toLowerCase();
  const name = p.guestName?.trim();
  const pinLine = (label: string) => (p.pin ? `${label}: ${p.pin}` : "");
  if (L.startsWith("ja")) {
    return [
      `${name ? `${name} 様\n` : ""}${p.early ? `本日は ${inT} からチェックインいただけます。` : `チェックインは ${d(p.checkIn)} ${inT} からです。`}`,
      p.late ? `チェックアウトは ${d(p.checkOut)} ${outT} までご利用いただけます。` : `チェックアウト: ${d(p.checkOut)} ${outT}`,
      "",
      `■ 建物の入口`,
      p.entranceUrl ? `QRを読み取るか、こちらを開いてください:\n${p.entranceUrl}\nお名前と、ご予約の電話番号の下4桁を入力 → ボタン長押しで解錠できます。` : "",
      "",
      `■ お部屋（${p.roomName}）`,
      `${p.roomUrl}`,
      pinLine("暗証番号（電話番号の下4桁）"),
    ].filter((x) => x !== "").join("\n");
  }
  if (L.startsWith("zh")) {
    return [
      `${name ? `${name} 您好：\n` : ""}${p.early ? `今天 ${inT} 起即可入住。` : `入住时间：${d(p.checkIn)} ${inT} 起。`}`,
      p.late ? `退房可延至 ${d(p.checkOut)} ${outT}。` : `退房时间：${d(p.checkOut)} ${outT}`,
      "",
      `■ 大楼入口`,
      p.entranceUrl ? `请扫描二维码或打开：\n${p.entranceUrl}\n输入姓名和预订时手机号码后4位 → 长按按钮即可开锁。` : "",
      "",
      `■ 房间（${p.roomName}）`,
      `${p.roomUrl}`,
      pinLine("密码（手机号码后4位）"),
    ].filter((x) => x !== "").join("\n");
  }
  if (L.startsWith("ko")) {
    return [
      `${name ? `${name} 님\n` : ""}${p.early ? `오늘 ${inT}부터 체크인하실 수 있습니다.` : `체크인: ${d(p.checkIn)} ${inT}부터`}`,
      p.late ? `체크아웃은 ${d(p.checkOut)} ${outT}까지 연장되었습니다.` : `체크아웃: ${d(p.checkOut)} ${outT}`,
      "",
      `■ 건물 입구`,
      p.entranceUrl ? `QR을 스캔하거나 아래 링크를 열어 주세요:\n${p.entranceUrl}\n이름과 예약 전화번호 뒤 4자리를 입력 → 버튼을 길게 눌러 잠금 해제.` : "",
      "",
      `■ 객실 (${p.roomName})`,
      `${p.roomUrl}`,
      pinLine("비밀번호 (전화번호 뒤 4자리)"),
    ].filter((x) => x !== "").join("\n");
  }
  return [
    `${name ? `Hi ${name},\n` : ""}${p.early ? `You can check in early today from ${inT}.` : `Check-in: from ${inT} on ${d(p.checkIn)}.`}`,
    p.late ? `Late check-out is confirmed until ${outT} on ${d(p.checkOut)}.` : `Check-out: ${outT} on ${d(p.checkOut)}`,
    "",
    `■ Building entrance`,
    p.entranceUrl ? `Scan the QR code or open:\n${p.entranceUrl}\nEnter your name and the last 4 digits of your booking phone number, then press and hold to unlock.` : "",
    "",
    `■ Your room (${p.roomName})`,
    `${p.roomUrl}`,
    pinLine("Code (last 4 digits of your phone)"),
  ].filter((x) => x !== "").join("\n");
}

/** 今日の清掃の進み具合: 今日チェックアウトする部屋のうち、退室後に清掃完了を押した数。 */
export function todayCleaning(rooms: StaffRoom[], all: StaffRes[], nowMs: number): { total: number; done: number } {
  const today = jstDay(nowMs);
  let total = 0, done = 0;
  for (const room of rooms) {
    const outs = all.filter((r) => r.room_id === room.id && jstDay(effOut(r)) === today);
    if (!outs.length) continue;
    total++;
    const lastOutRes = outs.sort((a, b) => ms(effOut(b)) - ms(effOut(a)))[0];
    const lastOut = ms(effOut(lastOutRes));
    const next = all.filter((r) => r.room_id === room.id && r.id !== lastOutRes.id && ms(effIn(r)) >= lastOut)
      .sort((a, b) => ms(effIn(a)) - ms(effIn(b)))[0] ?? null;
    if ((room.cleaned_at && ms(room.cleaned_at) >= lastOut) || nowMs >= ms(autoCleanTime(lastOutRes, next))) done++;
  }
  return { total, done };
}

/* ---------------- 部屋のアイコン ---------------- */
export interface RoomIcon { emoji: string; bg: string }
const ICONS: [RegExp, RoomIcon][] = [
  [/^(haru|spring)$|春/, { emoji: "🌸", bg: "#fde4ec" }],
  [/^(natu|natsu|summer)$|夏/, { emoji: "🌻", bg: "#fff1c2" }],
  [/^(aki|autumn|fall)$|秋/, { emoji: "🍁", bg: "#fde2cf" }],
  [/^(fuyu|winter)$|冬/, { emoji: "⛄", bg: "#e1efff" }],
  [/^(matsu|pine)$|松/, { emoji: "🌲", bg: "#dff3e4" }],
  [/^(take|bamboo)$|竹/, { emoji: "🎋", bg: "#e5f5dc" }],
  [/^(ume|plum)$|梅/, { emoji: "🌺", bg: "#fde0e6" }],
  [/^(hayashi|mori|forest)$|林|森/, { emoji: "🌳", bg: "#e2f1dc" }],
  [/^(ni|hasu|lotus)$|荷|蓮/, { emoji: "🪷", bg: "#fbe3f0" }],
  [/^(tsuru|crane)$|鶴/, { emoji: "🕊️", bg: "#eef1f7" }],
  [/^(art)$/, { emoji: "🎨", bg: "#f0e6fb" }],
  [/^(sakura)$|桜/, { emoji: "🌸", bg: "#fde4ec" }],
  [/^(umi|sea)$|海/, { emoji: "🌊", bg: "#dcefff" }],
  [/^(sora|sky)$|空/, { emoji: "☁️", bg: "#e6f2fb" }],
  [/^(tsuki|moon)$|月/, { emoji: "🌙", bg: "#efeafc" }],
  [/^(hoshi|star)$|星/, { emoji: "⭐", bg: "#fff4cc" }],
];
const FALLBACK: RoomIcon[] = [
  { emoji: "🏠", bg: "#f1ece2" }, { emoji: "🌼", bg: "#fff4cc" }, { emoji: "🍀", bg: "#e2f4e4" }, { emoji: "🐚", bg: "#fdebe4" },
  { emoji: "🎐", bg: "#e3f0fb" }, { emoji: "🍊", bg: "#ffe9d2" }, { emoji: "🫧", bg: "#e6f3f8" }, { emoji: "🌈", bg: "#f5ecfb" },
];
/** 部屋名 / slug からわかりやすいアイコンを決める (HARU → 🌸 など)。当てはまらなければ部屋ごとに固定の絵文字。 */
export function roomIcon(room: { slug: string; name: string }): RoomIcon {
  const tokens = `${room.slug} ${room.name}`.toLowerCase().split(/[^a-z0-9぀-ヿ㐀-鿿]+/).filter((x) => x && x !== "room");
  for (const [re, icon] of ICONS) if (tokens.some((tk) => re.test(tk))) return icon;
  let h = 0;
  for (const c of room.slug || room.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

/* ---------------- がんばり記録 ---------------- */
/** 今年の予約 (実際の入室・退室時刻)。サーバから軽い形で渡す。 */
export interface HistoryItem { in: string; out: string }
export interface Achievements {
  monthCleans: number; yearCleans: number;   // 退室済み = 清掃した部屋
  monthGuests: number; yearGuests: number;   // 入室済み = お迎えしたゲスト
  stampDays: number[];                        // 今月、清掃があった日 (1〜31)
  daysInMonth: number; firstWeekday: number;  // 今月のカレンダー用 (0=日)
}
export function achievements(history: HistoryItem[], nowMs: number): Achievements {
  const today = jstDay(nowMs), y = today.slice(0, 4), ym = today.slice(0, 7);
  let monthCleans = 0, yearCleans = 0, monthGuests = 0, yearGuests = 0;
  const stamps = new Set<number>();
  for (const h of history) {
    if (ms(h.out) <= nowMs) {
      const d = jstDay(h.out);
      if (d.startsWith(y)) yearCleans++;
      if (d.startsWith(ym)) { monthCleans++; stamps.add(Number(d.slice(8, 10))); }
    }
    if (ms(h.in) <= nowMs) {
      const d = jstDay(h.in);
      if (d.startsWith(y)) yearGuests++;
      if (d.startsWith(ym)) monthGuests++;
    }
  }
  const [yy, mm] = [Number(y), Number(today.slice(5, 7))];
  return {
    monthCleans, yearCleans, monthGuests, yearGuests,
    stampDays: Array.from(stamps).sort((a, b) => a - b),
    daysInMonth: new Date(Date.UTC(yy, mm, 0)).getUTCDate(),
    firstWeekday: new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay(),
  };
}

/* ---------------- お母さん用の部屋名 (漢字) ---------------- */
const KANJI: [RegExp, string][] = [
  [/^(haru|spring)$/, "春"], [/^(natu|natsu|summer)$/, "夏"], [/^(aki|autumn|fall)$/, "秋"], [/^(fuyu|winter)$/, "冬"],
  [/^(matsu|pine)$/, "松"], [/^(take|bamboo)$/, "竹"], [/^(ume|plum)$/, "梅"], [/^(hayashi|forest)$/, "林"], [/^mori$/, "森"],
  [/^(ni|hasu|lotus)$/, "荷"], [/^(tsuru|crane)$/, "鹤"], [/^sakura$/, "樱"], [/^(umi|sea)$/, "海"], [/^(sora|sky)$/, "空"],
  [/^(tsuki|moon)$/, "月"], [/^(hoshi|star)$/, "星"], [/^art$/, "艺"],
];
/**
 * スタッフ画面で使う部屋名。HARU → 春 のように漢字にする (ゲストへの案内文は元の名前のまま)。
 * すでに漢字の名前や、当てはまらない名前 (501 など) はそのまま。
 */
export function roomKanji(room: { slug: string; name: string }): string {
  if (/[㐀-鿿]/.test(room.name)) return room.name;
  const tokens = `${room.name} ${room.slug}`.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x && x !== "room");
  for (const [re, k] of KANJI) if (tokens.some((tk) => re.test(tk))) return k;
  return room.name;
}
