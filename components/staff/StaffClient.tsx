"use client";

// =========================================================
// スタッフ画面 (お母さん用) — 中文メイン / 日本語切替
//   今天: 部屋の状態 (🔴待清扫 / 🔵入住中 / ⚪空房) と清掃完了ボタン
//   预订: 提前入住 / 延迟退房 と ゲストへの案内文コピー
//   日历: 1週間の退房・入住・换房
//   记录: がんばり記録 (今月のスタンプ・今年の清掃数・バッジ)
//   工具: 暗証番号の一覧 (コピー・変更)、ゲストへの定型メッセージ、買い物リスト
// =========================================================
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, ClipboardList, CalendarDays, Sparkles, DoorOpen, Lock, Loader2, Check, Copy, Clock, LogOut,
  Sunrise, Sunset, Undo2, AlertTriangle, X, KeyRound, BedDouble, ArrowRight, Lightbulb, LightbulbOff, PowerOff, RefreshCw, Heart, Award, ScanFace, Trash2, NotebookPen, MessageCircle, Pencil, ShoppingCart, Share2, ListChecks, Plus, MoonStar, ChevronDown,
} from "lucide-react";
import {
  roomState, effIn, effOut, jstDay, jstTime, addDays, weekPlan, guestMessage, todayCleaning, roomIcon, roomKanji, achievements, linenPlan, DEFAULT_GUESTS,
  type StaffRoom, type StaffRes, type RoomStatus, type HistoryItem, type Achievements,
} from "@/lib/staffLogic";
import { setEarlyCheckin, setLateCheckout, markCleaned, undoCleaned, roomDoor, roomLights, roomAllOff, setRoomCode, setEntranceCode } from "@/app/staff/actions";
import { TEMPLATES, GUEST_LANGS, type GuestLang } from "@/lib/staffTemplates";
import { passkeySupported, hasPasskeyHere, registerPasskey, forgetPasskeyHere } from "@/lib/staffPasskeyClient";
import { dailyCheer, doneCheer, allDoneCheer, specialDay, badgeProgress, praiseCheer, BADGES } from "@/lib/staffCheer";

type Lang = "zh" | "ja";
export interface EntranceCode { id: string; name: string; building: string; code: string | null }
export interface StaffPasskey { id: string; device_name: string | null; created_at: string; last_used_at: string | null }
type Tab = "today" | "res" | "cal" | "rec" | "memo";

/* ---------------- 文言 ---------------- */
const S = {
  zh: {
    morning: "早上好", afternoon: "下午好", evening: "晚上好", hello: "Xiaobo",
    tabToday: "今天", tabRes: "预订", tabCal: "日历",
    dirty: "待清扫", staying: "入住中", vacant: "空房",
    todayPlan: "今天的安排", nothingToday: "今天没有退房和入住 🌿",
    checkout: "退房", checkin: "入住", out: "已退房",
    nextGuest: "下一位客人", arrives: "到达", left: "还有", h: "小时", m: "分",
    noNext: "近期没有客人", cleanDone: "清扫完成", confirmClean: "再按一次确认", confirmCleanSub: "会关空调、关灯，并锁门",
    cleanedAt: "已清扫", undo: "撤销", open: "开门", lock: "锁门", opened: "已开门", locked: "已锁门",
    devicePartial: "已记录清扫完成，但部分设备没有回应",
    early: "提前", late: "延迟", earlyIn: "提前入住", lateOut: "延迟退房", copyMsg: "复制给客人的消息", copied: "已复制！",
    restore: "恢复原来的时间", custom: "其他时间", save: "确定", cancel: "关闭",
    guestAirbnb: "Airbnb 客人", pin: "密码",
    errPrev: (who: string, t: string) => `上一位客人（${who}）${t} 才退房，不能早于这个时间`,
    errNext: (who: string, t: string) => `下一位客人（${who}）${t} 就要入住，不能晚于这个时间`,
    errEarlier: "请选比原来入住时间更早的时间", errLater: "请选比原来退房时间更晚的时间", errOther: "没有保存成功，请再试一次",
    notCleanWarn: "⚠ 这个房间还没清扫完",
    upcoming: "入住中和接下来 7 天", noRes: "没有预订",
    cleanings: (n: number) => `清扫 ${n} 间`, turnover: "换房", noPlan: "没有安排 🌿", today: "今天", tomorrow: "明天",
    setupMissing: "还需要在 Supabase 执行 migration_staff.sql（提前入住和清扫记录才会保存）",
    week: ["日", "一", "二", "三", "四", "五", "六"], weekPrefix: "星期",
    stayUntil: "住到", origTime: "原本",
    cheerTitle: "今天的一句话", another: "换一句",
    autoCleaned: (tm: string) => `${tm} 已自动标记为清扫完成（忘了按也没关系哦）`,
    autoNote: "忘了按也没关系，到了入住时间会自动完成 🌸",
    progress: "今天的清扫", progressOf: (d: number, n: number) => `${d} / ${n} 间`, noCleaningToday: "今天没有要清扫的房间，好好休息吧 🌿",
    lightOn: "开灯", lightOff: "关灯", lightOnDone: "灯已打开", lightOffDone: "灯已关掉",
    allOff: "全部关闭并锁门", allOffConfirm: "再按一次确认", allOffSub: "空调、灯全部关掉，并锁门", allOffDone: "已全部关闭 ✓",
    tabRec: "记录", monthDone: (n: number) => `这个月已经清扫了 ${n} 间 🌸`,
    recTitle: "Xiaobo 的努力记录", recMonth: "这个月", recYear: "今年", rooms: "间", guests: "位客人",
    cleaned: "清扫", welcomed: "迎接", stampTitle: (m: number) => `${m}月的小花印章`, stampNote: "有清扫的日子会开一朵花 🌸",
    badgeTitle: "我的徽章", nextBadge: (e: string, n: number) => `再清扫 ${n} 间，就能拿到 ${e}`, allBadges: "所有徽章都拿到了！太厉害了 👑",
    thanksTitle: "来自家人的话", thanks: "每一位客人舒服的一晚，都是你的功劳。谢谢你，Xiaobo ❤️",
    pkTitle: "用 Face ID 登录", pkPrompt: "设置以后，下次打开不用输入密码，看一下手机就能登录 😊", pkSetup: "现在设置", pkLater: "以后再说",
    pkDone: "设置好了！下次可以用 Face ID 登录 ✓", pkFail: "没有设置成功，请再试一次", pkMissing: "还需要在 Supabase 执行 migration_staff_passkeys.sql",
    pkList: "已设置的手机", pkNone: "还没有设置", pkHere: "在这台手机上设置", pkDelete: "删除", pkDeleteConfirm: "再按一次删除", pkLast: "上次使用",
    pkNote: "脸和指纹的数据只保存在手机里，不会上传。手机丢了的话，在这里删除就好。",
    tabMemo: "工具", bigText: "大字",
    checklist: "清扫清单", checkAllDone: "全部检查完了！可以按「清扫完成」了 ✨",
    linenTitle: "明天要准备的床品和毛巾", linenFor: (r: number, g: number) => `入住 ${r} 间・共 ${g} 人`, linenUnit: "件",
    linenPeople: (n: number) => `${n} 人`, linenEst: "（大约）", linenEstNote: (n: number) => `“大约”是不知道人数的预订，先按 ${n} 人计算`,
    tomorrowPlan: "明天的安排", tomorrowNone: "明天没有退房和入住，可以休息一下 🌿", tmrClean: (n: number) => `清扫 ${n} 间`, tmrIn: (n: number) => `入住 ${n} 位`, tmrFirst: (tm: string) => `最早 ${tm} 退房`,
    eveningTitle: "今天辛苦了 🌙", eveningBody: (c: number, g: number) => `今天完成了 ${c} 间清扫，迎接了 ${g} 位客人。好好休息吧！`, eveningNone: "今天也谢谢你。晚上好好休息吧！",
    tapHint: "点一下照片 💕",
    newBadge: "拿到新徽章了！", newBadgeBody: (n: number) => `今年已经清扫了 ${n} 间，太厉害了！`, great: "太好了！",
    shopTitle: "需要买的东西", shopPh: "其他东西…", add: "添加", shopEmpty: "现在没有要买的东西 👍", shopSend: "发给家人", shopSent: "已复制，可以粘贴发送",
    shopMsg: (items: string) => `【需要买的东西】\n${items}`, clearBought: "删除已买的",
    codesTitle: "密码一览", codesHint: "点「复制」就能粘贴发给客人", codesEntrance: "大门", codesRooms: "房间", codeNone: "未设置", codeEdit: "修改",
    codeSave: "保存", codeCancel: "取消", codeSaved: "已保存 ✓", codesMissing: "还需要在 Supabase 执行 migration_room_codes.sql（才能保存房间密码）", codeNote: "修改大门密码后，客人钥匙页面上的密码也会一起改变",
    tplTitle: "发给客人的消息", tplHint: "选客人的语言，点「复制」再粘贴到 Airbnb 或 LINE", tplLang: "客人的语言", copy: "复制", send: "发送", copiedShort: "已复制",
    weather: "今天的天气", tip: (code: number, max: number, min: number, rain: number) => weatherTip("zh", code, max, min, rain),
  },
  ja: {
    morning: "おはようございます", afternoon: "こんにちは", evening: "こんばんは", hello: "Xiaobo さん",
    tabToday: "今日", tabRes: "予約", tabCal: "カレンダー",
    dirty: "清掃待ち", staying: "滞在中", vacant: "空室",
    todayPlan: "今日の予定", nothingToday: "今日のチェックアウト・チェックインはありません 🌿",
    checkout: "退室", checkin: "入室", out: "退室済み",
    nextGuest: "次のゲスト", arrives: "到着", left: "あと", h: "時間", m: "分",
    noNext: "しばらく予約なし", cleanDone: "清掃完了", confirmClean: "もう一度押して確定", confirmCleanSub: "エアコン・照明をOFFにして施錠します",
    cleanedAt: "清掃済み", undo: "取り消す", open: "鍵を開ける", lock: "鍵を閉める", opened: "開けました", locked: "閉めました",
    devicePartial: "清掃完了は記録しましたが、一部の機器が応答しませんでした",
    early: "早期", late: "レイト", earlyIn: "早期チェックイン", lateOut: "レイトチェックアウト", copyMsg: "ゲストへの案内文をコピー", copied: "コピーしました！",
    restore: "元の時間に戻す", custom: "その他の時間", save: "決定", cancel: "閉じる",
    guestAirbnb: "Airbnb のゲスト", pin: "暗証番号",
    errPrev: (who: string, t: string) => `前のゲスト（${who}）が ${t} まで滞在するため、それより前にはできません`,
    errNext: (who: string, t: string) => `次のゲスト（${who}）が ${t} に入室するため、それより後にはできません`,
    errEarlier: "元のチェックインより早い時間を選んでください", errLater: "元のチェックアウトより遅い時間を選んでください", errOther: "保存できませんでした。もう一度お試しください",
    notCleanWarn: "⚠ この部屋はまだ清掃が終わっていません",
    upcoming: "滞在中と、これから7日間", noRes: "予約はありません",
    cleanings: (n: number) => `清掃 ${n} 部屋`, turnover: "入れ替え", noPlan: "予定なし 🌿", today: "今日", tomorrow: "明日",
    setupMissing: "Supabase で migration_staff.sql の実行が必要です（早期チェックインと清掃記録を保存するため）",
    week: ["日", "月", "火", "水", "木", "金", "土"], weekPrefix: "",
    stayUntil: "滞在", origTime: "元",
    cheerTitle: "今日のひとこと", another: "ほかの言葉",
    autoCleaned: (tm: string) => `${tm} に自動で清掃完了にしました（押し忘れても大丈夫）`,
    autoNote: "押し忘れても大丈夫。チェックイン時間になると自動で完了になります 🌸",
    progress: "今日の清掃", progressOf: (d: number, n: number) => `${d} / ${n} 部屋`, noCleaningToday: "今日は清掃の部屋はありません。ゆっくり休んでね 🌿",
    lightOn: "電気をつける", lightOff: "電気を消す", lightOnDone: "電気をつけました", lightOffDone: "電気を消しました",
    allOff: "すべてOFF＋施錠", allOffConfirm: "もう一度押して確定", allOffSub: "エアコン・照明をすべてOFFにして施錠します", allOffDone: "すべてOFFにしました ✓",
    tabRec: "記録", monthDone: (n: number) => `今月はもう ${n} 部屋きれいにしました 🌸`,
    recTitle: "Xiaobo さんのがんばり記録", recMonth: "今月", recYear: "今年", rooms: "部屋", guests: "組",
    cleaned: "清掃", welcomed: "お迎え", stampTitle: (m: number) => `${m}月のお花スタンプ`, stampNote: "清掃した日にお花が咲きます 🌸",
    badgeTitle: "バッジ", nextBadge: (e: string, n: number) => `あと ${n} 部屋で ${e} がもらえます`, allBadges: "バッジぜんぶ集まりました！すごい 👑",
    thanksTitle: "家族から", thanks: "ゲストの気持ちいい一晩は、ぜんぶあなたのおかげ。ありがとう、Xiaobo さん ❤️",
    pkTitle: "Face ID でログイン", pkPrompt: "設定すると、次からパスワードを入れずに、スマホを見るだけでログインできます 😊", pkSetup: "今すぐ設定", pkLater: "あとで",
    pkDone: "設定できました！次から Face ID でログインできます ✓", pkFail: "設定できませんでした。もう一度お試しください", pkMissing: "Supabase で migration_staff_passkeys.sql の実行が必要です",
    pkList: "設定したスマホ", pkNone: "まだ設定していません", pkHere: "このスマホで設定する", pkDelete: "削除", pkDeleteConfirm: "もう一度押して削除", pkLast: "最後に使用",
    pkNote: "顔や指紋のデータはスマホの中だけに保存され、送られません。スマホをなくしたときは、ここで削除してください。",
    tabMemo: "べんり", bigText: "大きい字",
    checklist: "清掃チェックリスト", checkAllDone: "ぜんぶチェックできました！「清掃完了」を押してね ✨",
    linenTitle: "明日そろえるリネン・タオル", linenFor: (r: number, g: number) => `入室 ${r} 部屋・合計 ${g} 人`, linenUnit: "枚",
    linenPeople: (n: number) => `${n}人`, linenEst: "（目安）", linenEstNote: (n: number) => `「目安」は人数が分からない予約です。${n}人で計算しています`,
    tomorrowPlan: "明日の予定", tomorrowNone: "明日はチェックアウトもチェックインもありません。ゆっくりしてね 🌿", tmrClean: (n: number) => `清掃 ${n} 部屋`, tmrIn: (n: number) => `入室 ${n} 組`, tmrFirst: (tm: string) => `最初の退室 ${tm}`,
    eveningTitle: "今日もおつかれさま 🌙", eveningBody: (c: number, g: number) => `今日は ${c} 部屋をきれいにして、${g} 組のゲストをお迎えしました。ゆっくり休んでね！`, eveningNone: "今日もありがとう。夜はゆっくり休んでね！",
    tapHint: "写真をタップ 💕",
    newBadge: "新しいバッジをもらいました！", newBadgeBody: (n: number) => `今年はもう ${n} 部屋きれいにしました。すごい！`, great: "やったね！",
    shopTitle: "買うものリスト", shopPh: "ほかのもの…", add: "追加", shopEmpty: "いま買うものはありません 👍", shopSend: "家族に送る", shopSent: "コピーしました。貼り付けて送ってね",
    shopMsg: (items: string) => `【買うものリスト】\n${items}`, clearBought: "買ったものを消す",
    codesTitle: "暗証番号の一覧", codesHint: "「コピー」を押して、ゲストへのメッセージに貼り付け", codesEntrance: "エントランス", codesRooms: "お部屋", codeNone: "未設定", codeEdit: "変更",
    codeSave: "保存", codeCancel: "やめる", codeSaved: "保存しました ✓", codesMissing: "Supabase で migration_room_codes.sql の実行が必要です（お部屋の番号を保存するため）", codeNote: "エントランスの番号を変えると、ゲストの鍵画面に出る番号も変わります",
    tplTitle: "ゲストへのメッセージ", tplHint: "ゲストの言語を選んで「コピー」→ Airbnb や LINE に貼り付け", tplLang: "ゲストの言語", copy: "コピー", send: "送る", copiedShort: "コピー済み",
    weather: "今日の天気", tip: (code: number, max: number, min: number, rain: number) => weatherTip("ja", code, max, min, rain),
  },
};
type ST = (typeof S)["zh"];

const STATUS_STYLE: Record<RoomStatus, { dot: string; chip: string; border: string; emoji: string }> = {
  dirty: { dot: "bg-[#e0564b]", chip: "bg-[#fde8e5] text-[#b8372d]", border: "border-l-[#e0564b]", emoji: "🔴" },
  staying: { dot: "bg-[#3b7dd8]", chip: "bg-[#e3eefc] text-[#23609f]", border: "border-l-[#3b7dd8]", emoji: "🔵" },
  vacant: { dot: "bg-[#c9bfae]", chip: "bg-[#f1ece2] text-[#7a6d5c]", border: "border-l-[#d8cfbf]", emoji: "⚪" },
};

const card = "rounded-3xl bg-white shadow-[0_10px_30px_-20px_rgba(59,50,40,0.45)]";

export default function StaffClient({
  rooms, reservations, baseUrl, entranceUrlByBuilding, setupMissing, history = [], geo = null, passkeys = null, entranceCodes = [], roomCodes = null,
}: {
  rooms: StaffRoom[]; reservations: StaffRes[]; baseUrl: string;
  entranceUrlByBuilding: Record<string, string>; setupMissing: boolean;
  history?: HistoryItem[]; geo?: { lat: number; lng: number } | null;
  /** 登録済みの Face ID / 指紋。null = テーブル未作成 */
  passkeys?: StaffPasskey[] | null;
  /** エントランスの暗証番号 */
  entranceCodes?: EntranceCode[];
  /** お部屋の暗証番号 (room.id → 番号)。null = migration_room_codes.sql 未実行 */
  roomCodes?: Record<string, string | null> | null;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("zh");
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(() => Date.now());
  const t = S[lang];

  useEffect(() => {
    try { const v = localStorage.getItem("staffLang"); if (v === "ja" || v === "zh") setLang(v); } catch { /* noop */ }
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const refresh = setInterval(() => router.refresh(), 120_000); // 2分ごとに最新へ
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, [router]);
  const changeLang = (l: Lang) => { setLang(l); try { localStorage.setItem("staffLang", l); } catch { /* noop */ } };

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const states = useMemo(() => rooms.map((room) => ({ room, st: roomState(room, reservations, now) })), [rooms, reservations, now]);
  const ach = useMemo(() => achievements(history, now), [history, now]);

  // 大きい字モード (端末ごとに記憶)
  const [big, setBig] = useState(false);
  useEffect(() => { try { setBig(localStorage.getItem("staffBig") === "1"); } catch { /* noop */ } }, []);
  const toggleBig = () => setBig((v) => { try { localStorage.setItem("staffBig", v ? "0" : "1"); } catch { /* noop */ } return !v; });

  const logout = async () => { await fetch("/api/staff/logout", { method: "POST" }).catch(() => null); location.href = "/staff/login"; };

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#f6efe2] pb-28 text-[17px] text-[#3b3228] [color-scheme:light]">
      <Header t={t} lang={lang} now={now} onLang={changeLang} onLogout={logout} big={big} onBig={toggleBig} />
      {setupMissing && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-2xl bg-[#fff3d6] p-3 text-sm text-[#7a5a12]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t.setupMissing}
        </p>
      )}
      <div className="px-4" style={big ? { zoom: 1.15 } : undefined}>
        {tab === "today" && <TodayTab t={t} lang={lang} rooms={rooms} states={states} reservations={reservations} roomById={roomById} now={now} ach={ach} geo={geo} pkReady={passkeys !== null} />}
        {tab === "res" && (
          <ResTab t={t} reservations={reservations} roomById={roomById} states={states} now={now}
            baseUrl={baseUrl} entranceUrlByBuilding={entranceUrlByBuilding} />
        )}
        {tab === "cal" && <CalTab t={t} rooms={rooms} reservations={reservations} now={now} />}
        {tab === "rec" && <RecTab t={t} lang={lang} ach={ach} now={now} passkeys={passkeys} />}
        {tab === "memo" && <MemoTab t={t} lang={lang} rooms={rooms} entranceCodes={entranceCodes} roomCodes={roomCodes} />}
      </div>
      <BadgeCelebration t={t} lang={lang} count={ach.yearCleans} />
      <BottomNav t={t} tab={tab} setTab={(x) => { setTab(x); window.scrollTo(0, 0); }} />
    </div>
  );
}

/* ---------------- ヘッダ (イラスト + あいさつ) ---------------- */
function Header({ t, lang, now, onLang, onLogout, big, onBig }: {
  t: ST; lang: Lang; now: number; onLang: (l: Lang) => void; onLogout: () => void; big: boolean; onBig: () => void;
}) {
  // 写真をタップすると、ハートがふわっと出てほめ言葉
  const [pat, setPat] = useState<{ k: number; text: string } | null>(null);
  const patMe = () => { setPat({ k: Date.now(), text: praiseCheer(lang) }); vibrate([15, 40, 15]); };
  const hour = Number(jstTime(new Date(now).toISOString()).slice(0, 2));
  const greet = hour < 12 ? t.morning : hour < 18 ? t.afternoon : t.evening;
  const day = jstDay(now);
  const wd = new Date(`${day}T00:00:00+09:00`).getUTCDay();
  const dateText = lang === "zh"
    ? `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日 ${t.weekPrefix}${t.week[(wd + 1) % 7]}`
    : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日（${t.week[(wd + 1) % 7]}）`;
  return (
    <header className="relative h-56 overflow-hidden rounded-b-[36px] shadow-[0_18px_40px_-26px_rgba(59,50,40,0.7)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/staff/xiaobo.jpg" alt="" onClick={patMe} className="absolute inset-0 h-full w-full cursor-pointer object-cover object-[50%_28%]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#3b3228]/75 via-[#3b3228]/10 to-transparent" />
      {pat && <Hearts key={pat.k} />}
      {pat && (
        <p key={`t${pat.k}`} className="pointer-events-none absolute inset-x-6 top-[38%] z-10 animate-[staffPop_2.6s_ease-out_forwards] rounded-2xl bg-white/90 px-4 py-2 text-center text-base font-bold text-[#b0662f] shadow-lg">
          {pat.text}
        </p>
      )}
      <div className="absolute right-3 top-3 flex gap-2">
        <button onClick={onBig} aria-pressed={big} aria-label={t.bigText}
          className={`rounded-full px-3 py-1.5 text-sm font-bold shadow backdrop-blur ${big ? "bg-[#3b7dd8] text-white" : "bg-white/85 text-[#3b3228]"}`}>
          A<span className="text-base">A</span>
        </button>
        <div className="flex overflow-hidden rounded-full bg-white/85 text-sm font-semibold shadow backdrop-blur">
          {(["zh", "ja"] as Lang[]).map((l) => (
            <button key={l} onClick={() => onLang(l)} className={`px-3 py-1.5 ${lang === l ? "bg-[#3b7dd8] text-white" : "text-[#3b3228]"}`}>
              {l === "zh" ? "中文" : "日本語"}
            </button>
          ))}
        </div>
        <button onClick={onLogout} aria-label="logout" className="rounded-full bg-white/85 p-2 text-[#3b3228] shadow backdrop-blur">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-base font-medium opacity-90">{dateText}（{jstTime(new Date(now).toISOString())}）</p>
        <h1 className="text-[28px] font-bold leading-tight drop-shadow">{greet}，{t.hello} ☀️</h1>
        <p className="mt-0.5 text-xs opacity-75">{t.tapHint}</p>
      </div>
    </header>
  );
}

/* ---------------- 今天 ---------------- */
function TodayTab({ t, lang, rooms, states, reservations, roomById, now, ach, geo, pkReady }: {
  t: ST; lang: Lang; rooms: StaffRoom[]; states: { room: StaffRoom; st: ReturnType<typeof roomState> }[]; reservations: StaffRes[];
  roomById: Map<string, StaffRoom>; now: number; ach: Achievements; geo: { lat: number; lng: number } | null; pkReady: boolean;
}) {
  const count = (s: RoomStatus) => states.filter((x) => x.st.status === s).length;
  const order: Record<RoomStatus, number> = { dirty: 0, staying: 1, vacant: 2 };
  const sorted = [...states].sort((a, b) => order[a.st.status] - order[b.st.status]);
  const buildings = Array.from(new Set(sorted.map((x) => x.room.building)));

  // 今日の退房・入住 (時間順)
  const today = jstDay(now);
  const events = reservations.flatMap((r) => {
    const ev: { at: string; kind: "out" | "in"; r: StaffRes }[] = [];
    if (jstDay(effOut(r)) === today) ev.push({ at: effOut(r), kind: "out", r });
    if (jstDay(effIn(r)) === today) ev.push({ at: effIn(r), kind: "in", r });
    return ev;
  }).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const prog = todayCleaning(rooms, reservations, now);
  return (
    <div className="space-y-5 pt-5">
      <SpecialBanner lang={lang} now={now} />
      <CheerCard t={t} lang={lang} now={now} />
      {pkReady && <PasskeyPrompt t={t} />}
      {geo && <WeatherCard t={t} geo={geo} />}
      <EveningCard t={t} now={now} prog={prog} guests={events.filter((e) => e.kind === "in" && new Date(e.at).getTime() <= now).length} />
      <ProgressCard t={t} lang={lang} prog={prog} now={now} monthCleans={ach.monthCleans} />
      <div className="grid grid-cols-3 gap-2">
        {(["dirty", "staying", "vacant"] as RoomStatus[]).map((s) => (
          <div key={s} className={`${card} flex flex-col items-center py-3`}>
            <span className="text-2xl">{STATUS_STYLE[s].emoji}</span>
            <span className="mt-0.5 text-[28px] font-bold leading-none">{count(s)}</span>
            <span className="mt-1 text-sm text-[#7a6d5c]">{t[s]}</span>
          </div>
        ))}
      </div>

      <section className={`${card} p-4`}>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Clock className="h-5 w-5 text-[#3b7dd8]" /> {t.todayPlan}</h2>
        {events.length === 0 ? <p className="py-2 text-[#7a6d5c]">{t.nothingToday}</p> : (
          <ul className="divide-y divide-[#f1ece2]">
            {events.map((e, i) => {
              const room = roomById.get(e.r.room_id);
              const shifted = e.kind === "in" ? !!e.r.early_checkin_at : !!e.r.late_checkout_at;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="w-14 text-lg font-bold tabular-nums">{jstTime(e.at)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${e.kind === "out" ? "bg-[#fde8e5] text-[#b8372d]" : "bg-[#e3eefc] text-[#23609f]"}`}>
                    {e.kind === "out" ? t.checkout : t.checkin}
                  </span>
                  {room && <RoomBubble room={room} size="sm" />}
                  <span className="min-w-0 flex-1 truncate font-semibold">{room ? <RoomName room={room} /> : "—"}
                    <span className="ml-1.5 text-sm font-normal text-[#7a6d5c]">{e.r.guest_name ?? ""}</span>
                  </span>
                  {shifted && <span className="rounded-full bg-[#f5c542] px-2 py-0.5 text-xs font-bold text-[#5a4300]">{e.kind === "in" ? t.early : t.late}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {buildings.map((b) => (
        <section key={b} className="space-y-3">
          {buildings.length > 1 && <h2 className="px-1 text-base font-bold text-[#7a6d5c]">{b}</h2>}
          {sorted.filter((x) => x.room.building === b).map(({ room, st }) => (
            <RoomCard key={room.id} t={t} lang={lang} room={room} st={st} now={now} />
          ))}
        </section>
      ))}

      <TomorrowCard t={t} lang={lang} rooms={rooms} reservations={reservations} roomById={roomById} now={now} />
    </div>
  );
}

function vibrate(p: number[]) { try { navigator.vibrate?.(p); } catch { /* noop */ } }

/* 今日のひとこと (日付で毎日変わる。「换一句」でほかの言葉) */
function CheerCard({ t, lang, now }: { t: ST; lang: Lang; now: number }) {
  const [offset, setOffset] = useState(0);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff4d6] via-[#ffeede] to-[#fde3e8] p-4 shadow-[0_10px_30px_-20px_rgba(59,50,40,0.45)]">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-[#b0662f]"><Heart className="h-4 w-4 fill-[#f08b7a] text-[#f08b7a]" /> {t.cheerTitle}</p>
        <button onClick={() => setOffset((o) => o + 1)} className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-[#7a6d5c]">
          <RefreshCw className="h-3.5 w-3.5" /> {t.another}
        </button>
      </div>
      <p className="mt-2 text-[19px] font-bold leading-relaxed text-[#4a3b2c]">{dailyCheer(jstDay(now), lang, offset)}</p>
    </section>
  );
}

/* 今日の清掃の進み具合 (全部終わったらお祝い) */
function ProgressCard({ t, lang, prog, now, monthCleans }: { t: ST; lang: Lang; prog: { total: number; done: number }; now: number; monthCleans: number }) {
  const month = monthCleans > 0 && <p className="mt-2 text-center text-sm font-semibold text-[#b0662f]">{t.monthDone(monthCleans)}</p>;
  if (prog.total === 0) return <div className={`${card} p-4 text-center text-[#7a6d5c]`}><p>{t.noCleaningToday}</p>{month}</div>;
  const all = prog.done >= prog.total;
  const pct = Math.round((prog.done / prog.total) * 100);
  return (
    <section className={`${card} p-4 ${all ? "bg-gradient-to-br from-[#e6f7ec] to-[#fff6d9]" : ""}`}>
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-1.5 text-lg font-bold"><Sparkles className="h-5 w-5 text-[#2f8a57]" /> {t.progress}</p>
        <p className="text-xl font-bold tabular-nums text-[#2f8a57]">{t.progressOf(prog.done, prog.total)}</p>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#efe7d8]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7ccf9a] to-[#2f8a57] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xl">
        {Array.from({ length: prog.total }).map((_, i) => <span key={i}>{i < prog.done ? "🌸" : "🤍"}</span>)}
      </div>
      {all && <p className="mt-3 text-center text-lg font-bold text-[#2f8a57]">{allDoneCheer(lang, jstDay(now))}</p>}
      {month}
    </section>
  );
}

function RoomCard({ t, lang, room, st, now }: { t: ST; lang: Lang; room: StaffRoom; st: ReturnType<typeof roomState>; now: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [party, setParty] = useState(0);
  const style = STATUS_STYLE[st.status];
  const next = st.next;
  // プレッシャーをかけないよう「あと○時間」のカウントダウンは出さない (到着時刻だけ)
  const cleanedToday = room.cleaned_at && jstDay(room.cleaned_at) === jstDay(now);

  const clean = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    setArmed(false); setBusy("clean"); setMsg(null);
    const r = await markCleaned(room.id).catch(() => ({ ok: false, error: "ERR" }));
    setBusy(null);
    if (!r.ok) setMsg({ ok: false, text: t.errOther });
    else if (r.error === "DEVICE_PARTIAL") setMsg({ ok: false, text: t.devicePartial });
    else { setMsg({ ok: true, text: doneCheer(lang) }); vibrate([30, 60, 30, 60, 90]); setParty(Date.now()); }
    router.refresh();
  };
  const door = async (a: "unlock" | "lock") => {
    setBusy(a); setMsg(null);
    const r = await roomDoor(room.id, a).catch(() => ({ ok: false }));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: a === "unlock" ? t.opened : t.locked } : { ok: false, text: t.errOther });
  };
  const lights = async (on: boolean) => {
    setBusy(on ? "lon" : "loff"); setMsg(null);
    const r = await roomLights(room.id, on).catch(() => ({ ok: false }));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: on ? t.lightOnDone : t.lightOffDone } : { ok: false, text: t.errOther });
  };
  const [armedOff, setArmedOff] = useState(false);
  const allOff = async () => {
    if (!armedOff) { setArmedOff(true); setTimeout(() => setArmedOff(false), 5000); return; }
    setArmedOff(false); setBusy("alloff"); setMsg(null);
    const r = await roomAllOff(room.id).catch(() => ({ ok: false, error: "ERR" }));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: t.allOffDone } : { ok: false, text: r.error === "DEVICE_PARTIAL" ? t.devicePartial : t.errOther });
  };
  const undo = async () => { setBusy("undo"); await undoCleaned(room.id).catch(() => null); setBusy(null); router.refresh(); };

  return (
    <div className={`${card} relative border-l-[10px] ${style.border} p-4`}>
      {party > 0 && <Petals key={party} />}
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2.5 text-[24px] font-bold tracking-wide">
          <RoomBubble room={room} /> <span className="truncate"><RoomName room={room} big /></span>
        </h3>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-bold ${style.chip}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /> {t[st.status]}
        </span>
      </div>

      <div className="mt-2 space-y-1.5 text-[16px]">
        {st.status === "staying" && st.current && (
          <p className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-[#3b7dd8]" />
            <span className="font-semibold">{st.current.guest_name ?? t.guestAirbnb}</span>
            <span className="text-[#7a6d5c]">· {t.checkout} {fmtDay(t, effOut(st.current), now)} {jstTime(effOut(st.current))}</span>
            {st.current.late_checkout_at && <Badge>{t.late}</Badge>}
          </p>
        )}
        {st.status === "dirty" && st.lastOut && (
          <p className="text-[#7a6d5c]">{jstTime(effOut(st.lastOut))} {t.out}{st.lastOut.guest_name ? `（${st.lastOut.guest_name}）` : ""}</p>
        )}
        {st.status === "vacant" && st.autoCleanedAt && jstDay(st.autoCleanedAt) === jstDay(now) && !cleanedToday && (
          <p className="flex items-center gap-1.5 text-[#2f8a57]"><Check className="h-5 w-5" /> {t.autoCleaned(jstTime(st.autoCleanedAt))}</p>
        )}
        {st.status === "vacant" && cleanedToday && (
          <p className="flex items-center gap-1.5 font-semibold text-[#2f8a57]"><Check className="h-5 w-5" /> {t.cleanedAt} {jstTime(room.cleaned_at!)}
            <button onClick={undo} disabled={!!busy} className="ml-2 flex items-center gap-1 text-sm font-normal text-[#7a6d5c] underline">
              <Undo2 className="h-3.5 w-3.5" /> {t.undo}
            </button>
          </p>
        )}
        {next ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ArrowRight className="h-5 w-5 shrink-0" />
            {t.nextGuest} {fmtDay(t, effIn(next), now)} {jstTime(effIn(next))} {t.arrives}
            {next.early_checkin_at && <Badge big>{t.early} {jstTime(next.early_checkin_at)}</Badge>}
          </p>
        ) : st.status !== "staying" && <p className="text-[#a2968a]">{t.noNext}</p>}
      </div>

      {st.status !== "staying" && (
        <div className="mt-4 space-y-2">
          {st.status === "dirty" && (
            <button onClick={clean} disabled={!!busy}
              className={`flex w-full flex-col items-center justify-center rounded-2xl py-4 text-white shadow-md transition active:scale-[0.99] disabled:opacity-60
                ${armed ? "bg-[#e0564b]" : "bg-[#2f8a57]"}`}>
              <span className="flex items-center gap-2 text-xl font-bold">
                {busy === "clean" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                {armed ? t.confirmClean : t.cleanDone}
              </span>
              {armed && <span className="mt-0.5 text-sm opacity-90">{t.confirmCleanSub}</span>}
            </button>
          )}
          {st.status === "dirty" && <p className="text-center text-sm text-[#8a7d6c]">{t.autoNote}</p>}
          {st.status === "dirty" && <CleanChecklist t={t} lang={lang} roomId={room.id} day={jstDay(now)} />}
          {st.status === "vacant" && (
            <button onClick={allOff} disabled={!!busy}
              className={`flex w-full flex-col items-center justify-center rounded-2xl py-3 text-white shadow transition active:scale-[0.99] disabled:opacity-60
                ${armedOff ? "bg-[#e0564b]" : "bg-[#6b5f52]"}`}>
              <span className="flex items-center gap-2 text-lg font-bold">
                {busy === "alloff" ? <Loader2 className="h-5 w-5 animate-spin" /> : <PowerOff className="h-5 w-5" />}
                {armedOff ? t.allOffConfirm : t.allOff}
              </span>
              {armedOff && <span className="mt-0.5 text-sm opacity-90">{t.allOffSub}</span>}
            </button>
          )}
          {room.has_light && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => lights(true)} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#f0d58a] bg-[#fff8e4] py-3 text-base font-semibold text-[#6b5200] active:bg-[#fdefc4] disabled:opacity-50">
                {busy === "lon" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lightbulb className="h-5 w-5" />} {t.lightOn}
              </button>
              <button onClick={() => lights(false)} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#e2d6c2] bg-[#fbf8f2] py-3 text-base font-semibold active:bg-[#f1ece2] disabled:opacity-50">
                {busy === "loff" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LightbulbOff className="h-5 w-5" />} {t.lightOff}
              </button>
            </div>
          )}
          {room.has_lock && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => door("unlock")} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#e2d6c2] bg-[#fbf8f2] py-3 text-base font-semibold active:bg-[#f1ece2] disabled:opacity-50">
                {busy === "unlock" ? <Loader2 className="h-5 w-5 animate-spin" /> : <DoorOpen className="h-5 w-5" />} {t.open}
              </button>
              <button onClick={() => door("lock")} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#e2d6c2] bg-[#fbf8f2] py-3 text-base font-semibold active:bg-[#f1ece2] disabled:opacity-50">
                {busy === "lock" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />} {t.lock}
              </button>
            </div>
          )}
        </div>
      )}
      {msg && <p className={`mt-2 rounded-2xl px-3 py-2 text-center text-base font-semibold ${msg.ok ? "bg-[#e6f5ec] text-[#2f8a57]" : "bg-[#fde8e5] text-[#b8372d]"}`}>{msg.text}</p>}
    </div>
  );
}

function Badge({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return <span className={`rounded-full bg-[#f5c542] font-bold text-[#5a4300] ${big ? "px-2.5 py-0.5 text-sm" : "px-2 py-0.5 text-xs"}`}>{children}</span>;
}

function fmtDay(t: ST, iso: string, now: number) {
  const d = jstDay(iso), today = jstDay(now);
  if (d === today) return t.today;
  if (d === addDays(today, 1)) return t.tomorrow;
  const wd = new Date(`${d}T00:00:00+09:00`).getUTCDay();
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${t.week[(wd + 1) % 7]})`;
}

/* ---------------- 预订 ---------------- */
function ResTab({ t, reservations, roomById, states, now, baseUrl, entranceUrlByBuilding }: {
  t: ST; reservations: StaffRes[]; roomById: Map<string, StaffRoom>;
  states: { room: StaffRoom; st: ReturnType<typeof roomState> }[]; now: number;
  baseUrl: string; entranceUrlByBuilding: Record<string, string>;
}) {
  const list = reservations
    .filter((r) => r.status !== "cancelled" && new Date(effOut(r)).getTime() > now && new Date(effIn(r)).getTime() < now + 7 * 86400e3)
    .sort((a, b) => new Date(effIn(a)).getTime() - new Date(effIn(b)).getTime());
  const dirtyRooms = new Set(states.filter((x) => x.st.status === "dirty").map((x) => x.room.id));
  return (
    <div className="space-y-3 pt-5">
      <h2 className="px-1 text-base font-bold text-[#7a6d5c]">{t.upcoming}</h2>
      {list.length === 0 && <p className={`${card} p-6 text-center text-[#7a6d5c]`}>{t.noRes}</p>}
      {list.map((r) => (
        <ResCard key={r.id} t={t} r={r} room={roomById.get(r.room_id)} all={reservations} now={now}
          roomDirty={dirtyRooms.has(r.room_id)} baseUrl={baseUrl} entranceUrlByBuilding={entranceUrlByBuilding} />
      ))}
    </div>
  );
}

function ResCard({ t, r, room, all, now, roomDirty, baseUrl, entranceUrlByBuilding }: {
  t: ST; r: StaffRes; room?: StaffRoom; all: StaffRes[]; now: number; roomDirty: boolean;
  baseUrl: string; entranceUrlByBuilding: Record<string, string>;
}) {
  const [sheet, setSheet] = useState<"early" | "late" | null>(null);
  const [copied, setCopied] = useState(false);
  const staying = new Date(effIn(r)).getTime() <= now;
  const copy = async () => {
    const text = guestMessage({
      lang: r.lang, guestName: r.guest_name, roomName: room?.name ?? "", checkIn: effIn(r), checkOut: effOut(r),
      early: !!r.early_checkin_at, late: !!r.late_checkout_at, pin: r.pin,
      entranceUrl: room ? entranceUrlByBuilding[room.building] ?? null : null,
      roomUrl: room ? `${baseUrl}/room/${room.slug}` : baseUrl,
    });
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[22px] font-bold">{room && <RoomBubble room={room} size="sm" />}{room ? <RoomName room={room} /> : "—"}
            {staying && <span className="ml-2 rounded-full bg-[#e3eefc] px-2 py-0.5 align-middle text-sm font-bold text-[#23609f]">{t.staying}</span>}
          </p>
          <p className="truncate text-[#7a6d5c]">{r.guest_name ?? t.guestAirbnb}</p>
        </div>
        {r.pin && (
          <div className="shrink-0 rounded-2xl bg-[#f6efe2] px-3 py-1.5 text-center">
            <p className="flex items-center gap-1 text-xs text-[#7a6d5c]"><KeyRound className="h-3 w-3" /> {t.pin}</p>
            <p className="font-mono text-xl font-bold tracking-[0.2em]">{r.pin}</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <TimeBox label={t.checkin} icon={<Sunrise className="h-4 w-4" />} day={fmtDay(t, effIn(r), now)} time={jstTime(effIn(r))}
          badge={r.early_checkin_at ? `${t.early}` : null} orig={r.early_checkin_at ? `${t.origTime} ${jstTime(r.check_in)}` : null} />
        <TimeBox label={t.checkout} icon={<Sunset className="h-4 w-4" />} day={fmtDay(t, effOut(r), now)} time={jstTime(effOut(r))}
          badge={r.late_checkout_at ? `${t.late}` : null} orig={r.late_checkout_at ? `${t.origTime} ${jstTime(r.check_out)}` : null} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setSheet("early")} disabled={staying}
          className="rounded-2xl border-2 border-[#f0d58a] bg-[#fff8e4] py-3 text-base font-bold text-[#6b5200] active:bg-[#fdefc4] disabled:opacity-35">
          {t.earlyIn}
        </button>
        <button onClick={() => setSheet("late")}
          className="rounded-2xl border-2 border-[#f0d58a] bg-[#fff8e4] py-3 text-base font-bold text-[#6b5200] active:bg-[#fdefc4]">
          {t.lateOut}
        </button>
      </div>
      <button onClick={copy}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3b7dd8] py-3 text-base font-bold text-white active:scale-[0.99]">
        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? t.copied : t.copyMsg}
      </button>

      {sheet && (
        <ShiftSheet t={t} kind={sheet} r={r} all={all} roomDirty={roomDirty} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

function TimeBox({ label, icon, day, time, badge, orig }: {
  label: string; icon: React.ReactNode; day: string; time: string; badge: string | null; orig: string | null;
}) {
  return (
    <div className={`rounded-2xl p-2.5 ${badge ? "bg-[#fff3c9]" : "bg-[#f6efe2]"}`}>
      <p className="flex items-center justify-center gap-1 text-sm text-[#7a6d5c]">{icon} {label} {badge && <Badge>{badge}</Badge>}</p>
      <p className="text-sm text-[#7a6d5c]">{day}</p>
      <p className="text-[26px] font-bold leading-tight tabular-nums">{time}</p>
      {orig && <p className="text-xs text-[#a2968a] line-through">{orig}</p>}
    </div>
  );
}

/* 時間を選ぶシート (提前入住 / 延迟退房) */
function ShiftSheet({ t, kind, r, roomDirty, onClose }: {
  t: ST; kind: "early" | "late"; r: StaffRes; all: StaffRes[]; roomDirty: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const options = kind === "early" ? ["12:00", "13:00", "14:00"] : ["11:00", "12:00", "13:00", "14:00"];
  const current = kind === "early" ? r.early_checkin_at : r.late_checkout_at;

  const apply = async (hhmm: string | null) => {
    setBusy(hhmm ?? "reset"); setErr(null);
    const res = await (kind === "early" ? setEarlyCheckin(r.id, hhmm) : setLateCheckout(r.id, hhmm))
      .catch(() => ({ ok: false, error: "ERR" } as { ok: boolean; error?: string; conflictAt?: string; conflictName?: string | null }));
    setBusy(null);
    if (res.ok) { router.refresh(); onClose(); return; }
    const who = res.conflictName || t.guestAirbnb;
    const at = res.conflictAt ? jstTime(res.conflictAt) : "";
    setErr(
      res.error === "OVERLAP_PREV" ? t.errPrev(who, at)
      : res.error === "OVERLAP_NEXT" ? t.errNext(who, at)
      : res.error === "NOT_EARLIER" ? t.errEarlier
      : res.error === "NOT_LATER" ? t.errLater
      : t.errOther
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-[32px] bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-bold">{kind === "early" ? t.earlyIn : t.lateOut}</h3>
          <button onClick={onClose} aria-label={t.cancel} className="rounded-full bg-[#f6efe2] p-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-[#7a6d5c]">
          {t.origTime} {kind === "early" ? `${t.checkin} ${jstTime(r.check_in)}` : `${t.checkout} ${jstTime(r.check_out)}`}
        </p>
        {kind === "early" && roomDirty && <p className="mb-3 rounded-2xl bg-[#fde8e5] p-3 font-semibold text-[#b8372d]">{t.notCleanWarn}</p>}
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const active = current && jstTime(current) === o;
            return (
              <button key={o} onClick={() => apply(o)} disabled={!!busy}
                className={`rounded-2xl py-4 text-2xl font-bold tabular-nums transition active:scale-[0.98] disabled:opacity-60
                  ${active ? "bg-[#3b7dd8] text-white" : "bg-[#f6efe2] text-[#3b3228]"}`}>
                {busy === o ? <Loader2 className="mx-auto h-7 w-7 animate-spin" /> : o}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} step={900}
            className="min-w-0 flex-1 rounded-2xl border-2 border-[#e2d6c2] px-4 py-3 text-xl" aria-label={t.custom} />
          <button onClick={() => custom && apply(custom)} disabled={!custom || !!busy}
            className="rounded-2xl bg-[#3b3228] px-5 text-lg font-bold text-white disabled:opacity-40">{t.save}</button>
        </div>
        {current && (
          <button onClick={() => apply(null)} disabled={!!busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#e2d6c2] py-3 text-base font-semibold text-[#7a6d5c]">
            {busy === "reset" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Undo2 className="h-5 w-5" />} {t.restore}
          </button>
        )}
        {err && <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#fde8e5] p-3 font-semibold text-[#b8372d]"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {err}</p>}
      </div>
    </div>
  );
}

/* ---------------- 日历 ---------------- */
function CalTab({ t, rooms, reservations, now }: { t: ST; rooms: StaffRoom[]; reservations: StaffRes[]; now: number }) {
  const plan = useMemo(() => weekPlan(rooms, reservations, jstDay(now), 7), [rooms, reservations, now]);
  return (
    <div className="space-y-3 pt-5">
      {plan.map((d) => {
        const isToday = d.day === jstDay(now);
        const wd = new Date(`${d.day}T00:00:00+09:00`).getUTCDay();
        return (
          <section key={d.day} className={`${card} p-4 ${isToday ? "ring-2 ring-[#3b7dd8]" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {Number(d.day.slice(5, 7))}/{Number(d.day.slice(8, 10))}（{t.week[(wd + 1) % 7]}）
                {isToday && <span className="ml-2 rounded-full bg-[#3b7dd8] px-2 py-0.5 text-sm text-white">{t.today}</span>}
              </h3>
              {d.cleanings > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[#fde8e5] px-3 py-1 text-base font-bold text-[#b8372d]">
                  <Sparkles className="h-4 w-4" /> {t.cleanings(d.cleanings)}
                </span>
              )}
            </div>
            {d.rooms.length === 0 ? <p className="text-[#a2968a]">{t.noPlan}</p> : (
              <ul className="space-y-2">
                {d.rooms.map((x) => (
                  <li key={x.room.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#faf6ee] px-3 py-2">
                    <span className="flex min-w-[5.5rem] items-center gap-1.5 text-lg font-bold"><RoomBubble room={x.room} size="sm" /><RoomName room={x.room} /></span>
                    {x.turnover && <span className="rounded-full bg-[#ffe2c2] px-2 py-0.5 text-sm font-bold text-[#a4520b]">{t.turnover}</span>}
                    {x.out && <span className="rounded-full bg-[#fde8e5] px-2 py-0.5 text-sm font-semibold text-[#b8372d]">{t.checkout} {jstTime(effOut(x.out))}{x.out.late_checkout_at ? ` · ${t.late}` : ""}</span>}
                    {x.in && <span className="rounded-full bg-[#e3eefc] px-2 py-0.5 text-sm font-semibold text-[#23609f]">{t.checkin} {jstTime(effIn(x.in))}{x.in.early_checkin_at ? ` · ${t.early}` : ""}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- 部屋のアイコン ---------------- */
function RoomBubble({ room, size = "md" }: { room: { slug: string; name: string }; size?: "sm" | "md" }) {
  const ic = roomIcon(room);
  const cls = size === "sm" ? "h-7 w-7 text-base" : "h-11 w-11 text-[24px]";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full ${cls}`} style={{ background: ic.bg }}>
      {ic.emoji}
    </span>
  );
}

/* 部屋名: 漢字 (春・夏…) を大きく、元の名前 (HARU) を小さく添える */
function RoomName({ room, big }: { room: { slug: string; name: string }; big?: boolean }) {
  const k = roomKanji(room);
  if (k === room.name) return <>{room.name}</>;
  return (
    <>
      {k}
      <span className={`ml-1.5 font-medium text-[#a2968a] ${big ? "text-sm" : "text-xs"}`}>{room.name}</span>
    </>
  );
}

/* 清掃完了のとき、花びらがふわっと舞う */
const PETALS = ["🌸", "✨", "🌼", "💮", "⭐", "🌷"];
function Petals() {
  const items = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    e: PETALS[i % PETALS.length], left: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 1.6 + Math.random() * 1.2, drift: (Math.random() - 0.5) * 80, size: 16 + Math.random() * 14,
  })), []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-3xl">
      <style>{`@keyframes staffPetal{0%{transform:translate(0,-20px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),260px) rotate(300deg);opacity:0}}`}</style>
      {items.map((p, i) => (
        <span key={i} className="absolute top-0" style={{
          left: `${p.left}%`, fontSize: p.size, opacity: 0,
          animation: `staffPetal ${p.dur}s ease-out ${p.delay}s forwards`, ["--dx" as any]: `${p.drift}px`,
        }}>{p.e}</span>
      ))}
    </div>
  );
}

/* 特別な日 (母の日・春節・中秋節など) */
function SpecialBanner({ lang, now }: { lang: Lang; now: number }) {
  const sp = specialDay(jstDay(now), lang);
  if (!sp) return null;
  return (
    <section className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-[#ffd9e0] via-[#ffe9c7] to-[#fff6c9] p-4 shadow-[0_10px_30px_-20px_rgba(59,50,40,0.45)]">
      <span className="text-[40px] leading-none">{sp.emoji}</span>
      <p className="text-[18px] font-bold leading-snug text-[#7a3b2c]">{sp.text}</p>
    </section>
  );
}

/* 今日の天気と、ひとことアドバイス (Open-Meteo・キー不要) */
function weatherTip(lang: Lang, code: number, max: number, min: number, rain: number) {
  const zh = lang === "zh";
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const wet = !snow && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || rain >= 50);
  const emoji = snow ? "❄️" : code >= 95 ? "⛈️" : wet ? "🌧️" : code === 0 || code === 1 ? "☀️" : code <= 3 ? "⛅" : code <= 48 ? "🌫️" : "🌤️";
  const tip = snow ? (zh ? "下雪了，路上很滑，走路慢一点 ⛄" : "雪の日は道がすべりやすいので、ゆっくり歩いてね ⛄")
    : wet ? (zh ? "今天可能下雨，床单毛巾在室内晾吧，出门记得带伞 ☂️" : "雨になりそう。シーツやタオルは部屋干しで、傘を忘れずに ☂️")
    : max >= 30 ? (zh ? "今天很热，打扫时开空调，多喝水 🥤" : "今日は暑いので、掃除中もエアコンをつけて、お水をこまめに 🥤")
    : min <= 3 ? (zh ? "今天很冷，多穿一点，通风时间短一点就好 🧣" : "今日は冷えます。あたたかくして、換気は短めで大丈夫 🧣")
    : code <= 1 ? (zh ? "天气很好，适合晒被子、开窗通风 🌞" : "いいお天気。布団干しや換気にぴったり 🌞")
    : (zh ? "今天也注意身体，累了就休息一下 🍵" : "今日も体を大事に。疲れたらひと休みしてね 🍵");
  return { emoji, tip };
}
function WeatherCard({ t, geo }: { t: ST; geo: { lat: number; lng: number } }) {
  const [w, setW] = useState<{ code: number; max: number; min: number; rain: number } | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=1`)
      .then((r) => r.json())
      .then((j) => {
        const d = j?.daily;
        if (!dead && d) setW({ code: d.weather_code?.[0] ?? 0, max: d.temperature_2m_max?.[0] ?? 20, min: d.temperature_2m_min?.[0] ?? 15, rain: d.precipitation_probability_max?.[0] ?? 0 });
      })
      .catch(() => null);
    return () => { dead = true; };
  }, [geo.lat, geo.lng]);
  if (!w) return null;
  const { emoji, tip } = t.tip(w.code, w.max, w.min, w.rain);
  return (
    <section className={`${card} flex items-center gap-3 p-4`}>
      <span className="text-[40px] leading-none">{emoji}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#7a6d5c]">{t.weather}
          <span className="ml-2 text-lg tabular-nums text-[#3b3228]">{Math.round(w.max)}° / {Math.round(w.min)}°</span>
          {w.rain > 0 && <span className="ml-2 text-sm text-[#3b7dd8]">☂ {w.rain}%</span>}
        </p>
        <p className="mt-0.5 font-semibold leading-snug">{tip}</p>
      </div>
    </section>
  );
}

/* ---------------- 记录 (がんばり記録) ---------------- */
function RecTab({ t, lang, ach, now, passkeys }: { t: ST; lang: Lang; ach: Achievements; now: number; passkeys: StaffPasskey[] | null }) {
  const month = Number(jstDay(now).slice(5, 7));
  const today = Number(jstDay(now).slice(8, 10));
  const stamps = new Set(ach.stampDays);
  const bp = badgeProgress(ach.yearCleans);
  const Stat = ({ label, cleans, guests }: { label: string; cleans: number; guests: number }) => (
    <div className={`${card} p-4 text-center`}>
      <p className="text-sm font-bold text-[#7a6d5c]">{label}</p>
      <p className="mt-1 text-[34px] font-bold leading-none text-[#2f8a57] tabular-nums">{cleans}<span className="ml-1 text-base">{t.rooms}</span></p>
      <p className="text-sm text-[#7a6d5c]">{t.cleaned} ✨</p>
      <p className="mt-2 text-[22px] font-bold leading-none text-[#3b7dd8] tabular-nums">{guests}<span className="ml-1 text-sm">{t.guests}</span></p>
      <p className="text-sm text-[#7a6d5c]">{t.welcomed} 🧳</p>
    </div>
  );
  return (
    <div className="space-y-4 pt-5">
      <h2 className="flex items-center gap-2 px-1 text-xl font-bold"><Award className="h-6 w-6 text-[#e0a526]" /> {t.recTitle}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t.recMonth} cleans={ach.monthCleans} guests={ach.monthGuests} />
        <Stat label={t.recYear} cleans={ach.yearCleans} guests={ach.yearGuests} />
      </div>

      <section className={`${card} p-4`}>
        <p className="text-lg font-bold">{t.stampTitle(month)}</p>
        <p className="mb-3 text-sm text-[#7a6d5c]">{t.stampNote}</p>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {t.week.map((w) => <span key={w} className="text-xs font-bold text-[#a2968a]">{w}</span>)}
          {Array.from({ length: ach.firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: ach.daysInMonth }).map((_, i) => {
            const d = i + 1, on = stamps.has(d);
            return (
              <span key={d} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs
                ${on ? "bg-[#fde4ec]" : "bg-[#faf6ee]"} ${d === today ? "ring-2 ring-[#3b7dd8]" : ""} ${d > today ? "opacity-50" : ""}`}>
                <span className="font-semibold text-[#7a6d5c]">{d}</span>
                <span className="text-base leading-none">{on ? "🌸" : "·"}</span>
              </span>
            );
          })}
        </div>
      </section>

      <section className={`${card} p-4`}>
        <p className="mb-3 text-lg font-bold">{t.badgeTitle}</p>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const got = ach.yearCleans >= b.at;
            return (
              <div key={b.at} className={`rounded-2xl p-2 text-center ${got ? "bg-gradient-to-br from-[#fff4d6] to-[#fde3e8]" : "bg-[#f4f0e8]"}`}>
                <p className={`text-[32px] leading-tight ${got ? "" : "opacity-25 grayscale"}`}>{b.emoji}</p>
                <p className={`text-xs font-bold ${got ? "text-[#7a3b2c]" : "text-[#b3a898]"}`}>{lang === "zh" ? b.zh : b.ja}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center font-semibold text-[#b0662f]">
          {bp.next ? t.nextBadge(bp.next.emoji, bp.left) : t.allBadges}
        </p>
      </section>

      <section className="rounded-3xl bg-gradient-to-br from-[#e3eefc] to-[#fde3e8] p-5 text-center shadow-[0_10px_30px_-20px_rgba(59,50,40,0.45)]">
        <p className="text-sm font-bold text-[#7a6d5c]">{t.thanksTitle} 💌</p>
        <p className="mt-2 text-[18px] font-bold leading-relaxed text-[#4a3b2c]">{t.thanks}</p>
      </section>

      <PasskeySettings t={t} passkeys={passkeys} />
    </div>
  );
}

/* ---------------- Face ID / 指紋ログイン ---------------- */
/* 今天タブ: まだこのスマホで設定していなければ、やさしくおすすめ (「以后再说」で非表示) */
function PasskeyPrompt({ t }: { t: ST }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem("staffPkLater") === "1"; } catch { /* noop */ }
    setShow(passkeySupported() && !hasPasskeyHere() && !dismissed);
  }, []);
  if (!show) return null;
  const setup = async () => {
    setBusy(true); setMsg(null);
    const r = await registerPasskey();
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: t.pkDone }); router.refresh(); setTimeout(() => setShow(false), 2500); }
    else if (r.error !== "CANCELLED") setMsg({ ok: false, text: r.error === "SETUP_MISSING" ? t.pkMissing : t.pkFail });
  };
  const later = () => { try { localStorage.setItem("staffPkLater", "1"); } catch { /* noop */ } setShow(false); };
  return (
    <section className={`${card} p-4`}>
      <p className="flex items-center gap-2 text-lg font-bold"><ScanFace className="h-6 w-6 text-[#2f8a57]" /> {t.pkTitle}</p>
      <p className="mt-1 text-[#6b5f52]">{t.pkPrompt}</p>
      {msg ? (
        <p className={`mt-3 rounded-2xl px-3 py-2 text-center font-semibold ${msg.ok ? "bg-[#e6f5ec] text-[#2f8a57]" : "bg-[#fde8e5] text-[#b8372d]"}`}>{msg.text}</p>
      ) : null}
      {!msg?.ok && (
        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
          <button onClick={setup} disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#2f8a57] py-3.5 text-lg font-bold text-white shadow active:scale-[0.99] disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanFace className="h-5 w-5" />} {t.pkSetup}
          </button>
          <button onClick={later} className="rounded-2xl bg-[#f6efe2] py-3.5 text-base font-semibold text-[#7a6d5c]">{t.pkLater}</button>
        </div>
      )}
    </section>
  );
}

/* 记录タブの下: 設定したスマホの一覧と削除 */
function PasskeySettings({ t, passkeys }: { t: ST; passkeys: StaffPasskey[] | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [supported, setSupported] = useState(false);
  const [here, setHere] = useState(false);
  useEffect(() => { setSupported(passkeySupported()); setHere(hasPasskeyHere()); }, []);
  const setup = async () => {
    setBusy("add"); setMsg(null);
    const r = await registerPasskey();
    setBusy(null);
    if (r.ok) { setHere(true); setMsg({ ok: true, text: t.pkDone }); router.refresh(); }
    else if (r.error !== "CANCELLED") setMsg({ ok: false, text: r.error === "SETUP_MISSING" ? t.pkMissing : t.pkFail });
  };
  const remove = async (id: string) => {
    if (armed !== id) { setArmed(id); setTimeout(() => setArmed(null), 4000); return; }
    setArmed(null); setBusy(id);
    await fetch("/api/staff/passkey", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    if ((passkeys?.length ?? 0) <= 1) { forgetPasskeyHere(); setHere(false); }
    setBusy(null); router.refresh();
  };
  const day = (iso: string) => `${Number(jstDay(iso).slice(5, 7))}/${Number(jstDay(iso).slice(8, 10))}`;
  return (
    <section className={`${card} p-4`}>
      <p className="flex items-center gap-2 text-lg font-bold"><ScanFace className="h-6 w-6 text-[#2f8a57]" /> {t.pkTitle}</p>
      {passkeys === null ? (
        <p className="mt-2 text-sm text-[#7a5a12]">{t.pkMissing}</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-bold text-[#7a6d5c]">{t.pkList}</p>
          {passkeys.length === 0 ? <p className="py-1 text-[#a2968a]">{t.pkNone}</p> : (
            <ul className="mt-1 divide-y divide-[#f1ece2]">
              {passkeys.map((k) => (
                <li key={k.id} className="flex items-center gap-2 py-2">
                  <span className="text-xl">📱</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{k.device_name ?? "Device"}</span>
                    <span className="ml-2 text-sm text-[#a2968a]">{day(k.created_at)}{k.last_used_at ? ` · ${t.pkLast} ${day(k.last_used_at)}` : ""}</span>
                  </span>
                  <button onClick={() => remove(k.id)} disabled={!!busy}
                    className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold ${armed === k.id ? "bg-[#e0564b] text-white" : "bg-[#f6efe2] text-[#7a6d5c]"}`}>
                    {busy === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {armed === k.id ? t.pkDeleteConfirm : t.pkDelete}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {supported && !here && (
            <button onClick={setup} disabled={!!busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f8a57] py-3.5 text-lg font-bold text-white shadow disabled:opacity-60">
              {busy === "add" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanFace className="h-5 w-5" />} {t.pkHere}
            </button>
          )}
          {msg && <p className={`mt-2 rounded-2xl px-3 py-2 text-center font-semibold ${msg.ok ? "bg-[#e6f5ec] text-[#2f8a57]" : "bg-[#fde8e5] text-[#b8372d]"}`}>{msg.text}</p>}
          <p className="mt-3 text-xs leading-relaxed text-[#a2968a]">🔒 {t.pkNote}</p>
        </>
      )}
    </section>
  );
}

/* ---------------- 便利機能・元気が出る仕組み ---------------- */
function readLS<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ } }

/* 写真をタップしたときのハート */
function Hearts() {
  const items = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    e: ["💕", "💖", "🌸", "✨", "💗"][i % 5], left: 10 + Math.random() * 80, delay: Math.random() * 0.4, size: 18 + Math.random() * 14,
  })), []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <style>{`@keyframes staffHeart{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-200px) scale(1.2);opacity:0}}
        @keyframes staffPop{0%{transform:scale(.8);opacity:0}12%{transform:scale(1.05);opacity:1}80%{opacity:1}100%{opacity:0}}`}</style>
      {items.map((h, i) => (
        <span key={i} className="absolute bottom-6" style={{ left: `${h.left}%`, fontSize: h.size, opacity: 0, animation: `staffHeart 2.2s ease-out ${h.delay}s forwards` }}>{h.e}</span>
      ))}
    </div>
  );
}

/* 清掃チェックリスト (部屋ごと・日ごとに、このスマホに記憶) */
const CHECK_ITEMS: { e: string; zh: string; ja: string }[] = [
  { e: "🛏️", zh: "换床单、被套、枕套", ja: "シーツ・布団カバー・枕カバー交換" },
  { e: "🧺", zh: "换毛巾、浴巾", ja: "タオル・バスタオル交換" },
  { e: "🚽", zh: "打扫厕所", ja: "トイレ掃除" },
  { e: "🛁", zh: "打扫浴室、洗脸台", ja: "お風呂・洗面台" },
  { e: "🧹", zh: "吸尘、拖地", ja: "掃除機・床ふき" },
  { e: "🗑️", zh: "倒垃圾、换垃圾袋", ja: "ゴミ回収・袋の交換" },
  { e: "🧻", zh: "补充厕纸、洗发水、沐浴露", ja: "トイレットペーパー・シャンプー補充" },
  { e: "☕", zh: "补充茶、咖啡、杯子", ja: "お茶・コーヒー・コップ" },
  { e: "🧊", zh: "检查冰箱和遗留物品", ja: "冷蔵庫・忘れ物チェック" },
  { e: "🎛️", zh: "遥控器放回原位", ja: "リモコンを元の場所へ" },
];
function CleanChecklist({ t, lang, roomId, day }: { t: ST; lang: Lang; roomId: string; day: string }) {
  const key = `staffCheck:${roomId}:${day}`;
  const [done, setDone] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { setDone(readLS<number[]>(key, [])); }, [key]);
  const toggle = (i: number) => setDone((d) => {
    const next = d.includes(i) ? d.filter((x) => x !== i) : [...d, i];
    writeLS(key, next); if (!d.includes(i)) vibrate([10]);
    return next;
  });
  const all = done.length >= CHECK_ITEMS.length;
  return (
    <div className="rounded-2xl border-2 border-[#eadfcb] bg-[#fffdf8]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <ListChecks className="h-5 w-5 text-[#2f8a57]" />
        <span className="flex-1 font-bold">{t.checklist}</span>
        <span className={`rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${all ? "bg-[#e6f5ec] text-[#2f8a57]" : "bg-[#f6efe2] text-[#7a6d5c]"}`}>
          {done.length}/{CHECK_ITEMS.length}
        </span>
        <ChevronDown className={`h-5 w-5 text-[#a2968a] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-1 px-2 pb-2">
          {CHECK_ITEMS.map((it, i) => {
            const on = done.includes(i);
            return (
              <li key={i}>
                <button onClick={() => toggle(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-[16px] ${on ? "bg-[#eef8f1] text-[#7a8f80] line-through" : "active:bg-[#f6efe2]"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-[#2f8a57] bg-[#2f8a57] text-white" : "border-[#d8cfbf] bg-white"}`}>
                    {on && <Check className="h-5 w-5" />}
                  </span>
                  <span className="text-xl" aria-hidden>{it.e}</span>
                  <span className="flex-1">{lang === "zh" ? it.zh : it.ja}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all && <p className="px-3 pb-3 text-center font-bold text-[#2f8a57]">{t.checkAllDone}</p>}
    </div>
  );
}

/* 明日の予定 (前の晩に心の準備ができるように) */
function TomorrowCard({ t, lang, rooms, reservations, roomById, now }: {
  t: ST; lang: Lang; rooms: StaffRoom[]; reservations: StaffRes[]; roomById: Map<string, StaffRoom>; now: number;
}) {
  const tmr = addDays(jstDay(now), 1);
  const plan = useMemo(() => weekPlan(rooms, reservations, tmr, 1)[0], [rooms, reservations, tmr]);
  const outs = plan?.rooms.filter((x) => x.out).map((x) => effOut(x.out!)).sort() ?? [];
  const ins = plan?.rooms.filter((x) => x.in).length ?? 0;
  const linen = useMemo(() => linenPlan(plan), [plan]);
  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><CalendarDays className="h-5 w-5 text-[#7a6d5c]" /> {t.tomorrowPlan}</h2>
      {!plan || plan.rooms.length === 0 ? <p className="text-[#7a6d5c]">{t.tomorrowNone}</p> : (
        <>
          <p className="flex flex-wrap gap-2 text-base font-semibold">
            {plan.cleanings > 0 && <span className="rounded-full bg-[#fde8e5] px-3 py-1 text-[#b8372d]">🧹 {t.tmrClean(plan.cleanings)}</span>}
            {ins > 0 && <span className="rounded-full bg-[#e3eefc] px-3 py-1 text-[#23609f]">🧳 {t.tmrIn(ins)}</span>}
            {outs[0] && <span className="rounded-full bg-[#f6efe2] px-3 py-1 text-[#6b5f52]">⏰ {t.tmrFirst(jstTime(outs[0]))}</span>}
          </p>
          <ul className="mt-3 space-y-1.5">
            {plan.rooms.map((x) => (
              <li key={x.room.id} className="flex flex-wrap items-center gap-2 text-[15px]">
                <RoomBubble room={roomById.get(x.room.id) ?? x.room} size="sm" />
                <span className="font-bold"><RoomName room={x.room} /></span>
                {x.out && <span className="text-[#b8372d]">{t.checkout} {jstTime(effOut(x.out))}</span>}
                {x.in && <span className="text-[#23609f]">{t.checkin} {jstTime(effIn(x.in))}</span>}
              </li>
            ))}
          </ul>
          {/* 明日そろえるリネン・タオル (予約の人数から自動計算) */}
          {linen && (
            <div className="mt-4 rounded-2xl bg-[#f3f7ee] p-3">
              <p className="flex flex-wrap items-baseline gap-x-2 font-bold text-[#3f6b35]">
                🧺 {t.linenTitle}
                <span className="text-sm font-semibold text-[#6b8a5e]">{t.linenFor(linen.rooms.length, linen.totalGuests)}</span>
              </p>
              <div className="mt-2 divide-y divide-[#e4ecdc] overflow-hidden rounded-xl bg-white shadow-sm">
                {linen.items.map((i) => (
                  <div key={i.key} className="flex items-baseline justify-between px-3 py-1.5">
                    <span className="text-[15px] text-[#4a4036]">{lang === "zh" ? i.zh : i.ja}</span>
                    <span className="text-xl font-bold text-[#3f6b35]">{i.count}<span className="ml-0.5 text-sm font-semibold">{t.linenUnit}</span></span>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#5d6b56]">
                {linen.rooms.map((r) => (
                  <span key={r.room.id}><RoomName room={roomById.get(r.room.id) ?? r.room} /> {t.linenPeople(r.guests)}{r.estimated ? t.linenEst : ""}</span>
                ))}
              </p>
              {linen.anyEstimated && <p className="mt-1 text-xs text-[#8a8f7e]">{t.linenEstNote(DEFAULT_GUESTS)}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* 夕方 (17時以降) の「今日もおつかれさま」 */
function EveningCard({ t, now, prog, guests }: { t: ST; now: number; prog: { total: number; done: number }; guests: number }) {
  const hour = Number(jstTime(new Date(now).toISOString()).slice(0, 2));
  if (hour < 17) return null;
  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#2d3a66] to-[#6b5aa6] p-4 text-white shadow-[0_10px_30px_-18px_rgba(45,58,102,0.9)]">
      <p className="flex items-center gap-2 text-lg font-bold"><MoonStar className="h-5 w-5 text-[#ffe08a]" /> {t.eveningTitle}</p>
      <p className="mt-1 leading-relaxed text-white/90">{prog.done > 0 || guests > 0 ? t.eveningBody(prog.done, guests) : t.eveningNone}</p>
    </section>
  );
}

/* 新しいバッジを取ったら一度だけお祝い */
function BadgeCelebration({ t, lang, count }: { t: ST; lang: Lang; count: number }) {
  const [badge, setBadge] = useState<ReturnType<typeof badgeProgress>["earned"][number] | null>(null);
  useEffect(() => {
    const top = badgeProgress(count).earned.slice(-1)[0];
    if (!top) return;
    const seen = readLS<number>("staffBadgeSeen", 0);
    if (top.at > seen) { setBadge(top); vibrate([30, 60, 30, 60, 120]); }
  }, [count]);
  if (!badge) return null;
  const close = () => { writeLS("staffBadgeSeen", badge.at); setBadge(null); };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6" onClick={close}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-[32px] bg-gradient-to-br from-[#fff4d6] via-white to-[#fde3e8] p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Petals />
        <p className="text-sm font-bold text-[#b0662f]">🎉 {t.newBadge}</p>
        <p className="mt-3 text-[72px] leading-none">{badge.emoji}</p>
        <p className="mt-3 text-2xl font-bold text-[#7a3b2c]">{lang === "zh" ? badge.zh : badge.ja}</p>
        <p className="mt-2 text-[#6b5f52]">{t.newBadgeBody(count)}</p>
        <button onClick={close} className="mt-5 w-full rounded-2xl bg-[#2f8a57] py-3.5 text-lg font-bold text-white shadow">{t.great}</button>
      </div>
    </div>
  );
}

/* ---------------- 备忘 (買うものリスト + メモ帳) ---------------- */
const SHOP_PRESETS: { zh: string; ja: string }[] = [
  { zh: "厕纸", ja: "トイレットペーパー" }, { zh: "洗发水", ja: "シャンプー" }, { zh: "护发素", ja: "リンス" },
  { zh: "沐浴露", ja: "ボディソープ" }, { zh: "洗手液", ja: "ハンドソープ" }, { zh: "洗洁精", ja: "食器用洗剤" },
  { zh: "洗衣液", ja: "洗濯洗剤" }, { zh: "垃圾袋", ja: "ゴミ袋" }, { zh: "纸巾", ja: "ティッシュ" },
  { zh: "牙刷", ja: "歯ブラシ" }, { zh: "茶包", ja: "お茶パック" }, { zh: "咖啡", ja: "コーヒー" },
  { zh: "电池", ja: "電池" }, { zh: "海绵", ja: "スポンジ" },
];
interface ShopItem { id: string; text: string; bought: boolean }
function MemoTab({ t, lang, rooms, entranceCodes, roomCodes }: {
  t: ST; lang: Lang; rooms: StaffRoom[]; entranceCodes: EntranceCode[]; roomCodes: Record<string, string | null> | null;
}) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setItems(readLS<ShopItem[]>("staffShop", [])); }, []);
  const save = (next: ShopItem[]) => { setItems(next); writeLS("staffShop", next); };
  const add = (v: string) => {
    const s = v.trim(); if (!s) return;
    if (items.some((x) => x.text === s && !x.bought)) return;
    save([...items, { id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, text: s, bought: false }]);
    setText(""); vibrate([10]);
  };
  const toggle = (id: string) => save(items.map((x) => (x.id === id ? { ...x, bought: !x.bought } : x)));
  const remove = (id: string) => save(items.filter((x) => x.id !== id));
  const need = items.filter((x) => !x.bought);
  const send = async () => {
    const body = t.shopMsg(need.map((x) => `・${x.text}`).join("\n"));
    try {
      if (navigator.share) { await navigator.share({ text: body }); return; }
    } catch { /* キャンセル等 */ return; }
    try { await navigator.clipboard.writeText(body); setMsg(t.shopSent); setTimeout(() => setMsg(null), 2500); } catch { /* noop */ }
  };
  return (
    <div className="space-y-4 pt-5">
      <CodesCard t={t} rooms={rooms} entranceCodes={entranceCodes} roomCodes={roomCodes} />
      <GuestTemplates t={t} lang={lang} />
      <section className={`${card} p-4`}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShoppingCart className="h-5 w-5 text-[#e0a526]" /> {t.shopTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SHOP_PRESETS.map((p) => {
            const label = lang === "zh" ? p.zh : p.ja;
            const on = need.some((x) => x.text === label);
            return (
              <button key={p.zh} onClick={() => add(label)} disabled={on}
                className={`rounded-full border-2 px-3 py-1.5 text-[15px] font-semibold ${on ? "border-[#2f8a57] bg-[#e6f5ec] text-[#2f8a57]" : "border-[#e2d6c2] bg-[#fbf8f2] active:bg-[#f1ece2]"}`}>
                {on ? "✓ " : "+ "}{label}
              </button>
            );
          })}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(text); }} className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.shopPh}
            className="min-w-0 flex-1 rounded-2xl border-2 border-[#e2d6c2] bg-white px-4 py-3 text-lg outline-none focus:border-[#3b7dd8]" />
          <button type="submit" disabled={!text.trim()} className="flex items-center gap-1 rounded-2xl bg-[#3b3228] px-4 text-lg font-bold text-white disabled:opacity-40">
            <Plus className="h-5 w-5" /> {t.add}
          </button>
        </form>
        {items.length === 0 ? <p className="mt-3 text-center text-[#a2968a]">{t.shopEmpty}</p> : (
          <ul className="mt-3 divide-y divide-[#f1ece2]">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <button onClick={() => toggle(x.id)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${x.bought ? "border-[#2f8a57] bg-[#2f8a57] text-white" : "border-[#d8cfbf] bg-white"}`}
                  aria-label={x.text}>
                  {x.bought && <Check className="h-5 w-5" />}
                </button>
                <span className={`flex-1 text-lg ${x.bought ? "text-[#a2968a] line-through" : ""}`}>{x.text}</span>
                <button onClick={() => remove(x.id)} aria-label="delete" className="rounded-full p-2 text-[#a2968a]"><X className="h-5 w-5" /></button>
              </li>
            ))}
          </ul>
        )}
        {items.some((x) => x.bought) && (
          <button onClick={() => save(items.filter((x) => !x.bought))} className="mt-2 text-sm font-semibold text-[#7a6d5c] underline">{t.clearBought}</button>
        )}
        {need.length > 0 && (
          <button onClick={send} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f8a57] py-3.5 text-lg font-bold text-white shadow active:scale-[0.99]">
            <Share2 className="h-5 w-5" /> {t.shopSend}
          </button>
        )}
        {msg && <p className="mt-2 text-center font-semibold text-[#2f8a57]">{msg}</p>}
      </section>

    </div>
  );
}

/* 暗証番号の一覧: エントランスとお部屋の番号を大きく表示してワンタップでコピー。その場で変更もできる */
function CodesCard({ t, rooms, entranceCodes, roomCodes }: {
  t: ST; rooms: StaffRoom[]; entranceCodes: EntranceCode[]; roomCodes: Record<string, string | null> | null;
}) {
  const buildings = Array.from(new Set(rooms.map((r) => r.building)));
  return (
    <section className={`${card} p-4`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-[#e0a526]" /> {t.codesTitle}</h2>
      <p className="mt-1 text-sm text-[#7a6d5c]">{t.codesHint}</p>

      {entranceCodes.length > 0 && (
        <>
          <p className="mt-3 text-sm font-bold text-[#7a6d5c]">🚪 {t.codesEntrance}</p>
          <ul className="mt-1 divide-y divide-[#f1ece2]">
            {entranceCodes.map((e) => (
              <CodeRow key={e.id} t={t} label={<span className="font-bold">{entranceCodes.length > 1 ? e.building : e.name}</span>} code={e.code}
                onSave={(v) => setEntranceCode(e.id, v)} note={t.codeNote} />
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 text-sm font-bold text-[#7a6d5c]">🛏️ {t.codesRooms}</p>
      {roomCodes === null ? (
        <p className="mt-1 rounded-xl bg-[#fff3d6] p-2 text-sm text-[#7a5a12]">{t.codesMissing}</p>
      ) : buildings.map((b) => (
        <div key={b}>
          {buildings.length > 1 && <p className="mt-2 text-xs font-bold text-[#a2968a]">{b}</p>}
          <ul className="divide-y divide-[#f1ece2]">
            {rooms.filter((r) => r.building === b).map((room) => (
              <CodeRow key={room.id} t={t}
                label={<span className="flex items-center gap-2 font-bold"><RoomBubble room={room} size="sm" /><RoomName room={room} /></span>}
                code={roomCodes[room.id] ?? null} onSave={(v) => setRoomCode(room.id, v)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function CodeRow({ t, label, code, onSave, note }: {
  t: ST; label: React.ReactNode; code: string | null; onSave: (v: string | null) => Promise<{ ok: boolean; error?: string }>; note?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(code ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); vibrate([15]); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await onSave(val.trim() || null).catch(() => ({ ok: false, error: "ERR" }));
    setBusy(false);
    if (r.ok) { setEditing(false); setMsg({ ok: true, text: t.codeSaved }); setTimeout(() => setMsg(null), 2000); router.refresh(); }
    else setMsg({ ok: false, text: r.error === "SETUP_MISSING" ? t.codesMissing : t.errOther });
  };
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!editing && (
          <>
            <span className={`font-mono text-[22px] font-bold tracking-[0.15em] ${code ? "" : "text-base font-normal tracking-normal text-[#b3a898]"}`}>{code ?? t.codeNone}</span>
            {code && (
              <button onClick={copy} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold ${copied ? "bg-[#2f8a57] text-white" : "bg-[#3b7dd8] text-white"}`}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t.copiedShort : t.copy}
              </button>
            )}
            <button onClick={() => { setVal(code ?? ""); setEditing(true); }} aria-label={t.codeEdit} className="rounded-xl bg-[#f6efe2] p-2 text-[#7a6d5c]">
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {editing && (
        <div className="mt-2">
          <div className="flex gap-2">
            <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="numeric" autoFocus maxLength={32}
              className="min-w-0 flex-1 rounded-xl border-2 border-[#e2d6c2] bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.15em] outline-none focus:border-[#3b7dd8]" />
            <button onClick={save} disabled={busy} className="rounded-xl bg-[#2f8a57] px-4 font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t.codeSave}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-xl bg-[#f6efe2] px-3 font-semibold text-[#7a6d5c]">{t.codeCancel}</button>
          </div>
          {note && <p className="mt-1 text-xs text-[#a2968a]">{note}</p>}
        </div>
      )}
      {msg && <p className={`mt-1 text-sm font-semibold ${msg.ok ? "text-[#2f8a57]" : "text-[#b8372d]"}`}>{msg.text}</p>}
    </li>
  );
}

/* ゲストに送る定型メッセージ (言語を選んでコピー / 共有) */
function GuestTemplates({ t, lang }: { t: ST; lang: Lang }) {
  const [gl, setGl] = useState<GuestLang>("en");
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { const v = readLS<GuestLang | null>("staffGuestLang", null); if (v) setGl(v); }, []);
  const pick = (v: GuestLang) => { setGl(v); writeLS("staffGuestLang", v); };
  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); vibrate([15]); setTimeout(() => setCopied(null), 2000); } catch { /* noop */ }
  };
  const share = async (text: string) => { try { await navigator.share?.({ text }); } catch { /* キャンセル */ } };
  return (
    <section className={`${card} p-4`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><MessageCircle className="h-5 w-5 text-[#3b7dd8]" /> {t.tplTitle}</h2>
      <p className="mt-1 text-sm text-[#7a6d5c]">{t.tplHint}</p>
      <p className="mt-3 text-sm font-bold text-[#7a6d5c]">{t.tplLang}</p>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {GUEST_LANGS.map((g) => (
          <button key={g.k} onClick={() => pick(g.k)}
            className={`rounded-xl py-2 text-[15px] font-bold ${gl === g.k ? "bg-[#3b7dd8] text-white" : "bg-[#f6efe2] text-[#3b3228]"}`}>{g.label}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {TEMPLATES.map((tp) => {
          const isOpen = open === tp.id;
          const text = tp.text[gl];
          return (
            <li key={tp.id} className="rounded-2xl border-2 border-[#eadfcb] bg-[#fffdf8]">
              <button onClick={() => setOpen(isOpen ? null : tp.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <span className="text-2xl" aria-hidden>{tp.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold">{tp.title[lang]}</span>
                  <span className="block text-sm text-[#7a6d5c]">{tp.about[lang]}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-[#a2968a] transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  <p className="whitespace-pre-line rounded-xl bg-white p-3 text-[15px] leading-relaxed text-[#4a3b2c] ring-1 ring-[#eadfcb]">{text}</p>
                  <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
                    <button onClick={() => copy(tp.id, text)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#3b7dd8] py-3 text-base font-bold text-white active:scale-[0.99]">
                      {copied === tp.id ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied === tp.id ? t.copiedShort : t.copy}
                    </button>
                    <button onClick={() => share(text)} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f6efe2] py-3 text-base font-semibold text-[#6b5f52]">
                      <Share2 className="h-5 w-5" /> {t.send}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- 下のナビ ---------------- */
function BottomNav({ t, tab, setTab }: { t: ST; tab: Tab; setTab: (t: Tab) => void }) {
  const items: { k: Tab; label: string; Icon: any }[] = [
    { k: "today", label: t.tabToday, Icon: Home },
    { k: "res", label: t.tabRes, Icon: ClipboardList },
    { k: "cal", label: t.tabCal, Icon: CalendarDays },
    { k: "rec", label: t.tabRec, Icon: Award },
    { k: "memo", label: t.tabMemo, Icon: NotebookPen },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8dfcf] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ k, label, Icon }) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              className={`flex flex-col items-center gap-1 py-3 text-[15px] font-bold ${on ? "text-[#3b7dd8]" : "text-[#a2968a]"}`}>
              <span className={`rounded-2xl px-3 py-1 ${on ? "bg-[#e3eefc]" : ""}`}><Icon className="h-7 w-7" /></span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
