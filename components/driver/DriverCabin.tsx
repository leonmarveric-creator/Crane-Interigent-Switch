"use client";

/**
 * お父さんのスマホ ⇄ 車内 iPad。
 *   ・「🚗 iPad に出して出発」: 予約から お迎え/お見送り・場所・部屋・言語・冷暖房 を自動で入れて、iPad を送迎の画面に
 *   ・送迎中はスマホの GPS を 3 秒ごとに送る (Wi-Fi だけの iPad 用)。画面はつけたまま (スリープすると iPhone は位置を送れない)
 *   ・スカイゲートブリッジでは、スマホの音楽を「⚡ BOOST 用」の曲に切り替え、渡り切ったら元の曲の続きへ
 *   ・設定: iPad の一覧 / 部屋の写真 (iPad 用) と エアコン・照明・Wi-Fi の位置
 */
import { roomHudFx2, primeHudAudio, type RoomHudFx2 } from "@/lib/roomHudFx2";
import { loadHoloGeo } from "@/lib/holoLite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DriverData } from "@/lib/driverData";
import type { CabinRoom, CabinSpots, CabinTrip } from "@/lib/cabinData";
import { BUILTIN_PHOTOS } from "@/lib/cabinPhotos";
import { BOOST_INIT, CRANE_NEST, PLACES, PLACE_KEYS, acModeFor, boostPrepDue, boostStep, dist, placeFromText, type LL, type PlaceKey } from "@/lib/cabinGeo";
import type { DRes } from "@/lib/driverLogic";
import type { RoomPrep } from "@/lib/cabinRoomPrep";
import { cabinStart, cabinBoard, cabinRoomPrepStop, cabinPos, cabinEnd, cabinSetQuiet, cabinSetHumor, cabinSetBoostSfx, cabinSetVoiceMode, cabinAiCmd, cabinCheckinQrUploadUrl, cabinSetCheckinQr, cabinRenameDevice, cabinDeleteDevice, cabinPhotoUploadUrl, cabinSetRoomPhoto, cabinRoomIcons, cabinIconUploadUrl, cabinSetRoomIcon, cabinArriveImages, cabinArriveUploadUrl, cabinSetArriveImages , driverAllOff, cabinAutoAlert , cabinSetPlacePoint, cabinPlacePoints } from "@/app/driver/actions";
import { compressRoomPhoto, compressRoomIcon } from "@/lib/driverCover";
import { sfx, vib } from "@/lib/driverSfx";
import { BOOST_SFX, boostSfxFile } from "@/lib/boostSfx";
import { HOLO_Q_KEY, isHoloQ, type HoloQ } from "@/lib/cabinHolo";
import { VOICE_MODES, isVoiceMode, voiceClear, type VoiceMode } from "@/lib/cabinVoice";
import { onVoiceCache, syncVoiceCache, voiceCacheState, type VoiceCacheState } from "@/lib/driverVoiceCache";
import { startRemoteVoice, unlockRemoteVoice } from "@/lib/remoteVoice";
import { playbackSession } from "@/lib/iosAudio";
import { rtJoin, rtJoinMsg, rtKick, rtSend, CABIN_CH } from "@/lib/rtKick";
import type { Music } from "@/components/driver/DriverMusic";
import { CAPTAIN, matchCaptain, type CaptainCmdId } from "@/lib/cabinAiTalk";

type T = (s: string, v?: Record<string, string | number>) => string;
const PP_KEYS = ["kix", "kix2", "rinku", "r833", "hineno"];
/** ボタンひとつの送迎で自動にすること */
export interface AutoPlan {
  tripId: string; roomId: string | null; roomKey: string; roomName: string; lang: "zh" | "en" | "ja" | "ko";
  /** お見送り (チェックアウトの日): 家から 200 m で部屋を全部オフ */
  off: { roomId: string; resId: string; room: string; name: string } | null; offDone?: boolean;
  /** お迎え: 迎え先 (関空は連絡橋に入ったら / ほかは 500 m 離れたら) で自動乗車 */
  pick: { ll: LL; kix: boolean } | null; near?: boolean; boarded?: boolean;
}
const LANGS: [string, string][] = [["zh", "中文"], ["en", "EN"], ["ja", "日本語"], ["ko", "한국어"]];

/* ================= 送迎中 (GPS を送る・BOOST の音楽) ================= */
/** 車内画面の声をこのスマホで流している最中か (お父さん向けの確認の声を重ねないため) */
let cabVoiceOn = false;
export function useCabin(initial: CabinTrip | null, music: Music, toast: (s: string) => void, t: T, voiceMode?: string) {
  useEffect(() => { if (isVoiceMode(voiceMode)) voiceModeNow = voiceMode; }, [voiceMode]);
  const [trip, setTrip] = useState<CabinTrip | null>(initial);
  /* 🔊 音が止まっている: 送迎の途中でページが開き直された (iPhone が画面を落として再起動した・開き直した) ときや、iPhone が音を止めたとき。
     iPhone は指で押さないと音を出せないので、大きな「タップで音を出す」ボタンを出す (スマホだけのときは車内画面の上に) */
  const [soundOff, setSoundOff] = useState<boolean>(!!initial);
  const [sending, setSending] = useState<"" | "ok" | "ng">("");
  const mRef = useRef(music); mRef.current = music;
  /* ---------- ボタンひとつの送迎 (自動の部屋オフ・自動乗車・アストレアの確認) ---------- */
  const auto = useRef<AutoPlan | null>(null);
  const boardRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});
  /** アストレアの確認の声 (英語) + 画面の字幕 (お父さんの言語) */
  const confirmSay = useCallback((key: string, room: string, msg: string) => {
    toast(msg);
    // 車内画面の声 (ASTRAEA・あいさつ) が流れている間は待ってから (声を重ねない。最大 20 秒)
    void (async () => { for (let i = 0; i < 80 && cabVoiceOn; i++) await new Promise((r) => setTimeout(r, 250)); try { void mRef.current.voiceOver(`/cabin/audio/room/${key}-${room}.mp3`, () => {}); } catch { /* 音が出せない */ } })();
  }, [toast]);
  /* ---------- 自動 ON / OFF の演出 (お父さんのスマホ: 軽量の動くホログラム) ----------
     走っていてもすぐ出す (自動で動いたことが見えるように)。ほかのアプリを見ている間だけ取っておき、
     この画面に戻ったときに出す。15 分たっても戻らなければ出さない (声と字幕でもう伝えてある)
     声と重ねない: 確認の声 (confirmSay) は演出が終わってから。車内画面の声が流れている間は、演出の効果音を鳴らさない */
  const fxQ = useRef<{ o: RoomHudFx2; at: number } | null>(null);
  const fxTry = useCallback(() => {
    const q = fxQ.current; if (!q) return;
    if (Date.now() - q.at > 15 * 60e3) { fxQ.current = null; return; }
    if (document.hidden) return;
    fxQ.current = null; return roomHudFx2({ ...q.o, sound: !cabVoiceOn });
  }, []);
  /** 演出を出す。終わったら (取っておいたときはすぐ) 解決する。最大 9 秒で先へ (声が遅れすぎないように) */
  const roomFx = useCallback((kind: "on" | "off", roomKey: string, name: string, parts: string[]): Promise<void> => {
    const holo = /^(haru|natsu|aki|fuyu)$/.test(roomKey) ? roomKey : "room";
    fxQ.current = { at: Date.now(), o: { kind, holo, room: name, lang: tRef.current("ユーモア") === "ユーモア" ? "ja" : "zh", parts, lite: true } };
    const p = fxTry();
    return p ? Promise.race([p, new Promise<void>((r) => setTimeout(r, 9000))]) : Promise.resolve();
  }, [fxTry]);
  useEffect(() => { const v = () => fxTry(); document.addEventListener("visibilitychange", v); return () => document.removeEventListener("visibilitychange", v); }, [fxTry]);
  const autoOff = useCallback(async (a: AutoPlan) => {
    if (!a.off) return; const { roomId, resId, room, name } = a.off;
    for (let i = 0; i < 3; i++) {
      const r = await driverAllOff(roomId, resId, true).catch(() => ({ ok: false }));
      if (r.ok) { sfx.chord(); await roomFx("off", a.roomKey, name, ["ac", "ceil", "wa"]); confirmSay(i ? "retryOk" : "offOk", room, i ? t("✓ 2 回目でオフにできました：{r}", { r: name }) : t("✓ {r} をすべてオフにしました", { r: name })); return; }
      if (i === 0) { sfx.error(); confirmSay("offFail", room, t("{r} が応答しません。もう一度送ります", { r: name })); }
      await new Promise((ok) => setTimeout(ok, 6000));
    }
    sfx.error(); vib([80, 60, 80]); confirmSay("failFinal", room, t("⚠ {r} のオフを確認できませんでした（お知らせに残しました）", { r: name }));
    void cabinAutoAlert(roomId, "auto_off");
  }, [confirmSay, t, roomFx]);
  useEffect(() => { setTrip(initial); }, [initial?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* ---------- 📱 iPad を使うか / スマホだけか (出発の前に選ぶ。送迎中に iPad を探すことはしない) ----------
     スマホだけ: このスマホの中で車内画面 (/cabin?phone=1) を動かす。iPad: 今までどおり iPad が動かす */
  const [mode, setModeS] = useState<"ipad" | "phone">("ipad");
  useEffect(() => { try { if (localStorage.getItem("drvCabMode") === "phone") setModeS("phone"); } catch { /* ignore */ } }, []);
  const setMode = useCallback((m: "ipad" | "phone") => { setModeS(m); try { localStorage.setItem("drvCabMode", m); } catch { /* ignore */ } }, []);
  const [phoneHide, setPhoneHide] = useState(false); // 手で閉じた (この送迎の間)
  useEffect(() => { setPhoneHide(false); }, [trip?.id]);
  const phoneEng = !!trip && mode === "phone", ipadOn = mode === "ipad";
  // 合図の回線を先につないでおく (出発を押した瞬間に iPad へ届くように)
  useEffect(() => { rtJoin(CABIN_CH, () => {}); }, []);

  useEffect(() => {
    if (!trip) { setSending(""); return; }
    let live = true, posRt = 0, last: { ll: LL; kmh: number | null; t: number } | null = null, bs = { ...BOOST_INIT }, boosting = false, gT: ReturnType<typeof setTimeout> | undefined;
    const geo = navigator.geolocation;
    const wid = geo?.watchPosition((p) => {
      const ll: LL = [p.coords.latitude, p.coords.longitude]; if (p.coords.accuracy > 80) return;
      let kmh = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : null;
      if (kmh == null && last && Date.now() - last.t > 500) kmh = (dist(last.ll, ll) / ((Date.now() - last.t) / 1000)) * 3.6;
      last = { ll, kmh, t: Date.now() };
      // iPad へ直接 (1 秒に 1 回まで)。サーバーへは下の間隔で
      if (Date.now() - posRt > 900) { posRt = Date.now(); rtSend(CABIN_CH, "pos", { t: trip.id, ll: [+ll[0].toFixed(6), +ll[1].toFixed(6)], kmh: kmh == null ? null : Math.round(kmh * 10) / 10 }); }
      const r = boostStep(bs, ll, kmh); bs = r.s;
      // ボタンひとつ: お見送りは家から 200 m 離れたら部屋を全部オフ (チェックアウトの日だけ)。お迎えは迎え先を離れたら自動で乗車
      const a = auto.current, tr = tripRef2.current;
      if (a && tr && a.tripId === tr.id) {
        if (tr.dir === "out" && a.off && !a.offDone && dist(ll, CRANE_NEST) > 200) { a.offDone = true; void autoOff(a); }
        if (tr.dir === "in" && tr.phase === "dead" && a.pick && !a.boarded) {
          const d = dist(ll, a.pick.ll); if (d < (a.pick.kix ? 700 : 250)) a.near = true;
          if (a.near && ((a.pick.kix && r.event === "start") || (!a.pick.kix && d > 500))) { a.boarded = true; void boardRef.current(true); }
        }
      }
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
      // ほかのアプリを使っている・画面が消えている間も、音楽と同じ audio 要素で ASTRAEA の声を鳴らす (iPhone は裏で Web Audio を止めるため)
      bg: { ready: () => mRef.current.bgVoiceReady(), play: (u, started) => mRef.current.voiceOver(u, started) },
      // 聞き取りやすくする声 (設定: BOOST のときだけ / いつも / 使わない)
      clear: (u) => voiceClear(u, voiceModeNow),
      // ブースト開始のセリフと一緒に BOOST の曲を始め、完了のセリフと一緒にフェードアウト (元の曲へ)
      onPlay: (u) => {
        // 準備の合図 → 曲をゆっくり止める。効果音 (起動) → 5.2 秒後の点火の瞬間に、BOOST の曲を普通の音量で始める (回送の BOOST は準備が無いので今までどおり)
        if (/boost-prep\.mp3$/.test(u)) { mRef.current.boostPrep(); return; }
        if (/(boost-sfx|\/boost\/[A-Za-z]+)\.mp3$/.test(u)) { if (!mRef.current.inBoost()) { clearTimeout(gT); boosting = mRef.current.boostIn(5200, true); } return; } // 準備が無い回送の BOOST も: 今の曲をすぐ小さくして起動音を聞かせ、点火 (5.2 秒) で BOOST の曲
        if (/(en-boost-on|dh\/boostIn)\.mp3$/.test(u)) { clearTimeout(gT); if (!mRef.current.inBoost()) boosting = mRef.current.boostIn(300); }
        else if (/(en-boost-off|dh\/boostOut)\.mp3$/.test(u)) { clearTimeout(gT); if (mRef.current.inBoost()) { boosting = false; mRef.current.boostOut(); } }
      },
      onStart: () => { cabVoiceOn = true; mRef.current.duck(true); }, onEnd: () => { cabVoiceOn = false; mRef.current.duck(false); }, onSetup: () => toast(t("声をスマホから流すには、Supabase の SQL（migration_cabin_voice.sql）を実行してください")),
      // iPhone が音を止めていた (電話・Siri・画面オフのあとなど)。この声は iPad が代わりに鳴らす。画面に触れれば戻る
      onBlocked: () => { setSoundOff(true); if (Date.now() - blockedAt > 30000) { blockedAt = Date.now(); toast(t("🔇 スマホの音が止まっています。画面をタップすると ASTRAEA の声が戻ります（今は iPad が話します）")); } } });
    let blockedAt = 0;
    // 画面のどこかに触れたら音を戻す (iPhone は指で触れたときしか音を再開できない)
    const reUnlock = () => { unlockRemoteVoice(); try { mRef.current.prime(); } catch { /* */ } };
    document.addEventListener("pointerdown", reUnlock, true);
    let lastCmd: number | null = null; // 最初の返事にある操作は前のもの (実行しない)
    let firstPoll = true;
    let warned = false;
    /* サーバーへ位置と曲を送る: 今までは 3 秒ごと。iPad と直接つながっている間は 9 秒ごと (位置は上で直接送っている)。
       曲が変わったとき・iPad から合図が来たとき (乗車・終わり・再生ボタン) は、すぐ送る */
    let sentAt = 0, busyPos = false, npId = "", force = false, npPos: { pos: number; t: number } | null = null;
    rtJoinMsg(CABIN_CH, () => { force = true; }, () => {});
    const iv = setInterval(async () => {
      if (!live || busyPos) return;
      const np = mRef.current.nowPlaying(); // 再生中の曲 (iPad の歌詞用)。位置がまだ取れていなくても送る
      if (!last && !np) return;
      const nid = np ? `${np.id}:${np.on}` : "";
      // 曲・再生/停止が変わった、または早送りなどで位置が 3 秒以上ずれた
      const jump = !!np && !!npPos && np.on && Math.abs(np.pos - (npPos.pos + (Date.now() - npPos.t) / 1000)) > 3;
      const changed = nid !== npId || jump;
      if (!force && !changed && Date.now() - sentAt < (rv.direct() ? 8800 : 2800)) return;
      force = false; npId = nid; npPos = np ? { pos: np.pos, t: Date.now() } : null; sentAt = Date.now(); busyPos = true; setTimeout(() => { busyPos = false; }, 8000);
      if (changed) setTimeout(() => rtKick(CABIN_CH), 600); // iPad に「曲が変わった」と知らせる (歌詞)
      const r = await cabinPos(trip.id, last?.ll[0] ?? null, last?.ll[1] ?? null, last?.kmh ?? null, np).catch(() => null);
      busyPos = false;
      if (!live) return;
      if (r?.ok) {
        if (last) setSending("ok");
        if (r.np === "setup" && !warned) { warned = true; toast(t("iPad に歌詞を出すには、Supabase の SQL（migration_cabin_music.sql）を実行してください")); }
        if (!r.active) { setTrip(null); toast(t("送迎が終わりました（iPad は待機画面に戻りました）")); return; }
        // 回送 ⇄ ゲスト乗車 (iPad のボタンで切り替わることもある)
        if (r.phase && r.phase !== trip.phase) setTrip((p) => (p && p.id === trip.id ? { ...p, phase: r.phase! } : p));
        // 乗車でお部屋を自動準備した (iPad の乗車ボタンのときもここで知る) → 通知
        if (r.prep && (!firstPoll || Date.now() - r.prep.n < 120000)) showPrep(r.prep);
        firstPoll = false;
        // iPad の再生ボタン (ゲストが押した) → このスマホの音楽を操作
        if (lastCmd == null) lastCmd = r.cmd?.n ?? 0;
        else if (r.cmd && r.cmd.n > lastCmd) { lastCmd = r.cmd.n; mRef.current.remote(r.cmd.c, r.cmd.v); }
      } else setSending("ng");
    }, 1000);
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
  /** 🏮 乗車時のお部屋の自動準備 (和風ライト + エアコン) の通知 */
  const [prep, setPrep] = useState<RoomPrep | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const seenPrep = useRef(0);
  const showPrep = useCallback((p: RoomPrep) => {
    if (p.n <= seenPrep.current) return Promise.resolve(); seenPrep.current = p.n;
    setPrep(p); sfx.chord(); vib([40, 60, 40]);
    // 画面いっぱいの自動 ON の演出
    return p.ok ? roomFx("on", auto.current?.roomKey ?? "room", p.room, ["ac"]) : Promise.resolve();
  }, [roomFx]);
  const stopPrep = useCallback(async () => {
    const tr = tripRef2.current; if (!tr) return; sfx.down();
    const r = await cabinRoomPrepStop(tr.id); setPrep(null);
    toast(r.ok ? t("お部屋のエアコンを消しました") : t("消せませんでした。お部屋の操作画面から消してください"));
  }, [toast, t]);

  const start = useCallback(async (v: Parameters<typeof cabinStart>[0], plan?: Omit<AutoPlan, "tripId">) => {
    unlockRemoteVoice(); primeHudAudio(); try { mRef.current.prime(); } catch { /* */ } // 出発ボタンを押したときに (iPhone は指で押したときでないと音を準備できない)
    const r = await cabinStart(v); rtKick(CABIN_CH);
    if (!r.ok) { sfx.error(); toast(r.error === "SETUP" ? t("先に Supabase の SQL（migration_cabin.sql）を実行してください") : t("iPad に出せませんでした") + "：" + r.error.slice(0, 60)); return false; }
    sfx.chord(); vib(30); setTrip(r.trip); toast(t("🚗 iPad に表示しました。気をつけて！"));
    auto.current = plan ? { ...plan, tripId: r.trip.id } : null;
    // 演出に使う建物の形を先に読んでおく (部屋ごと約 60KB。2 回目からはキャッシュ)
    if (plan && /^(haru|natsu|aki|fuyu)$/.test(plan.roomKey)) void loadHoloGeo(plan.roomKey);
    return true;
  }, [toast, t]);
  const end = useCallback(async () => {
    if (!trip) return; const id = trip.id; setTrip(null); sfx.down(); await cabinEnd(id); rtKick(CABIN_CH); toast(t("送迎を終わりにしました"));
  }, [trip, toast, t]);
  /** ゲスト乗車: 回送 (父向けの画面) → ゲスト用の送迎画面 */
  const board = useCallback(async (isAuto?: boolean) => {
    const tr = tripRef2.current; if (!tr || tr.phase !== "dead") return; sfx.chord(); vib(30);
    const a = auto.current; if (a) a.boarded = true;
    const r = await cabinBoard(tr.id); rtKick(CABIN_CH);
    if (!r.ok) { toast(r.error === "SETUP_VOICE" ? t("回送モードには Supabase の SQL（migration_cabin_voice.sql）が必要です") : t("切り替えられませんでした")); return; }
    setTrip({ ...tr, phase: "guest" });
    if (isAuto) toast(t("🚗 迎え先を離れたので、自動で乗車にしました"));
    if (a?.lang) setTimeout(() => { try { const m = mRef.current; if (!(m.playing && m.cur.p === "in" && m.cur.l === a.lang)) m.startWith("in", a.lang); } catch { /* */ } }, 6000); // 乗ったらゲストの言語のお迎え用の音楽へ
    if (r.prep) {
      const fxDone = showPrep(r.prep);
      const rk = a?.roomKey ?? "room", nm = a?.roomName ?? "";
      if (r.prep.ok) void (fxDone ?? Promise.resolve()).then(() => confirmSay("onOk", rk, t("✓ {r} のエアコンをつけました", { r: nm })));
      else { setTimeout(() => confirmSay("onFail", rk, t("⚠ {r} のエアコンが応答しません（お知らせに残しました）", { r: nm })), 2500); if (a?.roomId) void cabinAutoAlert(a.roomId, "auto_on"); }
    } else if (!isAuto) toast(t("🧳 ゲスト乗車。iPad をゲスト用の画面にしました"));
  }, [toast, t, showPrep, confirmSay]);
  boardRef.current = board;
  /** ASTRAEA に話しかける間、音楽を小さく */
  const duck = useCallback((on: boolean) => { try { mRef.current.duck(on); } catch { /* ignore */ } }, []);
  const restoreSound = useCallback(() => {
    playbackSession(); unlockRemoteVoice(); primeHudAudio();
    const m = mRef.current; try { m.prime(); } catch { /* */ }
    const tr = tripRef2.current;
    // 音楽が止まっていれば、その送迎の曲をもう一度 (曲の場所は最初から)
    try { if (tr && !m.playing && !m.inBoost()) { const l = (["zh", "en", "ja", "ko"].includes(tr.lang) ? tr.lang : "en") as "zh" | "en" | "ja" | "ko"; m.startWith(tr.dir, l); } } catch { /* */ }
    setSoundOff(false);
  }, []);
  return { trip, sending, start, end, duck, board, prep, stopPrep, closePrep: () => setPrep(null), ipadOn, phoneEng, phoneHide, setPhoneHide, mode, setMode, mus: () => mRef.current, soundOff: soundOff && !!trip, restoreSound };
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
    const r = await cabinSetHumor(h); rtKick(CABIN_CH);
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

/** アストレアの声を聞き取りやすく (このスマホで鳴らすときに、その場で整える) */
let voiceModeNow: VoiceMode = "boost";
export function VoicePick({ initial, t }: { initial: string; t: T }) {
  const zh = t("変える") !== "変える";
  const [cur, setCur] = useState<VoiceMode>(isVoiceMode(initial) ? initial : "boost");
  const [msg, setMsg] = useState("");
  useEffect(() => { voiceModeNow = cur; }, [cur]);
  const pick = async (m: VoiceMode) => {
    if (m === cur) return; sfx.tick(); const old = cur; setCur(m); setMsg("");
    const r = await cabinSetVoiceMode(m);
    if (!r.ok) { setCur(old); setMsg(r.error === "SETUP_VOICE" ? t("声の設定には Supabase の SQL（migration_voice_clear.sql）が必要です") : t("切り替えられませんでした")); }
  };
  return (
    <>
      <div className="csec">{t("アストレアの声を聞き取りやすく")}</div>
      <div className="cchips">
        {VOICE_MODES.map((v) => <button key={v.id} className={cur === v.id ? "on" : ""} onClick={() => void pick(v.id)}><b>{zh ? v.zh : v.ja}</b><small>{zh ? v.subZh : v.sub}</small></button>)}
      </div>
      {msg ? <p className="note warn">{msg}</p> : null}
      <VoiceCacheLine t={t} />
    </>
  );
}
/** 声をこのスマホに保存した状態 (保存しておくと、車の中でも声がすぐ鳴る → iPad が代わりに話す回数が減る) */
function VoiceCacheLine({ t }: { t: T }) {
  const [v, setV] = useState<VoiceCacheState>(voiceCacheState());
  useEffect(() => onVoiceCache(setV), []);
  const txt = v.state === "done" ? "✓ " + t("声をこのスマホに保存済み（{n}）", { n: v.total })
    : v.state === "saving" ? "📥 " + t("声をこのスマホに保存中… {d} / {n}", { d: v.done, n: v.total })
    : v.state === "fail" ? "⚠ " + t("保存できなかった声があります（電波のよい所でもう一度）")
    : v.state === "unsupported" ? t("このブラウザは保存に対応していません") : "📥 " + t("声をこのスマホに保存（約 14 MB・1 回だけ）");
  return (
    <div className="vcache">
      <span>{txt}</span>
      {v.state !== "saving" && v.state !== "unsupported" && <button onClick={() => { sfx.tick(); void syncVoiceCache(boostNow ? [`/cabin/audio/${boostSfxFile(boostNow)}.mp3`] : [], true); }}>{v.state === "done" ? t("確認") : t("保存")}</button>}
    </div>
  );
}

/** BOOST の起動音を選ぶ (▶ で試聴。全部の送迎で共通) */
let boostNow: string | null = null;
export function BoostPick({ initial, t }: { initial: string; t: T }) {
  const ui: "zh" | "ja" = t("変える") !== "変える" ? "zh" : "ja";
  const [cur, setCur] = useState(boostNow ?? initial);
  const [playing, setPlaying] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const au = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { au.current?.pause(); }, []);
  const name = (id: string) => { const x = BOOST_SFX.find((b) => b.id === id); return x ? (ui === "zh" ? x.zh : x.name) : id; };
  const play = (id: string) => {
    if (au.current) au.current.pause();
    if (playing === id) { setPlaying(null); return; }
    const a = new Audio(`/cabin/audio/${boostSfxFile(id)}.mp3`); au.current = a; setPlaying(id);
    a.onended = () => setPlaying((p) => (p === id ? null : p)); a.play().catch(() => setPlaying(null));
  };
  const pick = async (id: string) => {
    if (id === cur) return; sfx.tick(); const old = cur; setCur(id); setMsg("");
    const r = await cabinSetBoostSfx(id); rtKick(CABIN_CH);
    if (r.ok) { boostNow = id; void syncVoiceCache([`/cabin/audio/${boostSfxFile(id)}.mp3`]); }
    else { setCur(old); setMsg(r.error === "SETUP_BOOST_SFX" ? t("BOOST の音を選ぶには Supabase の SQL（migration_boost_sfx.sql）が必要です") : t("切り替えられませんでした")); }
  };
  return (
    <>
      <div className="csec">{t("BOOST の起動音")}</div>
      <button className="bsfx-cur" onClick={() => setOpen((v) => !v)}><b>⚡ {name(cur)}</b><span>{open ? "▲" : t("変える") + " ▾"}</span></button>
      {open && (
        <div className="bsfx">
          {BOOST_SFX.map((b) => (
            <div key={b.id} className={`bsfx-r ${cur === b.id ? "on" : ""}`}>
              <button className="pl" onClick={() => play(b.id)}>{playing === b.id ? "■" : "▶"}</button>
              <button className="nm" onClick={() => void pick(b.id)}>{ui === "zh" ? b.zh : b.name}{cur === b.id ? <em>✓ {t("使用中")}</em> : null}</button>
            </div>
          ))}
          <p className="note">{t("▶ で試聴、名前をタップで決定。次の BOOST から変わります（全部の送迎で共通）。")}</p>
        </div>
      )}
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
    try { if (["ja", "en", "zh", "ko"].includes(lang)) cab.mus().startWith(dir, lang as "ja" | "en" | "zh" | "ko"); } catch { /* ignore */ } // 押した瞬間に音楽 (iPhone は指で押した流れでないと鳴らない)
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
    const r = await cabinSetHumor(h); rtKick(CABIN_CH);
    if (r.ok) humorNow = h;
    if (!r.ok) { setHumor(!h); toastQ(r.error === "SETUP_HUMOR" ? t("ユーモアモードには Supabase の SQL（migration_ai_humor.sql）が必要です") : t("切り替えられませんでした")); }
    else toastQ(h ? t("😂 ユーモアモード ON：映画やアニメのネタも話します") : t("ユーモアモード OFF"));
  };
  // 🤫 静かモード: 車内 iPad の AI (ASTRAEA) のひと言を止める (道案内はそのまま)
  const [quiet, setQuiet] = useState(!!tr.aiQuiet);
  const toggleQuiet = async () => {
    const q = !quiet; setQuiet(q); sfx.tick();
    const r = await cabinSetQuiet(tr.id, q); rtKick(CABIN_CH);
    if (!r.ok) { setQuiet(!q); toastQ(r.error === "SETUP_AI" ? t("静かモードには Supabase の SQL（migration_cabin_ai.sql）が必要です") : t("切り替えられませんでした")); }
  };
  const [qMsg, toastQ] = useState("");
  /** 📍 今止まっている場所を、この行き先の到着地点にする (次からここで到着の画面・ホログラムが出る) */
  const setHere = async (k: string) => {
    const name = (PLACES as any)[k]?.name?.[ui] ?? k;
    if (!confirm(t("今いる場所を「{p}」の到着地点にしますか？（次から、ここに止まったら到着の演出が出ます）", { p: name }))) return;
    if (!navigator.geolocation) { toastQ(t("位置がわかりません")); return; }
    navigator.geolocation.getCurrentPosition(async (p) => {
      if (p.coords.accuracy > 60) { toastQ(t("GPS の精度が低いので、少し待ってからもう一度押してください")); return; }
      const r = await cabinSetPlacePoint(k, [p.coords.latitude, p.coords.longitude]); rtKick(CABIN_CH);
      sfx.chord(); toastQ(r.ok ? t("✓「{p}」の到着地点を登録しました", { p: name }) : t("登録できませんでした"));
    }, () => toastQ(t("位置がわかりません")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const [talk, setTalk] = useState(false);
  const [air, setAir] = useState(false); // ✈ 空港までの案内 (押すと選ぶ画面)
  return (
    <div className="cabbar">
      <span className="live" />
      <span className="tx"><b>🚗 {dev}</b><small>{tr.phase === "dead" ? (tr.dir === "in" ? `${t("回送")} · ${t("お宿")} → ${pn}` : `${t("帰り道")} · ${pn} → ${t("お宿")}`) : tr.dir === "in" ? `${pn} → ${t("お宿")}` : `${t("お宿")} → ${pn}`} · {cab.sending === "ok" ? "📡 " + t("位置を送信中") : cab.sending === "ng" ? "⚠ " + t("位置を送れません") : "…"}</small></span>
      {tr.phase === "dead" && tr.dir === "in" && <button className="board" onClick={() => void cab.board()}>🧳<small>{t("ゲスト乗車")}</small></button>}
      <button className="abtn" onClick={() => { sfx.tick(); setTalk(true); }}>🎙<small>ASTRAEA</small></button>
      <button className={`qbtn ${humor ? "on" : ""}`} title={t("ユーモアモード")} onClick={() => void toggleHumor()}>{humor ? "😂" : "🙂"}<small>{humor ? t("ユーモア") : t("ふつう")}</small></button>
      <button className={`qbtn ${quiet ? "on" : ""}`} title={t("静かモード")} onClick={() => void toggleQuiet()}>{quiet ? "🤫" : "✦"}<small>{quiet ? t("静か") : "AI"}</small></button>
      {tr.phase !== "dead" && <button className={`airbtn ${air ? "on" : ""}`} onClick={() => { sfx.tick(); setAir((v) => !v); }}>✈<small>{t("空港")}</small></button>}
      {cab.phoneEng && <button className={`qbtn ${!cab.phoneHide ? "on" : ""}`} onClick={() => { sfx.tick(); cab.setPhoneHide(!cab.phoneHide); }}>📱<small>{cab.phoneHide ? t("画面") : t("小さく")}</small></button>}
      <button onClick={() => { if (confirm(t("送迎を終わりにしますか？（iPad は待機画面に戻ります）"))) void cab.end(); }}>■ {t("終了")}</button>
      {air && <AirportCard tr={tr} t={t} toast={toastQ} onClose={() => setAir(false)} />}
      {cab.phoneEng && <PhoneCabin hidden={cab.phoneHide} cab={cab} t={t} />}
      {cab.soundOff && <SoundBtn cab={cab} t={t} />}
      {PP_KEYS.includes(tr.placeKey) && <button className="qbtn" title={t("ここを到着地点にする")} onClick={() => void setHere(tr.placeKey)}>📍<small>{t("ここ")}</small></button>}
      {cab.prep && <PrepNote p={cab.prep} cab={cab} t={t} />}
      {qMsg ? <em className="qmsg" onClick={() => toastQ("")}>{qMsg}</em> : null}
      {talk && <AstraeaSheet tr={tr} cab={cab} t={t} ui={ui} onClose={() => setTalk(false)} toast={toastQ} />}
    </div>
  );
}

/* ================= ✈ 空港までの道順 (お見送り中。押すと iPad で ASTRAEA が降りたあとの道順を案内) =================
   降りる場所は送迎予約から自動 (りんくう → 大屋根 / 往来北 → 5 番出口 / 関空 → ターミナル)。チップで変えられる */
type Drop = "r1" | "r2" | "t1" | "t2";
const DROPS: { k: Drop; icon: string; ja: string; zh: string }[] = [
  { k: "r1", icon: "🚉", ja: "りんくう 大屋根", zh: "临空城 大雨棚" },
  { k: "r2", icon: "🚉", ja: "りんくう 5番出口", zh: "临空城 5号出口" },
  { k: "t1", icon: "✈", ja: "関空 第1", zh: "机场 T1" },
  { k: "t2", icon: "✈", ja: "関空 第2", zh: "机场 T2" },
];
const dropOf = (tr: CabinTrip): Drop => tr.placeKey === "r833" ? "r2" : tr.placeKey === "kix2" ? "t2" : tr.placeKey === "kix" ? "t1" : "r1";
function AirportCard({ tr, t, toast, onClose }: { tr: CabinTrip; t: T; toast: (s: string) => void; onClose: () => void }) {
  const out = tr.dir === "out";
  // お見送り: 降りる場所の道順 / お迎え: 「明日どうやって空港へ？」(2 つの行き方と料金 → 道順)
  const [d, setD] = useState<Drop>(dropOf(tr)), [st, setSt] = useState<"" | "busy" | "on">(""), [m, setM] = useState<"how" | "route">(out ? "route" : "how");
  const ui = t("帰り道") === "返程" ? "zh" : "ja";
  const go = async (c: string) => {
    if (st === "busy") return;
    sfx.tick(); vib(25); setSt("busy");
    const r = await cabinAiCmd(tr.id, c as CaptainCmdId).catch(() => ({ ok: false } as any)); rtKick(CABIN_CH);
    if (!r?.ok) { setSt(""); sfx.error(); toast(t("送れませんでした")); return; }
    setSt("on"); setTimeout(onClose, 1400);
  };
  return (
    <div className="aircard">
      <div className="airhd"><b>✈ {out ? t("空港までの道順") : t("明日の空港への行き方")}</b><button onClick={onClose}>✕</button></div>
      {!out && (
        <div className="airtab">
          <button className={m === "how" ? "on" : ""} onClick={() => setM("how")}>🧭 {t("行き方と料金")}<small>{t("電車 / 車で直接")}</small></button>
          <button className={m === "route" ? "on" : ""} onClick={() => setM("route")}>🚶 {t("降りたあとの道順")}<small>{t("場所を選ぶ")}</small></button>
        </div>
      )}
      {m === "route" && (
        <div className="airdrop">
          {DROPS.map((x) => <button key={x.k} className={d === x.k ? "on" : ""} onClick={() => { sfx.tick(); setD(x.k); }}>{x.icon} {ui === "zh" ? x.zh : x.ja}</button>)}
        </div>
      )}
      {m === "how" && <p className="airnote">{t("無料送迎＋電車（1人 ¥370）と、車で直接（1台 ¥1,500）を、人数に合わせて比べて見せます。最後に QR でゲストのスマホに保存できます")}</p>}
      <button className={`airgo ${st === "on" ? "on" : ""}`} onClick={() => void go(m === "how" ? "airport_how" : "airport_" + d)}>
        <i>✈</i><span><b>{st === "on" ? t("iPad で案内中") : t("iPad で案内する")}</b><small>{t("ASTRAEA が iPad で話します")}</small></span><em>{st === "busy" ? "…" : st === "on" ? "📡" : "▶"}</em>
      </button>
    </div>
  );
}

/* ================= 🏮 乗車時のお部屋の自動準備 (お父さんへの通知) ================= */
function PrepNote({ p, cab, t }: { p: RoomPrep; cab: Cabin; t: T }) {
  useEffect(() => { const id = setTimeout(() => cab.closePrep(), 90000); return () => clearTimeout(id); }, [p.n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`prepnote ${p.ok ? "" : "ng"}`}>
      <span className="pi">❄️</span>
      <span className="pt"><b>{p.room ? `${p.room} · ` : ""}{p.ok ? t("お部屋のエアコンをつけました") : t("お部屋の準備がうまくいきませんでした")}</b><small>{p.ok ? t("明かりは着いて鍵を開けたとき、ゲストがコンシェルジュで選んだ明かりでつきます") : t("お部屋の操作画面から確かめてください")}</small></span>
      {p.ok && <button className="ps" onClick={() => { if (confirm(t("お部屋のエアコンを消しますか？"))) void cab.stopPrep(); }}>{t("止める")}</button>}
      <button className="px" onClick={() => cab.closePrep()}>✕</button>
    </div>
  );
}

/* ================= ASTRAEA に話しかける (マイク) / 指示ボタン ================= */
const GUIDE_BTN = { id: "guide" as const, icon: "🔑", zh: "进门方法", ja: "入り方ガイド" };
/** iPad の右下にコンシェルジュの QR をもう一度出す (お迎えのとき) */
const QR_BTN = { id: "qr" as const, icon: "🛎", zh: "显示礼宾二维码", ja: "QR を出す" };
/** iPad の地図の枠に建物のホログラム (お迎えのとき・約 46 秒。声は iPhone から) */
const HOLO_BTN = { id: "holo" as const, icon: "🛰", zh: "显示全息投影", ja: "ホログラム" };
const AIR_BTN = { id: "airport_how" as const, icon: "✈", zh: "去机场的方法", ja: "空港への行き方" };
function AstraeaSheet({ tr, cab, t, ui, onClose, toast }: { tr: CabinTrip; cab: Cabin; t: T; ui: "zh" | "ja"; onClose: () => void; toast: (s: string) => void }) {
  const [listen, setListen] = useState(false), [heard, setHeard] = useState(""), [sent, setSent] = useState(""), [btns, setBtns] = useState(false);
  const rec = useRef<any>(null);
  const send = async (c: CaptainCmdId, label: string) => {
    sfx.tick(); vib(15);
    const r = await cabinAiCmd(tr.id, c); rtKick(CABIN_CH);
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
      if (id) { const b = id === "guide" ? GUIDE_BTN : id === "qr" ? QR_BTN : id === "holo" ? HOLO_BTN : id === "airport_how" ? AIR_BTN : CAPTAIN.find((x) => x.id === id)!; void send(id, `${b.icon} ${ui === "zh" ? b.zh : b.ja}`); }
      else void send("unknown", "？");
    };
    setHeard(""); setListen(true); cab.duck(true); sfx.tick();
    try { r.start(); } catch { setListen(false); cab.duck(false); rec.current = null; }
  };
  const heardRef = useRef(""); heardRef.current = heard;
  useEffect(() => () => { try { rec.current?.abort?.(); } catch { /* ignore */ } cab.duck(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const all = [...CAPTAIN.map((c) => ({ id: c.id as CaptainCmdId, icon: c.icon, zh: c.zh, ja: c.ja })), GUIDE_BTN, ...(tr.dir === "in" ? [QR_BTN, HOLO_BTN] : [])];
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
      <BoostPick initial={data.cabin.boostSfx} t={t} />
      <VoicePick initial={data.cabin.voiceMode} t={t} />
      <PhoneSave t={t} toast={toast} />
      <HoloQPick t={t} />
      <PlacePointList t={t} toast={toast} />
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
      <ArriveImages t={t} toast={toast} />
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

/* 到着演出の画像: お見送りで着いたとき、iPad のホログラムの額に順に出す絵 (並べ替え・外すもここで)。何もなければ最初から入っている絵 */
function ArriveImages({ t, toast }: { t: T; toast: (s: string) => void }) {
  const [items, setItems] = useState<{ path: string; url: string }[]>([]), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await cabinArriveImages().catch(() => null); if (r?.ok) setItems(r.items); }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (next: { path: string; url: string }[]) => { setItems(next); const r = await cabinSetArriveImages(next.map((x) => x.path)); if (!r.ok) { toast(t("保存できませんでした")); await load(); } };
  const shrink = async (f: File): Promise<{ blob: Blob; ext: "webp" | "jpg" } | null> => {
    try { const bm = await createImageBitmap(f); const s = Math.min(1, 1400 / Math.max(bm.width, bm.height)); const c = document.createElement("canvas"); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s); c.getContext("2d")!.drawImage(bm, 0, 0, c.width, c.height);
      const w = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.86)); if (w && w.type === "image/webp") return { blob: w, ext: "webp" };
      const j = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.86)); return j ? { blob: j, ext: "jpg" } : null; } catch { return null; }
  };
  const add = async (files: FileList) => {
    setBusy(true); const added: { path: string; url: string }[] = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const c = await shrink(f); if (!c) { toast(t("画像を読み込めませんでした")); continue; }
      const u = await cabinArriveUploadUrl(c.ext); if (!u.ok) { toast(t("アップロードできませんでした")); continue; }
      const put = await fetch(u.signedUrl, { method: "PUT", headers: { "content-type": c.blob.type, "x-upsert": "false" }, body: c.blob }).catch(() => null);
      if (!put?.ok) { toast(t("アップロードできませんでした")); continue; }
      added.push({ path: u.path, url: URL.createObjectURL(c.blob) });
    }
    if (added.length) { await save([...items, ...added]); sfx.chord(); toast(t("保存しました")); await load(); }
    setBusy(false);
  };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = items.slice(); [n[i], n[j]] = [n[j], n[i]]; sfx.tick(); void save(n); };
  const del = (i: number) => { if (!confirm(t("この画像を外しますか？"))) return; void save(items.filter((_, k) => k !== i)); };
  return (
    <>
      <div className="ctitle" style={{ marginTop: 14 }}>🖼 {t("到着演出の画像")}</div>
      <div className="cnote">{t("お見送りで着いたとき、iPad のホログラムの額に順番に出る絵です。上から順に出ます。何も入れていないときは、最初から入っている絵が出ます。")}</div>
      <div className="arrimgs">
        {items.map((x, i) => (
          <div className="arri" key={x.path}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.url} alt="" /><em>{i + 1}</em>
            <div><button onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button><button onClick={() => del(i)}>✕</button></div>
          </div>
        ))}
        <label className="arri add">{busy ? t("保存中…") : "＋ " + t("画像を追加")}<input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { const f = e.target.files; if (f && f.length) void add(f); e.target.value = ""; }} hidden /></label>
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


/* ================= 📱 スマホの車内画面 (iPad がつながっていないとき) =================
   iPad と同じ車内画面 (/cabin?phone=1) を、この画面の中で動かす。声・効果音は今までどおりこのスマホの音楽と同じ道 (CarPlay) で流れる。
   隠しても動き続ける (観光案内・BOOST・ホログラムの判断はこちらが続ける) */
/** 🔊 タップで音を出す (画面のいちばん上。スマホだけのときは車内画面の上にも出る) */
function SoundBtn({ cab, t }: { cab: Cabin; t: T }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  if (!host) return null;
  return createPortal(<button className="sndOn" onClick={() => { sfx.tick(); cab.restoreSound(); }}><i>🔊</i><span>{t("タップで音を出す")}<small>{t("音楽・ASTRAEA の声が止まっています")}</small></span></button>, host);
}
function PhoneCabin({ hidden, cab, t }: { hidden: boolean; cab: Cabin; t: T }) {
  // 画面いっぱい (iPhone の縦・横)。親の枠 (cabbar) の中だと小さくなるので、body の直下に出す
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  const m = cab.mus();
  const [dim, setDim] = useState(false), [lst, setLst] = useState(false);
  const dT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = () => { setDim(false); if (dT.current) clearTimeout(dT.current); dT.current = setTimeout(() => { setDim(true); setLst(false); }, 5000); };
  useEffect(() => { wake(); return () => { if (dT.current) clearTimeout(dT.current); }; }, []);
  useEffect(() => { if (hidden) return; const o = document.body.style.overflow; document.body.style.overflow = "hidden"; document.body.classList.add("pcab-on"); return () => { document.body.style.overflow = o; document.body.classList.remove("pcab-on"); }; }, [hidden]);
  // 隠している間 (と画面が消えている間) は、車内画面に「描かなくていい」と伝える (動き・声・判断は続く)。軽くしてクラッシュを防ぐ
  const frR = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const post = () => { try { frR.current?.contentWindow?.postMessage({ cabBg: hidden || document.visibilityState !== "visible" }, location.origin); } catch { /* ignore */ } };
    post(); const iv = setInterval(post, 3000); document.addEventListener("visibilitychange", post);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", post); };
  }, [hidden]);
  if (!host) return null;
  const tap = (f: () => void) => () => { sfx.tick(); wake(); f(); };
  return createPortal(
    <div className={`pcabF ${hidden ? "hide" : ""}`}>
      <iframe ref={frR} src={`/cabin?phone=1&hq=${holoQ()}`} title="cabin" allow="autoplay; geolocation; fullscreen" />
      <div className={`pcm ${dim ? "dim" : ""}`} onPointerDown={wake}>
        <button className="pcx" onClick={tap(() => cab.setPhoneHide(true))}>✕<small>{t("戻る")}</small></button>
        <button className="pct" onClick={tap(() => setLst((v) => !v))}><i>🎵</i><span>{m.track ? m.track.title : t("曲がありません")}</span></button>
        <button onClick={tap(() => m.prev())}>⏮</button>
        <button className="pp" onClick={tap(() => m.toggle())}>{m.playing ? "⏸" : "▶"}</button>
        <button onClick={tap(() => m.next())}>⏭</button>
        {lst && (
          <div className="pcl">
            <div className="pcls">
              {(["in", "out"] as const).map((p) => <b key={p} className={m.cur.p === p ? "on" : ""} onClick={tap(() => m.setPlaylist(p, m.cur.l, true))}>{p === "in" ? t("お迎え用") : t("お見送り用")}</b>)}
              {(["ja", "en", "zh", "ko"] as const).map((l) => <b key={l} className={m.cur.l === l ? "on" : ""} onClick={tap(() => m.setPlaylist(m.cur.p, l, true))}>{l === "ja" ? "日本語" : l === "en" ? "EN" : l === "zh" ? "中文" : "한국어"}</b>)}
            </div>
            {m.list.length ? m.list.map((x, i) => <button key={x.id} className={m.track?.id === x.id ? "on" : ""} onClick={tap(() => { m.pick(i); setLst(false); })}>{m.track?.id === x.id && m.playing ? "▶ " : ""}{x.title}<small>{x.artist ?? ""}</small></button>) : <em>{t("この言語の曲はまだありません。設定から追加できます。")}</em>}
          </div>
        )}
      </div>
    </div>, host);
}

/** スマホだけのときのホログラムの画質 (このスマホに保存。最初は超軽量) */
function holoQ(): HoloQ { try { const v = localStorage.getItem(HOLO_Q_KEY); if (isHoloQ(v)) return v; } catch { /* ignore */ } return "ul"; }
export function HoloQPick({ t }: { t: T }) {
  const [q, setQ] = useState<HoloQ>("ul");
  useEffect(() => { setQ(holoQ()); }, []);
  const L: [HoloQ, string][] = [["std", t("標準")], ["lite", t("軽量")], ["ul", t("超軽量")]];
  return (
    <div className="hqp"><span>{t("ホログラムの画質（スマホだけのとき）")}</span>
      <div>{L.map(([k, n]) => <button key={k} className={q === k ? "on" : ""} onClick={() => { sfx.tick(); setQ(k); try { localStorage.setItem(HOLO_Q_KEY, k); } catch { /* ignore */ } }}>{n}</button>)}</div>
      <small>{t("超軽量 = 画質を下げて 1 秒 30 コマ（iPhone 12 など）。次の送迎から変わります")}</small></div>
  );
}

/** 📥 このスマホに保存 (車内画面の声・効果音・ホログラム・写真・地図)。家の Wi-Fi で 1 回 */
export function PhoneSave({ t, toast, mus }: { t: T; toast: (s: string) => void; mus?: Music }) {
  const musR = useRef(mus); musR.current = mus;
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<{ label: string; p: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || e.data.cab !== 1) return;
      if (e.data.prog !== undefined) setP(e.data.prog);
      if (e.data.saved) {
        const s = e.data.saved, m = musR.current;
        const fin = (n: number) => { sfx.chord(); toast(t("✓ このスマホに保存しました（地図 {n} 枚・約 {mb} MB）", { n: s.tiles, mb: s.mb }) + (n ? " ・ " + t("曲 {n} 曲", { n }) : "")); setTimeout(() => setOpen(false), 1200); };
        // 続けて音楽 (曲とカバー) も保存 → 走行中もギガを使わず、すぐ流れる
        if (m) void m.saveOffline((d, n) => setP({ label: t("音楽"), p: d / Math.max(1, n) })).then(() => fin(m.tracks.length)).catch(() => fin(0)); else fin(0);
      }
    };
    window.addEventListener("message", f); return () => window.removeEventListener("message", f);
  }, [open, t, toast]);
  return (
    <>
      <button className="btn" onClick={() => { sfx.tick(); setP(null); setOpen(true); }}>📥 {mus ? t("このスマホに保存（車内画面・声・ホログラム・地図・音楽）") : t("このスマホに保存（車内画面・声・ホログラム・地図）")}</button>
      <div className="cnote">{t("家の Wi-Fi で 1 回押してください。iPad が無いとき、走行中は通信なし・待ち時間なしで出ます。iPhone はこの画面をホーム画面に追加しておくと、保存が消えにくくなります。")}</div>
      {open && (
        <div className="psave">
          <div className="psc">
            <b>📥 {t("このスマホに保存しています…")}</b>
            <small>{p ? `${p.label} ${Math.round(p.p * 100)}%` : t("準備中…")}</small>
            <div className="bar"><i style={{ width: `${Math.round((p?.p ?? 0) * 100)}%` }} /></div>
            <button className="btn" onClick={() => setOpen(false)}>{t("閉じる")}</button>
          </div>
          <iframe src="/cabin?phone=1&save=1" title="save" />
        </div>
      )}
    </>
  );
}


/** 登録した到着地点の一覧 (設定)。送迎中に送迎バーの 📍 で登録する */
function PlacePointList({ t, toast }: { t: T; toast: (s: string) => void }) {
  const [pts, setPts] = useState<Record<string, [number, number]>>({});
  const load = useCallback(async () => { const r = await cabinPlacePoints(); if (r.ok) setPts(r.points); }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="cnote">
      <b>📍 {t("到着地点")}</b>　{t("送迎中に車を止めた所で、送迎バーの 📍 を押すと登録できます（例：りんくうのガラスのエレベーターの前）。")}
      {Object.keys(pts).length ? Object.entries(pts).map(([k, ll]) => (
        <div key={k} className="fedit"><span>{(PLACES as any)[k]?.name?.ja ?? k}：{ll[0].toFixed(5)}, {ll[1].toFixed(5)}</span>
          <button onClick={async () => { const r = await cabinSetPlacePoint(k, null); if (r.ok) { toast(t("元に戻しました")); void load(); } }}>{t("元に戻す")}</button></div>
      )) : <div>{t("まだ登録されていません（駅は、まわりで 5 秒止まると着いたことになります）")}</div>}
    </div>
  );
}
