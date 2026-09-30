"use client";

/**
 * K-OPS: 曲・歌詞・アルバムカバーの管理。
 *   ・起動 / ノーマル / クルーズ の 3 本のテープに曲を追加 (iPhone のファイルからも選べる)
 *   ・歌詞はお父さんの画面 (HIROSHI DRIVE) と同じシートで付ける (貼り付け・ファイル・タイミング合わせ)
 *   ・カバーは画像を選ぶか、MP3 に入っているジャケットを自動で使う
 */
import { useCallback, useEffect, useState } from "react";
import { LyricsSheet } from "@/components/driver/DriverMusic";
import type { DriverTrack } from "@/lib/driverData";
import { makeT } from "@/lib/driverI18n";
import { compressCover, mp3Cover } from "@/lib/driverCover";

type Which = "boot" | "normal" | "cruise";
interface Tr { id: string; title: string; url: string; lrc?: string | null; cover?: string | null }
const TAPES: { k: Which; n: string; en: string; d: string }[] = [
  { k: "normal", n: "ノーマル", en: "NORMAL", d: "ミッション中に流す曲" },
  { k: "cruise", n: "クルーズ", en: "CRUISE", d: "クルーズモード (橋・高速) の曲" },
  { k: "boot", n: "起動・ホーム", en: "BOOT", d: "起動・待機画面の曲" },
];
const tJa = makeT("ja");
const post = (b: any) => fetch("/api/kaku", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({ ok: false, error: "NET" }));
const ERR: Record<string, string> = {
  SETUP: "Supabase で migration_kaku.sql を実行してください",
  SETUP_LRC: "歌詞の保存には Supabase で migration_kaku_lyrics.sql を実行してください",
  SETUP_COVER: "カバーの保存には Supabase で migration_kaku_cover.sql を実行してください",
  LEGACY: "前にアップした曲には付けられません (消して追加し直してください)",
};
const em = (e?: string) => ERR[e || ""] || `できませんでした (${e || "?"})`;

export default function KOpsLibrary({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [tab, setTab] = useState<Which>("normal");
  const [tracks, setTracks] = useState<Record<Which, Tr[]>>({ boot: [], normal: [], cruise: [] });
  const [setup, setSetup] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ly, setLy] = useState<Tr | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; v: string } | null>(null);
  const toast = (s: string) => setMsg(s);

  const load = useCallback(async () => {
    const r = await fetch("/api/kaku", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setMsg("読み込めませんでした"); return; }
    setTracks({ boot: r.tracks?.boot ?? [], normal: r.tracks?.normal ?? [], cruise: r.tracks?.cruise ?? [] });
    setSetup([r.tracksSetup && ERR.SETUP, r.lyricsSetup && ERR.SETUP_LRC, r.coverSetup && ERR.SETUP_COVER].filter(Boolean) as string[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const changed = async () => { await load(); onChange(); };

  /** カバーを上げて付ける */
  async function putCover(id: string, img: Blob, quiet = false): Promise<boolean> {
    const c = await compressCover(img); if (!c) { if (!quiet) setMsg("画像を読み込めませんでした"); return false; }
    const u = await post({ op: "coverUrl", id, ext: c.ext }); if (!u.ok) { if (!quiet) setMsg(em(u.error)); return false; }
    const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": c.ext === "webp" ? "image/webp" : "image/jpeg", "x-upsert": "false" }, body: c.blob }).catch(() => null);
    if (!put?.ok) { if (!quiet) setMsg("アップロードできませんでした"); return false; }
    const r = await post({ op: "coverSet", id, path: u.path }); if (!r.ok) { if (!quiet) setMsg(em(r.error)); return false; }
    return true;
  }
  /** 曲を追加 (MP3 にジャケットが入っていれば、それをカバーにする) */
  async function addSongs(files: File[]) {
    setBusy(true); let ok = 0, cov = 0;
    for (const [i, f] of files.entries()) {
      setMsg(`アップロード中… (${i + 1}/${files.length}) ${f.name}`);
      const ext = (f.name.split(".").pop() || "mp3").toLowerCase();
      const u = await post({ op: "bgmUrl", which: tab, ext: /^(mp3|m4a|aac|wav)$/.test(ext) ? ext : "mp3" });
      if (!u.ok) { setMsg(em(u.error)); break; }
      const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": f.type || "audio/mpeg", "x-upsert": "false" }, body: f }).catch(() => null);
      if (!put?.ok) { setMsg(`アップロードできませんでした: ${f.name}`); continue; }
      const r = await post({ op: "trackAdd", which: tab, path: u.path, title: f.name.replace(/\.[^.]+$/, "").slice(0, 80) });
      if (!r.ok) { setMsg(em(r.error)); break; }
      ok++;
      const art = await mp3Cover(f).catch(() => null);
      if (art && (await putCover(r.id, art, true))) cov++;
    }
    await changed(); setBusy(false);
    if (ok) setMsg(`✓ ${ok} 曲追加しました${cov ? ` (カバー ${cov} 枚は曲の中の画像を使いました)` : ""}`);
  }
  async function setCoverFile(id: string, f: File) { setBusy(true); setMsg("カバーを保存中…"); if (await putCover(id, f)) { await changed(); setMsg("✓ カバーを付けました"); } setBusy(false); }
  async function removeCover(id: string) { const r = await post({ op: "coverSet", id, path: null }); if (!r.ok) return setMsg(em(r.error)); await changed(); setMsg("カバーを外しました"); }
  async function del(id: string) { setDelId(null); const r = await post({ op: "trackDel", id }); if (!r.ok) return setMsg(em(r.error)); await changed(); setMsg("消しました"); }
  async function move(i: number, d: -1 | 1) {
    const arr = tracks[tab].filter((t) => !t.id.startsWith("legacy-")); const j = i + d; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setTracks({ ...tracks, [tab]: [...tracks[tab].filter((t) => t.id.startsWith("legacy-")), ...arr] });
    const r = await post({ op: "trackOrder", ids: arr.map((t) => t.id) }); if (!r.ok) setMsg(em(r.error)); await changed();
  }
  async function rename(id: string, v: string) {
    setEdit(null); const t = v.trim(); if (!t) return;
    const r = await post({ op: "trackTitle", id, title: t }); if (!r.ok) return setMsg(em(r.error)); await changed();
  }

  const list = tracks[tab];
  const legacy = list.filter((t) => t.id.startsWith("legacy-")), normal = list.filter((t) => !t.id.startsWith("legacy-"));
  return (
    <div className="klib" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div className="kl-box">
        <div className="kl-h"><b>MUSIC LIBRARY</b><small>曲・歌詞・アルバムカバー</small><button className="kl-x" onClick={onClose}>✕</button></div>
        <div className="kl-tabs">{TAPES.map((t) => (
          <button key={t.k} className={tab === t.k ? "on" : ""} onClick={() => { setTab(t.k); setDelId(null); }}><b>{t.en}</b><small>{t.n} · {tracks[t.k].length}</small></button>
        ))}</div>
        <div className="kl-sub">{TAPES.find((t) => t.k === tab)!.d}。上から順に流れます。</div>
        {setup.map((s) => <div key={s} className="kl-warn">{s}</div>)}
        <label className={`kl-add ${busy ? "dis" : ""}`}>＋ 曲を追加<small>MP3 / M4A / AAC / WAV · 何曲でも</small>
          <input type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav" disabled={busy} onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) void addSongs(fs); }} />
        </label>
        <div className="kl-list">
          {!list.length && <div className="kl-empty">まだ曲がありません</div>}
          {legacy.map((t) => (
            <div key={t.id} className="kl-row"><div className="kl-cv"><img src="/cabin/bay.webp" alt="" /></div>
              <div className="kl-t"><b>{t.title}</b><small>前の設定でアップした曲 · 歌詞・カバーは付けられません</small></div>
              <div className="kl-b">{delId === t.id ? <button className="del on" onClick={() => void del(t.id)}>本当に消す</button> : <button className="del" onClick={() => setDelId(t.id)}>🗑</button>}</div></div>
          ))}
          {normal.map((t, i) => (
            <div key={t.id} className="kl-row">
              <label className="kl-cv" title="カバー画像を選ぶ"><img src={t.cover || "/cabin/bay.webp"} alt="" className={t.cover ? "" : "ph"} /><span>{t.cover ? "変更" : "＋ カバー"}</span>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void setCoverFile(t.id, f); }} /></label>
              <div className="kl-t">
                {edit?.id === t.id
                  ? <input autoFocus value={edit.v} maxLength={80} onChange={(e) => setEdit({ id: t.id, v: e.target.value })} onBlur={() => void rename(t.id, edit.v)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(null); }} />
                  : <b onClick={() => setEdit({ id: t.id, v: t.title })} title="タップで曲名を変える">{i + 1}. {t.title} <em>✎</em></b>}
                <small>{t.lrc ? "✓ 歌詞あり" : "歌詞なし"}{t.cover ? " · ✓ カバー" : ""}</small>
              </div>
              <div className="kl-b">
                <button className={t.lrc ? "ly has" : "ly"} onClick={() => setLy(t)}>{t.lrc ? "✓ 歌詞" : "＋ 歌詞"}</button>
                {t.cover && <button onClick={() => void removeCover(t.id)} title="カバーを外す">⊘</button>}
                <button disabled={i === 0} onClick={() => void move(i, -1)}>▲</button>
                <button disabled={i === normal.length - 1} onClick={() => void move(i, 1)}>▼</button>
                {delId === t.id ? <button className="del on" onClick={() => void del(t.id)}>本当に消す</button> : <button className="del" onClick={() => setDelId(t.id)}>🗑</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="kl-msg">{msg || "カバー: 画像をタップして選ぶ (MP3 に入っているジャケットは自動で使います) · 曲名はタップで変更"}</div>
      </div>
      {ly && (
        <div className="drv" style={{ position: "fixed", inset: 0, zIndex: 3100, minHeight: 0, padding: 0, background: "transparent", userSelect: "text", WebkitUserSelect: "text" }}>
          <LyricsSheet
            tr={{ id: ly.id, purpose: "in", startSec: 0, lang: "ja", title: ly.title, artist: null, url: ly.url, cover: ly.cover ?? null, lrc: ly.lrc ?? null, sort: 0 } as DriverTrack}
            t={tJa} toast={toast} onClose={() => setLy(null)}
            onSave={(lrc) => { setLy((x) => (x ? { ...x, lrc } : x)); void post({ op: "trackLrc", id: ly.id, lrc }).then(async (r) => { if (!r.ok) setMsg(em(r.error)); else { await changed(); setMsg(lrc ? "✓ 歌詞を保存しました" : "歌詞を消しました"); } }); }}
          />
        </div>
      )}
    </div>
  );
}

const CSS = `
.klib{position:fixed;inset:0;z-index:3000;background:rgba(0,6,4,.72);display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));font-family:"Rajdhani","Hiragino Sans","PingFang SC",sans-serif;color:#eafff6;-webkit-user-select:none;user-select:none}
.kl-box{width:min(760px,100%);max-height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,#06231a,#020b07);border:1px solid rgba(70,245,175,.62);box-shadow:0 0 30px rgba(60,242,166,.25);border-radius:8px;overflow:hidden}
.kl-h{display:flex;align-items:baseline;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(60,242,166,.2)}
.kl-h b{font-size:20px;letter-spacing:.24em;color:#3cf2a6}.kl-h small{font-size:13px;color:#86b9a5}
.kl-x{margin-left:auto;background:none;border:1px solid rgba(70,245,175,.5);color:#bfffe0;width:36px;height:32px;border-radius:6px;font-size:16px}
.kl-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px 4px}
.kl-tabs button{background:rgba(4,17,13,.9);border:1px solid rgba(60,242,166,.25);color:#cfe9df;padding:8px 4px;border-radius:6px;text-align:center}
.kl-tabs button b{display:block;font-size:16px;letter-spacing:.2em}.kl-tabs button small{font-size:11.5px;color:#86b9a5}
.kl-tabs button.on{border-color:#3cf2a6;background:linear-gradient(180deg,rgba(60,242,166,.18),rgba(60,242,166,.04));box-shadow:inset 0 -2px 0 #3cf2a6;color:#fff}
.kl-sub{padding:6px 16px 0;font-size:12.5px;color:#86b9a5}
.kl-warn{margin:8px 16px 0;padding:8px 10px;border:1px solid #ffb020;color:#ffd28a;border-radius:6px;font-size:13px}
.kl-add{position:relative;display:block;margin:10px 16px;padding:12px;text-align:center;border:1.5px dashed #3cf2a6;border-radius:8px;color:#3cf2a6;font-size:17px;letter-spacing:.1em;cursor:pointer}
.kl-add small{display:block;font-size:11px;color:#86b9a5;letter-spacing:.05em}.kl-add.dis{opacity:.5}
.kl-add input,.kl-cv input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.kl-list{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 16px 8px}
.kl-empty{padding:24px;text-align:center;color:#86b9a5}
.kl-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(60,242,166,.14)}
.kl-cv{position:relative;flex:0 0 58px;width:58px;height:58px;border:1px solid rgba(60,242,166,.4);border-radius:4px;overflow:hidden;cursor:pointer}
.kl-cv img{width:100%;height:100%;object-fit:cover;display:block}.kl-cv img.ph{opacity:.35}
.kl-cv span{position:absolute;left:0;right:0;bottom:0;font-size:10px;text-align:center;background:rgba(0,10,6,.75);color:#bfffe0;padding:1px 0}
.kl-t{flex:1;min-width:0}.kl-t b{display:block;font:600 15px "Hiragino Sans","PingFang SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:text}
.kl-t b em{font-style:normal;color:#86b9a5;font-size:12px}
.kl-t input{width:100%;background:#031a12;border:1px solid #3cf2a6;color:#fff;font-size:16px;padding:4px 6px;border-radius:4px}
.kl-t small{font-size:11.5px;color:#86b9a5}
.kl-b{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;max-width:52%}
.kl-b button{min-width:34px;height:32px;padding:0 8px;border-radius:5px;border:1px solid rgba(60,242,166,.35);background:rgba(4,17,13,.9);color:#dff;font-size:13px}
.kl-b button:disabled{opacity:.3}.kl-b .ly{color:#3cf2a6}.kl-b .ly.has{background:rgba(60,242,166,.15);border-color:#3cf2a6}
.kl-b .del.on{border-color:#ff5a5a;color:#ff8a8a;background:rgba(80,0,0,.4)}
.kl-msg{padding:10px 16px;border-top:1px solid rgba(60,242,166,.2);font-size:12.5px;color:#bfffe0;min-height:20px}
@media (max-width:520px){.kl-b{max-width:none;width:100%}.kl-row{flex-wrap:wrap}}
`;
