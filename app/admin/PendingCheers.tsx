"use client";

/**
 * ゲストが自由に書いた「ひとこと」の承認 (承認したものだけ、お母さんの画面「来自世界的声音」に流れる)。
 *   中文訳を入れて「承認」/ 流さないなら「非表示」。
 */
import { useState, useTransition } from "react";
import { approveCheer, hideCheer } from "./cheerActions";

export interface PendingCheer { id: string; name: string; country: string | null; at: string; text: string; lang: string }

export default function PendingCheers({ items }: { items: PendingCheer[] }) {
  const [list, setList] = useState(items);
  const [zh, setZh] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  if (!list.length) return null;
  const done = (id: string) => setList((l) => l.filter((x) => x.id !== id));
  return (
    <section className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-500/[0.06] p-4">
      <p className="text-sm font-semibold text-amber-200">✉ ゲストのひとこと（承認待ち {list.length} 件）</p>
      <p className="mt-1 text-[11px] text-white/50">承認したものだけ、お母さんの画面に流れます。中文訳は空でも大丈夫です（原文だけ流れます）。</p>
      <div className="mt-3 space-y-3">
        {list.map((x) => (
          <div key={x.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] text-white/45">{x.name}{x.country ? ` · ${x.country}` : ""} · {new Date(x.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            <p className="mt-1 text-sm text-white/90" dir="auto">「{x.text}」</p>
            <input value={zh[x.id] ?? ""} onChange={(e) => setZh({ ...zh, [x.id]: e.target.value })} placeholder="中文訳（任意）"
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30" />
            <div className="mt-2 flex gap-2">
              <button disabled={pending} onClick={() => start(async () => { const r = await approveCheer(x.id, zh[x.id] ?? ""); if (r.ok) done(x.id); })}
                className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">承認して流す</button>
              <button disabled={pending} onClick={() => start(async () => { const r = await hideCheer(x.id); if (r.ok) done(x.id); })}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/70 disabled:opacity-50">流さない</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
