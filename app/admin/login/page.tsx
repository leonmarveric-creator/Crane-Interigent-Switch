"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Fingerprint } from "lucide-react";
import { blip, access, deny, keyTick } from "@/lib/sfx";

const SPIN: React.CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    blip();
    setBusy(true); setErr(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (res.ok) { access(); router.push("/admin"); }
    else { deny(); setErr(true); }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#04060c] text-white flex items-center justify-center px-6">
      {/* 背景HUD */}
      <div className="pointer-events-none absolute inset-0">
        <div className="anim-drift absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/25 blur-[120px]" />
        <div className="anim-drift2 absolute bottom-0 -right-20 h-72 w-72 rounded-full bg-violet-600/20 blur-[110px]" />
        <div className="anim-grid absolute inset-0
          [background-image:linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)]
          [background-size:44px_44px]" />
        <div className="anim-scan absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/15 to-transparent" />
        <svg viewBox="0 0 400 400" className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]">
          <g className="anim-spin-slow" style={SPIN}>
            <circle cx="200" cy="200" r="185" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="2 10" />
            <circle cx="200" cy="200" r="140" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="40 30" />
          </g>
        </svg>
      </div>

      {/* HUDコーナー */}
      <div className="pointer-events-none fixed inset-0">
        <span className="absolute left-3 top-3 h-7 w-7 border-l-2 border-t-2 border-cyan-300/40" />
        <span className="absolute right-3 top-3 h-7 w-7 border-r-2 border-t-2 border-cyan-300/40" />
        <span className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-cyan-300/40" />
        <span className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-cyan-300/40" />
      </div>

      {/* ログインパネル (角カット + 周回光) */}
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="clip-bevel relative z-10 w-full max-w-sm"
        style={{ filter: err ? "drop-shadow(0 0 26px rgba(244,63,94,0.5))" : "drop-shadow(0 0 26px rgba(34,211,238,0.3))" }}
      >
        <span className="clip-bevel pointer-events-none absolute inset-0"
          style={{ background: err ? "rgba(244,63,94,0.3)" : "rgba(34,211,238,0.25)" }} />
        <span className="clip-bevel anim-spin-slow pointer-events-none absolute inset-0"
          style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.85) 16deg, transparent 72deg)" }} />
        <span className="clip-bevel pointer-events-none absolute inset-[1.5px] bg-[#070a12]/95 backdrop-blur-2xl" />

        <div className="relative p-8">
          <span className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t border-cyan-300/50" />
          <span className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t border-cyan-300/50" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-3.5 w-3.5 border-b border-l border-cyan-300/50" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r border-cyan-300/50" />

          <p className="font-mono text-[10px] tracking-[0.35em] text-cyan-400/70">HOST TERMINAL</p>
          <div className="mt-1.5 mb-6 flex items-center gap-2.5">
            {busy
              ? <Fingerprint className="h-5 w-5 animate-pulse text-cyan-300" />
              : <KeyRound className="h-5 w-5 text-cyan-300" />}
            <h1 className="text-lg font-medium tracking-wide">Host Admin</h1>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); if (e.target.value.length > pw.length) keyTick(); }}
            placeholder="Password"
            autoFocus
            className={`clip-bevel-sm w-full border bg-black/50 px-4 py-3 font-mono text-sm
              focus:outline-none ${err ? "border-rose-500/60" : "border-white/15 focus:border-cyan-400/60"}`}
          />
          <div className="mt-3 h-4 font-mono text-[11px] tracking-[0.2em]">
            {err && <span className="anim-alert text-rose-400">ACCESS DENIED · パスワードが違います</span>}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="clip-bevel-sm mt-4 flex w-full items-center justify-center gap-2 border border-cyan-400/50
              bg-cyan-500/15 py-3 text-sm text-cyan-200 active:bg-cyan-500/30 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "AUTHENTICATING…" : "ログイン"}
          </button>
        </div>
      </motion.form>
    </main>
  );
}
