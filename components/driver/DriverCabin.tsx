"use client";

/**
 * お父さんのスマホ ⇄ 車内 iPad。
 *   ・「🚗 iPad に出して出発」: 予約から お迎え/お見送り・場所・部屋・言語・冷暖房 を自動で入れて、iPad を送迎の画面に
 *   ・送迎中はスマホの GPS を 3 秒ごとに送る (Wi-Fi だけの iPad 用)。画面はつけたまま (スリープすると iPhone は位置を送れない)
 *   ・スカイゲートブリッジでは、スマホの音楽を「⚡ BOOST 用」の曲に切り替え、渡り切ったら元の曲の続きへ
 *   ・設定: iPad の一覧 / 部屋の写真 (iPad 用) と エアコン・照明・Wi-Fi の位置
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriverData } from "@/lib/driverData";
import type { CabinRoom, CabinSpots, CabinTrip } from "@/lib/cabinData";
import { BUILTIN_PHOTOS } from "@/lib/cabinPhotos";
import { BOOST_INIT, CRANE_NEST, PLACES, PLACE_KEYS, acModeFor, boostPrepDue, boostStep, dist, placeFromText, type LL, type PlaceKey } from "@/lib/cabinGeo";
import type { DRes } from "@/lib/driverLogic";
import { cabinStart, cabinBoard, cabinPos, cabinEnd, cabinSetQuiet, cabinSetHumor, cabinAiCmd, cabinCheckinQrUploadUrl, cabinSetCheckinQr, cabinRenameDevice, cabinDeleteDevice, cabinPhotoUploadUrl, cabinSetRoomPhoto, cabinRoomIcons, cabinIconUploadUrl, cabinSetRoomIcon } from "@/app/driver/actions";
import { compressRoomPhoto, compressRoomIcon } from "@/lib/driverCover";
import { sfx, vib } from "@/lib/driverSfx";
import { startRemoteVoice, unlockRemoteVoice } from "@/lib/remoteVoice";
import type { Music } from "@/components/driver/DriverMusic";
import { CAPTAIN, matchCaptain, type CaptainCmdId } from "@/lib/cabinAiTalk";

type T = (s: string, v?: Record<string, string | number>) => string;
const LANGS: [string, string][] = [["zh", "中文"], ["en", "EN"], ["ja", "日本語"], ["ko", "한국어"]];

/* ================= 送迎中 (GPS を送る・BOOST の音楽) ================= */
export function useCabin(initial: CabinTrip | null, music: Music, toast: (s: string) => void, t: T) {
  const [trip, setTrip] = useState<CabinTrip | null>(initial);
  const [sending, setSending] = useState<"" | "ok" | "ng">("");
  const mRef = useRef(music); mRef.current = music;
  useEffect(() => { setTrip(initial); }, [initial?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!trip) { setSending(""); return; }
    let live = true, last: { ll: LL; kmh: number | null; t: number } | null = null, bs = { ...BOOST_INIT }, boosting = false, gT: ReturnType<typeof setTimeout> | undefined;
    const geo = navigator.geolocation;
    const wid = geo?.watchPosition((p) => {
      const ll: LL = [p.coords.latitude, p.coords.longitude]; if (p.coords.accuracy > 80) return;
      let kmh = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
      if (kmh == null && last && Date.now() - last.t > 500) kmh = (dist(last.ll, ll) / ((Date.now() - last.t) / 1000)) * 3.6;
      last = { ll, kmh, t: Date.now() };
      const r = boostStep(bs, ll, kmh); bs = r.s;
      // BOOST の準備 (曲をゆっくり止める) は iPad の合図 (boost-prep) で。iPad の声がスマホに来ていないときだけ、このスマホの GPS で
      if (!r.event && !rv.ok() && boostPrepDue(bs, ll, kmh)) mRef.current.boostPrep();
      // BOOST の曲は iPad の「ブースト開始 / 完了」のセリフに合わせる (下の onPlay)。
      // セリフが来ないとき (iPad の声がスマホに来ていない) だけ、このスマホの GPS で始める / 終える
      if (r.event === "start") { clearTimeout(gT); gT = setTimeout(() => { if (live && !mRef.current.inBoost()) boosting = mRef.current.boostIn(0); }, rv.ok() ? 12000 : 5000); }
      else if (r.event === "end") { clearTimeout(gT); gT = setTimeout(() => { if (live && mRef.current.inBoost()) { boosting = false; mRef.current.boostOut(); } }, rv.ok() ? 12000 : 0); }
      // 橋から離れたのに BOOST の曲のまま (終わりを見逃した) → 元の曲へ
      else if (bs.phase === "off" && boosting && mRef.current.inBoost()) { boosting = false; mRef.current.boostOut(); }
    }, () => setSending("ng"), { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    // 車内 iPad の声 (ASTRAEA・道案内) をこのスマホで鳴らす (Bluetooth で車のスピーカーへ)。話している間は音楽を小さく
    const rv = startRemoteVoice(trip.id, {
      // ブースト開始のセリフと一緒に BOOST の曲を始め、完了のセリフと一緒にフェードアウト (元の曲へ)
      onPlay: (u) => {
        // 準備の合図 → 曲をゆっくり止める。効果音 (起動) → 5.2 秒後の点火の瞬間に、BOOST の曲を普通の音量で始める (回送の BOOST は準備が無いので今までどおり)
        if (/boost-prep\.mp3$/.test(u)) { mRef.current.boostPrep(); return; }
        if (/boost-sfx\.mp3$/.test(u)) { if (mRef.current.prepped() && !mRef.current.inBoost()) { clearTimeout(gT); boosting = mRef.current.boostIn(5200, true); } return; }
        if (/(en-boost-on|dh\/boostIn)\.mp3$/.test(u)) { clearTimeout(gT); if (!mRef.current.inBoost()) boosting = mRef.current.boostIn(300); }
        else if (/(en-boost-off|dh\/boostOut)\.mp3$/.test(u)) { clearTimeout(gT); if (mRef.current.inBoost()) { boosting = false; mRef.current.boostOut(); } }
      },
      onStart: () => mRef.current.duck(true), onEnd: () => mRef.current.duck(false), onSetup: () => toast(t("声をスマホから流すには、Supabase の SQL（migration_cabin_voice.sql）を実行してください")),
      // iPhone が音を止めていた (電話・Siri・画面オフのあとなど)。この声は iPad が代わりに鳴らす。画面に触れれば戻る
      onBlocked: () => { if (Date.now() - blockedAt > 30000) { blockedAt = Date.now(); toast(t("🔇 スマホの音が止まっています。画面をタップすると ASTRAEA の声が戻ります（今は iPad が話します）")); } } });
    let blockedAt = 0;
    // 画面のどこかに触れたら音を戻す (iPhone は指で触れたときしか音を再開できない)
    const reUnlock = () => unlockRemoteVoice();
    document.addEventListener("pointerdown", reUnlock, true);
    let lastCmd: number | null = null; // 最初の返事にある操作は前のもの (実行しない)
    let warned = false;
    const iv = setInterval(async () => {
      if (!live) return;
      const np = mRef.current.nowPlaying(); // 再生中の曲 (iPad の歌詞用)。位置がまだ取れていなくても送る
      if (!last && !np) return;
      const r = await cabinPos(trip.id, last?.ll[0] ?? null, last?.ll[1] ?? null, last?.kmh ?? null, np).catch(() => null);
      if (!live) return;
      if (r?.ok) {
        if (last) setSending("ok");
        if (r.np === "setup" && !warned) { warned = true; toast(t("iPad に歌詞を出すには、Supabase の SQL（migration_cabin_music.sql）を実行してください")); }
        if (!r.active) { setTrip(null); toast(t("送迎が終わりました（iPad は待機画面に戻りました）")); return; }
        // 回送 ⇄ ゲスト乗車 (iPad のボタンで切り替わることもある)
        if (r.phase && r.phase !== trip.phase) setTrip((p) => (p && p.id === trip.id ? { ...p, phase: r.phase! } : p));
        // iPad の再生ボタン (ゲストが押した) → このスマホの音楽を操作
        if (lastCmd == null) lastCmd = r.cmd?.n ?? 0;
        else if (r.cmd && r.cmd.n > lastCmd) { lastCmd = r.cmd.n; mRef.current.remote(r.cmd.c, r.cmd.v); }
      } else setSending("ng");
    }, 3000);
    // 送迎中はスマホの画面を消さない (iPhone は画面が消えると位置を送れないため)
    let lock: any = null;
    const wake = () => { if ("wakeLock" in navigator && document.visibilityState === "visible") (navigator as any).wakeLock.request("screen").then((l: any) => { lock = l; }).catch(() => {}); };
    wake(); document.addEventListener("visibilitychange", wake);
    return () => {
      live = false; clearTimeout(gT); rv.stop(); if (wid != null) geo?.clearWatch(wid); clearInterval(iv);
      document.removeEventListener("visibilitychange", wake); lock?.release?.().catch?.(() => {});
      document.removeEventListener("pointerdown", reUnlock, true);
      if (mRef.current.inBoost()) mRef.current.boostOut(); else mRef.current.boostPrepCancel();
    };
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tripRef2 = useRef(trip); tripRef2.current = trip;

  const start = useCallback(async (v: Parameters<typeof cabinStart>[0]) => {
    unlockRemoteVoice(); // 出発ボタンを押したときに (iPhone は指で押したときでないと音を準備できない)
    const r = await cabinStart(v);
    if (!r.ok) { sfx.error(); toast(r.error === "SETUP" ? t("先に Supabase の SQL（migration_cabin.sql）を実行してください") : t("iPad に出せませんでした") + "：" + r.error.slice(0, 60)); return false; }
    sfx.chord(); vib(30); setTrip(r.trip); toast(t("🚗 iPad に表示しました。気をつけて！"));
    return true;
  }, [toast, t]);
  const end = useCallback(async () => {
    if (!trip) return; const id = trip.id; setTrip(null); sfx.down(); await cabinEnd(id); toast(t("送迎を終わりにしました"));
  }, [trip, toast, t]);
  /** ゲスト乗車: 回送 (父向けの画面) → ゲスト用の送迎画面 */
  const board = useCallback(async () => {
    const tr = tripRef2.current; if (!tr) return; sfx.chord(); vib(30);
    const r = await cabinBoard(tr.id);
    if (!r.ok) { toast(r.error === "SETUP_VOICE" ? t("回送モードには Supabase の SQL（migration_cabin_voice.sql）が必要です") : t("切り替えられませんでした")); return; }
    setTrip({ ...tr, phase: "guest" }); toast(t("🧳 ゲスト乗車。iPad をゲスト用の画面にしました"));
  }, [toast, t]);
  /** ASTRAEA に話しかける間、音楽を小さく */
  const duck = useCallback((on: boolean) => { try { mRef.current.duck(on); } catch { /* ignore */ } }, []);
  return { trip, sending, start, end, duck, board };
}
export type Cabin = ReturnType<typeof useCabin>;

/* ================= 出発のシート ================= */
/* ================= 😂 ユーモアモード (ASTRAEA が映画・アニメ・ゲームのネタも話す) =================
   全部の送迎で共通の設定 (AGENT KAKU と同じ)。出発の画面・車内 iPad の設定・送迎中のバーのどこからでも切り替えられる */
let humorNow: boolean | null = null; // このスマホで最後に切り替えた値 (画面を開き直すまで、ほかの場所にも反映)
export function HumorPick({ initial, t }: { initial: boolean; t: T }) {
  const [on, setOn] = useState(humorNow ?? initial);
  const [msg, setMsg] = useState("");
  const pick = async (h: boolean) => {
    if (h === on) return; sfx.tick(); setOn(h); setMsg("");
    const r = await cabinSetHumor(h);
    if (r.ok) humorNow = h;
    else { setOn(!h); setMsg(r.error === "SETUP_HUMOR" ? t("ユーモアモードには Supabase の SQL（migration_ai_humor.sql）が必要です") : t("切り替えられませんでした")); }
  };
  return (
    <>
      <div className="csec">{t("ASTRAEA の話し方")}</div>
      <div className="cchips">
        <button className={!on ? "on" : ""} onClick={() => void pick(false)}><b>🙂 {t("ふつう")}</b><small>{t("案内とふつうのひと言")}</small></button>
        <button className={on ? "on" : ""} onClick={() => void pick(true)}><b>😂 {t("ユーモアモード")}</b><small>{t("映画・アニメ・ゲームのネタも話す")}</small></button>
      </div>
      {msg ? <p className="note warn">{msg}</p> : null}
    </>
  );
}

export function CabinSheet({ open, onClose, res, dir0, data, cab, t, roomName, ui }: {
  ui: "zh" | "ja"; open: boolean; onClose: () => void; res: DRes | null; dir0: "in" | "out"; data: DriverData; cab: Cabin; t: T; roomName: (id: string) => string;
}) {
  const devs = data.cabin.devices;
  const [dev, setDev] = useState<string | null>(null);
  const [dir, setDir] = useState<"in" | "out">(dir0);
  const [place, setPlace] = useState<PlaceKey>("kix");
  const [other, setOther] = useState<{ name: string; ll: LL } | null>(null);
  const [q, setQ] = useState(""), [hits, setHits] = useState<{ name: string; ll: LL }[]>([]), [qBusy, setQBusy] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [lang, setLang] = useState("zh");
  const [ac, setAc] = useState<"cool" | "heat" | "none">("cool");
  const [busy, setBusy] = useState(false);
  // 開くたびに予約から自動で入れる
  useEffect(() => {
    if (!open) return;
    let last: string | null = null; try { last = localStorage.getItem("drvCabDev"); } catch { /* ignore */ }
    setDev(devs.find((d) => d.id === last)?.id ?? devs[0]?.id ?? null);
    setDir(dir0);
    // お見送りは Crane Nest のシステムでゲストが選んだ行き先 (あれば)
    const drop = dir0 === "out" ? res?.drop ?? null : null;
    const pk = drop?.dest ? placeFromText(drop.dest, drop.terminal) : placeFromText(res?.pickupPlace ?? null, res?.flightInfo?.terminal ?? null);
    setPlace(pk ?? (res?.flightNo ? "kix" : "kix")); setOther(null); setHits([]); setQ(pk === null && res?.pickupPlace ? res.pickupPlace : "");
    setRoomId(res?.roomId ?? data.rooms[0]?.id ?? null);
    setLang(res?.lang ?? "zh"); setAc(acModeFor(Date.now()));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    const s = q.trim(); if (!s) return; setQBusy(true); setHits([]);
    const out: { name: string; ll: LL }[] = [];
    try { const r = await (await fetch("https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(s))).json(); for (const f of r.slice(0, 6)) out.push({ name: f.properties.title, ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]] }); } catch { /* ignore */ }
    try { const r = await (await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jp&viewbox=134.9,34.8,135.7,34.1&bounded=1&q=" + encodeURIComponent(s))).json(); for (const x of r) out.push({ name: String(x.display_name).split(",").slice(0, 2).join(" "), ll: [+x.lat, +x.lon] }); } catch { /* ignore */ }
    setHits(out.filter((o) => dist(o.ll, PLACES.kix.ll) < 60000).slice(0, 6)); setQBusy(false);
  };
  const go = async () => {
    if (place === "other" && !other) { sfx.error(); return; }
    setBusy(true);
    try { if (dev) localStorage.setItem("drvCabDev", dev); } catch { /* ignore */ }
    const ok = await cab.start({ deviceId: dev, resId: res?.id ?? null, dir, placeKey: place, placeName: place === "other" ? other!.name : null, placeLL: place === "other" ? other!.ll : null, roomId, lang, ac, phase: dir === "in" ? "dead" : "guest" });
    setBusy(false); if (ok) onClose();
  };
  const ago = (s: string | null) => { if (!s) return "—"; const m = Math.round((Date.now() - Date.parse(s)) / 60000); return m < 1 ? t("今") : m < 60 ? t("{m}分前", { m }) : t("{h}時間前", { h: Math.round(m / 60) }); };
  return (
    <>
      <div className={`sheet-bg ${open ? "show" : ""}`} onClick={onClose} />
      <div className={`sheet cabs ${open ? "show" : ""}`}>
        <h4>🚗 {t("車内 iPad に出して出発")}</h4>
        {data.cabin.missing ? <p className="note warn">{t("先に Supabase の SQL（migration_cabin.sql）を実行してください")}</p> : null}
        <div className="csec">{t("どの iPad に出しますか？")}</div>
        <div className="cchips">
          {devs.map((d) => <button key={d.id} className={dev === d.id ? "on" : ""} onClick={() => { sfx.tick(); setDev(d.id); }}><b>{d.name}</b><small>{d.hasGps === true ? "GPS ✓" : d.hasGps === false ? t("スマホの位置") : "GPS ?"} · {ago(d.lastSeen)}</small></button>)}
          <button className={dev === null ? "on" : ""} onClick={() => { sfx.tick(); setDev(null); }}><b>{t("全部の iPad")}</b><small>{devs.length ? t("{n} 台", { n: devs.length }) : t("iPad が未登録です")}</small></button>
        </div>
        <div className="segsw small">
          <button className={dir === "in" ? "on" : ""} onClick={() => { sfx.tick(); setDir("in"); }}>🛬 {t("お迎え")}</button>
          <button className={dir === "out" ? "on" : ""} onClick={() => { sfx.tick(); setDir("out"); }}>🛫 {t("お見送り")}</button>
        </div>
        <div className="csec">{dir === "in" ? t("どこでお迎え？") : t("どこへお見送り？")}{res?.pickupPlace ? <small>（{t("予約")}: {res.pickupPlace}）</small> : null}</div>
        <div className="cchips pl">
          {PLACE_KEYS.map((k) => <button key={k} className={place === k ? "on" : ""} onClick={() => { sfx.tick(); setPlace(k); }}>{PLACES[k].name[ui]}</button>)}
          <button className={place === "other" ? "on" : ""} onClick={() => { sfx.tick(); setPlace("other"); }}>📍 {t("その他")}</button>
        </div>
        {place === "other" && (
          <div className="cother">
            <div className="fedit"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder={t("住所・駅・ホテル名")} /><button className="add" onClick={() => void search()}>{qBusy ? "…" : "🔍"}</button></div>
            {other ? <p className="note">✓ {other.name}</p> : null}
            {hits.map((h, i) => <button key={i} className={`chit ${other?.name === h.name ? "on" : ""}`} onClick={() => { sfx.tick(); setOther(h); }}>📍 {h.name}<small>{(dist(h.ll, CRANE_NEST) / 1000).toFixed(1)} km</small></button>)}
          </div>
        )}
        <div className="csec">{t("お部屋")}</div>
        <div className="cchips">{data.rooms.map((r) => <button key={r.id} className={roomId === r.id ? "on" : ""} onClick={() => { sfx.tick(); setRoomId(r.id); }}>{roomName(r.id)}</button>)}</div>
        <div className="crow">
          <div><div className="csec">{t("画面の言語")}</div><div className="cchips sm">{LANGS.map(([k, n]) => <button key={k} className={lang === k ? "on" : ""} onClick={() => setLang(k)}>{n}</button>)}</div></div>
          <div><div className="csec">{t("エアコン")}</div><div className="cchips sm">{(["cool", "heat", "none"] as const).map((k) => <button key={k} className={ac === k ? "on" : ""} onClick={() => setAc(k)}>{k === "cool" ? "❄ " + t("冷房") : k === "heat" ? "🔥 " + t("暖房") : t("なし")}</button>)}</div></div>
        </div>
        <HumorPick initial={data.cabin.humor} t={t} />
        <p className="note">{t("声はすべて英語です。送迎中はこのスマホの画面をつけたままにしてください（GPS の無い iPad にスマホの位置を送ります）。")}</p>
        <div className="acts">
          <button onClick={onClose}>{t("やめる")}</button>
          <button className="ok" disabled={busy || (place === "other" && !other)} onClick={() => void go()}>{busy ? "…" : "🚗 " + t("出発")}</button>
        </div>
      </div>
    </>
  );
}

/* ================= 送迎中のバー ================= */
export function CabinBar({ cab, data, t, ui }: { cab: Cabin; data: DriverData; t: T; ui: "zh" | "ja" }) {
  const tr = cab.trip; if (!tr) return null;
  const dev = data.cabin.devices.find((d) => d.id === tr.deviceId);
  const pn = tr.placeKey === "other" ? tr.placeName || t("その他") : (PLACES as any)[tr.placeKey]?.name[ui] ?? tr.placeKey;
  return <CabinBarIn key={tr.id} tr={tr} dev={dev?.name ?? t("全部の iPad")} pn={pn} cab={cab} t={t} ui={ui} humor0={data.cabin.humor} />;
}
function CabinBarIn({ tr, dev, pn, cab, t, ui, humor0 }: { tr: CabinTrip; dev: string; pn: string; cab: Cabin; t: T; ui: "zh" | "ja"; humor0: boolean }) {
  // 😂 ユーモアモード: ASTRAEA が映画・アニメ・ゲームのオマージュも話す (全部の送迎で共通・AGENT KAKU と同じ設定)
  const [humor, setHumor] = useState(humorNow ?? humor0);
  const toggleHumor = async () => {
    const h = !humor; setHumor(h); sfx.tick();
    const r = await cabinSetHumor(h);
    if (r.ok) humorNow = h;
    if (!r.ok) { setHumor(!h); toastQ(r.error === "SETUP_HUMOR" ? t("ユーモアモードには Supabase の SQL（migration_ai_humor.sql）が必要です") : t("切り替えられませんでした")); }
    else toastQ(h ? t("😂 ユーモアモード ON：映画やアニメのネタも話します") : t("ユーモアモード OFF"));
  };
  // 🤫 静かモード: 車内 iPad の AI (ASTRAEA) のひと言を止める (道案内はそのまま)
  const [quiet, setQuiet] = useState(!!tr.aiQuiet);
  const toggleQuiet = async () => {
    const q = !quiet; setQuiet(q); sfx.tick();
    const r = await cabinSetQuiet(tr.id, q);
    if (!r.ok) { setQuiet(!q); toastQ(r.error === "SETUP_AI" ? t("静かモードには Supabase の SQL（migration_cabin_ai.sql）が必要です") : t("切り替えられませんでした")); }
  };
  const [qMsg, toastQ] = useState("");
  const [talk, setTalk] = useState(false);
  return (
    <div className="cabbar">
      <span className="live" />
      <span className="tx"><b>🚗 {dev}</b><small>{tr.phase === "dead" ? (tr.dir === "in" ? `${t("回送")} · ${t("お宿")} → ${pn}` : `${t("帰り道")} · ${pn} → ${t("お宿")}`) : tr.dir === "in" ? `${pn} → ${t("お宿")}` : `${t("お宿")} → ${pn}`} · {cab.sending === "ok" ? "📡 " + t("位置を送信中") : cab.sending === "ng" ? "⚠ " + t("位置を送れません") : "…"}</small></span>
      {tr.phase === "dead" && tr.dir === "in" && <button className="board" onClick={() => void cab.board()}>🧳<small>{t("ゲスト乗車")}</small></button>}
      <button className="abtn" onClick={() => { sfx.tick(); setTalk(true); }}>🎙<small>ASTRAEA</small></button>
      <button className={`qbtn ${humor ? "on" : ""}`} title={t("ユーモアモード")} onClick={() => void toggleHumor()}>{humor ? "😂" : "🙂"}<small>{humor ? t("ユーモア") : t("ふつう")}</small></button>
      <button className={`qbtn ${quiet ? "on" : ""}`} title={t("静かモード")} onClick={() => void toggleQuiet()}>{quiet ? "🤫" : "✦"}<small>{quiet ? t("静か") : "AI"}</small></button>
      <button onClick={() => { if (confirm(t("送迎を終わりにしますか？（iPad は待機画面に戻ります）"))) void cab.end(); }}>■ {t("終了")}</button>
      {qMsg ? <em className="qmsg" onClick={() => toastQ("")}>{qMsg}</em> : null}
      {talk && <AstraeaSheet tr={tr} cab={cab} t={t} ui={ui} onClose={() => setTalk(false)} toast={toastQ} />}
    </div>
  );
}

/* ================= ASTRAEA に話しかける (マイク) / 指示ボタン ================= */
const GUIDE_BTN = { id: "guide" as const, icon: "🔑", zh: "进门方法", ja: "入り方ガイド" };
function AstraeaSheet({ tr, cab, t, ui, onClose, toast }: { tr: CabinTrip; cab: Cabin; t: T; ui: "zh" | "ja"; onClose: () => void; toast: (s: string) => void }) {
  const [listen, setListen] = useState(false), [heard, setHeard] = useState(""), [sent, setSent] = useState(""), [btns, setBtns] = useState(false);
  const rec = useRef<any>(null);
  const send = async (c: CaptainCmdId, label: string) => {
    sfx.tick(); vib(15);
    const r = await cabinAiCmd(tr.id, c);
    if (!r.ok) { sfx.error(); toast(r.error === "SETUP_AI" ? t("ASTRAEA の指示には Supabase の SQL（migration_cabin_ai.sql）が必要です") : t("送れませんでした")); return; }
    setSent("📡 " + label); setTimeout(() => setSent(""), 2500);
    if (c !== "unknown") setTimeout(onClose, 900);
  };
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const mic = () => {
    if (!SR) { toast(t("このスマホでは音声入力が使えません。ボタンで指示してください")); setBtns(true); return; }
    if (rec.current) { rec.current.stop(); return; }
    const r = new SR(); rec.current = r;
    r.lang = ui === "ja" ? "ja-JP" : "zh-CN"; r.interimResults = true; r.continuous = false;
    let fin = "";
    r.onresult = (e: any) => { let s = ""; for (const x of e.results) { s += x[0].transcript; if (x.isFinal) fin = s; } setHeard(s); };
    r.onerror = () => { /* 下の onend で */ };
    r.onend = () => {
      rec.current = null; setListen(false); cab.duck(false);
      const s = (fin || "").trim() || heardRef.current.trim(); if (!s) return;
      const id = matchCaptain(s);
      if (id) { const b = id === "guide" ? GUIDE_BTN : CAPTAIN.find((x) => x.id === id)!; void send(id, `${b.icon} ${ui === "zh" ? b.zh : b.ja}`); }
      else void send("unknown", "？");
    };
    setHeard(""); setListen(true); cab.duck(true); sfx.tick();
    try { r.start(); } catch { setListen(false); cab.duck(false); rec.current = null; }
  };
  const heardRef = useRef(""); heardRef.current = heard;
  useEffect(() => () => { try { rec.current?.abort?.(); } catch { /* ignore */ } cab.duck(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const all = [...CAPTAIN.map((c) => ({ id: c.id as CaptainCmdId, icon: c.icon, zh: c.zh, ja: c.ja })), GUIDE_BTN];
  return (
    <>
      <div className="sheet-bg show" onClick={onClose} />
      <div className="sheet show astr" onClick={(e) => e.stopPropagation()}>
        <h4>🎙 ASTRAEA <small>{t("話しかけると iPad が答えます")}</small></h4>
        <button className={`amic ${listen ? "rec" : ""}`} onClick={mic}>{listen ? "■" : "🎙"}</button>
        <p className="aheard">{listen ? (heard || t("聞き取り中…")) : heard ? `「${heard}」` : t("押して話す（例：「阿斯特莱亚，办理入住」「アストレア、状況は？」）")}</p>
        {sent ? <p className="asent">{sent} → iPad</p> : null}
        <p className="awarn">⚠ {t("運転中は助手席の方が操作してください")}</p>
        <button className="alink" onClick={() => setBtns((v) => !v)}>{btns ? "▲" : "▼"} {t("ボタンで指示")}</button>
        {btns && <div className="agrid">{all.map((b) => <button key={b.id} onClick={() => void send(b.id, `${b.icon} ${ui === "zh" ? b.zh : b.ja}`)}>{b.icon} {ui === "zh" ? b.zh : b.ja}</button>)}</div>}
      </div>
    </>
  );
}

/* ================= 設定: iPad と 部屋の写真 ================= */
export function CabinSettings({ data, t, toast, refresh, onStart }: { data: DriverData; t: T; toast: (s: string) => void; refresh: () => Promise<void>; onStart: () => void }) {
  const [edit, setEdit] = useState<CabinRoom | null>(null);
  const ago = (s: string | null) => { if (!s) return "—"; const m = Math.round((Date.now() - Date.parse(s)) / 60000); return m < 1 ? t("今") : m < 60 ? t("{m}分前", { m }) : m < 1440 ? t("{h}時間前", { h: Math.round(m / 60) }) : t("{d}日前", { d: Math.round(m / 1440) }); };
  return (
    <div className="card" id="cabinSet">
      <div className="ctitle">🚗 {t("車内 iPad")}</div>
      <HumorPick initial={data.cabin.humor} t={t} />
      {data.cabin.missing ? <p className="note warn">{t("先に Supabase の SQL（migration_cabin.sql）を実行してください")}</p> : null}
      <div className="cnote">{t("iPad の Safari で {u} を開いてログインし、名前（1号車 など）を付けて登録します。ホーム画面に追加すると全画面で使えます。", { u: typeof location !== "undefined" ? location.origin + "/cabin" : "/cabin" })}</div>
      {data.cabin.devices.map((d) => (
        <div className="fedit" key={d.id}>
          <span className="cdev"><b>{d.name}</b><small>{d.hasGps === true ? "GPS ✓" : d.hasGps === false ? t("GPS なし → スマホの位置") : "GPS ?"} · {ago(d.lastSeen)}</small></span>
          <button onClick={async () => { const n = prompt(t("名前"), d.name); if (!n?.trim()) return; const r = await cabinRenameDevice(d.id, n); if (r.ok) { toast(t("変えました")); void refresh(); } }}>✎</button>
          <button className="del" onClick={async () => { if (!confirm(t("「{n}」の登録を消しますか？", { n: d.name }))) return; const r = await cabinDeleteDevice(d.id); if (r.ok) void refresh(); }}>✕</button>
        </div>
      ))}
      {!data.cabin.devices.length && <p className="note">{t("まだ iPad がありません")}</p>}
      <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={onStart}>🚗 {t("予約なしで iPad に出して出発")}</button>
      <CheckinQr url={data.cabin.checkinQr} t={t} toast={toast} refresh={refresh} />
      <div className="ctitle" style={{ marginTop: 14 }}>🏠 {t("部屋の写真（iPad 用）")}</div>
      <div className="cnote">{t("写真はアップロードすると自動で小さく（横 1280px・約 100KB）します。エアコン・照明・Wi-Fi の位置をタップで合わせると、iPad の演出がその場所から出ます。")}</div>
      <div className="cphotos">
        {data.cabin.rooms.map((r) => (
          <button key={r.id} className="cph" onClick={() => { sfx.blip(); setEdit(r); }} style={{ ["--rc" as any]: r.accent }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.photo ? <img src={r.photo} alt="" /> : <span className="none">{t("写真なし")}</span>}
            <b>{r.kanji} {r.en}</b>
          </button>
        ))}
      </div>
      <RoomIcons rooms={data.cabin.rooms} t={t} toast={toast} />
      {edit && <PhotoEditor room={edit} t={t} toast={toast} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void refresh(); }} />}
    </div>
  );
}

/* チェックイン QR (全員共通の画像)。「チェックイン」と話しかけると iPad に大きく出る */
function CheckinQr({ url, t, toast, refresh }: { url: string | null; t: T; toast: (s: string) => void; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const up = async (f: File) => {
    setBusy(true);
    try {
      // QR はくっきりさせたいので、そのまま上げる (大きすぎる写真だけ 1400px の PNG に縮める)
      let blob: Blob = f, ext: "png" | "jpg" | "webp" = f.type.includes("png") ? "png" : f.type.includes("webp") ? "webp" : "jpg";
      if (f.size > 1.5 * 1024 * 1024 || !/image\/(png|jpe?g|webp)/.test(f.type)) {
        const bm = await createImageBitmap(f); const s = Math.min(1, 1400 / Math.max(bm.width, bm.height));
        const c = document.createElement("canvas"); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
        const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0, c.width, c.height);
        blob = await new Promise<Blob>((ok, ng) => c.toBlob((b) => (b ? ok(b) : ng(new Error("toBlob"))), "image/png")); ext = "png";
      }
      const u = await cabinCheckinQrUploadUrl(ext); if (!u.ok) { toast(t("アップロードできませんでした")); return; }
      const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": blob.type || "image/png", "x-upsert": "false" }, body: blob }).catch(() => null);
      if (!put?.ok) { toast(t("アップロードできませんでした")); return; }
      const r = await cabinSetCheckinQr(u.path);
      if (!r.ok) { toast(r.error === "SETUP_AI" ? t("チェックイン QR には Supabase の SQL（migration_cabin_ai.sql）が必要です") : t("保存できませんでした")); return; }
      sfx.chord(); toast(t("✓ チェックイン QR を登録しました")); await refresh();
    } catch { toast(t("画像を読み込めませんでした")); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="ctitle" style={{ marginTop: 14 }}>📋 {t("チェックイン QR（全員共通）")}</div>
      <div className="cnote">{t("パスポート登録・本人確認・送迎予約のページの QR 画像を登録します。ASTRAEA に「チェックイン」と話しかけると、iPad に大きく表示されます。")}</div>
      <div className="ckrow">
        {url ? <img src={url} alt="" /> : <span className="ckempty">QR</span>}
        <label className="btn">{busy ? t("保存中…") : "🖼 " + (url ? t("変える") : t("QR 画像を選ぶ"))}<input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void up(f); }} /></label>
        {url ? <button onClick={async () => { if (!confirm(t("チェックイン QR を外しますか？"))) return; const r = await cabinSetCheckinQr(null); if (r.ok) { toast(t("外しました")); await refresh(); } }}>{t("外す")}</button> : null}
      </div>
    </>
  );
}

/* 部屋のイラスト: NFC / QR で開くゲスト用ガイド (/g/[部屋]) の左上に出る絵。春夏秋冬は最初から入っていて、ここで好きな絵に変えられる */
function RoomIcons({ rooms, t, toast }: { rooms: CabinRoom[]; t: T; toast: (s: string) => void }) {
  const [icons, setIcons] = useState<Record<string, { url: string | null; custom: boolean }>>({});
  const [busy, setBusy] = useState("");
  const key = rooms.map((r) => r.id).join(",");
  const load = useCallback(async () => { const r = await cabinRoomIcons(rooms.map((x) => ({ id: x.id, kanji: x.kanji }))).catch(() => null); if (r?.ok) setIcons(r.icons); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  const up = async (room: CabinRoom, f: File) => {
    setBusy(room.id);
    const c = await compressRoomIcon(f); if (!c) { setBusy(""); toast(t("画像を読み込めませんでした")); return; }
    const u = await cabinIconUploadUrl(room.id, c.ext); if (!u.ok) { setBusy(""); toast(t("アップロードできませんでした")); return; }
    const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": c.blob.type, "x-upsert": "false" }, body: c.blob }).catch(() => null);
    if (!put?.ok) { setBusy(""); toast(t("アップロードできませんでした")); return; }
    const r = await cabinSetRoomIcon(room.id, u.path); setBusy("");
    if (!r.ok) { toast(t("保存できませんでした")); return; }
    sfx.chord(); toast(t("保存しました")); await load();
  };
  const back = async (room: CabinRoom) => {
    if (!confirm(t("アップロードした絵を外しますか？"))) return;
    setBusy(room.id); const r = await cabinSetRoomIcon(room.id, null); setBusy("");
    if (r.ok) { toast(t("外しました")); await load(); } else toast(t("保存できませんでした"));
  };
  return (
    <>
      <div className="ctitle" style={{ marginTop: 14 }}>🐰 {t("部屋のイラスト（ゲスト用ガイド）")}</div>
      <div className="cnote">{t("お部屋の NFC・QR から開くガイドの左上に出る絵です。画像を選ぶと、真ん中を正方形に切り抜いて自動で小さくします。外すと最初の絵（無い部屋は漢字）に戻ります。")}</div>
      {rooms.map((r) => { const ic = icons[r.id]; return (
        <div className="ckrow" key={r.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ic?.url ? <img src={ic.url} alt="" /> : <span className="ckempty">{r.kanji}</span>}
          <b style={{ minWidth: 64 }}>{r.kanji} {r.en}</b>
          <label className="btn">{busy === r.id ? t("保存中…") : "🖼 " + t("変える")}<input type="file" accept="image/*" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void up(r, f); }} /></label>
          {ic?.custom ? <button disabled={!!busy} onClick={() => void back(r)}>{t("外す")}</button> : null}
        </div>
      ); })}
    </>
  );
}

function PhotoEditor({ room, t, toast, onClose, onSaved }: { room: CabinRoom; t: T; toast: (s: string) => void; onClose: () => void; onSaved: () => void }) {
  const [photo, setPhoto] = useState<string | null>(room.photoKey);
  const [url, setUrl] = useState<string | null>(room.photo);
  const [spots, setSpots] = useState<CabinSpots>(room.spots);
  const [which, setWhich] = useState<keyof CabinSpots>("lamp");
  const [busy, setBusy] = useState("");
  const pickBuiltin = (k: string) => { setPhoto("builtin:" + k); setUrl(BUILTIN_PHOTOS[k].src); setSpots(BUILTIN_PHOTOS[k].spots); sfx.tick(); };
  const upload = async (f: File) => {
    setBusy(t("保存中…"));
    const c = await compressRoomPhoto(f); if (!c) { setBusy(""); toast(t("画像を読み込めませんでした")); return; }
    const u = await cabinPhotoUploadUrl(room.id, c.ext); if (!u.ok) { setBusy(""); toast(t("アップロードできませんでした")); return; }
    const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": c.blob.type, "x-upsert": "false" }, body: c.blob }).catch(() => null);
    setBusy(""); if (!put?.ok) { toast(t("アップロードできませんでした")); return; }
    setPhoto(u.path); setUrl(URL.createObjectURL(c.blob)); toast(t("写真を小さくしました（{k}KB）。位置を合わせて保存してください", { k: Math.round(c.blob.size / 1024) }));
  };
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - b.left) / b.width) * 100), y = Math.round(((e.clientY - b.top) / b.height) * 100);
    setSpots((s) => ({ ...s, [which]: [x, y] })); sfx.tick(); vib(10);
  };
  const save = async () => {
    setBusy(t("保存中…")); const r = await cabinSetRoomPhoto(room.id, photo, spots); setBusy("");
    if (!r.ok) { toast(r.error === "SETUP" ? t("先に Supabase の SQL（migration_cabin.sql）を実行してください") : t("保存できませんでした")); return; }
    sfx.chord(); toast(t("保存しました")); onSaved();
  };
  const ICON: Record<keyof CabinSpots, string> = { ac: "❄", lamp: "💡", wifi: "📶" };
  return (
    <>
      <div className="sheet-bg show" onClick={onClose} />
      <div className="sheet show">
        <h4>🏠 {room.kanji} {room.en} ─ {t("iPad の部屋の写真")}</h4>
        <div className="phed" onClick={tap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" /> : <span className="none">{t("写真なし")}</span>}
          {(Object.keys(ICON) as (keyof CabinSpots)[]).map((k) => spots[k] ? <i key={k} className={`spot ${which === k ? "on" : ""}`} style={{ left: `${spots[k]![0]}%`, top: `${spots[k]![1]}%` }}>{ICON[k]}</i> : null)}
        </div>
        <div className="segsw small four">
          {(Object.keys(ICON) as (keyof CabinSpots)[]).map((k) => <button key={k} className={which === k ? "on" : ""} onClick={() => setWhich(k)}>{ICON[k]} {k === "ac" ? t("エアコン") : k === "lamp" ? t("照明") : "Wi-Fi"}</button>)}
          <button onClick={() => setSpots((s) => ({ ...s, [which]: null }))}>{t("なし")}</button>
        </div>
        <p className="note">{t("上のボタンで選んでから、写真の上をタップしてください。")}</p>
        <div className="csec">{t("最初から入っている写真")}</div>
        <div className="cphotos sm">
          {Object.keys(BUILTIN_PHOTOS).map((k) => (
            <button key={k} className={`cph ${photo === "builtin:" + k ? "on" : ""}`} onClick={() => pickBuiltin(k)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BUILTIN_PHOTOS[k].src} alt="" />
            </button>
          ))}
        </div>
        <label className="mfile">{busy || "📷 " + t("新しい写真を選ぶ")}<input type="file" accept="image/*" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} /></label>
        <div className="acts">
          <button onClick={onClose}>{t("やめる")}</button>
          <button className="ok" disabled={!!busy} onClick={() => void save()}>{t("保存")}</button>
        </div>
      </div>
    </>
  );
}

/** 予約 → 出発のシートを開くときの初期値 (テスト用にも使う) */
export function useCabinSheet() {
  const [s, setS] = useState<{ res: DRes | null; dir: "in" | "out" } | null>(null);
  return useMemo(() => ({ state: s, open: (res: DRes | null, dir: "in" | "out") => { sfx.blip(); setS({ res, dir }); }, close: () => setS(null) }), [s]);
}
