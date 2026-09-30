/**
 * 確認用: Crane Nest のシステムに登録されたゲスト (お見送りの送迎予約 + パスポート) の一覧と、
 * こちらのどの予約に紐づいたか。スタッフ画面 (/staff/guests) とお父さんの画面 (/driver/guests) で使う (サーバ専用)。
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toCabinRoom } from "@/lib/cabinData";
import { craneNestOn, craneNestReport, type CnReportRow } from "@/lib/craneNest";

type L = "ja" | "zh";
const TX = {
  ja: { title: "Crane Nest の登録ゲスト", back: "← 戻る", desc: "パスポート登録・お見送りの送迎予約（Crane Nest のシステム）と、こちらの予約との紐づけの確認。送迎の日", reg: "登録", ok: "紐づいた", ng: "紐づかない", past: "過去 {d} 日", none: "この期間の登録はありません。", noName: "（名前なし）", ppl: "名", room: "お部屋", nankai: "南海に乗車", airport: "空港", depart: "出発", undecided: "未定", resOf: "様の予約", byToken: "予約つき QR で紐づけ", byRoom: "お部屋と日付で紐づけ", notLinked: "紐づいていません", notQr: "（予約つき QR ではない登録）", at: "登録", noEnv: "Vercel の環境変数 CRANENEST_SUPABASE_URL と CRANENEST_SUPABASE_SERVICE_KEY が設定されていません（設定したあと、もう一度デプロイが必要です）。", readErr: "Crane Nest の Supabase を読めませんでした", keyHint: "キー（service_role / secret）が正しいか確認してください。" },
  zh: { title: "Crane Nest 登记的客人", back: "← 返回", desc: "护照登记·送机预约（Crane Nest 系统）和本系统预约的关联确认。送机日期", reg: "登记", ok: "已关联", ng: "未关联", past: "过去 {d} 天", none: "这段时间没有登记。", noName: "（没有名字）", ppl: "人", room: "房间", nankai: "乘南海线", airport: "机场", depart: "出发", undecided: "未定", resOf: "的预约", byToken: "通过预约二维码关联", byRoom: "按房间和日期关联", notLinked: "未关联", notQr: "（不是通过预约二维码登记）", at: "登记于", noEnv: "Vercel 环境变量 CRANENEST_SUPABASE_URL 和 CRANENEST_SUPABASE_SERVICE_KEY 未设置（设置后需要重新部署）。", readErr: "无法读取 Crane Nest 的 Supabase", keyHint: "请确认密钥（service_role / secret）是否正确。" },
} as const;
/** 紐づかない理由 (日本語で作られる) → 中文 */
function whyZh(s: string) {
  return s.replace(/^合言葉に合う予約がありません（期間外・キャンセル）$/, "找不到与二维码对应的预约（不在期间内或已取消）")
    .replace(/^お部屋「(.*)」がわかりません$/, "无法识别房间「$1」")
    .replace(/^(\S+) にチェックアウトする「(.)」の予約がありません$/, "没有 $1 退房的「$2」房间预约");
}

const D = 86400e3;
const ymd = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const md = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(5, 10).replace("-", "/") : "");
const hm = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(11, 16) : "");

export default async function CraneNestGuests({ days, lang, base, backHref }: { days?: string; lang: L; base: string; backHref: string }) {
  const t = TX[lang];
  const back = Math.min(365, Math.max(7, Number(days) || 30));
  const now = Date.now(), from = ymd(now - back * D), to = ymd(now + 60 * D);

  const [rq, resq] = await Promise.all([
    supabaseAdmin.from("rooms").select("*"),
    supabaseAdmin.from("reservations").select("*").neq("status", "cancelled")
      .gte("check_out", new Date(Date.parse(from) - D).toISOString()).lte("check_out", new Date(Date.parse(to) + 2 * D).toISOString()),
  ]);
  const rooms = new Map(((rq.data ?? []) as any[]).map((r) => [r.id, toCabinRoom(r)]));
  const res = ((resq.data ?? []) as any[]).map((r) => {
    const room = rooms.get(r.assigned_room_id || r.room_id);
    return { id: r.id as string, roomKanji: room?.kanji ?? null, room: room ? `${room.kanji} ${room.en}` : "?", checkIn: String(r.early_checkin_at || r.check_in), checkOut: String(r.late_checkout_at || r.check_out),
      token: r.guest_token ? String(r.guest_token) : null, guest: (r.entrance_name || r.guest_name || null) as string | null };
  });
  const rep = await craneNestReport(res, from, to);
  const ok = rep.rows.filter((r) => r.res).length, ng = rep.rows.length - ok;
  const href = (d: number, l: L) => `${base}?days=${d}&lang=${l}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <a href={backHref} className="rounded-full border border-[#d9ccb4] bg-white px-3 py-1 text-sm">{t.back}</a>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <div className="ml-auto flex overflow-hidden rounded-full border border-[#d9ccb4] bg-white text-sm">
          <a href={href(back, "ja")} className={`px-3 py-1 ${lang === "ja" ? "bg-[#3b3228] text-white" : ""}`}>日本語</a>
          <a href={href(back, "zh")} className={`px-3 py-1 ${lang === "zh" ? "bg-[#3b3228] text-white" : ""}`}>中文</a>
        </div>
      </div>
      <p className="mb-4 text-sm text-[#8a7a66]">{t.desc} {from} 〜 {to}</p>

      {!craneNestOn() ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">{t.noEnv}</div>
      ) : rep.error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm">{t.readErr}：{rep.error}<br />{t.keyHint}</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-2xl font-bold">{rep.rows.length}</div><div className="text-xs text-[#8a7a66]">{t.reg}</div></div>
            <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-2xl font-bold text-emerald-600">{ok}</div><div className="text-xs text-[#8a7a66]">{t.ok}</div></div>
            <div className="rounded-2xl bg-white p-3 shadow-sm"><div className={`text-2xl font-bold ${ng ? "text-amber-600" : ""}`}>{ng}</div><div className="text-xs text-[#8a7a66]">{t.ng}</div></div>
          </div>
          <div className="mb-3 flex gap-2 text-sm">
            {[30, 90, 365].map((d) => <a key={d} href={href(d, lang)} className={`rounded-full border px-3 py-1 ${d === back ? "border-[#3b3228] bg-[#3b3228] text-white" : "border-[#d9ccb4] bg-white"}`}>{t.past.replace("{d}", String(d))}</a>)}
          </div>
          {rep.rows.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-[#8a7a66]">{t.none}</p> : rep.rows.map((r) => <Row key={r.drop.id} r={r} lang={lang} />)}
        </>
      )}
    </main>
  );
}

function Row({ r, lang }: { r: CnReportRow; lang: L }) {
  const t = TX[lang], d = r.drop;
  const where = d.intent === "nankai" ? `${d.dest ?? "?"} · ${t.nankai}` : d.intent === "airport" ? `${d.dest ?? "?"} → ${t.airport} T${d.terminal ?? "?"}` : `${d.dest ?? "?"}${d.terminal ? ` · T${d.terminal}` : ""}`;
  return (
    <div className={`mb-3 rounded-2xl border-l-4 bg-white p-4 shadow-sm ${r.res ? "border-emerald-500" : "border-amber-500"}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <b className="text-base">{d.names.length ? d.names.join(" / ") : t.noName}</b>
        <span className="text-sm text-[#8a7a66]">{d.names.length} {t.ppl} · {t.room}「{r.roomName}」</span>
        {d.status !== "pending" ? <span className="rounded-full bg-[#efe6d6] px-2 text-xs">{d.status}</span> : null}
      </div>
      <div className="mt-1 text-sm">🛫 {d.date ?? "?"} · <b>{where}</b> · {t.depart} {d.departAt ? d.departAt.slice(0, 5) : t.undecided}{d.flightAt ? ` · ✈ ${hm(d.flightAt)}` : ""} · 👥{d.pax} 🧳{d.large} 👜{d.small}{d.special ? ` 🚲${d.special}` : ""}</div>
      <div className={`mt-2 rounded-xl px-3 py-2 text-sm ${r.res ? "bg-emerald-50" : "bg-amber-50"}`}>
        {r.res ? (
          <>✓ <b>{r.res.guest ?? t.noName}</b> {t.resOf} · {r.res.room} · {md(r.res.checkIn)} → {md(r.res.checkOut)}
            <span className="ml-2 text-xs text-[#8a7a66]">{d.linked === "token" ? t.byToken : t.byRoom}</span></>
        ) : (
          <>⚠ {t.notLinked}：{lang === "zh" ? whyZh(r.why ?? "") : r.why}{r.hasToken ? "" : <span className="ml-1 text-xs text-[#8a7a66]">{t.notQr}</span>}</>
        )}
      </div>
      {r.createdAt ? <div className="mt-1 text-right text-xs text-[#b7a891]">{t.at} {md(r.createdAt)} {hm(r.createdAt)}</div> : null}
    </div>
  );
}
