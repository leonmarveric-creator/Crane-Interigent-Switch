"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Copy, Check, Download, RefreshCw, Ban, LogOut, DoorOpen, KeyRound, QrCode,
} from "lucide-react";
import { LANGS, LANG_LABEL } from "@/lib/i18n";
import { addReservation, cancelReservation, regeneratePin } from "./actions";

export interface Room {
  id: string; slug: string; display_name: string; is_active: boolean;
  url: string; qr: string;
}
export interface Reservation {
  id: string; room_name: string; room_slug: string;
  source: "ical" | "manual"; status: "active" | "cancelled" | "completed";
  guest_name: string | null; guest_lang: string;
  check_in: string; check_out: string;
  unlock_pin: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

export default function AdminClient({
  rooms, reservations,
}: { rooms: Room[]; reservations: Reservation[] }) {
  const [filter, setFilter] = useState<string>("all");

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
            <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-400/70">HOST DASHBOARD</p>
            <h1 className="mt-1 text-2xl font-semibold">部屋QR ＆ 予約管理</h1>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs active:scale-95">
            <LogOut className="h-4 w-4" /> ログアウト
          </button>
        </header>

        {/* 印刷用 固定QR (ドアに貼る) */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-cyan-200">
            <QrCode className="h-4 w-4" /> ドア用 固定QR（印刷して各部屋の入口に貼る）
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {rooms.map((r) => <RoomQrCard key={r.id} r={r} />)}
          </div>
        </section>

        {/* 予約追加フォーム */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-200">
            <Plus className="h-4 w-4" /> 手動で予約を追加（PIN自動発行）
          </div>
          <form action={addReservation} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/60">
              部屋
              <select name="room_id" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.display_name}（{r.slug}）</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/60">
              言語
              <select name="guest_lang" defaultValue="en"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]">
                {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              チェックイン（日本時間）
              <input type="datetime-local" name="check_in" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="text-xs text-white/60">
              チェックアウト（日本時間）
              <input type="datetime-local" name="check_out" required
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="text-xs text-white/60">
              ゲスト名（任意）
              <input type="text" name="guest_name" placeholder="—"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" />
            </label>
            <label className="text-xs text-white/60">
              PIN（任意・空なら自動4桁）
              <input type="text" name="unlock_pin" inputMode="numeric" placeholder="自動" maxLength={6}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white font-mono" />
            </label>
            <button type="submit"
              className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/50
                bg-emerald-500/15 py-3 text-sm text-emerald-200 active:bg-emerald-500/30">
              <Plus className="h-4 w-4" /> 予約を追加してPINを発行
            </button>
          </form>
        </section>

        {/* フィルタ */}
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="すべて" />
          {rooms.map((r) => (
            <FilterChip key={r.id} active={filter === r.slug}
              onClick={() => setFilter(r.slug)} label={r.display_name} />
          ))}
        </div>

        {/* 予約カード */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((r) => <ReservationCard key={r.id} r={r} />)}
          {shown.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-white/40">予約がありません</p>
          )}
        </div>
      </div>
    </main>
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
        <button onClick={copy} className="text-white/50 hover:text-cyan-300" title="URLコピー">
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        </button>
        <a href={r.qr} download={`qr-${r.slug}.png`} className="text-white/50 hover:text-white" title="QR保存">
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function ReservationCard({ r }: { r: Reservation }) {
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
              {r.source === "ical" ? "Airbnb" : "手動"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-white/50">{fmt(r.check_in)} → {fmt(r.check_out)}</p>
          {r.guest_name && <p className="text-xs text-white/40">{r.guest_name}・{r.guest_lang}</p>}
        </div>

        {/* PIN (ゲストに送る数字) */}
        <button onClick={copyPin}
          className="shrink-0 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-center">
          <div className="flex items-center gap-1 text-[10px] text-cyan-300/70">
            <KeyRound className="h-3 w-3" /> PIN {copied ? "✓" : ""}
          </div>
          <div className="font-mono text-2xl tracking-[0.3em] text-cyan-200">{r.unlock_pin ?? "----"}</div>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={regeneratePin}>
          <input type="hidden" name="id" value={r.id} />
          <button type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
            <RefreshCw className="h-3.5 w-3.5" /> PIN再発行
          </button>
        </form>
        {active && (
          <form action={cancelReservation}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
              <Ban className="h-3.5 w-3.5" /> キャンセル
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
