"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Copy, Check, Download, RefreshCw, Ban, LogOut, DoorOpen, KeyRound,
  QrCode, Globe, ExternalLink, Snowflake, CalendarDays, ClipboardList, Wrench,
  Image as ImageIcon, History, PowerOff, Loader2, Home, Upload,
} from "lucide-react";
import { LANGS, LANG_LABEL } from "@/lib/i18n";
import {
  AT, ADMIN_LANGS, ADMIN_LANG_LABEL, isAdminLang, type AdminLang,
} from "@/lib/adminI18n";
import {
  addReservation, cancelReservation, regeneratePin, setPin, assignDevices, updateRoomImage, uploadRoomImage, updateGeofence,
} from "./actions";

export interface Room {
  id: string; slug: string; display_name: string; is_active: boolean;
  ac_device_id: string | null; light_device_id: string | null;
  image_url: string | null;
  lat: number | null; lng: number | null; radius: number;
  url: string; qr: string;
}
export interface Reservation {
  id: string; room_name: string; room_slug: string;
  source: "ical" | "manual"; status: "active" | "cancelled" | "completed";
  guest_name: string | null; guest_lang: string;
  check_in: string; check_out: string;
  unlock_pin: string | null;
  airbnb_reservation_url: string | null;
}
export interface SwitchBotInfo {
  error: string | null;
  deviceList: { deviceId: string; deviceName: string; deviceType: string }[];
  infraredRemoteList: { deviceId: string; deviceName: string; remoteType: string }[];
}
export interface LogEntry {
  id: string; room_name: string; room_slug: string;
  action: string; source: string; success: boolean; created_at: string;
}
type T = (typeof AT)["ja"];
type Tab = "today" | "reservations" | "rooms" | "history" | "test";

const LOCALE: Record<AdminLang, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN" };
const fmt = (iso: string, lang: AdminLang) =>
  new Date(iso).toLocaleString(LOCALE[lang], {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  });

/**
 * 送信ボタン (サーバーアクション用)。
 * 送信中はスピナー、完了後は数秒「✓ 保存しました」を表示して、保存されたことを可視化する。
 * <form action={...}> の中で submit ボタンとして使うこと。
 */
function SubmitButton({
  className, children, savedText, idleIcon,
}: {
  className?: string; children: React.ReactNode; savedText: string; idleIcon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) {
      setSaved(true);
      const id = setTimeout(() => setSaved(false), 1900);
      was.current = pending;
      return () => clearTimeout(id);
    }
    was.current = pending;
  }, [pending]);
  return (
    <button type="submit" disabled={pending}
      className={`${className ?? ""} transition disabled:opacity-60`}
      aria-busy={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : saved ? (
        <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3.5 w-3.5" />{savedText}</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">{idleIcon}{children}</span>
      )}
    </button>
  );
}

export default function AdminClient({
  rooms, reservations, switchbot, logs,
}: { rooms: Room[]; reservations: Reservation[]; switchbot: SwitchBotInfo; logs: LogEntry[] }) {
  const [lang, setLang] = useState<AdminLang>("ja");
  const [tab, setTab] = useState<Tab>("today");
  const t = AT[lang];

  useEffect(() => {
    const saved = localStorage.getItem("adminLang");
    if (isAdminLang(saved)) setLang(saved);
  }, []);
  const changeLang = (l: AdminLang) => { setLang(l); localStorage.setItem("adminLang", l); };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    location.href = "/admin/login";
  };

  return (
    <main className="min-h-dvh bg-[#05060a] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute top-1/2 -right-24 h-96 w-96 rounded-full bg-violet-600/15 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-28 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">{t.dashboard}</p>
            <h1 className="mt-1 text-xl font-semibold">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch lang={lang} onChange={changeLang} />
            <button onClick={logout}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs active:scale-95">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {tab === "today" && <TodayTab rooms={rooms} reservations={reservations} t={t} lang={lang} />}
        {tab === "reservations" && <ReservationsTab rooms={rooms} reservations={reservations} t={t} lang={lang} />}
        {tab === "rooms" && <RoomsTab rooms={rooms} info={switchbot} t={t} />}
        {tab === "history" && <HistoryTab logs={logs} rooms={rooms} t={t} lang={lang} />}
        {tab === "test" && <DeviceTestSection rooms={rooms} t={t} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} t={t} />
    </main>
  );
}

/* ---------------- Bottom nav ---------------- */
function BottomNav({ tab, setTab, t }: { tab: Tab; setTab: (t: Tab) => void; t: T }) {
  const items: { key: Tab; label: string; Icon: any }[] = [
    { key: "today", label: t.tabToday, Icon: CalendarDays },
    { key: "reservations", label: t.tabReservations, Icon: ClipboardList },
    { key: "rooms", label: t.tabRooms, Icon: DoorOpen },
    { key: "history", label: t.tabHistory, Icon: History },
    { key: "test", label: t.tabTest, Icon: Wrench },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0a0c14]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl">
        {items.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] transition
                ${active ? "text-cyan-300" : "text-white/45"}`}>
              <Icon className="h-5 w-5" />
              {label}
              {active && <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-cyan-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------- Today tab ---------------- */
const jstDay = (iso: number | string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD

function TodayTab({ rooms, reservations, t, lang }: { rooms: Room[]; reservations: Reservation[]; t: T; lang: AdminLang }) {
  const now = Date.now();
  const today = jstDay(now);

  // 各部屋: 今滞在中 > 今日これから到着 の順で「今日のゲスト」を選ぶ
  const todayByRoom = useMemo(() => {
    const m = new Map<string, { r: Reservation; state: "staying" | "arriving" }>();
    for (const room of rooms) {
      const active = reservations.find((r) =>
        r.room_slug === room.slug && r.status === "active" &&
        new Date(r.check_in).getTime() <= now && now < new Date(r.check_out).getTime()
      );
      if (active) { m.set(room.slug, { r: active, state: "staying" }); continue; }
      const arriving = reservations
        .filter((r) => r.room_slug === room.slug && r.status === "active"
          && new Date(r.check_in).getTime() > now && jstDay(r.check_in) === today)
        .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())[0];
      if (arriving) m.set(room.slug, { r: arriving, state: "arriving" });
    }
    return m;
  }, [reservations, rooms, now, today]);

  const anyToday = rooms.some((r) => todayByRoom.has(r.slug));

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm text-cyan-200">
        <CalendarDays className="h-4 w-4" /> {t.todayTitle}
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3">{t.tabRooms}</th>
              <th className="px-2 py-3">{t.status}</th>
              <th className="px-2 py-3">{t.period}</th>
              <th className="px-2 py-3">{t.pin}</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const hit = todayByRoom.get(room.slug);
              const r = hit?.r;
              return (
                <tr key={room.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RoomThumb room={room} size={32} />
                      <span className="font-medium">{room.display_name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {!hit
                      ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/40">{t.empty}</span>
                      : hit.state === "staying"
                        ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">{t.staying}</span>
                        : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">{t.arriving}</span>}
                  </td>
                  <td className="px-2 py-3 text-[11px] text-white/60">
                    {r ? `${fmt(r.check_in, lang)} → ${fmt(r.check_out, lang)}` : "—"}
                  </td>
                  <td className="px-2 py-3 font-mono text-cyan-200">{r?.unlock_pin ?? "—"}</td>
                  <td className="px-2 py-3">
                    {r?.airbnb_reservation_url && (
                      <a href={r.airbnb_reservation_url} target="_blank" rel="noopener noreferrer"
                        className="text-rose-300/80 hover:text-rose-300"><ExternalLink className="h-4 w-4" /></a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!anyToday && <p className="mt-3 text-center text-xs text-white/40">{t.todayNone}</p>}
    </section>
  );
}

/* ---------------- Reservations tab ---------------- */
function ReservationsTab({ rooms, reservations, t, lang }: { rooms: Room[]; reservations: Reservation[]; t: T; lang: AdminLang }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = useMemo(
    () => reservations.filter((r) => filter === "all" || r.room_slug === filter),
    [reservations, filter]
  );
  return (
    <section>
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-200">
          <Plus className="h-4 w-4" /> {t.addTitle}
        </div>
        <form action={addReservation} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.room}>
            <select name="room_id" required className={selCls}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.display_name}（{r.slug}）</option>)}
            </select>
          </Field>
          <Field label={t.language}>
            <select name="guest_lang" defaultValue="en" className={selCls}>
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </Field>
          <Field label={t.checkIn}>
            <input type="datetime-local" name="check_in" required className={selCls} />
          </Field>
          <Field label={t.checkOut}>
            <input type="datetime-local" name="check_out" required className={selCls} />
          </Field>
          <Field label={`${t.guestName}（${t.optional}）`}>
            <input type="text" name="guest_name" placeholder="—" className={selCls} />
          </Field>
          <Field label={t.pinField}>
            <input type="text" name="unlock_pin" inputMode="numeric" placeholder={t.autoPlaceholder} maxLength={6} className={`${selCls} font-mono`} />
          </Field>
          <SubmitButton savedText={t.saved} idleIcon={<Plus className="h-4 w-4" />}
            className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/15 py-3 text-sm text-emerald-200 active:bg-emerald-500/30">
            {t.addButton}
          </SubmitButton>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t.all} />
        {rooms.map((r) => <FilterChip key={r.id} active={filter === r.slug} onClick={() => setFilter(r.slug)} label={r.display_name} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((r) => <ReservationCard key={r.id} r={r} t={t} lang={lang} />)}
        {shown.length === 0 && <p className="col-span-full py-12 text-center text-sm text-white/40">{t.noReservations}</p>}
      </div>
    </section>
  );
}

/* ---------------- History tab ---------------- */
function HistoryTab({ logs, rooms, t, lang }: { logs: LogEntry[]; rooms: Room[]; t: T; lang: AdminLang }) {
  const [filter, setFilter] = useState<string>("all");
  const actionLabel: Record<string, string> = {
    unlock: t.unlock, lock: t.lock, ac_on: t.acOn, ac_off: t.acOff, light_on: t.lightOn, light_off: t.lightOff,
  };
  const srcLabel: Record<string, string> = { guest: t.srcGuest, admin: t.srcAdmin, cron: t.srcCron };
  const shown = useMemo(() => logs.filter((l) => filter === "all" || l.room_slug === filter), [logs, filter]);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm text-cyan-200">
        <History className="h-4 w-4" /> {t.historyTitle}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t.all} />
        {rooms.map((r) => <FilterChip key={r.id} active={filter === r.slug} onClick={() => setFilter(r.slug)} label={r.display_name} />)}
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-3 py-3">{t.when}</th>
              <th className="px-2 py-3">{t.tabRooms}</th>
              <th className="px-2 py-3">{t.unlock}/{t.acOn}</th>
              <th className="px-2 py-3">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2.5 text-[11px] text-white/60">{fmt(l.created_at, lang)}</td>
                <td className="px-2 py-2.5 text-xs">{l.room_name}</td>
                <td className="px-2 py-2.5 text-xs">
                  <span className="text-white/80">{actionLabel[l.action] ?? l.action}</span>
                  <span className="ml-1 text-[10px] text-white/35">· {srcLabel[l.source] ?? l.source}</span>
                </td>
                <td className="px-2 py-2.5">
                  {l.success
                    ? <Check className="h-4 w-4 text-emerald-300" />
                    : <span className="text-rose-300">×</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="mt-3 text-center text-xs text-white/40">{t.noLogs}</p>}
    </section>
  );
}

/* ---------------- Rooms tab ---------------- */
function RoomsTab({ rooms, info, t }: { rooms: Room[]; info: SwitchBotInfo; t: T }) {
  const ir = info.infraredRemoteList ?? [];
  const acs = ir.filter((d) => /air\s*conditioner/i.test(d.remoteType));
  const lights = ir.filter((d) => /light/i.test(d.remoteType));
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {rooms.map((room) => (
        <RoomManageCard key={room.id} room={room} acs={acs} lights={lights} sbError={info.error} t={t} />
      ))}
    </section>
  );
}

function RoomManageCard({
  room, acs, lights, sbError, t,
}: {
  room: Room;
  acs: { deviceId: string; deviceName: string }[];
  lights: { deviceId: string; deviceName: string }[];
  sbError: string | null;
  t: T;
}) {
  const [copied, setCopied] = useState(false);
  const opt = (d: { deviceId: string; deviceName: string }) => (
    <option key={d.deviceId} value={d.deviceId}>{d.deviceName || d.deviceId}</option>
  );
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
      <div className="flex gap-3 p-4">
        <RoomThumb room={room} size={72} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{room.display_name}</p>
          <p className="font-mono text-[11px] text-white/40">{room.slug}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={async () => { await navigator.clipboard.writeText(room.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} URL
            </button>
            <a href={room.qr} download={`qr-${room.slug}.png`}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              <Download className="h-3.5 w-3.5" /> QR
            </a>
          </div>
        </div>
        <img src={room.qr} alt="QR" className="h-16 w-16 rounded-lg bg-white p-1" />
      </div>

      {/* デバイス割り当て */}
      <div className="border-t border-white/10 p-4">
        {sbError ? (
          <p className="text-[11px] text-amber-300/80">{sbError}</p>
        ) : (
          <form action={assignDevices} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="room_id" value={room.id} />
            <label className="flex-1 text-[11px] text-white/50">{t.ac}
              <select name="ac" defaultValue={room.ac_device_id ?? ""} className={`${selCls} mt-1 py-2 text-xs`}>
                <option value="">{t.none}</option>{acs.map(opt)}
              </select>
            </label>
            <label className="flex-1 text-[11px] text-white/50">{t.light}
              <select name="light" defaultValue={room.light_device_id ?? ""} className={`${selCls} mt-1 py-2 text-xs`}>
                <option value="">{t.none}</option>{lights.map(opt)}
              </select>
            </label>
            <SubmitButton savedText={t.saved} className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">{t.save}</SubmitButton>
          </form>
        )}
      </div>

      {/* 画像: ファイルアップロード */}
      <form action={uploadRoomImage} className="flex items-end gap-2 border-t border-white/10 p-4">
        <input type="hidden" name="room_id" value={room.id} />
        <label className="flex-1 text-[11px] text-white/50">
          <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {t.uploadImage} <span className="text-white/30">(≤4MB)</span></span>
          <input type="file" name="image" accept="image/*,video/*" required
            className="mt-1 block w-full text-xs text-white/70 file:mr-2 file:rounded-lg file:border file:border-violet-400/50
              file:bg-violet-500/15 file:px-3 file:py-1.5 file:text-violet-200" />
        </label>
        <SubmitButton savedText={t.saved} idleIcon={<Upload className="h-3.5 w-3.5" />}
          className="rounded-lg border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-xs text-violet-200">{t.uploadImage}</SubmitButton>
      </form>

      {/* 画像URL (任意・直接指定したい場合) */}
      <form action={updateRoomImage} className="flex items-end gap-2 border-t border-white/10 px-4 pb-4">
        <input type="hidden" name="room_id" value={room.id} />
        <label className="flex-1 text-[11px] text-white/50">
          <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {t.imageUrlLabel}</span>
          <input type="text" name="image_url" defaultValue={room.image_url ?? ""} placeholder="https://... or /rooms/room-xxx.jpg" className={`${selCls} mt-1 py-2 text-xs`} />
        </label>
        <SubmitButton savedText={t.saved} className="rounded-lg border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-xs text-violet-200">{t.save}</SubmitButton>
      </form>

      {/* ウェルカム / 退室クリーンアップ */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
        <SceneButton slug={room.slug} action="welcome" label={t.welcomeScene} tone="emerald" />
        <SceneButton slug={room.slug} action="away" label={t.checkoutOff} tone="amber" />
      </div>

      {/* ジオフェンス (位置制限) */}
      <form action={updateGeofence} className="border-t border-white/10 p-4">
        <input type="hidden" name="room_id" value={room.id} />
        {/* タイトル + 大きめON/OFFトグル (現在状態を表示) */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/50">📍 {t.geofenceTitle}</p>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="geofence_on" aria-label={t.geofenceEnable} defaultChecked={room.radius > 0} className="peer sr-only" />
            <span className="font-mono text-[10px] tracking-widest text-white/40 peer-checked:hidden">OFF</span>
            <span className="hidden font-mono text-[10px] tracking-widest text-emerald-300 peer-checked:inline">ON</span>
            <span className="relative h-6 w-11 rounded-full bg-white/15 transition-colors peer-checked:bg-emerald-500/70
              after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow
              after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
          </label>
        </div>
        <p className="mb-2 text-[10px] text-white/35">{t.geofenceHint}</p>
        <div className="flex items-end gap-2">
          <input type="text" name="lat" inputMode="decimal" defaultValue={room.lat ?? ""} placeholder="lat 35.0000" className={`${selCls} py-2 text-xs`} />
          <input type="text" name="lng" inputMode="decimal" defaultValue={room.lng ?? ""} placeholder="lng 135.0000" className={`${selCls} py-2 text-xs`} />
          <input type="text" name="radius" inputMode="numeric" defaultValue={room.radius || 150} placeholder="150" className="w-20 rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-center text-xs text-white" />
          <SubmitButton savedText={t.saved} className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-200">{t.save}</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function SceneButton({ slug, action, label, tone }: {
  slug: string; action: "welcome" | "away"; label: string; tone: "emerald" | "amber";
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const run = async () => {
    setBusy(true); setDone(false);
    try {
      await fetch("/api/admin/test-device", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomSlug: slug, action }),
      });
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch { /* ignore */ }
    setBusy(false);
  };
  const cls = tone === "emerald"
    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 active:bg-emerald-500/20"
    : "border-amber-400/40 bg-amber-500/10 text-amber-200 active:bg-amber-500/20";
  const Icon = action === "welcome" ? Home : PowerOff;
  return (
    <button onClick={run} disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs disabled:opacity-50 ${cls}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4 text-emerald-300" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function RoomThumb({ room, size }: { room: Room; size: number }) {
  if (room.image_url) {
    const isVid = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(room.image_url);
    if (isVid) {
      return (
        <video src={room.image_url} width={size} height={size} muted playsInline preload="metadata"
          style={{ width: size, height: size }}
          className="shrink-0 rounded-xl object-cover"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      );
    }
    return (
      <img src={room.image_url} alt={room.display_name} width={size} height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-xl object-cover"
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    );
  }
  return (
    <div style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/30">
      <DoorOpen className="h-1/2 w-1/2" />
    </div>
  );
}

/* ---------------- Device test tab ---------------- */
function DeviceTestSection({ rooms, t }: { rooms: Room[]; t: T }) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2 text-sm text-violet-200">
        <Wrench className="h-4 w-4" /> {t.testTitle}
      </div>
      <p className="mb-4 text-xs text-white/40">{t.testDesc}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rooms.map((room) => (
          <a key={room.id} href={`/admin/test/${room.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100 active:bg-violet-500/20">
            <span className="flex items-center gap-2"><RoomThumb room={room} size={32} />{room.display_name}</span>
            <span className="flex items-center gap-1 text-xs text-violet-300/80">{t.openTest}<ExternalLink className="h-3.5 w-3.5" /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------------- shared ---------------- */
const selCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-white/60">{label}<div className="mt-1">{children}</div></label>;
}

function LangSwitch({ lang, onChange }: { lang: AdminLang; onChange: (l: AdminLang) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs active:scale-95">
        <Globe className="h-4 w-4 text-cyan-300" /> {ADMIN_LANG_LABEL[lang]}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 z-20 mt-2 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c14]/90 backdrop-blur-xl">
            {ADMIN_LANGS.map((l) => (
              <li key={l}>
                <button onClick={() => { onChange(l); setOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-sm ${l === lang ? "text-cyan-300 bg-cyan-500/10" : "text-white/70 hover:bg-white/5"}`}>
                  {ADMIN_LANG_LABEL[l]}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-white/5 text-white/60"}`}>
      {label}
    </button>
  );
}

function ReservationCard({ r, t, lang }: { r: Reservation; t: T; lang: AdminLang }) {
  const [copied, setCopied] = useState(false);
  const active = r.status === "active";
  const copyPin = async () => {
    if (!r.unlock_pin) return;
    await navigator.clipboard.writeText(r.unlock_pin);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border bg-white/[0.04] p-5 backdrop-blur-xl ${active ? "border-white/10" : "border-rose-500/20 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DoorOpen className="h-4 w-4 text-cyan-300" />
            <span className="font-medium">{r.room_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide
              ${active ? "bg-emerald-500/15 text-emerald-300" : r.status === "cancelled" ? "bg-rose-500/15 text-rose-300" : "bg-white/10 text-white/50"}`}>
              {r.status}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{r.source === "ical" ? "Airbnb" : t.manual}</span>
          </div>
          <p className="mt-1.5 text-xs text-white/50">{fmt(r.check_in, lang)} → {fmt(r.check_out, lang)}</p>
          {r.guest_name && <p className="text-xs text-white/40">{r.guest_name}・{r.guest_lang}</p>}
        </div>
        <button onClick={copyPin} className="shrink-0 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-center">
          <div className="flex items-center gap-1 text-[10px] text-cyan-300/70"><KeyRound className="h-3 w-3" /> {t.pin} {copied ? "✓" : ""}</div>
          <div className="font-mono text-2xl tracking-[0.3em] text-cyan-200">{r.unlock_pin ?? "----"}</div>
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {r.airbnb_reservation_url && (
          <a href={r.airbnb_reservation_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
            <ExternalLink className="h-3.5 w-3.5" /> {t.openAirbnb}
          </a>
        )}
        {/* PINを手動設定 (Airbnb推奨コード等) */}
        <form action={setPin} className="flex items-center gap-1">
          <input type="hidden" name="id" value={r.id} />
          <input name="pin" defaultValue={r.unlock_pin ?? ""} inputMode="numeric" maxLength={6}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center font-mono text-xs text-cyan-200" />
          <SubmitButton savedText={t.saved} className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200">{t.save}</SubmitButton>
        </form>
        <form action={regeneratePin}>
          <input type="hidden" name="id" value={r.id} />
          <SubmitButton savedText={t.saved} idleIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
            {t.regenPin}
          </SubmitButton>
        </form>
        {active && (
          <form action={cancelReservation}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton savedText={t.saved} idleIcon={<Ban className="h-3.5 w-3.5" />}
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
              {t.cancel}
            </SubmitButton>
          </form>
        )}
      </div>
    </motion.div>
  );
}
