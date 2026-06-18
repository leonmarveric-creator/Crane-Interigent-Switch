"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { T, type Lang } from "@/lib/i18n";

export default function AccessDenied({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#05060a] text-white flex items-center justify-center px-6">
      {/* 走査線グリッド */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]
        [background-image:linear-gradient(#f43f5e_1px,transparent_1px),linear-gradient(90deg,#f43f5e_1px,transparent_1px)]
        [background-size:40px_40px]" />
      {/* 赤いグロー */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2
        rounded-full bg-rose-600/30 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm rounded-3xl border border-rose-500/30
          bg-white/5 p-8 text-center backdrop-blur-xl
          shadow-[0_0_60px_-15px_rgba(244,63,94,0.6)]"
      >
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full
            border border-rose-500/50 bg-rose-500/10"
        >
          <ShieldAlert className="h-10 w-10 text-rose-400" strokeWidth={1.5} />
        </motion.div>
        <h1 className="text-2xl font-semibold tracking-wide text-rose-300">
          {t.accessDenied}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          {t.accessDeniedDesc}
        </p>
        <div className="mt-6 font-mono text-[10px] tracking-[0.3em] text-rose-400/50">
          ERR · 403 · TOKEN_INVALID
        </div>
      </motion.div>
    </main>
  );
}
