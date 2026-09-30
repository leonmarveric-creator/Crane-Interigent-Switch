import { NextRequest, NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * AGENT KAKU (/kaku) のサーバー側。
 *   GET  ?op=ext&k=fx|eq|wx|planes|news|geo|route|conv … 外の情報 (ブラウザからは取れないものもあるのでここを通す)
 *   GET  (op なし)                                      … 記録・お気に入り・BGM
 *   POST {op:"log"|"fav"|"bgmUrl"|"bgmSet"}
 */
export const dynamic = "force-dynamic";
const J = (v: any, status = 200) => NextResponse.json(v, { status, headers: { "cache-control": "no-store" } });
const UA = { "user-agent": "CraneNest-AgentKaku/1.0 (guesthouse car display)", "accept-language": "ja" };
const num = (v: string | null, lo: number, hi: number) => { const n = Number(v); return v != null && v !== "" && isFinite(n) && n >= lo && n <= hi ? n : null; };
const BUCKET = "driver-music";
const pub = (p: string | null) => (p ? supabaseAdmin.storage.from(BUCKET).getPublicUrl(p).data.publicUrl : null);

async function get(url: string, sec: number, json = true): Promise<any> {
  const r = await fetch(url, { headers: UA, next: { revalidate: sec } } as any);
  if (!r.ok) throw new Error(String(r.status));
  return json ? r.json() : r.text();
}

/** 外の情報。取れなければ例外 (呼ぶ側で ok:false) */
async function ext(k: string, q: URLSearchParams): Promise<any> {
  if (k === "fx") { const d = await get("https://open.er-api.com/v6/latest/JPY", 3600); return { TWD: d.rates?.TWD, HKD: d.rates?.HKD, USD: d.rates?.USD }; }
  if (k === "eq") {
    const d = await get("https://api.p2pquake.net/v2/history?codes=551&limit=1", 60); const e = d?.[0]?.earthquake; if (!e) return null;
    return { place: e.hypocenter?.name || "不明", mag: e.hypocenter?.magnitude ?? null, max: e.maxScale ?? 0, time: e.time };
  }
  if (k === "wx") {
    const d = await get("https://api.open-meteo.com/v1/forecast?latitude=34.426&longitude=135.279&current=wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=ms&timezone=Asia%2FTokyo", 600);
    return { wind: d.current?.wind_speed_10m ?? null, dir: d.current?.wind_direction_10m ?? null, code: d.current?.weather_code ?? null };
  }
  if (k === "planes") {
    const lat = 34.4347, lng = 135.244;
    const d = await get(`https://opensky-network.org/api/states/all?lamin=${lat - 0.36}&lamax=${lat + 0.36}&lomin=${lng - 0.44}&lomax=${lng + 0.44}`, 15);
    return (d.states || []).filter((s: any) => s[5] && s[6] && !s[8]).slice(0, 40)
      .map((s: any) => ({ cs: String(s[1] || s[0]).trim(), from: s[2], lat: s[6], lng: s[5], alt: Math.round(s[7] || s[13] || 0), hd: s[10] || 0, v: Math.round((s[9] || 0) * 3.6) }));
  }
  if (k === "news") {
    const x: string = await get("https://www3.nhk.or.jp/rss/news/cat0.xml", 600, false);
    return [...x.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()).slice(0, 8);
  }
  if (k === "geo") {
    const s = (q.get("q") || "").slice(0, 80); if (!s.trim()) return [];
    const d = await get(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(s)}`, 86400);
    return (d || []).map((r: any) => ({ n: String(r.display_name).split(",")[0].trim(), sub: String(r.display_name).split(",").slice(1, 4).join(",").trim(), ll: [Number(r.lat), Number(r.lon)] }));
  }
  if (k === "route") {
    const a = [num(q.get("alat"), 20, 50), num(q.get("alng"), 120, 155)], b = [num(q.get("blat"), 20, 50), num(q.get("blng"), 120, 155)];
    if ([...a, ...b].some((v) => v == null)) return null;
    const d = await get(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, 3600);
    const r = d.routes?.[0]; if (!r) return null;
    return { pts: r.geometry.coordinates.map(([x, y]: number[]) => [y, x]), dur: r.duration };
  }
  if (k === "conv") {
    const lat = num(q.get("lat"), 20, 50), lng = num(q.get("lng"), 120, 155); if (lat == null || lng == null) return null;
    const body = `[out:json][timeout:10];node(around:2000,${lat},${lng})[shop=convenience];out 15;`;
    const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { ...UA, "content-type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(body), cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    return (d.elements || []).map((e: any) => ({ n: e.tags?.name || e.tags?.brand || "コンビニ", ll: [e.lat, e.lon] }));
  }
  throw new Error("BAD_K");
}

/** 記録・お気に入り・BGM (SQL をまだ実行していなければ setup: true) */
async function state() {
  const jst = new Date(Date.now() + 9 * 3600000);
  const month = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3600000).toISOString();
  const today = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 3600000).toISOString();
  const [pl, ms, st, sb, tk, dd] = await Promise.all([
    supabaseAdmin.from("kaku_places").select("name,lat,lng,type,fav,visits").order("visits", { ascending: false }).limit(200),
    supabaseAdmin.from("kaku_missions").select("name,kind,type,km,sec,kept,rank,ended_at").gte("ended_at", month).order("ended_at", { ascending: false }).limit(300),
    supabaseAdmin.from("app_settings").select("kaku_bgm_normal,kaku_bgm_cruise").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("app_settings").select("kaku_bgm_boot").eq("id", 1).maybeSingle(),
    // カバー (cover_path)・歌詞 (lrc) の列がまだ無いときは、あるものだけで読む
    supabaseAdmin.from("kaku_tracks").select("id,which,title,path,sort,lrc,cover_path").order("sort").order("created_at").limit(300)
      .then((r) => (r.error && /cover_path/.test(r.error.message) ? supabaseAdmin.from("kaku_tracks").select("id,which,title,path,sort,lrc").order("sort").order("created_at").limit(300).then((x) => ({ ...x, noCover: true })) : { ...r, noCover: false }))
      .then((r: any) => (r.error && /lrc/.test(r.error.message) ? supabaseAdmin.from("kaku_tracks").select("id,which,title,path,sort").order("sort").order("created_at").limit(300).then((x) => ({ ...x, noLrc: true, noCover: true })) : { ...r, noLrc: false })),
    // お父さんの画面 (HIROSHI DRIVE) で登録した曲も、K-OPS で流せるようにする (読むだけ)
    supabaseAdmin.from("driver_tracks").select("*").order("purpose").order("sort").order("created_at").limit(300),
  ]);
  const missions = (ms.data ?? []) as any[];
  return {
    setup: !!(pl.error || ms.error || st.error),
    places: ((pl.data ?? []) as any[]).map((p) => ({ n: p.name, ll: [p.lat, p.lng], type: p.type, fav: p.fav, visits: p.visits })),
    missions: missions.slice(0, 50),
    monthKm: Math.round(missions.reduce((a, m) => a + Number(m.km || 0), 0) * 10) / 10,
    monthCount: missions.length,
    todayCount: missions.filter((m) => m.ended_at >= today).length,
    // プレイリスト。前の「1 曲だけ」の設定が残っていれば、先頭に入れる (id: legacy-…)
    tracks: (() => {
      const out: Record<string, { id: string; title: string; url: string; lrc?: string | null; cover?: string | null; artist?: string | null; start?: number }[]> = { boot: [], normal: [], cruise: [], dad: [] };
      const leg: Record<string, string | null> = { boot: (sb.data as any)?.kaku_bgm_boot ?? null, normal: (st.data as any)?.kaku_bgm_normal ?? null, cruise: (st.data as any)?.kaku_bgm_cruise ?? null };
      for (const w of ["boot", "normal", "cruise"]) if (leg[w]) out[w].push({ id: `legacy-${w}`, title: "アップした曲", url: pub(leg[w])! });
      for (const t of (tk.data ?? []) as any[]) if (out[t.which]) out[t.which].push({ id: t.id, title: t.title, url: pub(t.path)!, lrc: t.lrc ?? null, cover: pub(t.cover_path ?? null) });
      for (const t of ((dd as any).error ? [] : (dd as any).data ?? []) as any[]) if (t.file_path) out.dad.push({ id: `dad-${t.id}`, title: t.title, artist: t.artist ?? null, url: pub(t.file_path)!, lrc: t.lrc ?? null, cover: pub(t.cover_path ?? null), start: Number(t.start_sec) || 0 });
      return out;
    })(),
    tracksSetup: !!tk.error,
    lyricsSetup: !tk.error && (tk as any).noLrc === true,
    coverSetup: !tk.error && (tk as any).noCover === true,
    bgm: { boot: pub((sb.data as any)?.kaku_bgm_boot ?? null), normal: pub((st.data as any)?.kaku_bgm_normal ?? null), cruise: pub((st.data as any)?.kaku_bgm_cruise ?? null) },
  };
}

export async function GET(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const q = req.nextUrl.searchParams;
  if (q.get("op") === "ext") {
    try { return J({ ok: true, data: await ext(q.get("k") || "", q) }); } catch (e) { return J({ ok: false, error: String((e as Error)?.message || e) }); }
  }
  try { return J({ ok: true, ...(await state()) }); } catch (e) { return J({ ok: false, error: String((e as Error)?.message || e) }); }
}

const clean = (s: unknown, n = 60) => String(s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const setupErr = (m: string) => (/kaku_/.test(m) ? "SETUP" : m);

export async function POST(req: NextRequest) {
  if (!isStaff()) return J({ ok: false, error: "UNAUTHORIZED" }, 401);
  const b = await req.json().catch(() => ({} as any));
  // ミッション完了 → 記録と、行った場所の回数
  if (b.op === "log") {
    const stops = (Array.isArray(b.stops) ? b.stops : []).slice(0, 6)
      .map((s: any) => ({ n: clean(s?.n), ll: [Number(s?.ll?.[0]), Number(s?.ll?.[1])], type: clean(s?.type, 10) || null }))
      .filter((s: any) => s.n && isFinite(s.ll[0]) && isFinite(s.ll[1]));
    const row = {
      name: clean(b.name) || "MISSION", kind: b.kind === "guest" ? "guest" : "free", type: clean(b.type, 10) || null, stops,
      km: Math.max(0, Math.min(2000, Number(b.km) || 0)), sec: Math.max(0, Math.min(86400, Math.round(Number(b.sec) || 0))),
      kept: Math.max(0, Math.min(100, Math.round(Number(b.kept) || 0))), rank: clean(b.rank, 3) || null,
      started_at: Number(b.started) > 0 ? new Date(Number(b.started)).toISOString() : null,
    };
    const { error } = await supabaseAdmin.from("kaku_missions").insert(row);
    if (error) return J({ ok: false, error: setupErr(error.message) });
    for (const s of stops) {
      const { data: old } = await supabaseAdmin.from("kaku_places").select("visits").eq("name", s.n).maybeSingle();
      await supabaseAdmin.from("kaku_places").upsert({ name: s.n, lat: s.ll[0], lng: s.ll[1], type: s.type, visits: ((old as any)?.visits ?? 0) + 1, last_at: new Date().toISOString() }, { onConflict: "name" });
    }
    return J({ ok: true });
  }
  // お気に入り ★
  if (b.op === "fav") {
    const n = clean(b.n), lat = Number(b.ll?.[0]), lng = Number(b.ll?.[1]);
    if (!n || !isFinite(lat) || !isFinite(lng)) return J({ ok: false, error: "BAD" });
    const { error } = await supabaseAdmin.from("kaku_places").upsert({ name: n, lat, lng, type: clean(b.type, 10) || null, fav: !!b.fav }, { onConflict: "name" });
    return J(error ? { ok: false, error: setupErr(error.message) } : { ok: true });
  }
  // プレイリスト: 曲を追加 / 消す / 並べ替え
  if (b.op === "trackAdd") {
    const which = ["boot", "normal", "cruise"].includes(b.which) ? b.which : null, path = String(b.path || "");
    if (!which || !new RegExp(`^kaku/bgm-${which}-[\\w-]+\\.(mp3|m4a|aac|wav)$`).test(path)) return J({ ok: false, error: "BAD" });
    const { data: last } = await supabaseAdmin.from("kaku_tracks").select("sort").eq("which", which).order("sort", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabaseAdmin.from("kaku_tracks").insert({ which, path, title: clean(b.title, 80) || "曲", sort: ((last as any)?.sort ?? 0) + 1 }).select("id").single();
    if (error) { await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => null); return J({ ok: false, error: setupErr(error.message) }); }
    return J({ ok: true, id: (data as any).id, url: pub(path) });
  }
  if (b.op === "trackDel") {
    const id = String(b.id || "");
    if (id.startsWith("legacy-")) {
      const w = id.slice(7); if (!["boot", "normal", "cruise"].includes(w)) return J({ ok: false, error: "BAD" });
      const col = `kaku_bgm_${w}`; const { data: old } = await supabaseAdmin.from("app_settings").select(col).eq("id", 1).maybeSingle();
      await supabaseAdmin.from("app_settings").update({ [col]: null }).eq("id", 1); const p0 = (old as any)?.[col]; if (p0) await supabaseAdmin.storage.from(BUCKET).remove([p0]).catch(() => null);
      return J({ ok: true });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return J({ ok: false, error: "BAD" });
    let del: any = await supabaseAdmin.from("kaku_tracks").delete().eq("id", id).select("path,cover_path").maybeSingle();
    if (del.error && /cover_path/.test(del.error.message)) del = await supabaseAdmin.from("kaku_tracks").delete().eq("id", id).select("path").maybeSingle();
    const gone = [del.data?.path, del.data?.cover_path].filter(Boolean) as string[];
    if (gone.length) await supabaseAdmin.storage.from(BUCKET).remove(gone).catch(() => null);
    return J({ ok: true });
  }
  // 歌詞 (LRC)。null で消す
  if (b.op === "trackLrc") {
    const id = String(b.id || "");
    if (id.startsWith("legacy-")) return J({ ok: false, error: "LEGACY" });
    if (!/^[0-9a-f-]{36}$/i.test(id)) return J({ ok: false, error: "BAD" });
    const lrc = b.lrc == null ? null : String(b.lrc).replace(/\u0000/g, "").slice(0, 60000) || null;
    const { error } = await supabaseAdmin.from("kaku_tracks").update({ lrc }).eq("id", id);
    return J(error ? { ok: false, error: /lrc/.test(error.message) ? "SETUP_LRC" : setupErr(error.message) } : { ok: true });
  }
  // 曲名を変える
  if (b.op === "trackTitle") {
    const id = String(b.id || ""), title = clean(b.title, 80);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !title) return J({ ok: false, error: "BAD" });
    const { error } = await supabaseAdmin.from("kaku_tracks").update({ title }).eq("id", id);
    return J(error ? { ok: false, error: setupErr(error.message) } : { ok: true });
  }
  // アルバムカバー: アップロード先を作る → 付ける / 外す (path: null)。前の画像は消す
  if (b.op === "coverUrl") {
    const id = String(b.id || ""), ext = b.ext === "jpg" ? "jpg" : "webp";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return J({ ok: false, error: "BAD" });
    const path = `kaku/cover-${id.slice(0, 8)}-${Date.now().toString(36)}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    return J(error || !data ? { ok: false, error: error?.message || "UPLOAD_URL" } : { ok: true, path, signedUrl: data.signedUrl });
  }
  if (b.op === "coverSet") {
    const id = String(b.id || ""), path: string | null = b.path ?? null;
    if (!/^[0-9a-f-]{36}$/i.test(id) || (path && !/^kaku\/cover-[\w-]+\.(webp|jpg)$/.test(path))) return J({ ok: false, error: "BAD" });
    const { data: old } = await supabaseAdmin.from("kaku_tracks").select("cover_path").eq("id", id).maybeSingle();
    const { error } = await supabaseAdmin.from("kaku_tracks").update({ cover_path: path }).eq("id", id);
    if (error) {
      if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => null);
      return J({ ok: false, error: /cover_path/.test(error.message) ? "SETUP_COVER" : setupErr(error.message) });
    }
    const prev = (old as any)?.cover_path; if (prev && prev !== path) await supabaseAdmin.storage.from(BUCKET).remove([prev]).catch(() => null);
    return J({ ok: true, url: pub(path) });
  }
  if (b.op === "trackOrder") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
    for (let i = 0; i < ids.length; i++) { const { error } = await supabaseAdmin.from("kaku_tracks").update({ sort: i + 1 }).eq("id", ids[i]); if (error) return J({ ok: false, error: setupErr(error.message) }); }
    return J({ ok: true });
  }
  // BGM: アップロード先を作る → 登録 / 外す (path: null)
  if (b.op === "bgmUrl") {
    const which = b.which === "cruise" ? "cruise" : b.which === "boot" ? "boot" : "normal", ext = /^(mp3|m4a|aac|wav)$/.test(String(b.ext)) ? b.ext : "mp3";
    const path = `kaku/bgm-${which}-${Date.now().toString(36)}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    return J(error || !data ? { ok: false, error: error?.message || "UPLOAD_URL" } : { ok: true, path, signedUrl: data.signedUrl });
  }
  if (b.op === "bgmSet") {
    const which = b.which === "cruise" ? "cruise" : b.which === "boot" ? "boot" : "normal", col = `kaku_bgm_${which}`, path: string | null = b.path ?? null;
    if (path && !new RegExp(`^kaku/bgm-${which}-[\\w-]+\\.(mp3|m4a|aac|wav)$`).test(path)) return J({ ok: false, error: "BAD_PATH" });
    const { data: old } = await supabaseAdmin.from("app_settings").select(col).eq("id", 1).maybeSingle();
    const { error } = await supabaseAdmin.from("app_settings").update({ [col]: path }).eq("id", 1);
    if (error) {
      if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => null);
      return J({ ok: false, error: /kaku_bgm/.test(error.message) ? "SETUP" : error.message });
    }
    const prev = (old as any)?.[col]; if (prev && prev !== path) await supabaseAdmin.storage.from(BUCKET).remove([prev]).catch(() => null);
    return J({ ok: true, url: pub(path) });
  }
  return J({ ok: false, error: "BAD_OP" }, 400);
}
