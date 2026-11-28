/**
 * 送迎のお知らせ (WxPusher アプリへ。サーバー専用。wake-alarm の Cron から driverRunner 経由で 1〜2 分ごと)。
 *   ・送迎の N 分前 (ふだん 30 分): お迎え (時刻・場所・部屋・ゲスト・便と到着見込み) / お見送り (出発時刻・行き先・ターミナル・人数・荷物・便)
 *   ・前の日の夜 20 時: 明日の送迎の一覧
 *   押すと「送迎 GO」(/driver/go) が開く。送り先は管理画面の「スマホへのお知らせ」で「送迎」にチェックした人 (言語は人ごと)
 *   同じお知らせは 2 回送らない (notify_log)
 */
import { sendWxPusher } from "@/lib/wxpusher";
import { claimNotify, getNotifySettings, recipientsFor, unclaimNotify, type Recipient } from "@/lib/notifyRecipients";
import { loadCraneNestDrops, type CnDrop } from "@/lib/craneNest";
import { addDays, jstDay, jstTime, type DRes } from "@/lib/driverLogic";

type L = "ja" | "zh";
const X: Record<L, Record<string, string>> = {
  ja: { pick: "お迎え", drop: "お見送り", before: "{m}分前のお知らせ", time: "時刻", depart: "出発", place: "場所", dest: "行き先", room: "部屋", guest: "ゲスト", pax: "人数", bags: "荷物", big: "大{n}", small: "小{n}", flight: "便", eta: "到着見込み", land: "着陸", delay: "{n}分遅れ", go: "「送迎 GO」を開いて「出発」を押してください", tomorrow: "明日の送迎", none: "明日の送迎はありません", term: "T{n}", plane: "飛行機", ppl: "{n}名", tap: "押すと送迎画面が開きます" },
  zh: { pick: "接机/接站", drop: "送机/送站", before: "提前{m}分钟提醒", time: "时间", depart: "出发", place: "地点", dest: "目的地", room: "房间", guest: "客人", pax: "人数", bags: "行李", big: "大{n}", small: "小{n}", flight: "航班", eta: "预计到达", land: "已落地", delay: "晚点{n}分钟", go: "请打开「送迎 GO」按「出发」", tomorrow: "明天的接送", none: "明天没有接送", term: "T{n}", plane: "飞机", ppl: "{n}人", tap: "点开即可打开接送页面" },
};
const f = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const site = () => { const h = process.env.VERCEL_PROJECT_PRODUCTION_URL; return h ? `https://${h.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : null; };
const ms = (iso: string) => new Date(iso).getTime();

type Room = { name: string; kanji: string };
interface Trip { key: string; kind: "pick" | "drop"; at: number; r: DRes; room: Room; drop?: CnDrop | null }

function lines(t: Trip, l: L, head: boolean, min: number): string[] {
  const x = X[l], r = t.r, out: string[] = [];
  if (head) out.push(`${t.kind === "pick" ? "🚗" : "🛫"} ${x[t.kind]}（${f(x.before, { m: min })}）`);
  if (t.kind === "pick") {
    out.push(`${x.time}：${jstTime(t.at)}`, `${x.place}：${r.pickupPlace || "—"}`);
    if (r.flightNo) { const fi = r.flightInfo; const eta = fi?.actual ? `${x.land} ${jstTime(fi.actual)}` : fi?.expected ? `${x.eta} ${jstTime(fi.expected)}` : fi?.scheduled ? `${x.eta} ${jstTime(fi.scheduled)}` : "";
      out.push(`${x.flight}：${r.flightNo}${eta ? `　${eta}` : ""}${fi?.delayMin && fi.delayMin > 0 ? `（${f(x.delay, { n: fi.delayMin })}）` : ""}${fi?.terminal ? `　T${fi.terminal}` : ""}`); }
  } else {
    const d = t.drop!;
    out.push(`${x.depart}：${d.departAt}`, `${x.dest}：${d.dest || "—"}${d.terminal ? `　${f(x.term, { n: d.terminal })}` : ""}`);
    if (d.flightAt) out.push(`${x.plane}：${jstTime(d.flightAt)}`);
    const bags = [d.large ? f(x.big, { n: d.large }) : "", d.small ? f(x.small, { n: d.small }) : ""].filter(Boolean).join(" ");
    out.push(`${x.pax}：${f(x.ppl, { n: d.pax || 1 })}${bags ? `　${x.bags}：${bags}` : ""}`);
  }
  out.push(`${x.room}：${t.room.kanji || t.room.name}`);
  const g = t.drop?.names?.[0] || r.guest; if (g) out.push(`${x.guest}：${g}`);
  return out;
}

async function send(rs: Recipient[], key: string, title: (l: L) => string, body: (l: L) => string[]): Promise<void> {
  if (!(await claimNotify(key))) return;
  const url = site() ? `${site()}/driver/go` : undefined;
  let ok = false;
  for (const l of ["ja", "zh"] as L[]) {
    const uids = rs.filter((r) => r.lang === l).map((r) => r.uid); if (!uids.length) continue;
    const res = await sendWxPusher({ title: title(l), content: [title(l), "", ...body(l), "", url ? X[l].tap : X[l].go].join("\n"), uids: uids.join(","), url }).catch(() => ({ ok: false }));
    ok ||= res.ok;
  }
  if (!ok) await unclaimNotify(key); // 送れなかったら、次の回にもう一度
}

/** drops はお見送りの日 (今日・明日) の予約だけ読む。5 分ごと (Crane Nest のシステムへの問い合わせを減らす) */
const g = globalThis as unknown as { __cnDrops?: { at: number; v: Record<string, CnDrop | null> } };
async function dropsOf(res: DRes[], rooms: Map<string, Room>, tokens: Record<string, string>, nowMs: number) {
  const today = jstDay(nowMs), tmr = addDays(today, 1);
  const want = res.filter((r) => [today, tmr].includes(jstDay(r.checkOut)));
  if (!want.length) return {} as Record<string, CnDrop | null>;
  if (g.__cnDrops && nowMs - g.__cnDrops.at < 5 * 60e3) return g.__cnDrops.v;
  const v = await loadCraneNestDrops(want.map((r) => ({ id: r.id, roomKanji: rooms.get(r.roomId)?.kanji ?? null, checkOut: r.checkOut, token: tokens[r.id] ?? null }))).catch(() => ({} as Record<string, CnDrop | null>));
  g.__cnDrops = { at: nowMs, v };
  return v;
}

export async function runTripNotify(res: DRes[], rooms: Map<string, Room>, tokens: Record<string, string>, nowMs = Date.now()): Promise<number> {
  const rs = await recipientsFor("trip").catch(() => null);
  if (!rs?.length) return 0; // 送迎のお知らせは、管理画面で登録した人にだけ
  const { tripMin } = await getNotifySettings();
  const today = jstDay(nowMs), tmr = addDays(today, 1);
  const drops = await dropsOf(res, rooms, tokens, nowMs);
  const trips = (day: string): Trip[] => {
    const out: Trip[] = [];
    for (const r of res) {
      const room = rooms.get(r.roomId); if (!room) continue;
      if (jstDay(r.checkIn) === day && r.pickupAt && !r.pickupNone) out.push({ key: `pick:${r.id}:${r.pickupAt}`, kind: "pick", at: ms(r.pickupAt), r, room });
      const d = drops[r.id];
      if (d && d.date === day && d.departAt && /^\d{1,2}:\d{2}$/.test(d.departAt)) { const at = Date.parse(`${d.date}T${d.departAt.padStart(5, "0")}:00+09:00`); if (Number.isFinite(at)) out.push({ key: `drop:${r.id}:${d.date}T${d.departAt}`, kind: "drop", at, r, room, drop: d }); }
    }
    return out.sort((a, b) => a.at - b.at);
  };
  let n = 0;
  // ① 送迎の N 分前 (遅れて気づいても、送迎の時刻の 10 分後までは送る)
  for (const t of trips(today)) {
    if (nowMs < t.at - tripMin * 60e3 || nowMs > t.at + 10 * 60e3) continue;
    await send(rs, t.key, (l) => `${t.kind === "pick" ? "🚗" : "🛫"} ${X[l][t.kind]} ${jstTime(t.at)} · ${t.room.kanji || t.room.name}${t.kind === "pick" ? ` · ${t.r.pickupPlace || ""}` : t.drop?.dest ? ` → ${t.drop.dest}` : ""}`, (l) => lines(t, l, true, tripMin));
    n++;
  }
  // ② 前の日の夜 20 時〜23 時: 明日の送迎の一覧 (送迎がない日は送らない)
  const hr = Number(jstTime(nowMs).slice(0, 2));
  if (hr >= 20 && hr < 23) {
    const ts = trips(tmr);
    if (ts.length) await send(rs, `sum:${tmr}`, (l) => `📋 ${X[l].tomorrow}（${ts.length}）`, (l) => ts.flatMap((t, i) => [...(i ? [""] : []), `${t.kind === "pick" ? "🚗" : "🛫"} ${X[l][t.kind]}`, ...lines(t, l, false, tripMin)]));
  }
  return n;
}
