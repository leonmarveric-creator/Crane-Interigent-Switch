"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (res.ok) router.push("/admin");
    else setErr(true);
  };

  return (
    <main className="min-h-dvh bg-[#05060a] text-white flex items-center justify-center px-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-cyan-300" />
          <h1 className="text-lg font-medium tracking-wide">Host Admin</h1>
        </div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm
            focus:border-cyan-400/60 focus:outline-none"
        />
        {err && <p className="mt-3 text-xs text-rose-400">パスワードが違います</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/50
            bg-cyan-500/15 py-3 text-sm text-cyan-200 active:bg-cyan-500/30"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} ログイン
        </button>
      </motion.form>
    </main>
  );
}
