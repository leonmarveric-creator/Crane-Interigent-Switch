"use client";

/**
 * 管理画面 (ツール → テスト): スマホへのお知らせ (WxPusher アプリ) の送り先。
 *   1 人ずつ: 名前・UID・言語・受け取るお知らせ (送迎 / 便槽 / 自動 ON・OFF / 鍵の電池)。人ごとにテスト送信できる
 *   送迎のお知らせ: 送迎の N 分前 + 前の日の夜 20 時に明日の一覧。押すと「送迎 GO」が開く
 *   保存には migration_notify.sql が必要。WxPusher のアプリのトークンは Vercel の環境変数 WXPUSHER_APP_TOKEN
 */
import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Send, Trash2, Check } from "lucide-react";
import { getNotifyConfig, saveNotifyConfig, testNotify } from "./actions";
import type { NotifyTopic, Recipient } from "@/lib/notifyRecipients";

const TX = {
  ja: { title: "スマホへのお知らせ（WxPusher）", sub: "送迎の内容・便槽のピンチなどを、WxPusher アプリに送ります。", token: "WxPusher のアプリのトークン", ok: "設定済み", ng: "未設定（Vercel の環境変数 WXPUSHER_APP_TOKEN）", name: "名前", lang: "言語", trip: "送迎", tank: "便槽", auto: "自動ON/OFF", key: "鍵の電池", add: "送り先を追加", save: "保存", saved: "保存しました ✓", test: "テスト", tripTest: "送迎の見本", sent: "送りました。アプリに届いたか見てください", del: "削除", min: "送迎の何分前に知らせるか", minU: "分前", setup: "Supabase で migration_notify.sql の実行が必要です", help: "UID は WxPusher の管理画面 →「用户管理」に、購読した人ごとに出ます（UID_ で始まる文字）。", env: "まだ誰も登録していないので、今は環境変数 WXPUSHER_UIDS の人に送っています（送迎のお知らせは送りません）。", noSite: "押して開くページの URL がわからないため、リンクなしで送ります。" },
  zh: { title: "手机通知（WxPusher）", sub: "把接送内容、粪池告急等发送到 WxPusher App。", token: "WxPusher 应用 Token", ok: "已设置", ng: "未设置（Vercel 环境变量 WXPUSHER_APP_TOKEN）", name: "名字", lang: "语言", trip: "接送", tank: "粪池", auto: "自动开/关", key: "门锁电池", add: "添加接收人", save: "保存", saved: "已保存 ✓", test: "测试", tripTest: "接送样例", sent: "已发送，请在 App 里确认", del: "删除", min: "接送前几分钟提醒", minU: "分钟前", setup: "需要在 Supabase 执行 migration_notify.sql", help: "UID 在 WxPusher 管理后台 →「用户管理」里，每个订阅的人都有（以 UID_ 开头）。", env: "还没有登记接收人，现在发给环境变量 WXPUSHER_UIDS 里的人（不发送接送通知）。", noSite: "不知道点开后的网址，所以不带链接发送。" },
};
const TOPICS: NotifyTopic[] = ["trip", "tank", "auto", "key"];

export default function NotifyCard({ lang }: { lang: string }) {
  const x = lang === "zh" ? TX.zh : TX.ja;
  const [cfg, setCfg] = useState<Awaited<ReturnType<typeof getNotifyConfig>> | null>(null);
  const [rs, setRs] = useState<Recipient[]>([]), [min, setMin] = useState(30);
  const [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { getNotifyConfig().then((c) => { setCfg(c); setRs(c.recipients); setMin(c.tripMin); }).catch(() => setMsg(x.setup)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (i: number, p: Partial<Recipient>) => setRs((a) => a.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const save = () => start(async () => { const r = await saveNotifyConfig(rs, min); setMsg(r.ok ? x.saved : r.error === "SETUP" ? x.setup : r.error ?? "ERROR"); });
  const test = async (r: Recipient, kind: "trip" | "plain") => {
    setBusy(`${r.uid}:${kind}`); setMsg(null);
    const res = await testNotify(r.uid, kind, r.lang).catch((e) => ({ ok: false, error: String(e) }));
    setBusy(null); setMsg(res.ok ? `${r.name || r.uid}: ${x.sent}` : `${r.name || r.uid}: ${res.error}`);
  };
  const inp = "rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400/60";
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">{x.title}</h3>
      <p className="mt-0.5 text-xs text-white/50">{x.sub}</p>
      {cfg && (
        <div className="mt-2 space-y-1 text-xs">
          <p className={cfg.tokenSet ? "text-emerald-300" : "text-amber-300"}>{x.token}：{cfg.tokenSet ? x.ok : x.ng}</p>
          {!cfg.recipients.length && cfg.envUids && <p className="text-white/50">{x.env}</p>}
          {!cfg.siteSet && <p className="text-white/40">{x.noSite}</p>}
        </div>
      )}
      <div className="mt-3 space-y-3">
        {rs.map((r, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap gap-2">
              <input className={`${inp} w-28`} placeholder={x.name} value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <input className={`${inp} min-w-0 flex-1 font-mono text-xs`} placeholder="UID_xxxxxxxx" value={r.uid} onChange={(e) => upd(i, { uid: e.target.value.trim() })} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              <select className={inp} value={r.lang} onChange={(e) => upd(i, { lang: e.target.value === "zh" ? "zh" : "ja" })}><option value="ja">日本語</option><option value="zh">中文</option></select>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOPICS.map((t) => { const on = r.topics.includes(t); return (
                <button key={t} type="button" onClick={() => upd(i, { topics: on ? r.topics.filter((k) => k !== t) : [...r.topics, t] })}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${on ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/15 text-white/45"}`}>
                  {on && <Check className="h-3 w-3" />}{x[t]}
                </button>); })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" disabled={!!busy} onClick={() => test(r, "plain")} className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80">{busy === `${r.uid}:plain` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}{x.test}</button>
              <button type="button" disabled={!!busy} onClick={() => test(r, "trip")} className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80">{busy === `${r.uid}:trip` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}{x.tripTest}</button>
              <button type="button" onClick={() => setRs((a) => a.filter((_, j) => j !== i))} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-300/80"><Trash2 className="h-3 w-3" />{x.del}</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setRs((a) => [...a, { name: "", uid: "", lang: "ja", topics: ["tank"] }])} className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs text-white/70"><Plus className="h-3.5 w-3.5" />{x.add}</button>
        <p className="text-[11px] leading-relaxed text-white/40">{x.help}</p>
        <label className="flex items-center gap-2 text-xs text-white/70">{x.min}
          <select className={inp} value={min} onChange={(e) => setMin(Number(e.target.value))}>{[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}{x.minU}</option>)}</select>
        </label>
        <button type="button" onClick={save} disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/20 py-2.5 text-sm font-semibold text-cyan-100">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{x.save}</button>
        {msg && <p className="text-xs text-cyan-200/80">{msg}</p>}
      </div>
    </section>
  );
}
