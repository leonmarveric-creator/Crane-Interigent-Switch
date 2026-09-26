"use client";

/**
 * 管理画面: お父さんの送迎画面 (HIROSHI DRIVE /driver) のデザインを切り替える (ツール → テスト)。
 *   ハイブリッド = 愛車のダッシュボード / バイク = お父さんの絵とタコメーター。保存には migration_driver.sql が必要。
 */
import { useState, useTransition } from "react";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { setDriverDesign } from "./actions";

type Design = "hybrid" | "bike";
const OPTIONS: { v: Design; ja: string; en: string; noteJa: string; noteEn: string }[] = [
  { v: "hybrid", ja: "🚙 ハイブリッド", en: "🚙 Hybrid", noteJa: "愛車のダッシュボード・START で起動", noteEn: "Car dashboard, START to boot" },
  { v: "bike", ja: "🏍 バイク", en: "🏍 Bike", noteJa: "お父さんの絵・エンジン音で起動", noteEn: "Dad illustration, engine start" },
];

export default function DriverDesignCard({ initial, lang }: { initial: Design; lang: string }) {
  const [design, setDesign] = useState<Design>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ja = lang !== "en";
  const choose = (v: Design) => {
    if (v === design) return;
    const prev = design;
    setDesign(v); setMsg(null);
    start(async () => {
      const r = await setDriverDesign(v);
      if (r.ok) setMsg(ja ? "保存しました ✓（お父さんの画面は次に開いたときに変わります）" : "Saved ✓");
      else { setDesign(prev); setMsg(ja ? "Supabase で migration_driver.sql の実行が必要です" : "Run migration_driver.sql in Supabase"); }
    });
  };
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">{ja ? "お父さんの送迎画面（HIROSHI DRIVE）" : "Driver screen (HIROSHI DRIVE)"}</h3>
        <a href="/driver" target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs text-cyan-300">/driver <ExternalLink className="h-3 w-3" /></a>
      </div>
      <p className="mt-0.5 text-xs text-white/50">{ja ? "画面のデザインを選びます。お父さんの設定画面からも変えられます。" : "Choose the design. Also changeable from the driver's settings."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const on = design === o.v;
          return (
            <button key={o.v} type="button" onClick={() => choose(o.v)} disabled={pending}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left ${on ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-cyan-300 bg-cyan-400 text-black" : "border-white/30"}`}>
                {on && (pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{ja ? o.ja : o.en}</span>
                <span className="block text-[11px] text-white/45">{ja ? o.noteJa : o.noteEn}</span>
              </span>
            </button>
          );
        })}
      </div>
      {msg && <p className="mt-2 text-xs text-cyan-200/80">{msg}</p>}
    </section>
  );
}
