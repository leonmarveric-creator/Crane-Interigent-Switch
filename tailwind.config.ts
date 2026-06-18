import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  // 動的に生成されうるネオン色を保険でセーフリスト化
  safelist: [
    "text-cyan-300", "text-emerald-300", "text-amber-300", "text-violet-300",
    "border-cyan-400/40", "border-emerald-400/40", "border-amber-400/40",
  ],
  plugins: [],
} satisfies Config;
