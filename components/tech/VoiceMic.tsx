"use client";

/**
 * 音声コントロール (ハイテクUI)。
 *   マイクボタンを押している間だけ、スマホのブラウザ音声認識で聞き取る (無料・録音は保存しない)。
 *   短くタップした場合は、話し終わると自動で止まる。
 *   聞き取った言葉を parseVoiceCommand で既存ボタンの操作に変換し、
 *   window イベント (VOICE_EVENT) で各ボタンに伝える → 各ボタンが自分の処理 (効果音・音声も同じ) を実行する。
 *   ボタンは画面右下に浮かぶ丸いマイク。初回だけ使い方の吹き出しを出す (OK で以後は出さない)。
 *   鍵は対象外。ブラウザが音声認識に対応していなければボタン自体を出さない。
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, WandSparkles, Copy, Check, X, Wifi, KeyRound, DoorOpen, Clock, CloudSun, MapPin, Siren, Phone, ExternalLink, Sun, Moon, Sparkles, MessageCircle, AlarmClock } from "lucide-react";
import { parseVoiceCommand, parseSpellCommand, parseVoiceQuestion, parseVoiceExtra, speechLangCode, type VoiceAction, type VoiceQuestion, type VoiceRoomCaps, type VoiceExtra } from "@/lib/voiceCommand";
import { primeVoice, speak, overrideNextVoice } from "@/lib/sfx";
import { roomAssistant } from "@/lib/roomAssistant";
import { fxPlan, drawFortune, jstDayKey, type LightFx, type Fortune } from "@/lib/lightEffects";
import { extrasText } from "@/lib/voiceExtrasText";
import FxOverlay, { type ScreenFx } from "@/components/tech/FxOverlay";

export const VOICE_EVENT = "crane-voice-command";
const TIP_KEY = "voiceTipSeen";

/** 各ボタン側で使う: 音声コマンドを受け取る */
export function useVoiceAction(handler: (a: VoiceAction) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<VoiceAction>).detail);
    window.addEventListener(VOICE_EVENT, fn);
    return () => window.removeEventListener(VOICE_EVENT, fn);
  }, []);
}

type Texts = {
  fab: string; tipTitle: string; tipBody: string; listening: string; retry: string; denied: string; why: string; examples: string[];
  label: (a: VoiceAction) => string;
  /** 質問への答えの表示 */
  q: {
    wifi: string; checkout: string; entrance: string; room: string; ssid: string; password: string; none: string; copy: string; copied: string; loading: string;
    weather: string; today: string; tomorrow: string; rain: string; umbrellaYes: string; umbrellaMaybe: string; umbrellaNo: string;
    nearby: string; store: string; station: string; laundry: string; openMap: string;
    emergency: string; police: string; ambulance: string; host: string; emergencyNote: string;
  };
};

type WeatherDay = { code: number; max: number; min: number; rain: number };
type Answer = {
  q: VoiceQuestion; loading: boolean;
  rows: { label?: string; value: string }[];
  weather?: WeatherDay[];
  links?: { key: "store" | "station" | "laundry"; href: string }[];
  supportUrl?: string | null;
};

/** 天気コード (Open-Meteo / WMO) → 絵文字 */
function weatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 95) return "⛈️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 51) return "🌧️";
  return "☁️";
}

/** 近くの場所を地図で探すリンク (部屋の位置を中心に Google マップで検索) */
function mapLink(query: string, lat?: number | null, lng?: number | null) {
  const q = encodeURIComponent(query);
  return typeof lat === "number" && typeof lng === "number"
    ? `https://www.google.com/maps/search/${q}/@${lat},${lng},16z`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** 返事の声 (アンドロイドの声の録音。答えそのものは画面に大きく出す) */
const ANSWER_VOICE: Record<VoiceQuestion, string> = {
  wifi: "Here is your Wi-Fi information.",
  checkout: "Here is your check-out time.",
  entrance_code: "Here is the entrance code.",
  room_code: "Here is your room code.",
  weather: "Here is the weather forecast.",
  emergency: "Here are the emergency contacts.",
  nearby: "Here are nearby places.",
  nearby_store: "Here are nearby places.",
  nearby_station: "Here are nearby places.",
  nearby_laundry: "Here are nearby places.",
};

type Phase = "idle" | "listening" | "done" | "error";

/** あいさつ・会話・おみくじのカード */
type ExtraCard = {
  kind: "morning" | "night" | "out" | "who" | "help" | "omikuji";
  loading?: boolean;
  weather?: WeatherDay | null;
  checkoutToday?: string | null;
  alarm?: string | null;
  fortune?: Fortune;
};

/** 季節の演出と、その季節の部屋 */
const SEASON_FX: Partial<Record<VoiceExtra, "spring" | "summer" | "autumn" | "winter">> = { sakura: "spring", fireworks: "summer", momiji: "autumn", snow: "winter" };
const EXTRA_VOICE: Partial<Record<VoiceExtra, string>> = {
  party: "Party mode, activated!", aurora: "Enjoy the aurora.", shooting_star: "Make a wish.", countdown: "Launching in three. Two. One.",
  omikuji: "Here is your fortune.", breathe: "Let's breathe together.", birthday: "Happy birthday!",
  sakura: "Enjoy the cherry blossoms.", fireworks: "Enjoy the fireworks.", momiji: "Enjoy the autumn leaves.", snow: "Enjoy the snowfall.",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 天気 (Open-Meteo / キー不要)。今日から days 日分 */
async function fetchWeather(lat?: number | null, lng?: number | null, days = 2): Promise<WeatherDay[]> {
  if (typeof lat !== "number" || typeof lng !== "number") return [];
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=${days}`);
    const j = await r.json();
    return (j?.daily?.weather_code ?? []).map((c: number, i: number) => ({
      code: c, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]),
      rain: Math.round(j.daily.precipitation_probability_max[i] ?? 0),
    }));
  } catch { return []; }
}

function getRecognition(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function VoiceMic({ lang, caps, texts, roomSlug, roomName = "", lat, lng, variant = "tech", allowed }: {
  lang: string; caps: VoiceRoomCaps; texts: Texts; roomSlug: string; roomName?: string; lat?: number | null; lng?: number | null;
  /** tech = ハイテクUI (マイク) / magic = マジカルUI (杖で呪文を唱えるデザイン) */
  variant?: "tech" | "magic";
  /** この画面にあるボタンの操作だけ受け付ける (無い操作は「もう一度」) */
  allowed?: VoiceAction[];
}) {
  const magic = variant === "magic";
  const tipKey = magic ? `${TIP_KEY}:magic` : TIP_KEY; // 案内はハイテク / マジカルそれぞれ初回だけ
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnswer = () => { setAnswer(null); setCopied(null); if (answerTimer.current) clearTimeout(answerTimer.current); };

  // 質問に答える: 情報はページに埋め込まず、聞かれたときだけ取りに行く
  const ask = async (q: VoiceQuestion) => {
    setAnswer({ q, loading: true, rows: [] });
    if (answerTimer.current) clearTimeout(answerTimer.current);
    answerTimer.current = setTimeout(() => setAnswer(null), 60000);
    let rows: Answer["rows"] = [];
    // 天気: 画面上部と同じ Open-Meteo (キー不要) から今日と明日
    if (q === "weather") {
      const days = await fetchWeather(lat, lng, 2);
      setAnswer({ q, loading: false, rows: [], weather: days });
      speak(days.length ? ANSWER_VOICE[q] : "Sorry, that information is not available.");
      return;
    }
    // 近くの場所: 部屋の位置を中心に地図で検索 (登録不要)
    if (q.startsWith("nearby")) {
      const all: Answer["links"] = [
        { key: "store", href: mapLink("コンビニ", lat, lng) },
        { key: "station", href: mapLink("駅", lat, lng) },
        { key: "laundry", href: mapLink("コインランドリー", lat, lng) },
      ];
      const want = q === "nearby_store" ? "store" : q === "nearby_station" ? "station" : q === "nearby_laundry" ? "laundry" : null;
      const links = want ? [...all.filter((l) => l.key === want), ...all.filter((l) => l.key !== want)] : all;
      setAnswer({ q, loading: false, rows: [], links });
      speak(ANSWER_VOICE[q]);
      return;
    }
    // 緊急時は 110 / 119 をすぐに出す (ホストの連絡先はあとから追加)
    if (q === "emergency") {
      setAnswer({ q, loading: false, rows: [], supportUrl: null });
      speak(ANSWER_VOICE[q]);
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    }
    let supportUrl: string | null = null;
    try {
      const r = await fetch(`/api/room-info/${roomSlug}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      supportUrl = j?.supportUrl ?? null;
      if (q === "wifi" && j?.wifi) {
        if (j.wifi.ssid) rows.push({ label: texts.q.ssid, value: j.wifi.ssid });
        if (j.wifi.password) rows.push({ label: texts.q.password, value: j.wifi.password });
      } else if (q === "checkout" && j?.checkOut) {
        const d = new Date(j.checkOut);
        const day = d.toLocaleDateString(lang === "en" ? "en-US" : lang, { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });
        const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
        rows = [{ label: day, value: time }];
      } else if (q === "entrance_code" && j?.entranceCode) {
        rows = [{ value: String(j.entranceCode) }];
      } else if (q === "room_code" && j?.roomCode) {
        rows = [{ value: String(j.roomCode) }];
      }
    } catch { /* ignore */ }
    // 緊急時: 110 / 119 はいつでも出す (ホストの連絡先は登録があれば)
    if (q === "emergency") {
      setAnswer((a) => (a && a.q === "emergency" ? { ...a, supportUrl } : a));
      return;
    }
    setAnswer({ q, loading: false, rows });
    speak(rows.length ? ANSWER_VOICE[q] : "Sorry, that information is not available.");
    if (navigator.vibrate) navigator.vibrate(18);
  };
  /* ---------------- あいさつ・会話・隠しコマンド ---------------- */
  const x = extrasText(lang);
  const assistant = roomAssistant(roomSlug, roomName);
  const [card, setCard] = useState<ExtraCard | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeCard = () => { setCard(null); if (cardTimer.current) clearTimeout(cardTimer.current); };
  const openCard = (c: ExtraCard) => {
    setCard(c);
    if (cardTimer.current) clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => setCard(null), 45000);
  };
  const [screenFx, setScreenFx] = useState<{ fx: ScreenFx; n: number } | null>(null);
  const lightRun = useRef(0);
  const can = (a: VoiceAction) => !allowed || allowed.includes(a);
  const toast = (text: string, ok = true, ms = 3200) => { setMsg(text); setPhase(ok ? "done" : "error"); hideLater(ms); };

  /** 和風ライトの光の演出。ブラウザが 1 コマずつサーバーに送る (途中で別の操作をしたら止まる) */
  const playLight = async (fx: LightFx) => {
    if (!caps.hasWafu) return;
    const id = ++lightRun.current;
    const plan = fxPlan(fx);
    let startedAt: string | undefined;
    const post = async (frame: number | "restore") => {
      try {
        const r = await fetch(`/api/effects/${roomSlug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fx, frame, startedAt }) });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    };
    const first = await post(0);
    if (!first || first.noLight || first.stop) return;
    if (first.limited) { toast(x.limited, false, 4500); return; }
    startedAt = first.startedAt;
    for (let i = 1; i < plan.frames.length; i++) {
      await sleep(plan.intervalMs);
      if (lightRun.current !== id) return;
      const r = await post(i);
      if (!r || r.stop) return;
    }
    if (plan.restoreWarm) {
      await sleep(plan.intervalMs || 4000);
      if (lightRun.current !== id) return;
      await post("restore");
    }
  };
  const showFx = (fx: ScreenFx) => setScreenFx({ fx, n: Date.now() % 100000 });

  /** ボタンの操作をして、そのボタンのいつものセリフの代わりにあいさつを言わせる (効果音はボタンのまま) */
  const actWith = (a: VoiceAction, line: string) => {
    lightRun.current++; // 光の演出中なら止める
    if (!magic) overrideNextVoice(line); // マジカルUIは呪文の声のまま
    window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: a }));
  };

  const runExtra = async (k: VoiceExtra) => {
    if (navigator.vibrate) navigator.vibrate(18);
    switch (k) {
      case "good_morning": {
        speak("Good morning.");
        openCard({ kind: "morning", loading: true });
        const [days, info] = await Promise.all([fetchWeather(lat, lng, 1), fetch(`/api/room-info/${roomSlug}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
        let checkoutToday: string | null = null;
        if (info?.checkOut && jstDayKey(new Date(info.checkOut).getTime()) === jstDayKey()) {
          checkoutToday = new Date(info.checkOut).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
        }
        setCard((c) => (c?.kind === "morning" ? { kind: "morning", weather: days[0] ?? null, checkoutToday } : c));
        return;
      }
      case "welcome_home":
        if (can("welcome")) { actWith("welcome", "Welcome home"); toast(x.home); } else { speak("Welcome home"); toast(x.home); }
        return;
      case "going_out": {
        if (can("away")) actWith("away", "Have a safe trip"); else speak("Have a safe trip");
        openCard({ kind: "out", loading: true });
        const days = await fetchWeather(lat, lng, 1);
        setCard((c) => (c?.kind === "out" ? { kind: "out", weather: days[0] ?? null } : c));
        return;
      }
      case "good_night": {
        if (can("good_night")) actWith("good_night", "Sweet dreams."); else speak("Sweet dreams.");
        openCard({ kind: "night", loading: true });
        const [days, info] = await Promise.all([fetchWeather(lat, lng, 2), fetch(`/api/room-info/${roomSlug}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
        const alarm = info?.alarm?.fireAt ? new Date(info.alarm.fireAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) : null;
        setCard((c) => (c?.kind === "night" ? { kind: "night", weather: days[1] ?? null, alarm } : c));
        return;
      }
      case "tired":
        if (caps.hasWafu && can("welcome_cozy")) actWith("welcome_cozy", "Relax. You've done enough today.");
        else speak("Relax. You've done enough today.");
        toast(x.tired, true, 3800);
        return;
      case "who":
        speak(assistant?.voice ?? "ASTRALIS system online");
        openCard({ kind: "who" });
        return;
      case "help":
        speak("Here is what I can do.");
        openCard({ kind: "help" });
        return;
      case "omikuji": {
        speak(EXTRA_VOICE.omikuji!);
        openCard({ kind: "omikuji", fortune: drawFortune(roomSlug, jstDayKey()) });
        void playLight("omikuji");
        return;
      }
      case "countdown": {
        speak(EXTRA_VOICE.countdown!);
        showFx("countdown");
        const galaxy = caps.hasGalaxy && can("galaxy_on");
        await sleep(3300);
        if (galaxy) window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: "galaxy_on" }));
        else showFx("shooting_star");
        return;
      }
      case "shooting_star":
        speak(EXTRA_VOICE.shooting_star!);
        showFx("shooting_star");
        return;
      default: {
        // 季節の演出は、その季節の部屋だけ
        const season = SEASON_FX[k];
        if (season && assistant?.season !== season) {
          toast(x.seasonOnly(x.seasons[season], x.seasonRooms[season]), false, 4500);
          return;
        }
        speak(EXTRA_VOICE[k] ?? "");
        showFx(k as ScreenFx);
        void playLight(k as LightFx);
      }
    }
  };

  const copy = async (i: number, v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [msg, setMsg] = useState("");
  const rec = useRef<any>(null);
  const pressAt = useRef(0);
  const finals = useRef<string[]>([]);
  const heardRef = useRef("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSupported(!!getRecognition()); }, []);
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ignore */ } }, []);

  const hideLater = (ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPhase("idle"), ms);
  };

  const finish = () => {
    const cands = finals.current.length ? finals.current : heardRef.current ? [heardRef.current] : [];
    // 質問 (Wi-Fi / チェックアウト / 暗証番号) を先に判定
    const question = parseVoiceQuestion(cands);
    if (question) {
      setPhase("idle");
      void ask(question);
      return;
    }
    // あいさつ・会話・隠しコマンド (おはよう / ただいま / おみくじ / 流れ星 など)
    const extra = parseVoiceExtra(cands);
    if (extra) {
      setPhase("idle");
      void runExtra(extra);
      return;
    }
    // マジカルUI では、画面で使っている呪文の言葉 (ルーモス / ノックス など) もそのまま効く
    const parsed = (magic ? parseSpellCommand(cands, caps) : null) ?? parseVoiceCommand(cands, caps);
    const action = parsed && (!allowed || allowed.includes(parsed)) ? parsed : null;
    if (action) {
      lightRun.current++; // 光の演出中なら止める (ゲストの操作を優先)
      setMsg(texts.label(action));
      setPhase("done");
      window.dispatchEvent(new CustomEvent<VoiceAction>(VOICE_EVENT, { detail: action }));
      if (navigator.vibrate) navigator.vibrate(18);
      hideLater(2200);
    } else {
      setMsg(texts.retry);
      setPhase("error");
      hideLater(3200);
    }
  };

  const start = () => {
    const R = getRecognition();
    if (!R || phase === "listening") return;
    primeVoice(); // タップ中に音声再生を解放 (結果が出たあと各ボタンの音声が鳴るように)
    if (hideTimer.current) clearTimeout(hideTimer.current);
    finals.current = []; heardRef.current = ""; setHeard(""); setMsg("");
    const r = new R();
    r.lang = speechLangCode(lang);
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    r.onresult = (e: any) => {
      let interim = "";
      const f: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) for (let j = 0; j < res.length; j++) f.push(res[j].transcript);
        else interim += res[0].transcript;
      }
      if (f.length) finals.current = f;
      heardRef.current = f[0] ?? interim;
      setHeard(heardRef.current);
    };
    r.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setMsg(texts.denied); setPhase("error"); hideLater(4500);
        rec.current = null;
      }
    };
    r.onend = () => {
      if (rec.current !== r) return; // エラーで終了済み
      rec.current = null;
      finish();
    };
    rec.current = r;
    pressAt.current = Date.now();
    setPhase("listening");
    if (navigator.vibrate) navigator.vibrate(12);
    try { r.start(); } catch { rec.current = null; setPhase("idle"); }
  };

  // 押し続けて離したら聞き取り終了 / 短いタップなら話し終わりで自動終了
  const release = () => {
    if (!rec.current) return;
    if (Date.now() - pressAt.current > 450) { try { rec.current.stop(); } catch { /* ignore */ } }
  };

  // 初回だけの案内 (この端末で一度 OK を押したら二度と出さない)
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (!supported) return;
    let seen = false;
    try { seen = localStorage.getItem(tipKey) === "1"; } catch { /* ignore */ }
    if (seen) return;
    const id = setTimeout(() => setTip(true), 2500);
    return () => clearTimeout(id);
  }, [supported]);
  const closeTip = () => {
    setTip(false);
    try { localStorage.setItem(tipKey, "1"); } catch { /* ignore */ }
  };

  if (!supported || typeof document === "undefined") return null;

  const listening = phase === "listening";
  return createPortal(
    <>
      {/* 右下に浮かぶマイクボタン (スクロールしても同じ位置) */}
      <div className="fixed bottom-5 right-4 z-[65] flex items-center gap-2 font-sans tracking-normal"
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <span className={`pointer-events-none rounded-full border px-3 py-1.5 text-[12.5px] font-semibold backdrop-blur-md ${magic
          ? (listening ? "border-[#f5c26b]/80 bg-[#3b2a55]/85 text-[#ffe7b3]" : "border-[#d8bf86]/50 bg-[#15121f]/90 text-[#ffe7b3]")
          : (listening ? "border-cyan-200/70 bg-cyan-500/30 text-white" : "border-cyan-300/40 bg-[#050a12]/90 text-cyan-50")}`}
          style={magic ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
          {listening ? texts.listening : texts.fab}
        </span>
        <button type="button" aria-label={texts.fab}
          onPointerDown={(e) => { e.preventDefault(); if (tip) closeTip(); start(); }}
          onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          className={`${magic ? "vm-fab-magic border-[#ffe7b3]/80 text-[#fff5dd]" : "vm-fab border-cyan-50/80 text-white"} relative flex h-[62px] w-[62px] shrink-0 select-none items-center justify-center rounded-full border-[1.5px] [touch-action:none] [-webkit-touch-callout:none] ${listening ? (magic ? "vm-fab-magic-on scale-110" : "vm-fab-on scale-110") : ""}`}
          style={{ background: magic ? "radial-gradient(circle at 35% 30%, #f5c26b, #7c4dbd 55%, #241640)" : "radial-gradient(circle at 35% 30%, #67e8f9, #0891b2 55%, #083344)", transition: "transform 0.15s" }}>
          {listening && <span className={`absolute inset-[-6px] animate-ping rounded-full border-2 ${magic ? "border-[#f5c26b]/70" : "border-cyan-200/70"}`} />}
          {magic ? <WandSparkles className="relative h-7 w-7" strokeWidth={1.8} /> : <Mic className="relative h-7 w-7" strokeWidth={1.9} />}
        </button>
      </div>

      {/* 初回だけの案内の吹き出し */}
      <AnimatePresence>
        {tip && phase === "idle" && (
          <motion.div key="voice-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className={`fixed right-4 z-[65] w-[264px] rounded-2xl border px-4 py-3 font-sans tracking-normal ${magic ? "border-[#d8bf86]/60 bg-[#15121f] shadow-[0_0_24px_rgba(245,194,107,0.3)]" : "border-cyan-300/55 bg-[#06101b] shadow-[0_0_24px_rgba(34,211,238,0.3)]"}`}
            style={{ bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 78px)" }}>
            <p className={`text-[14px] font-bold ${magic ? "text-[#ffe7b3]" : "text-cyan-50"}`}>{texts.tipTitle}</p>
            <p className={`mt-1 text-[12px] leading-relaxed ${magic ? "text-[#f8ecd1]/75" : "text-cyan-50/75"}`}>{texts.tipBody}</p>
            <button type="button" onClick={closeTip} className={`mt-1.5 block w-full text-right text-[13px] font-semibold ${magic ? "text-[#f5c26b]" : "text-cyan-300"}`}>OK</button>
            <span className={`absolute -bottom-[7px] right-[26px] h-3 w-3 rotate-45 border-b border-r ${magic ? "border-[#d8bf86]/60 bg-[#15121f]" : "border-cyan-300/55 bg-[#06101b]"}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 質問の答え: 画面の中央に大きく表示 (コピーできる) */}
      <AnimatePresence>
        {answer && (
          <motion.div key="voice-answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55 px-5 font-sans tracking-normal backdrop-blur-sm" onClick={closeAnswer}>
            <motion.div initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-sm rounded-2xl border px-5 pb-5 pt-4 ${magic ? "border-[#d8bf86]/55 bg-[#15121f] shadow-[0_0_40px_rgba(245,194,107,0.28)]" : "border-cyan-300/45 bg-[#050b14] shadow-[0_0_40px_rgba(34,211,238,0.3)]"}`}>
              <button type="button" onClick={closeAnswer} aria-label="close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/50 active:bg-white/10"><X className="h-4 w-4" /></button>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-cyan-200">
                {answer.q === "wifi" ? <Wifi className="h-4 w-4" /> : answer.q === "checkout" ? <Clock className="h-4 w-4" /> : answer.q === "entrance_code" ? <DoorOpen className="h-4 w-4" />
                  : answer.q === "room_code" ? <KeyRound className="h-4 w-4" /> : answer.q === "weather" ? <CloudSun className="h-4 w-4" /> : answer.q === "emergency" ? <Siren className="h-4 w-4 text-rose-300" /> : <MapPin className="h-4 w-4" />}
                {answer.q === "wifi" ? texts.q.wifi : answer.q === "checkout" ? texts.q.checkout : answer.q === "entrance_code" ? texts.q.entrance
                  : answer.q === "room_code" ? texts.q.room : answer.q === "weather" ? texts.q.weather : answer.q === "emergency" ? texts.q.emergency : texts.q.nearby}
              </p>
              {answer.loading ? (
                <p className="mt-5 text-center text-white/60">{texts.q.loading}</p>
              ) : answer.q === "weather" && answer.weather?.length ? (
                // 天気: 今日と明日 (気温・雨の確率・傘の目安)
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {answer.weather.slice(0, 2).map((d, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                      <p className="text-[12px] text-white/55">{i === 0 ? texts.q.today : texts.q.tomorrow}</p>
                      <p className="mt-1 text-[34px] leading-none">{weatherEmoji(d.code)}</p>
                      <p className="mt-2 font-mono text-[18px] text-white"><span className="text-rose-200">{d.max}°</span> <span className="text-white/40">/</span> <span className="text-sky-200">{d.min}°</span></p>
                      <p className="mt-1 text-[12px] text-cyan-100">☔ {texts.q.rain} {d.rain}%</p>
                      <p className={`mt-1.5 text-[11.5px] leading-snug ${d.rain >= 50 ? "text-amber-200" : "text-white/60"}`}>
                        {d.rain >= 50 ? texts.q.umbrellaYes : d.rain >= 30 ? texts.q.umbrellaMaybe : texts.q.umbrellaNo}
                      </p>
                    </div>
                  ))}
                </div>
              ) : answer.links ? (
                // 近くの場所: 地図で開く
                <div className="mt-3 space-y-2.5">
                  {answer.links.map((l) => (
                    <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-400/[0.07] px-4 py-3.5 active:scale-[0.98]">
                      <span className="text-[26px] leading-none">{l.key === "store" ? "🏪" : l.key === "station" ? "🚉" : "🧺"}</span>
                      <span className="flex-1 text-[16px] font-semibold text-white">{l.key === "store" ? texts.q.store : l.key === "station" ? texts.q.station : texts.q.laundry}</span>
                      <span className="flex items-center gap-1 text-[12px] text-cyan-200">{texts.q.openMap} <ExternalLink className="h-3.5 w-3.5" /></span>
                    </a>
                  ))}
                </div>
              ) : answer.q === "emergency" ? (
                // 緊急時: 警察 110 / 救急・消防 119 / ホストの連絡先
                <div className="mt-3 space-y-2.5">
                  <a href="tel:110" className="flex items-center gap-3 rounded-xl border border-sky-300/40 bg-sky-500/15 px-4 py-3.5 active:scale-[0.98]">
                    <Phone className="h-5 w-5 text-sky-200" />
                    <span className="flex-1 text-[15px] font-semibold text-white">{texts.q.police}</span>
                    <span className="font-mono text-[26px] font-bold text-sky-100">110</span>
                  </a>
                  <a href="tel:119" className="flex items-center gap-3 rounded-xl border border-rose-300/50 bg-rose-500/20 px-4 py-3.5 active:scale-[0.98]">
                    <Phone className="h-5 w-5 text-rose-200" />
                    <span className="flex-1 text-[15px] font-semibold text-white">{texts.q.ambulance}</span>
                    <span className="font-mono text-[26px] font-bold text-rose-100">119</span>
                  </a>
                  {answer.supportUrl && (
                    <a href={answer.supportUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-3.5 active:scale-[0.98]">
                      <Phone className="h-5 w-5 text-emerald-200" />
                      <span className="flex-1 text-[15px] font-semibold text-white">{texts.q.host}</span>
                      <ExternalLink className="h-4 w-4 text-emerald-200" />
                    </a>
                  )}
                  <p className="pt-1 text-[11px] leading-snug text-white/50">{texts.q.emergencyNote}</p>
                </div>
              ) : answer.rows.length === 0 ? (
                <p className="mt-5 text-center text-[15px] text-amber-200">{texts.q.none}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {answer.rows.map((r, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      {r.label && <p className="text-[11px] text-white/50">{r.label}</p>}
                      <div className="mt-0.5 flex items-center gap-3">
                        <p className={`min-w-0 flex-1 break-all font-mono font-semibold leading-tight text-white ${r.value.length > 10 ? "text-[20px] tracking-wide" : "text-[28px] tracking-wider"}`}>{r.value}</p>
                        {answer.q !== "checkout" && (
                          <button type="button" onClick={() => copy(i, r.value)}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-2 text-[12px] text-cyan-100 active:scale-95">
                            {copied === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === i ? texts.q.copied : texts.q.copy}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 隠しコマンドの画面演出 (タッチは下のボタンに通す) */}
      {screenFx && (
        <FxOverlay key={screenFx.n} fx={screenFx.fx} n={screenFx.n} onDone={() => setScreenFx(null)}
          texts={{ inhale: x.inhale, exhale: x.exhale, breatheDone: x.breatheDone, party: x.party, aurora: x.aurora, wish: x.wish, birthday: x.birthday }} />
      )}

      {/* あいさつ・会話・おみくじのカード */}
      <AnimatePresence>
        {card && (
          <motion.div key="voice-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55 px-5 font-sans tracking-normal backdrop-blur-sm" onClick={closeCard}>
            <motion.div initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-sm rounded-2xl border px-5 pb-5 pt-4 ${magic ? "border-[#d8bf86]/55 bg-[#15121f] shadow-[0_0_40px_rgba(245,194,107,0.28)]" : "border-cyan-300/45 bg-[#050b14] shadow-[0_0_40px_rgba(34,211,238,0.3)]"}`}>
              <button type="button" onClick={closeCard} aria-label="close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/50 active:bg-white/10"><X className="h-4 w-4" /></button>
              <p className={`flex items-center gap-2 text-[14px] font-semibold ${magic ? "text-[#ffe7b3]" : "text-cyan-200"}`}>
                {card.kind === "morning" ? <Sun className="h-4 w-4" /> : card.kind === "night" ? <Moon className="h-4 w-4" /> : card.kind === "out" ? <DoorOpen className="h-4 w-4" />
                  : card.kind === "help" ? <MessageCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {card.kind === "morning" ? x.morning : card.kind === "night" ? x.night : card.kind === "out" ? x.out
                  : card.kind === "who" ? x.whoTitle : card.kind === "help" ? x.helpTitle : x.fortuneTitle}
              </p>

              {card.loading ? (
                <p className="mt-5 text-center text-white/60">{texts.q.loading}</p>
              ) : card.kind === "who" ? (
                // 自己紹介: この部屋のアシスタント (画面はフルネーム)
                <div className="mt-4 text-center">
                  <p className={`font-mono text-[11px] tracking-[0.35em] ${magic ? "text-[#f5c26b]/80" : "text-cyan-300/80"}`}>{assistant?.room ?? roomName}</p>
                  <p className="mt-1.5 text-[26px] font-bold tracking-[0.08em] text-white [text-shadow:0_0_18px_rgba(125,211,252,0.6)]">{assistant?.name ?? "ASTRALIS"}</p>
                  <p className="mt-2 text-[13px] text-white/75">{x.whoBody}</p>
                  <p className="mt-3 text-[10.5px] text-white/45">{x.poweredBy}</p>
                </div>
              ) : card.kind === "help" ? (
                // 使える言葉の一覧
                <div className="mt-3 space-y-2.5">
                  {x.helpGroups.map((g) => (
                    <div key={g.title}>
                      <p className="text-[11px] text-white/50">{g.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.items.map((it) => (
                          <span key={it} className={`rounded-full border px-2.5 py-1 text-[12px] text-white ${magic ? "border-[#d8bf86]/35 bg-[#d8bf86]/10" : "border-cyan-300/30 bg-cyan-400/[0.07]"}`}>「{it}」</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : card.kind === "omikuji" && card.fortune ? (
                // おみくじ: 1 日 1 回の運勢とラッキーカラー
                <div className="mt-4 text-center">
                  <p className="text-[40px] font-bold leading-none text-white" style={{ fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif" }}>{x.ranks[card.fortune.rank]}</p>
                  <div className="mt-4 flex items-center justify-center gap-2.5">
                    <span className="h-6 w-6 rounded-full border border-white/40" style={{ background: `rgb(${card.fortune.rgb.split(":").join(",")})`, boxShadow: `0 0 14px rgb(${card.fortune.rgb.split(":").join(",")})` }} />
                    <p className="text-[14px] text-white/85">{x.luckyColor}: <b>{x.colors[card.fortune.color]}</b></p>
                  </div>
                  {caps.hasWafu && <p className="mt-2 text-[11px] text-white/50">{x.fortuneNote}</p>}
                </div>
              ) : (
                // おはよう / いってきます / おやすみ: 天気 (+ チェックアウト / 目覚まし)
                <div className="mt-3 space-y-2.5">
                  {card.weather ? (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <span className="text-[34px] leading-none">{weatherEmoji(card.weather.code)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/50">{card.kind === "night" ? x.tomorrowWeather : x.todayWeather}</p>
                        <p className="font-mono text-[17px] text-white"><span className="text-rose-200">{card.weather.max}°</span> <span className="text-white/40">/</span> <span className="text-sky-200">{card.weather.min}°</span> <span className="ml-1 text-[12px] text-cyan-100">☔ {card.weather.rain}%</span></p>
                        <p className={`text-[11.5px] leading-snug ${card.weather.rain >= 50 ? "text-amber-200" : "text-white/60"}`}>
                          {card.weather.rain >= 50 ? texts.q.umbrellaYes : card.weather.rain >= 30 ? texts.q.umbrellaMaybe : texts.q.umbrellaNo}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {card.kind === "morning" && card.checkoutToday && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3">
                      <Clock className="h-5 w-5 text-amber-200" />
                      <p className="flex-1 text-[14px] text-white">{x.checkoutToday}</p>
                      <p className="font-mono text-[22px] font-semibold text-amber-100">{card.checkoutToday}</p>
                    </div>
                  )}
                  {card.kind === "night" && (
                    <div className="flex items-center gap-3 rounded-xl border border-violet-300/35 bg-violet-400/10 px-4 py-3">
                      <AlarmClock className="h-5 w-5 text-violet-200" />
                      <p className="flex-1 text-[14px] text-white">{card.alarm ? x.alarmAt : x.noAlarm}</p>
                      {card.alarm && <p className="font-mono text-[22px] font-semibold text-violet-100">{card.alarm}</p>}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 聞き取りパネル (body 直下なので親の文字スタイルや transform の影響を受けない) */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div key="voice-panel"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
            style={{ bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 80px)" }}>
            <div className={`w-full max-w-sm rounded-2xl font-sans tracking-normal border px-4 py-3 text-center backdrop-blur-xl ${magic ? "border-[#d8bf86]/45 bg-[#15121f]/95 shadow-[0_0_34px_rgba(245,194,107,0.28)]" : "border-cyan-300/30 bg-[#050a12]/95 shadow-[0_0_30px_rgba(34,211,238,0.25)]"}`}>
              {listening ? (
                <>
                  {magic ? (
                    // 詠唱中: ルーンの刻まれた魔法陣がゆっくり回る
                    <div className="relative mx-auto h-16 w-16">
                      <svg viewBox="0 0 100 100" className="vm-circle absolute inset-0 h-full w-full">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="#f5c26b" strokeOpacity="0.8" strokeWidth="1.2" />
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#f5c26b" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="3 4" />
                        <polygon points="50,12 83,69 17,69" fill="none" stroke="#c4a5ff" strokeOpacity="0.8" strokeWidth="1" />
                        <polygon points="50,88 17,31 83,31" fill="none" stroke="#c4a5ff" strokeOpacity="0.8" strokeWidth="1" />
                        {["ᚠ", "ᚱ", "ᛟ", "ᚨ", "ᛉ", "ᛞ"].map((r, i) => (
                          <text key={i} x={50 + 42 * Math.sin((i * Math.PI) / 3)} y={53 - 42 * Math.cos((i * Math.PI) / 3)} fontSize="8" fill="#ffe7b3" textAnchor="middle">{r}</text>
                        ))}
                      </svg>
                      <span className="absolute inset-[38%] rounded-full bg-[#ffe7b3] shadow-[0_0_16px_6px_rgba(245,194,107,0.7)]" />
                    </div>
                  ) : (
                    <div className="flex h-6 items-center justify-center gap-[3px]">
                      {Array.from({ length: 13 }, (_, i) => (
                        <span key={i} className="w-[3px] rounded-full bg-cyan-300"
                          style={{ height: 6, animation: `voiceBar 0.9s ease-in-out ${(i % 7) * 0.08}s infinite` }} />
                      ))}
                    </div>
                  )}
                  <p className={`mt-1 font-mono text-[9px] tracking-[0.3em] ${magic ? "text-[#f5c26b]/80" : "text-cyan-300/70"}`}>{texts.listening}</p>
                  <p className={`mt-1 min-h-[20px] text-[15px] ${magic ? "italic text-[#fff5dd]" : "text-white"}`}
                    style={magic ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>{heard || "…"}</p>
                  {!heard && (
                    <p className="mt-1 text-[10.5px] leading-snug text-white/45">
                      {texts.examples.map((x) => `「${x}」`).join(" ")}<br />{texts.why}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {heard && <p className="text-[12px] text-white/50">“{heard}”</p>}
                  <p className={`mt-0.5 text-[15px] font-semibold ${phase === "done" ? (magic ? "text-[#ffe7b3]" : "text-emerald-300") : "text-amber-200"}`} style={magic ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>{msg}</p>
                  {phase === "error" && <p className="mt-1 text-[10.5px] text-white/45">{texts.examples.map((x) => `「${x}」`).join(" ")}</p>}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
