"use client";

/**
 * お父さん専用の送迎画面 HIROSHI DRIVE。
 *   デザイン: hybrid (愛車のダッシュボード画像) / bike (バイクとお父さんの絵)。管理画面・設定で切り替え。
 *   表示言語: 简体中文 (既定) / 日本語。
 *   ページ: ホーム / 送迎 (お迎え・お見送り) / 案内 (部屋を選んで QR と説明) / 設定。中央の START でお出迎え準備。
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { DriverData, DriverPlace } from "@/lib/driverData";
import { todayBoard, upcomingArrivals, nextArrival, pickupBase, jstTime, jstDay, roomColor, FLIGHT_MONTHLY_FREE, aboardVoice, type DRes, type DRoom, type FlightInfo } from "@/lib/driverLogic";
import { sfx, say, roomVoice, vib, setDriverMute, onVoiceChange } from "@/lib/driverSfx";
import { makeT, type UiLang } from "@/lib/driverI18n";
import { guideSteps, type GuideLang } from "@/lib/driverGuide";
import {
  driverRefresh, driverRoomAction, driverPrepare, driverCheckout, driverSavePickup, driverSetFlight, driverCheckFlight,
  driverSavePlaces, driverSaveSettings, driverResolveAlert,
} from "@/app/driver/actions";
import { useDriverMusic, MusicPlayer, MusicSheet, MusicAdmin, type MLang } from "@/components/driver/DriverMusic";

type Page = "home" | "pick" | "guide" | "set";
const P = (x: number, y: number, w: number, h: number, W: number, H: number) =>
  ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` }) as React.CSSProperties;
const DW = 1086, DH = 1215, BH = 1448, NH = 233;
const pd = (x: number, y: number, w: number, h: number) => P(x, y, w, h, DW, DH);
const pb = (x: number, y: number, w: number, h: number) => P(x, y, w, h, DW, BH);
const pn = (x: number, y: number, w: number, h: number) => P(x, y, w, h, DW, NH);
/** 天気は泉佐野市 */
const WX_PLACE = { lat: 34.4066, lng: 135.3269 };

function wxInfo(code: number): { e: string; ja: string; zh: string } {
  if (code === 0) return { e: "☀", ja: "晴れ", zh: "晴" };
  if (code <= 2) return { e: "🌤", ja: "晴れ時々曇り", zh: "晴间多云" };
  if (code === 3) return { e: "☁", ja: "曇り", zh: "阴" };
  if (code === 45 || code === 48) return { e: "🌫", ja: "霧", zh: "雾" };
  if (code >= 95) return { e: "⛈", ja: "雷雨", zh: "雷雨" };
  if (code >= 71 && code <= 77) return { e: "❄", ja: "雪", zh: "雪" };
  if (code >= 51) return { e: "🌧", ja: "雨", zh: "雨" };
  return { e: "☁", ja: "曇り", zh: "阴" };
}

export default function DriverApp({ data: initial, now: serverNow }: { data: DriverData; now: number }) {
  const [data, setData] = useState(initial);
  const [lang, setLang] = useState<UiLang>("zh");
  const t = useMemo(() => makeT(lang), [lang]);
  const design = data.settings.design;
  const [page, setPage] = useState<Page>("home");
  const [booting, setBooting] = useState<"idle" | "run" | "done">("idle");
  const [bootStep, setBootStep] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(serverNow);
  const [toastMsg, setToastMsg] = useState<string>("");
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((s: string) => { setToastMsg(s); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(""), 2800); }, []);
  const [sfxOn, setSfxOn] = useState(true), [voiceOn, setVoiceOn] = useState(true);

  // 保存していた設定 (言語・音)
  useEffect(() => {
    try {
      const l = localStorage.getItem("drvLang"); if (l === "ja" || l === "zh") setLang(l);
      setSfxOn(localStorage.getItem("drvSfx") !== "0"); setVoiceOn(localStorage.getItem("drvVoice") !== "0");
      if (sessionStorage.getItem("drvBooted") === "1") setBooting("done");
    } catch { /* ignore */ }
    const id = setInterval(() => setNowMs(Date.now()), 30000); setNowMs(Date.now());
    // 画面の画像・声をこの端末に保存 (2 回目からギガを使わない)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/driver-sw.js", { scope: "/driver" }).catch(() => {});
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setDriverMute(!sfxOn, !voiceOn); }, [sfxOn, voiceOn]);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "ja"; }, [lang]);

  // 定期的に最新の予約へ (画面が見えているときだけ・2 分ごと)
  const refresh = useCallback(async () => { const r = await driverRefresh(); if (r.ok) setData(r.data); }, []);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 120000);
    const vis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [refresh]);

  const roomOf = useCallback((id: string) => data.rooms.find((r) => r.id === id), [data.rooms]);
  const board = useMemo(() => todayBoard(data.res, nowMs), [data.res, nowMs]);
  const upcoming = useMemo(() => upcomingArrivals(data.res, nowMs, 3), [data.res, nowMs]);
  const next = nextArrival(board);
  const nextOut = board.departures.find((r) => Date.parse(r.checkOut) > nowMs) ?? board.departures[0] ?? null;
  const rName = (r: DRes | null | undefined) => (r ? roomOf(r.roomId)?.name ?? "—" : "—");
  const gName = (r: DRes | null | undefined) => (r?.guest ? `${r.guest} ${t("様")}` : t("ゲスト"));

  /* ---------------- 天気 ---------------- */
  const [wx, setWx] = useState<{ temp: number; code: number } | null>(null);
  useEffect(() => {
    const { lat, lng } = WX_PLACE;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`)
      .then((r) => r.json()).then((j) => setWx({ temp: Math.round(j.current.temperature_2m), code: j.current.weather_code })).catch(() => {});
  }, []);
  const wxI = wx ? wxInfo(wx.code) : null;
  const wxText = wxI ? (lang === "zh" ? wxI.zh : wxI.ja) : "";
  const hour = new Date(nowMs + 9 * 3600e3).getUTCHours();
  const tod = hour >= 6 && hour < 16 ? "day" : hour >= 16 && hour < 19 ? "dusk" : "night";
  const dateText = new Date(nowMs).toLocaleDateString(lang === "zh" ? "zh-CN" : "ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });

  /* ---------------- 音楽 ---------------- */
  const autoLang = { in: (next?.lang ?? "zh") as MLang, out: (nextOut?.lang ?? "en") as MLang };
  const autoWho = { in: next ? `${gName(next)}（${rName(next)}）` : "", out: nextOut ? `${gName(nextOut)}（${rName(nextOut)}）` : "" };
  const music = useDriverMusic(data.tracks, t, toast, autoLang);
  const [musicOpen, setMusicOpen] = useState(false);
  useEffect(() => { onVoiceChange((s) => music.duck(s)); });

  /* ---------------- 起動 ---------------- */
  const startBoot = () => {
    if (booting !== "idle") return;
    sfx.prime(); setBooting("run"); vib([20, 40, 20]);
    const push = (s: string, ms: number) => setTimeout(() => setBootStep((x) => [...x, s]), ms);
    if (design === "bike") {
      sfx.engine(); push("rev", 600); push("idle", 1300); say(["boot-bike"], 1900);
      setTimeout(() => { setBooting("done"); try { sessionStorage.setItem("drvBooted", "1"); } catch { /* ignore */ } }, 2800);
      return;
    }
    sfx.hybrid(); push("sweep", 150); push("settle", 1150); push("lights", 900); push("lights2", 1700); push("ready", 2100);
    say(["boot"], 2600);
    setTimeout(() => { setBooting("done"); try { sessionStorage.setItem("drvBooted", "1"); } catch { /* ignore */ } }, 4300);
  };
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    if (booting !== "run" || design === "bike") return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i <= 7; i++) ids.push(setTimeout(() => setSeg(i), 60 + i * 60));
    for (let i = 7; i >= 3; i--) ids.push(setTimeout(() => setSeg(i), 700 + (7 - i) * 70));
    return () => ids.forEach(clearTimeout);
  }, [booting, design]);

  /* ---------------- エンブレム: ライト ---------------- */
  const [lit, setLit] = useState(false);
  const [flash, setFlash] = useState(0);
  const toggleLights = () => { sfx.prime(); const v = !lit; setLit(v); setFlash((f) => f + 1); sfx.lights(v); vib(v ? [15, 30, 15, 30, 40] : 20); say([v ? "lights-on" : "lights-off"], v ? 900 : 200); };

  /* ---------------- お出迎え準備 ---------------- */
  const [preparing, setPreparing] = useState<string[]>([]);
  const [charge, setCharge] = useState(0);
  const [roomSheet, setRoomSheet] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [emMsg, setEmMsg] = useState<string>("");
  const prepTargets = board.arrivals.length ? board.arrivals : [];
  const preparedCount = board.arrivals.filter((r) => r.preparedAt).length;
  const pct = board.arrivals.length ? Math.round((preparedCount / board.arrivals.length) * 100) : 100;
  const openStart = () => { sfx.prime(); sfx.blip(); setPage("home"); setSel(next ? [next.id] : []); setRoomSheet(true); };
  // 送迎ページの準備: 部屋ごとの準備の種類と機器チェックの表示
  const [prepMode, setPrepMode] = useState<Record<string, "welcome" | "wafu">>({});
  const [devSt, setDevSt] = useState<Record<string, "wait" | "ok" | "ng">>({});
  const prepare = async (ids: string[], mode: "welcome" | "wafu" = "welcome", stay = false) => {
    if (!ids.length || preparing.length) return;
    setRoomSheet(false); if (!stay) window.scrollTo({ top: 0, behavior: "smooth" });
    setDevSt((d) => ({ ...d, ...Object.fromEntries(ids.map((id) => [id, "wait"])) }));
    const rs = ids.map((id) => data.res.find((r) => r.id === id)!).filter(Boolean);
    const names = rs.map((r) => rName(r)).join("・");
    setPreparing(ids); setEmMsg(t("{n}（{g}）を準備中…", { n: names, g: rs.map((r) => gName(r)).join("・") }));
    sfx.sweep(); vib(20);
    const rv = rs.length === 1 ? roomVoice(roomOf(rs[0].roomId)?.slug ?? "") : null;
    say(rs.length > 1 ? ["prep-many"] : [rv || "", "prep"], 250);
    let c = stay ? 0 : Math.round((preparedCount / Math.max(1, board.arrivals.length)) * 8);
    const chg = setInterval(() => { c = Math.min(8, c + 1); setCharge(c); sfx.tick(); }, 420);
    const r = await driverPrepare(ids, mode);
    clearInterval(chg); setCharge(8); setPreparing([]);
    setDevSt((d) => ({ ...d, ...Object.fromEntries(ids.map((id) => [id, r.ok && r.done.includes(id) ? "ok" : "ng"])) }));
    if (r.ok) {
      setPrepMode((m) => ({ ...m, ...Object.fromEntries(r.done.map((id) => [id, mode])) }));
      setModes((x) => { const y = { ...x }; for (const id of r.done) { const rid = data.res.find((q) => q.id === id)?.roomId; if (rid) y[rid] = { ...y[rid], mode, ac: true, light: mode === "welcome" }; } return y; });
    }
    if (!r.ok) { sfx.error(); setEmMsg(t("準備できませんでした。もう一度お試しください")); toast(t("準備できませんでした")); return; }
    const at = new Date().toISOString();
    setData((d) => ({ ...d, res: d.res.map((x) => (r.done.includes(x.id) ? { ...x, preparedAt: at } : x)) }));
    setEmMsg(t(mode === "wafu" ? "{n}（{g}）和風モードの準備が完了しました {t}" : "{n}（{g}）の準備が完了しました {t}", { n: names, g: rs.map((x) => gName(x)).join("・"), t: jstTime(Date.now()) }));
    sfx.chord(); vib([15, 30, 50]); say(rs.length > 1 ? ["ready-many"] : [rv || "", "ready", mode === "wafu" ? "wafu" : ""], 250);
  };

  /* ---------------- 部屋の操作 (カード) ---------------- */
  const [modes, setModes] = useState<Record<string, { mode?: string; galaxy?: boolean; lock?: "locked" | "unlocked"; ac?: boolean; light?: boolean; last?: string }>>({});
  const [openCard, setOpenCard] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<DRoom | null>(null);
  const cardRooms = useMemo(() => {
    const seen = new Set<string>(); const out: { room: DRoom; res: DRes | null; tag: string }[] = [];
    const add = (r: DRes, tag: string) => { const room = roomOf(r.roomId); if (room && !seen.has(room.id)) { seen.add(room.id); out.push({ room, res: r, tag }); } };
    board.arrivals.forEach((r) => add(r, "in")); board.departures.forEach((r) => add(r, "out")); board.staying.forEach((r) => add(r, "stay"));
    if (showAll) data.rooms.forEach((room) => { if (!seen.has(room.id)) { seen.add(room.id); out.push({ room, res: null, tag: "free" }); } });
    return out;
  }, [board, showAll, data.rooms, roomOf]);
  useEffect(() => { if (!openCard && cardRooms[0]) setOpenCard(next ? next.roomId : cardRooms[0].room.id); }, [cardRooms, next, openCard]);
  const roomAct = async (room: DRoom, a: string, confirmed = false) => {
    if (a === "unlock" && !confirmed) { setConfirmUnlock(room); sfx.notify(); return; }
    sfx.prime();
    const st = modes[room.id] || {};
    const map: Record<string, { action: any; patch: any; voice: string; msg: string; fx: () => void }> = {
      welcome: { action: "welcome", patch: { mode: "welcome", ac: true, light: true }, voice: "welcome", msg: t("快適モード"), fx: sfx.sweep },
      wafu: { action: "welcome_cozy", patch: { mode: "wafu", ac: true, light: false }, voice: "wafu", msg: t("和風モード"), fx: sfx.sweep },
      galaxy: st.galaxy ? { action: "galaxy_off", patch: { galaxy: false }, voice: "galaxy-off", msg: t("ギャラクシー OFF"), fx: sfx.down } : { action: "galaxy_on", patch: { galaxy: true }, voice: "galaxy-on", msg: t("ギャラクシー ON"), fx: sfx.chord },
      unlock: { action: "unlock", patch: { lock: "unlocked" }, voice: "unlock", msg: t("解錠しました"), fx: sfx.auth },
      lock: { action: "lock", patch: { lock: "locked" }, voice: "lock", msg: t("施錠しました"), fx: sfx.down },
      ac: st.ac ? { action: "ac_off", patch: { ac: false }, voice: "ac-off", msg: t("エアコン OFF"), fx: sfx.down } : { action: "ac_on", patch: { ac: true }, voice: "ac-on", msg: t("エアコン ON"), fx: sfx.sweep },
      light: st.light ? { action: "light_off", patch: { light: false }, voice: "light-off", msg: t("照明 OFF"), fx: sfx.down } : { action: "light_on", patch: { light: true }, voice: "light-on", msg: t("照明 ON"), fx: sfx.sweep },
    };
    const m = map[a]; if (!m) return;
    m.fx(); vib(20);
    const r = await driverRoomAction(room.id, m.action);
    if (!r.ok) { sfx.error(); toast(`${room.name}：${t("操作できませんでした")}`); return; }
    setModes((x) => ({ ...x, [room.id]: { ...st, ...m.patch, last: `✓ ${jstTime(Date.now())} ${room.name}：${m.msg}` } }));
    toast(`${room.name}：${m.msg}`);
    say([roomVoice(room.slug) || "", m.voice], 200);
  };

  /* ---------------- おもてなし ---------------- */
  const [omo, setOmo] = useState(false);
  const startOmotenashi = () => {
    sfx.prime(); music.prime(); sfx.auth(); vib([20, 40, 20]); setOmo(true);
    let turn = 0; try { turn = Number(localStorage.getItem("drvAboard") || 0); localStorage.setItem("drvAboard", String(turn + 1)); } catch { /* ignore */ }
    say([aboardVoice(next, turn)], 300);
    setTimeout(() => music.startWith("in", autoLang.in), 4200);
  };
  const arriveSoon = () => { sfx.notify(); say(["arrive"], 200); setTimeout(() => music.fadeOut(), 2400); };

  /* ---------------- 送迎: お迎え場所・便名・飛行機 ---------------- */
  const [pickTab, setPickTab] = useState<"in" | "out">("in");
  const [pickSheet, setPickSheet] = useState<DRes | null>(null);
  const [pickPlace, setPickPlace] = useState<string | null>(null);
  const [pickTime, setPickTime] = useState<string>("");
  const openPickSheet = (r: DRes) => { sfx.blip(); setPickSheet(r); setPickPlace(r.pickupPlace); setPickTime(r.pickupAt ? jstTime(r.pickupAt) : ""); };
  const savePickup = async (none: boolean) => {
    const r = pickSheet; if (!r) return;
    const at = pickTime ? new Date(`${jstDay(r.checkIn)}T${pickTime}:00+09:00`).toISOString() : null;
    const v = { place: none ? null : pickPlace, at: none ? null : at, none };
    setData((d) => ({ ...d, res: d.res.map((x) => (x.id === r.id ? { ...x, pickupPlace: v.place, pickupAt: v.at, pickupNone: none } : x)) }));
    setPickSheet(null); sfx.chord(); say(["saved"], 200);
    const s = await driverSavePickup(r.id, v); if (!s.ok) toast(t("保存できませんでした"));
  };
  const [flightEdit, setFlightEdit] = useState<string>("");
  const [flightBusy, setFlightBusy] = useState<string>("");
  const saveFlight = async (r: DRes, v: string) => {
    const no = v.toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
    setData((d) => ({ ...d, res: d.res.map((x) => (x.id === r.id ? { ...x, flightNo: no, flightInfo: null, flightCheckedAt: null } : x)) }));
    setFlightEdit(""); await driverSetFlight(r.id, no || "");
  };
  const checkFlight = async (r: DRes) => {
    setFlightBusy(r.id); sfx.sweep();
    const x = await driverCheckFlight(r.id);
    setFlightBusy("");
    if (!x.ok) { sfx.error(); toast(x.error === "NOT_CONFIGURED" ? t("飛行機の確認はまだ設定されていません") : t("確認できませんでした")); return; }
    setData((d) => ({ ...d, flightUsed: d.flightUsed + (x.reused ? 0 : 1), res: d.res.map((y) => (y.id === r.id ? { ...y, flightInfo: x.info, flightCheckedAt: x.checkedAt } : y)) }));
    if (x.reused) { toast(t("5分以内に確認済みなので、前回の結果を表示しました（回数は使っていません）")); return; }
    sfx.notify(); vib([15, 30, 15]);
    say([x.info?.status === "Landed" || x.info?.status === "Arrived" ? "landed" : (x.info?.delayMin ?? 0) >= 15 ? "delayed" : "flight"], 250);
  };

  /* ---------------- 案内 ---------------- */
  const guideRooms = useMemo(() => [...board.arrivals, ...board.staying, ...board.departures].filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i), [board]);
  const [gRes, setGRes] = useState<string>("");
  const [gLang, setGLang] = useState<GuideLang>("zh");
  const [qr, setQr] = useState<string>("");
  const [steps, setSteps] = useState<number>(-1);
  const curG = guideRooms.find((r) => r.id === gRes) ?? next ?? guideRooms[0] ?? null;
  const openGuide = (r: DRes | null, quiet = false) => {
    if (r) { setGRes(r.id); setGLang(r.lang as GuideLang); setOpenCard(r.roomId); }
    setSteps(-1); setPage("guide"); window.scrollTo(0, 0);
    if (!quiet) { sfx.sweep(); say(["guide"], 250); }
  };
  useEffect(() => {
    if (!curG) { setQr(""); return; }
    const room = roomOf(curG.roomId); if (!room) return;
    const url = `${location.origin}/room/${room.slug}?lang=${gLang}`;
    QRCode.toDataURL(url, { margin: 1, width: 520, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [curG?.id, gLang, roomOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const gSteps = useMemo(() => {
    if (!curG) return [];
    const room = roomOf(curG.roomId); const ent = data.entrances.find((e) => e.building === room?.building) ?? data.entrances[0];
    return guideSteps(gLang, { code: ent?.keypad ?? null, pin: curG.pin, ssid: ent?.wifiSsid ?? null, pass: ent?.wifiPass ?? null });
  }, [curG, gLang, data.entrances, roomOf]);

  /* ---------------- 設定 ---------------- */
  const [places, setPlaces] = useState<DriverPlace[]>(data.places);
  useEffect(() => { setPlaces(data.places); }, [data.places]);
  const [newPlace, setNewPlace] = useState("");
  const savePlaces = async (L: DriverPlace[]) => { setPlaces(L); const r = await driverSavePlaces(L.map((p) => ({ id: p.id.startsWith("new-") ? undefined : p.id, name: p.name }))); if (r.ok) void refresh(); };
  const saveSetting = async (v: Parameters<typeof driverSaveSettings>[0]) => { setData((d) => ({ ...d, settings: { ...d.settings, ...v } as any })); sfx.blip(); const r = await driverSaveSettings(v); if (!r.ok) toast(t("保存できませんでした")); };
  const setUiLang = (l: UiLang) => { setLang(l); try { localStorage.setItem("drvLang", l); } catch { /* ignore */ } sfx.blip(); };

  const go = (p: Page) => {
    sfx.prime(); sfx.blip();
    if (p === "guide") return openGuide(next ?? guideRooms[0] ?? null);
    setPage(p); window.scrollTo(0, 0);
  };

  /* ---------------- 小さな部品 ---------------- */
  const eta = (iso: string) => {
    const m = Math.round((Date.parse(iso) - nowMs) / 60000);
    if (m < -5) return t("完了");
    if (m < 60) return t("あと {n}分", { n: Math.max(0, m) });
    return t("あと {n}時間", { n: Math.round(m / 60) });
  };
  const nights = (r: DRes) => Math.max(1, Math.round((Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 86400e3));
  const mapUrl = (r: DRes) => { const q = data.places.find((p) => p.name === r.pickupPlace)?.mapQuery || r.pickupPlace || rName(r); return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`; };
  /** 送迎ページのお迎えカード (1 画面に入るようにコンパクト)。open でないものはたたむ */
  const ArrivalCard = ({ r, open, onOpen }: { r: DRes; open: boolean; onOpen: () => void }) => {
    const room = roomOf(r.roomId); const today = jstDay(r.checkIn) === jstDay(nowMs);
    const busy = preparing.includes(r.id), m = prepMode[r.id], st = devSt[r.id];
    const f: FlightInfo | null = r.flightInfo; const late = (f?.delayMin ?? 0) >= 15;
    const head = (
      <div className="r1"><span className="time">{jstTime(pickupBase(r))}</span><span className="kind">{t("お迎え")}</span><span className="who">{gName(r)}</span>
        <span className="eta">{today ? eta(pickupBase(r)) : jstDay(r.checkIn).slice(5).replace("-", "/")}</span></div>
    );
    if (!open) return (
      <div className="card pc sub" style={{ ["--rc" as any]: roomColor(room?.slug ?? "") }}>
        {head}
        <div className="collapsed">{t("お部屋")} <b>{rName(r)}</b>{r.pickupPlace ? ` ・ ${r.pickupPlace}` : ""}{r.preparedAt ? <span className="okc2"> ・ ✓</span> : null}
          <button onClick={() => { sfx.tick(); onOpen(); }}>{t("開く")}</button></div>
      </div>
    );
    const chip = (k: string, label: string, val: string) => <span key={k} className={st === "wait" ? "wait" : st === "ok" || (r.preparedAt && !st) ? "ok" : st === "ng" ? "ng" : ""}><i>{st === "ng" ? "!" : st === "ok" || (r.preparedAt && !st) ? "✓" : ""}</i>{label}<em>{st === "wait" ? "…" : st === "ok" || (r.preparedAt && !st) ? val : "—"}</em></span>;
    const cool = (() => { const mo = Number(new Date(nowMs + 9 * 3600e3).getUTCMonth()) + 1; return mo >= 5 && mo <= 10; })();
    return (
      <div className="card pc sel" style={{ ["--rc" as any]: roomColor(room?.slug ?? "") }}>
        {head}
        <div className="r2">{t("お部屋")} <b>{rName(r)}</b> ・ {t("{n}泊", { n: nights(r) })} ・ {r.lang.toUpperCase()}</div>
        <button className="line" onClick={() => openPickSheet(r)}>
          <span className="ic">📍</span>
          <span className={`v ${r.pickupPlace || r.pickupNone ? "" : "unset"}`}>{r.pickupNone ? t("送迎なし") : r.pickupPlace ? r.pickupPlace : t("未設定（タップで設定）")}{r.pickupAt && !r.pickupNone ? <small>{jstTime(r.pickupAt)}</small> : null}</span>
          <span className="go">›</span>
        </button>
        {!r.pickupNone && (r.flightNo ? (
          <>
            <div className="line fl2">
              <span className="ic">✈</span>
              {flightEdit === r.id ? <input autoFocus defaultValue={r.flightNo} onBlur={(e) => void saveFlight(r, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                : <button className="v mono" onClick={() => setFlightEdit(r.id)}>{r.flightNo}</button>}
              <span className="rt">{f ? `${f.from ?? ""} → ${f.to ?? ""}` : ""}</span>
              <button className="fchk" disabled={flightBusy === r.id} onClick={() => void checkFlight(r)}>{flightBusy === r.id ? "…" : t("確認")}</button>
            </div>
            {f && (
              <div className="fres4">
                <div><small>{t("状況")}</small><b className={f.status === "Landed" || f.status === "Arrived" ? "okc2" : late ? "delay" : "onTime"}>{f.status === "Landed" || f.status === "Arrived" ? t("着陸") : late ? t("遅れ") : f.status === "Canceled" ? t("欠航") : t("定刻")}</b></div>
                <div><small>{t("ターミナル")}</small><b>{f.terminal ? `T${f.terminal}` : "—"}</b></div>
                <div><small>{t("到着見込み")}</small><b className={late ? "delay" : "onTime"}>{f.actual ? jstTime(f.actual) : f.expected ? jstTime(f.expected) : f.scheduled ? jstTime(f.scheduled) : "—"}</b></div>
                <div><small>{t("ゲート")}</small><b>{f.gate || "—"}</b></div>
              </div>
            )}
            {f && r.flightCheckedAt ? <div className="fmeta"><span>{t("{t} に確認", { t: jstTime(r.flightCheckedAt) })}</span><span>{late ? t("{n}分遅れ", { n: f.delayMin ?? 0 }) : ""}</span></div> : null}
          </>
        ) : (
          <div className="line fl2 dash">
            <span className="ic">✈</span>
            {flightEdit === r.id ? <input autoFocus placeholder={t("例: CI152")} onBlur={(e) => void saveFlight(r, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              : <><span className="rt">{t("便名：未入力")}</span><button className="fchk" onClick={() => setFlightEdit(r.id)}>{t("入力する")}</button></>}
          </div>
        ))}
        <div className={`acts3 ${room?.hasWafu ? "" : "two"}`}>
          <button className={`main ${busy && m !== "wafu" ? "run" : r.preparedAt && m !== "wafu" ? "done" : ""}`} disabled={busy} onClick={() => void prepare([r.id], "welcome", true)}>
            {busy ? t("準備中…") : r.preparedAt && m !== "wafu" ? "✓ " + t("準備完了") + " ─ " + t("いつでも入室OK") : r.preparedAt && m === "wafu" ? "⚡ " + t("快適に変える") : "⚡ " + t("お出迎え準備")}
          </button>
          {room?.hasWafu && (
            <button className={`wafu ${m === "wafu" && (r.preparedAt || busy) ? "on" : ""}`} disabled={busy} onClick={() => void prepare([r.id], "wafu", true)}>
              <b>🏮</b>{m === "wafu" && r.preparedAt && !busy ? t("和風") + " ✓" : t("和風準備")}
            </button>
          )}
          <button className="gd" onClick={() => openGuide(r)}><b>▦</b>{t("案内")}</button>
        </div>
        <div className="dev">
          {room?.hasAc !== false && chip("ac", t("エアコン"), cool ? t("冷房") : t("暖房"))}
          {m === "wafu" ? chip("lt", t("和風ライト"), t("暖色")) : chip("lt", t("照明"), "ON")}
          {room?.hasLock && <span className="lock"><i>🔒</i>{t("鍵")}<em>{t("施錠のまま")}</em></span>}
        </div>
        {data.settings.autoPrep && !r.preparedAt && today && (
          <div className="autoline">⏱ {t("到着 {m}分前に自動で準備する（{t}）", { m: data.settings.autoPrepMin, t: jstTime(Date.parse(pickupBase(r)) - data.settings.autoPrepMin * 60e3) })}</div>
        )}
      </div>
    );
  };
  /** 送迎ページ上のエネルギーモニター (開いているお迎えの部屋の準備) */
  const PickMonitor = ({ r }: { r: DRes | null }) => {
    const busy = !!r && preparing.includes(r.id), done = !!r?.preparedAt && !busy;
    const n = busy ? charge : done ? 8 : 0;
    const P = (x: number, y: number, w: number, h: number) => ({ left: `${(x / 1086) * 100}%`, top: `${((y - 960) / 255) * 100}%`, width: `${(w / 1086) * 100}%`, height: `${(h / 255) * 100}%` }) as React.CSSProperties;
    const failed = !!r && devSt[r.id] === "ng" && !busy && !done;
    const msg = busy || failed ? emMsg : done ? t(prepMode[r!.id] === "wafu" ? "{n}（{g}）和風モードの準備が完了しました {t}" : "{n}（{g}）の準備が完了しました {t}", { n: rName(r), g: gName(r), t: jstTime(r!.preparedAt!) }) : r ? t("「お出迎え準備」で お部屋の準備をはじめます") : t("本日のお迎えはありません");
    return (
      <div className="emwrap"><div className={`pem em ${busy ? "on" : ""} ${done ? "done" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bg" src="/driver/em.jpg" alt="" />
        <div className="eng" style={P(140, 1040, 125, 105)} /><div className="spin" style={P(345, 1062, 98, 66)} />
        <div className="fl" style={P(262, 1090, 80, 14)} /><div className="fl" style={P(446, 1090, 92, 14)} /><div className="fl" style={P(680, 1090, 88, 14)} />
        <div className="cells" style={P(553, 1079, 108, 37)}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < n ? "on" : busy && i === n ? "charging" : ""} />)}</div>
        <div className="ov c pct" style={P(540, 1040, 130, 30)}>{r ? `${Math.round((n / 8) * 100)}%` : "—"}</div>
        <div className="house" style={P(780, 1030, 190, 120)} />
        <div className="ov c lbl2" style={P(130, 1126, 160, 28)}>{t("エンジン")}</div>
        <div className="ov c lbl2" style={P(318, 1126, 160, 28)}>{t("モーター")}</div>
        <div className="ov c lbl2" style={P(530, 1126, 160, 28)}>{t("バッテリー")}</div>
        <div className="ov c room" style={P(790, 1138, 170, 28)}>{r ? rName(r) : t("お部屋")}</div>
        <div className="ov c st" style={P(110, 1165, 866, 40)}>{done ? <span className="okc">✓</span> : null}{msg}</div>
      </div></div>
    );
  };
  const [pickOpen, setPickOpen] = useState<string>("");

  /* ================================================================ */
  const bike = design === "bike";
  const nextTab = next ? rName(next) : null;
  const bootDone = booting === "done";
  const nr = (r: DRes | null) => (r ? rName(r) : "");

  return (
    <div className={`drv ${bike ? "bike" : "hybrid"} t-${tod}`}>
      {/* ---------------- 起動 ---------------- */}
      {!bootDone && (bike ? (
        <div className={`boot bikeboot ${bootStep.join(" ")}`}>
          <div className="tach">
            <svg viewBox="0 0 230 230"><circle cx="115" cy="115" r="104" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
              {Array.from({ length: 9 }, (_, i) => { const a = ((-120 + i * 30) * Math.PI) / 180; const c = i >= 7 ? "#ff5a3d" : "rgba(255,255,255,.6)"; return <g key={i}><line x1={115 + 92 * Math.sin(a)} y1={115 - 92 * Math.cos(a)} x2={115 + 80 * Math.sin(a)} y2={115 - 80 * Math.cos(a)} stroke={c} strokeWidth="3" /><text x={115 + 66 * Math.sin(a)} y={120 - 66 * Math.cos(a)} fill={c} fontSize="15" textAnchor="middle">{i}</text></g>; })}
              <g className="needle"><line x1="115" y1="115" x2="115" y2="30" stroke="#ff8a3d" strokeWidth="3.5" strokeLinecap="round" /></g>
              <circle cx="115" cy="115" r="9" fill="#1a1208" stroke="#ff8a3d" strokeWidth="2" /></svg>
          </div>
          <button className="start" onClick={startBoot}>ENGINE<br />START</button>
          <div className="cap">HIROSHI DRIVE</div>
        </div>
      ) : (
        <div className={`boot ${bootStep.join(" ")}`}>
          <div className="bimg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bg" src="/driver/boot.jpg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="blm bcar" src="/driver/b_carL.png" style={pb(170, 440, 250, 105)} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="blm bcar" src="/driver/b_carR.png" style={pb(666, 440, 250, 105)} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="blm bwL" src="/driver/b_wingL.png" style={pb(10, 770, 435, 145)} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="blm bwR" src="/driver/b_wingR.png" style={pb(641, 770, 435, 145)} alt="" />
            <svg className="bov" viewBox={`0 0 ${DW} ${BH}`} preserveAspectRatio="none">
              {[208, 685].map((x0, side) => Array.from({ length: 7 }, (_, i) => { const k = side ? 6 - i : i; const x = x0 + i * 26.8; return <polygon key={`${side}-${i}`} className={k < seg ? "on" : ""} points={`${x},900 ${x + 24},900 ${x + 32},912 ${x + 8},912`} />; }))}
            </svg>
            <div className="sys" style={pb(700, 928, 160, 24)}>{bootStep.includes("lights") ? "ONLINE" : "STANDBY"}</div>
            <div className="ring" style={pb(423, 955, 240, 240)} />
            <button className="pb" aria-label="POWER" style={pb(423, 955, 240, 240)} onClick={startBoot} />
            <div className="hint" style={pb(160, 1255, 766, 50)}>{bootStep.includes("ready") ? "" : t("タップして、ドライブをはじめる")}</div>
            <div className="ready" style={pb(470, 1250, 146, 56)}>READY</div>
          </div>
        </div>
      ))}

      {/* ---------------- ホーム ---------------- */}
      {page === "home" && (
        <div className="page">
          {bike ? (
            <div className="bikehero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/driver/hiroshi.jpg" alt="" />
              <div className="clock"><b>{jstTime(nowMs)}</b><span>{dateText}</span></div>
              <div className="hello"><div className="tt">HIROSHI DRIVE</div><h1>{t(hour < 11 ? "おはようございます、ひろしさん" : hour < 18 ? "こんにちは、ひろしさん" : "おつかれさまです、ひろしさん")}</h1>
                <div className="sub">{t("今日は お迎え {a}件・お見送り {b}件 です", { a: board.arrivals.length, b: board.departures.length })}</div></div>
            </div>
          ) : (
            <div className={`dash em ${preparing.length ? "on" : ""} ${pct === 100 && board.arrivals.length ? "done" : ""} ${lit ? "lit" : ""} ${flash ? "flash" : ""}`} key={`f${flash}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bg" src="/driver/dash.jpg" alt="" />
              <div className="tod" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lm lmCar" src="/driver/m_car.png" style={pd(160, 262, 385, 76)} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lm lmL" src="/driver/m_wingL.png" style={pd(20, 484, 330, 144)} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lm lmR" src="/driver/m_wingR.png" style={pd(736, 484, 330, 144)} alt="" />
              <svg className="emlights" viewBox={`0 0 ${DW} ${DH}`} preserveAspectRatio="none">
                <defs><radialGradient id="lg"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#cfeaff" stopOpacity=".9" /><stop offset="1" stopColor="#6fb6ff" stopOpacity="0" /></radialGradient></defs>
                <circle className="pj pjC" cx="185" cy="292" r="16" fill="url(#lg)" /><circle className="pj pjC" cx="466" cy="294" r="18" fill="url(#lg)" />
                <circle className="pj pjW" cx="110" cy="546" r="30" fill="url(#lg)" /><circle className="pj pjW" cx="976" cy="546" r="30" fill="url(#lg)" />
                <circle cx="543" cy="632" r="62" className="ringE" /><circle cx="543" cy="632" r="62" className="ripple" />
                <path className="route" d="M205 866 C 250 828, 320 822, 370 850 S 470 905, 578 893" pathLength="100" />
              </svg>
              <div className="ov r" style={pd(640, 18, 400, 34)}><span className="date">{dateText}</span></div>
              <div className="ov r" style={pd(640, 70, 400, 44)}><span className="wx">{wx ? <>{t("泉佐野")} <b>{wx.temp}°</b> {wxI?.e} {wxText}</> : ""}</span></div>
              <div className="ov c lbl" style={pd(200, 550, 160, 34)}>{t("お迎え")}</div>
              <div className="ov c lbl" style={pd(726, 550, 160, 34)}>{t("お見送り")}</div>
              <div className="ov c num" style={pd(200, 580, 180, 80)}>{board.arrivals.length}<small>{t("件")}</small></div>
              <div className="ov c num" style={pd(716, 580, 180, 80)}>{board.departures.length}<small>{t("件")}</small></div>
              <div className="ov c lbl2" style={pd(222, 664, 130, 26)}>{t("次の送迎")}</div>
              <div className="ov c lbl2" style={pd(652, 664, 130, 26)}>{t("次の送迎")}</div>
              <div className="ov nx" style={pd(214, 686, 226, 38)}>{next ? <><b>{jstTime(pickupBase(next))}</b> {next.pickupPlace || nr(next)}</> : "—"}</div>
              <div className="ov nx" style={pd(638, 686, 205, 38)}>{nextOut ? <><b>{jstTime(nextOut.checkOut)}</b> {nr(nextOut)}</> : "—"}</div>
              <div className="ov c lbl3" style={pd(400, 774, 286, 34)}>{t("本日のドライブ")}</div>
              <div className="ov stop" style={pd(196, 878, 200, 60)}>{board.arrivals[0] ? <><b>{board.arrivals[0].pickupPlace || nr(board.arrivals[0])}</b>{jstTime(pickupBase(board.arrivals[0]))} {board.arrivals[0].guest ?? ""}</> : <b>{t("本日の送迎はありません")}</b>}</div>
              <div className="ov stop" style={pd(596, 878, 210, 60)}>{board.arrivals[1] ? <><b>{board.arrivals[1].pickupPlace || nr(board.arrivals[1])}</b>{jstTime(pickupBase(board.arrivals[1]))} {board.arrivals[1].guest ?? ""}</> : null}</div>
              <div className="ov c wxb" style={pd(848, 812, 120, 130)}><span>{t("泉佐野")}</span><b>{wx ? `${wx.temp}°` : "—"}</b><span>{wxText}</span></div>
              <div className="fl" style={pd(262, 1090, 80, 14)} /><div className="fl" style={pd(446, 1090, 92, 14)} /><div className="fl" style={pd(680, 1090, 88, 14)} />
              <div className="cells" style={pd(553, 1079, 108, 37)}>{Array.from({ length: 8 }, (_, i) => { const n = preparing.length ? charge : Math.round((pct / 100) * 8); return <i key={i} className={i < n ? "on" : preparing.length && i === n ? "charging" : ""} />; })}</div>
              <div className="ov c pct" style={pd(540, 1040, 130, 30)}>{board.arrivals.length ? `${preparing.length ? Math.round((charge / 8) * 100) : pct}%` : "—"}</div>
              <div className="spin" style={pd(345, 1062, 98, 66)} /><div className="eng" style={pd(140, 1040, 125, 105)} /><div className="house" style={pd(780, 1030, 190, 120)} />
              <div className="ov c lbl2" style={pd(130, 1133, 160, 28)}>{t("エンジン")}</div>
              <div className="ov c lbl2" style={pd(318, 1126, 160, 28)}>{t("モーター")}</div>
              <div className="ov c lbl2" style={pd(530, 1126, 160, 28)}>{t("バッテリー")}</div>
              <div className="ov c room" style={pd(790, 1143, 170, 28)}>{preparing.length ? preparing.map((id) => nr(data.res.find((r) => r.id === id) ?? null)).join("・") : t("お部屋")}</div>
              <div className="ov c st" style={pd(200, 1164, 686, 44)}>{emMsg || (board.arrivals.length ? t("START で お部屋の準備をはじめます") : t("本日の送迎はありません"))}</div>
              <button className="embBtn" style={pd(480, 570, 126, 126)} aria-label="lights" onClick={toggleLights} />
            </div>
          )}

          <div className="wrap">
            {data.setupMissing && <div className="alert">⚠ {t("Supabase の SQL（migration_driver.sql）がまだ実行されていません")}</div>}
            {data.alerts.map((a) => (
              <div className="alert" key={a.id}>🔋 {t("{r} の鍵の電池を交換してください（残り {b}%）", { r: roomOf(a.roomId || "")?.name ?? "", b: a.battery ?? "?" })}
                {a.dueAt ? <small> ・ {t("チェックイン {d}", { d: jstDay(a.dueAt).slice(5).replace("-", "/") })}</small> : null}
                <button onClick={async () => { await driverResolveAlert(a.id); setData((d) => ({ ...d, alerts: d.alerts.filter((x) => x.id !== a.id) })); sfx.chord(); }}>{t("交換しました")}</button>
              </div>
            ))}
            {bike && (
              <div className="gauges">
                <div className="g"><div className="v">{board.arrivals.length}</div><div className="l">{t("お迎え")}</div></div>
                <div className="g"><div className="v">{board.departures.length}</div><div className="l">{t("お見送り")}</div></div>
                <div className="g"><div className="v">{wx ? `${wxI?.e} ${wx.temp}°` : "—"}</div><div className="l">{t("泉佐野")} {wxText}</div></div>
              </div>
            )}
            <div className="chips">
              {board.arrivals.map((r) => (
                <div key={r.id} className={`chip ${preparing.includes(r.id) ? "run" : r.preparedAt ? "done" : ""}`}><i /><b>{nr(r)}</b>
                  <span>{preparing.includes(r.id) ? t("準備中…") : r.preparedAt ? t("準備完了") + " " + jstTime(r.preparedAt) : data.settings.autoPrep ? t("未準備・{t} に自動", { t: jstTime(Date.parse(pickupBase(r)) - data.settings.autoPrepMin * 60e3) }) : t("未準備")}</span></div>
              ))}
            </div>

            <div className="sec"><b>01</b>IN-CAR ・ {t("お父さんが操作")}</div>
            <div className="card omotenashi">
              <button className={`btn main ${omo ? "done" : ""}`} onClick={startOmotenashi}>{omo ? "✓ " + t("おもてなし中 ─ 音楽を流しています") : "🚗 " + t("おもてなし開始（歓迎の声 ＋ 音楽）")}</button>
              <MusicPlayer m={music} t={t} onOpen={() => setMusicOpen(true)} onArrive={arriveSoon} />
            </div>
            <div className="rcards">
              {cardRooms.map(({ room, res, tag }) => {
                const st = modes[room.id] || {}, open = openCard === room.id;
                return (
                  <div key={room.id} className={`rc ${open ? "open" : ""}`} style={{ ["--rc" as any]: roomColor(room.slug) }}>
                    <button className="rch" onClick={() => { sfx.blip(); setOpenCard(open ? "" : room.id); }}>
                      <i className="dot" />
                      <span className="rn"><b>{room.name}</b><small>{res ? `${gName(res)}・${tag === "in" ? jstTime(pickupBase(res)) + " " + t("着") : tag === "out" ? jstTime(res.checkOut) + " " + t("チェックアウト") : t("滞在中")}` : t("空室")}</small></span>
                      <span className="rst">{st.lock === "unlocked" ? "🔓 " + t("解錠中") : st.lock === "locked" ? "🔒 " + t("施錠") : ""}{st.mode ? `・${st.mode === "welcome" ? t("快適モード") : t("和風モード")}` : ""}{st.galaxy ? "・🌌" : ""}</span>
                      <em>{open ? "▲" : "▼"}</em>
                    </button>
                    {open && (
                      <div className="rcb">
                        <div className="rlabel">{t("モード")}</div>
                        <div className="rrow three">
                          <button className={`rb ${st.mode === "welcome" ? "on" : ""}`} onClick={() => void roomAct(room, "welcome")}><b>🏠</b>{t("快適モード")}</button>
                          {room.hasWafu && <button className={`rb ${st.mode === "wafu" ? "on" : ""}`} onClick={() => void roomAct(room, "wafu")}><b>🏮</b>{t("和風モード")}</button>}
                          {room.hasGalaxy && <button className={`rb ${st.galaxy ? "on" : ""}`} onClick={() => void roomAct(room, "galaxy")}><b>🌌</b>{st.galaxy ? t("ギャラクシー ON") : t("ギャラクシー OFF")}</button>}
                        </div>
                        <div className="rlabel">{t("機器")}</div>
                        <div className="rrow four">
                          {room.hasLock && <button className={`rb ${st.lock === "unlocked" ? "on" : ""}`} onClick={() => void roomAct(room, "unlock")}><b>🔓</b>{t("解錠")}</button>}
                          {room.hasLock && <button className={`rb ${st.lock === "locked" ? "on" : ""}`} onClick={() => void roomAct(room, "lock")}><b>🔒</b>{t("施錠")}</button>}
                          {room.hasAc && <button className={`rb ${st.ac ? "on" : ""}`} onClick={() => void roomAct(room, "ac")}><b>❄️</b>{t("エアコン")}</button>}
                          {room.hasLight && <button className={`rb ${st.light ? "on" : ""}`} onClick={() => void roomAct(room, "light")}><b>💡</b>{t("照明")}</button>}
                        </div>
                        <div className="rlast">{st.last || t("まだ操作していません")}</div>
                        {data.battery[room.id] && <div className="rbat">🔋 {t("電池 {b}%・{d} 確認", { b: data.battery[room.id].battery ?? "?", d: jstDay(data.battery[room.id].checkedAt).slice(5).replace("-", "/") })}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {!cardRooms.length && <p className="note">{t("今日は操作する部屋がありません")}</p>}
              <button className="linkbtn" onClick={() => { sfx.blip(); setShowAll((v) => !v); }}>{showAll ? t("今日の部屋だけにする") : "＋ " + t("ほかの部屋を操作する")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 送迎 ---------------- */}
      {page === "pick" && (
        <div className="page">
          <div className="wrap top">
            <div className="ptop"><b>{t("送迎")}</b><span>{dateText}</span></div>
            <div className="segsw">
              <button className={pickTab === "in" ? "on" : ""} onClick={() => { sfx.tick(); setPickTab("in"); }}>🛬 {t("お迎え")} <em>{board.arrivals.length}</em></button>
              <button className={pickTab === "out" ? "on" : ""} onClick={() => { sfx.tick(); setPickTab("out"); }}>🛫 {t("お見送り")} <em>{board.departures.length}</em></button>
            </div>
            {pickTab === "in" ? (
              <div className="pane">
                {(() => {
                  const all = [...board.arrivals, ...upcoming];
                  const openId = all.find((x) => x.id === pickOpen)?.id ?? next?.id ?? all[0]?.id ?? "";
                  const cur = all.find((x) => x.id === openId) ?? null;
                  const card = (x: DRes) => <Fragment key={x.id}>{ArrivalCard({ r: x, open: x.id === openId, onOpen: () => setPickOpen(x.id) })}</Fragment>;
                  return (
                    <>
                      {PickMonitor({ r: cur })}
                      {board.arrivals.length ? board.arrivals.map(card) : <p className="note">{t("本日のお迎えはありません")}</p>}
                      {upcoming.length > 0 && <><div className="sec">{t("これからの予定")}</div>{upcoming.map(card)}</>}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="pane">
                {board.departures.length ? board.departures.map((r) => (
                  <div key={r.id} className="card" style={{ ["--rc" as any]: roomColor(roomOf(r.roomId)?.slug ?? "") }}>
                    <div className="row1"><span className="time">{jstTime(r.checkOut)}</span><span className="kind out">{t("お見送り")}</span><span className="eta">{eta(r.checkOut)}</span></div>
                    <div className="who">{gName(r)}<small>{r.lang.toUpperCase()}</small></div>
                    <div className="meta">{t("お部屋")} <b>{rName(r)}</b></div>
                    <div className="btns">
                      <button className="btn" onClick={() => { music.setPlaylist("out", r.lang as MLang, false); setTimeout(() => music.play(), 150); toast(t("お見送りの音楽を流します")); }}>🎵 {t("お見送りの音楽")}</button>
                      <button className="btn main gray" onClick={async () => { sfx.down(); vib(40); const x = await driverCheckout(r.id); if (x.ok) { say(["checkout"], 600); toast(t("✓ 全部OFF・施錠しました（清掃リストに出ます）")); } else { sfx.error(); toast(t("操作できませんでした")); } }}>⏻ {t("チェックアウト処理（全部OFF＋施錠）")}</button>
                    </div>
                  </div>
                )) : <p className="note">{t("本日のお見送りはありません")}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 案内 ---------------- */}
      {page === "guide" && (
        <div className="page">
          <div className="wrap top guide">
            <div className="sec c">GUEST GUIDANCE</div>
            <div className="grooms">
              {guideRooms.map((r) => (
                <button key={r.id} className={`gr ${curG?.id === r.id ? "on" : ""}`} style={{ ["--rc" as any]: roomColor(roomOf(r.roomId)?.slug ?? "") }} onClick={() => { sfx.tick(); openGuide(r, true); }}>
                  <i /><b>{rName(r)}</b><small>{gName(r)}・{jstDay(r.checkIn) === jstDay(nowMs) ? t("今日 {t} 到着", { t: jstTime(pickupBase(r)) }) : t("滞在中")}</small>
                </button>
              ))}
            </div>
            {curG ? (
              <>
                <div className="glabel">{t("ゲストの言語")}</div>
                <div className="langs">{(["en", "zh", "ko", "ja"] as GuideLang[]).map((l) => <button key={l} className={gLang === l ? "on" : ""} onClick={() => { sfx.blip(); setGLang(l); }}>{({ en: "English", zh: "中文", ko: "한국어", ja: "日本語" } as const)[l]}</button>)}</div>
                <div className="qrbox" style={{ ["--rc" as any]: roomColor(roomOf(curG.roomId)?.slug ?? "") }}>
                  <div className="beam" />{/* eslint-disable-next-line @next/next/no-img-element */}{qr ? <img src={qr} alt="QR" /> : null}
                </div>
                <div className="qrroom">{rName(curG)}</div>
                <div className="qrguest">{gName(curG)}{curG.pin ? ` ・ PIN ${curG.pin}` : ""}</div>
                {steps < 0 ? (
                  <button className="demo" onClick={() => { sfx.auth(); say(["guide"], 0); setSteps(0); }}>{t("案内を始める（スマホを見せる）")}</button>
                ) : (
                  <>
                    <div className="step">
                      <div className="n">STEP {steps + 1} / {gSteps.length}</div>
                      <h3>{gSteps[steps]?.h}</h3>
                      {gSteps[steps]?.big && <div className="big" dangerouslySetInnerHTML={{ __html: gSteps[steps].big! }} />}
                      <p dangerouslySetInnerHTML={{ __html: gSteps[steps]?.p ?? "" }} />
                    </div>
                    <div className="nav2"><button onClick={() => { if (steps > 0) { sfx.blip(); setSteps(steps - 1); } }}>←</button><button className="fwd" onClick={() => { if (steps < gSteps.length - 1) { sfx.tick(); setSteps(steps + 1); } else { sfx.chord(); toast(t("案内おわり ─ よい滞在を！")); setSteps(-1); } }}>→</button></div>
                    <div className="dots">{gSteps.map((_, i) => <i key={i} className={i === steps ? "on" : ""} />)}</div>
                  </>
                )}
              </>
            ) : <p className="note c">{t("今日は案内するゲストがいません")}</p>}
          </div>
        </div>
      )}

      {/* ---------------- 設定 ---------------- */}
      {page === "set" && (
        <div className="page">
          <div className="wrap top">
            <div className="sec">SETTINGS</div>
            <div className="card">
              <div className="ctitle">🌐 语言 / 言語</div>
              <div className="segsw small"><button className={lang === "zh" ? "on" : ""} onClick={() => setUiLang("zh")}>简体中文</button><button className={lang === "ja" ? "on" : ""} onClick={() => setUiLang("ja")}>日本語</button></div>
            </div>
            <div className="card">
              <div className="ctitle">🎨 {t("画面のデザイン")}</div>
              <div className="segsw small"><button className={design === "hybrid" ? "on" : ""} onClick={() => void saveSetting({ design: "hybrid" })}>🚙 {t("ハイブリッド")}</button><button className={design === "bike" ? "on" : ""} onClick={() => void saveSetting({ design: "bike" })}>🏍 {t("バイク")}</button></div>
            </div>
            <div className="card">
              <div className="ctitle">⚡ {t("自動準備")}</div>
              <div className="auto"><button className={`sw ${data.settings.autoPrep ? "on" : ""}`} onClick={() => void saveSetting({ autoPrep: !data.settings.autoPrep })} />{t("到着前に自動でお部屋を準備する")}</div>
              {data.settings.autoPrep && <div className="mins">{[10, 20, 30, 45, 60].map((m) => <button key={m} className={data.settings.autoPrepMin === m ? "on" : ""} onClick={() => void saveSetting({ autoPrepMin: m })}>{t("{m}分前", { m })}</button>)}</div>}
            </div>
            <div className="card">
              <div className="ctitle">📍 {t("よく使うお迎え場所")}</div>
              <div className="cnote">{t("名前の変更・並べ替え・削除ができます。お父さん・お母さん・Kakuさんの全員の画面に同じ一覧が出ます。")}</div>
              {places.map((p, i) => (
                <div className="fedit" key={p.id}>
                  <input defaultValue={p.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) void savePlaces(places.map((x) => (x.id === p.id ? { ...x, name: v } : x))); }} />
                  <button onClick={() => { if (i > 0) { const L = places.slice(); [L[i - 1], L[i]] = [L[i], L[i - 1]]; sfx.tick(); void savePlaces(L); } }}>↑</button>
                  <button className="del" onClick={() => { sfx.blip(); void savePlaces(places.filter((x) => x.id !== p.id)); }}>✕</button>
                </div>
              ))}
              <div className="fedit"><input value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder={t("新しい場所（例: 伏見稲荷 駐車場）")} /><button className="add" onClick={() => { if (!newPlace.trim()) return; sfx.chord(); void savePlaces([...places, { id: `new-${Date.now()}`, name: newPlace.trim(), mapQuery: null, sort: places.length }]); setNewPlace(""); }}>{t("追加")}</button></div>
            </div>
            <MusicAdmin m={music} t={t} toast={toast} autoLang={autoLang} />
            <div className="card">
              <div className="ctitle">✈ {t("飛行機の確認")}</div>
              <div className="quota"><div className="bar"><i style={{ width: `${Math.max(0, 100 - (data.flightUsed / FLIGHT_MONTHLY_FREE) * 100)}%` }} /></div><b>{Math.max(0, FLIGHT_MONTHLY_FREE - data.flightUsed)} / {FLIGHT_MONTHLY_FREE}</b></div>
              <div className="cnote">{t("今月の残り回数（無料枠）。毎月1日に戻ります。便名が入っている予約で確認したときだけ減ります。")}</div>
              <div className="auto"><button className={`sw ${data.settings.flightAuto ? "on" : ""}`} onClick={() => void saveSetting({ flightAuto: !data.settings.flightAuto })} />{t("到着1時間前に1回だけ自動で確認する")}</div>
            </div>
            <div className="card">
              <div className="auto"><button className={`sw ${voiceOn ? "on" : ""}`} onClick={() => { const v = !voiceOn; setVoiceOn(v); try { localStorage.setItem("drvVoice", v ? "1" : "0"); } catch { /* ignore */ } }} />{t("声で知らせる")}</div>
              <div className="auto"><button className={`sw ${sfxOn ? "on" : ""}`} onClick={() => { const v = !sfxOn; setSfxOn(v); try { localStorage.setItem("drvSfx", v ? "1" : "0"); } catch { /* ignore */ } }} />{t("効果音")}</div>
              <p className="note">{t("ホーム画面に追加すると、アプリのように開けて、画像や声もスマホに保存されます（Safari の共有ボタン →「ホーム画面に追加」）。")}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 下のナビ ---------------- */}
      {bike ? (
        <nav className="tabs">
          {(["home", "pick"] as Page[]).map((p) => <button key={p} className={page === p ? "on" : ""} onClick={() => go(p)}>{p === "home" ? "⌂" : "👥"}<span>{t(p === "home" ? "ホーム" : "送迎")}</span></button>)}
          <span className="navc"><button className="startc" onClick={openStart}>START</button>{nextTab && <em>NEXT ▸ {nextTab}</em>}</span>
          {(["guide", "set"] as Page[]).map((p) => <button key={p} className={page === p ? "on" : ""} onClick={() => go(p)}>{p === "guide" ? "⌖" : "⚙"}<span>{t(p === "guide" ? "案内" : "設定")}</span></button>)}
        </nav>
      ) : (
        <nav className="navimg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/driver/nav.jpg" alt="" />
          {([["home", 80, 90, 110, 78], ["pick", 280, 90, 120, 78], ["guide", 690, 90, 120, 78], ["set", 895, 90, 115, 78]] as const).map(([k, x, y, w, h]) => (
            <span key={k}>
              <i className={`nbg ${page === k ? "on" : ""}`} style={pn(x - 40, y - 20, w + 80, h + 40)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`nglow ${page === k ? "on" : ""}`} src={`/driver/nvz_${k}.png`} style={pn(x, y, w, h)} alt="" />
            </span>
          ))}
          {([["home", "ホーム", 60, 150], ["pick", "送迎", 260, 160], ["guide", "案内", 670, 160], ["set", "設定", 880, 150]] as const).map(([k, s, x, w]) => <span key={k} className={`nlbl ${page === k ? "on" : ""}`} style={pn(x, 140, w, 30)}>{t(s)}</span>)}
          <i className="navline" style={{ left: `${({ home: 12.4, pick: 31.3, guide: 69.1, set: 87.7 } as const)[page]}%` }} />
          <button className="hot" style={pn(40, 70, 190, 120)} aria-label="home" onClick={() => go("home")} />
          <button className="hot" style={pn(240, 70, 200, 120)} aria-label="pick" onClick={() => go("pick")} />
          <button className="hot st" style={pn(450, 0, 186, 170)} aria-label="START" onClick={openStart} />
          <button className="hot" style={pn(650, 70, 200, 120)} aria-label="guide" onClick={() => go("guide")} />
          <button className="hot" style={pn(860, 70, 190, 120)} aria-label="set" onClick={() => go("set")} />
          <div className="nextroom" style={pn(413, 190, 260, 32)}>{nextTab ? `NEXT ▸ ${nextTab}` : board.arrivals.length ? "ALL READY ✓" : "HIROSHI DRIVE"}</div>
        </nav>
      )}

      {/* ---------------- シート ---------------- */}
      <div className={`sheet-bg ${roomSheet ? "show" : ""}`} onClick={() => setRoomSheet(false)} />
      <div className={`sheet ${roomSheet ? "show" : ""}`}>
        <h4>{t("どの部屋を準備しますか？")}</h4>
        {prepTargets.length ? prepTargets.map((r) => {
          const on = sel.includes(r.id);
          return (
            <button key={r.id} className={`rsel ${on ? "on" : ""} ${r.preparedAt ? "done" : ""}`} onClick={() => { sfx.tick(); setSel((s) => (on ? s.filter((x) => x !== r.id) : [...s, r.id])); }}>
              <span className="ck2">{on ? "✓" : ""}</span><span><b>{rName(r)}</b><small>{gName(r)}・{jstTime(pickupBase(r))} {t("着")}</small></span><em>{r.preparedAt ? t("準備完了") : t("未準備")}</em>
            </button>
          );
        }) : <p className="note">{t("本日のお迎えはありません")}</p>}
        <p className="note">{t("次に到着する部屋に最初からチェックが入っています。2部屋まとめて選べます。")}</p>
        <div className="acts one"><button className="ok" disabled={!sel.length} onClick={() => void prepare(sel)}>{sel.length ? t("準備開始（{n}）", { n: sel.map((id) => nr(data.res.find((r) => r.id === id) ?? null)).join("・") }) : t("部屋を選んでください")}</button></div>
      </div>

      <div className={`sheet-bg ${pickSheet ? "show" : ""}`} onClick={() => setPickSheet(null)} />
      <div className={`sheet ${pickSheet ? "show" : ""}`}>
        <h4>{t("お迎え場所")}{pickSheet ? ` ─ ${gName(pickSheet)}` : ""}</h4>
        <div className="favs">{places.map((p) => <button key={p.id} className={pickPlace === p.name ? "on" : ""} onClick={() => { sfx.tick(); setPickPlace(p.name); }}>{p.name}</button>)}</div>
        <label>{t("お迎え時刻（入れなくてもOK）")}</label>
        <input type="time" value={pickTime} onChange={(e) => setPickTime(e.target.value)} />
        <div className="sheetlinks">
          {pickSheet && !pickSheet.pickupNone && <a className="linkbtn" href={mapUrl(pickSheet)} target="_blank" rel="noreferrer">📍 {t("地図で開く")} ›</a>}
          <button className="linkbtn" onClick={() => { setPickSheet(null); setPage("set"); }}>{t("よく使う場所を編集")} ›</button>
        </div>
        <div className="acts"><button onClick={() => void savePickup(true)}>{t("送迎なし")}</button><button className="ok" onClick={() => void savePickup(false)}>{t("保存")}</button></div>
      </div>

      <div className={`sheet-bg ${confirmUnlock ? "show" : ""}`} onClick={() => setConfirmUnlock(null)} />
      <div className={`sheet cf ${confirmUnlock ? "show" : ""}`}>
        <h4>{t("{r} を解錠しますか？", { r: confirmUnlock?.name ?? "" })}</h4>
        <div className="acts"><button onClick={() => setConfirmUnlock(null)}>{t("やめる")}</button><button className="ok warn" onClick={() => { const r = confirmUnlock; setConfirmUnlock(null); if (r) void roomAct(r, "unlock", true); }}>{t("解錠する")}</button></div>
      </div>

      <MusicSheet m={music} t={t} open={musicOpen} onClose={() => setMusicOpen(false)} autoLang={autoLang} autoWho={autoWho} onAdmin={() => { setMusicOpen(false); setPage("set"); setTimeout(() => document.getElementById("musicAdmin")?.scrollIntoView({ behavior: "smooth" }), 100); }} />
      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
