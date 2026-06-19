"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Copy, Check, Download, RefreshCw, Ban, LogOut, DoorOpen, KeyRound,
  QrCode, Globe, ExternalLink,
} from "lucide-react";
import { LANGS, LANG_LABEL } from "@/lib/i18n";
import {
  AT, ADMIN_LANGS, ADMIN_LANG_LABEL, isAdminLang, type AdminLang,
} from "@/lib/adminI18n";
import { addReservation, cancelReservation, regeneratePin, assignDevices } from "./actions";

export interface Room {
  id: string; slug: string; display_name: string; is_active: boolean;
  ac_device_id: string | null; light_device_id: string | null;
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

const LOCALE: Record<AdminLang, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN" };
const fmt = (iso: string, lang: AdminLang) =>
  new Date(iso).toLocaleString(LOCALE[lang], {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

export default function AdminClient({
  rooms, reservations, switchbot,
}: { rooms: Room[]; reservations: Reservation[]; switchbot: SwitchBotInfo }) {
  const [lang, setLang] = useState<AdminLang>("ja");
  const [filter, setFilter] = useState<string>("all");
  const t = AT[lang];

  useEffect(() => {
    const saved = localStorage.getItem("adminLang");
    if (isAdminLang(saved)) setLang(saved);
  }, []);
  const changeLang = (l: AdminLang) => { setLang(l); localStorage.setItem("adminLang", l); };

  const shown = useMemo(
    () => reservations.filter((r) => filter === "all" || r.room_slug === filter),
    [reservations, filter]
  );

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

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">{t.dashboard}</p>
            <h1 className="mt-1 text-2xl font-semibold">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch lang={lang} onChange={changeLang} />
            <button onClick={logout}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs active:scale-95">
              <LogOut className="h-4 w-4" /> {t.logout}
            </button>
          </div>
        </header>

        {/* 印刷用 固定QR */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-cyan-200">
            <QrCode className="h-4 w-4" /> {t.doorQrTitle}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {rooms.map((r) => <RoomQrCard key={r.id} r={r} />)}
          </div>
        </section>

        {/* デバイス割り当て */}
        <DeviceAssignSection rooms={rooms} info={switchbot} t={t} />

        {/* 予約追加フォーム */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-200">
            <Plus className="h-4 w-4" /> {t.addTitle}
          </div>
          <form action={addReservation} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/60">
              {t.room}
              <select name="room_id" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.display_name}（{r.slug}）</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/60">
              {t.language}
              <select name="guest_lang" defaultValue="en"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]">
                {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              {t.checkIn}
              <input type="datetime-local" name="check_in" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="text-xs text-white/60">
              {t.checkOut}
              <input type="datetime-local" name="check_out" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="text-xs text-white/60">
              {t.guestName}（{t.optional}）
              <input type="text" name="guest_name" placeholder="—"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" />
            </label>
            <label className="text-xs text-white/60">
              {t.pinField}
              <input type="text" name="unlock_pin" inputMode="numeric" placeholder={t.autoPlaceholder} maxLength={6}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white font-mono" />
            </label>
            <button type="submit"
              className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/50
                bg-emerald-500/15 py-3 text-sm text-emerald-200 active:bg-emerald-500/30">
              <Plus className="h-4 w-4" /> {t.addButton}
            </button>
          </form>
        </section>

        {/* フィルタ */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t.all} />
          {rooms.map((r) => (
            <FilterChip key={r.id} active={filter === r.slug}
              onClick={() => setFilter(r.slug)} label={r.display_name} />
          ))}
        </div>

        {/* 予約カード */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((r) => <ReservationCard key={r.id} r={r} t={t} lang={lang} />)}
          {shown.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-white/40">{t.noReservations}</p>
          )}
        </div>
      </div>
    </main>
  );
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
          <motion.ul
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
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

type T = (typeof AT)["ja"];

function DeviceAssignSection({ rooms, info, t }: { rooms: Room[]; info: SwitchBotInfo; t: T }) {
  const ir = info.infraredRemoteList ?? [];
  const acs = ir.filter((d) => /air\s*conditioner/i.test(d.remoteType));
  const lights = ir.filter((d) => /light/i.test(d.remoteType));

  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-cyan-200">
        <KeyRound className="h-4 w-4" /> {t.assignTitle}
      </div>
      <p className="mb-4 text-xs text-white/40">{t.assignDesc}</p>

      {info.error ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {info.error}{t.switchbotEnvNote}
        </p>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <RoomAssignRow key={room.id} room={room} acs={acs} lights={lights} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function RoomAssignRow({
  room, acs, lights, t,
}: {
  room: Room;
  acs: { deviceId: string; deviceName: string }[];
  lights: { deviceId: string; deviceName: string }[];
  t: T;
}) {
  const opt = (d: { deviceId: string; deviceName: string }) => (
    <option key={d.deviceId} value={d.deviceId}>{d.deviceName || d.deviceId}</option>
  );
  return (
    <form action={assignDevices}
      className="grid grid-cols-1 items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <input type="hidden" name="room_id" value={room.id} />
      <div className="text-sm font-medium text-white/80">{room.display_name}</div>
      <label className="text-[11px] text-white/50">
        {t.ac}
        <select name="ac" defaultValue={room.ac_device_id ?? ""}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white [color-scheme:dark]">
          <option value="">{t.none}</option>
          {acs.map(opt)}
        </select>
      </label>
      <label className="text-[11px] text-white/50">
        {t.light}
        <select name="light" defaultValue={room.light_device_id ?? ""}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white [color-scheme:dark]">
          <option value="">{t.none}</option>
          {lights.map(opt)}
        </select>
      </label>
      <button type="submit"
        className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-xs text-emerald-200 active:bg-emerald-500/30">
        {t.save}
      </button>
    </form>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition
        ${active ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-white/5 text-white/60"}`}>
      {label}
    </button>
  );
}

function RoomQrCard({ r }: { r: Room }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(r.url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-xl">
      <img src={r.qr} alt={`QR ${r.slug}`} className="mx-auto w-full max-w-[140px] rounded-xl bg-white p-1.5" />
      <p className="mt-2 truncate text-xs text-white/70">{r.display_name}</p>
      <div className="mt-2 flex justify-center gap-2">
        <button onClick={copy} className="text-white/50 hover:text-cyan-300" title="URL">
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        </button>
        <a href={r.qr} download={`qr-${r.slug}.png`} className="text-white/50 hover:text-white" title="QR">
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
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
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border bg-white/[0.04] p-5 backdrop-blur-xl
        ${active ? "border-white/10" : "border-rose-500/20 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DoorOpen className="h-4 w-4 text-cyan-300" />
            <span className="font-medium">{r.room_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide
              ${active ? "bg-emerald-500/15 text-emerald-300"
                : r.status === "cancelled" ? "bg-rose-500/15 text-rose-300"
                : "bg-white/10 text-white/50"}`}>
              {r.status}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
              {r.source === "ical" ? "Airbnb" : t.manual}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-white/50">{fmt(r.check_in, lang)} → {fmt(r.check_out, lang)}</p>
          {r.guest_name && <p className="text-xs text-white/40">{r.guest_name}・{r.guest_lang}</p>}
        </div>

        <button onClick={copyPin}
          className="shrink-0 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-center">
          <div className="flex items-center gap-1 text-[10px] text-cyan-300/70">
            <KeyRound className="h-3 w-3" /> {t.pin} {copied ? "✓" : ""}
          </div>
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
        <form action={regeneratePin}>
          <input type="hidden" name="id" value={r.id} />
          <button type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
            <RefreshCw className="h-3.5 w-3.5" /> {t.regenPin}
          </button>
        </form>
        {active && (
          <form action={cancelReservation}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
              <Ban className="h-3.5 w-3.5" /> {t.cancel}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
