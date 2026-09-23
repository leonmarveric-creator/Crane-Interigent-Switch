import type { Metadata, Viewport } from "next";

// スタッフ画面 (お母さん用)。ホーム画面に追加するとアプリのように開ける。
export const metadata: Metadata = {
  title: "Xiaobo 助手",
  applicationName: "Xiaobo 助手",
  robots: { index: false, follow: false },
  // ホーム画面に追加したとき /admin ではなく /staff が開くよう、専用の manifest とアイコンを使う
  manifest: "/staff/manifest.webmanifest",
  icons: {
    icon: [{ url: "/staff/icon-192.png?v=2", sizes: "192x192" }, { url: "/staff/icon.png?v=2", sizes: "512x512" }],
    apple: [{ url: "/staff/apple-touch-icon.png?v=2", sizes: "180x180" }],
    shortcut: "/staff/icon-192.png?v=2",
  },
  appleWebApp: { capable: true, title: "Xiaobo 助手", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#f6efe2" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f6efe2] text-[#3b3228] [color-scheme:light]">{children}</div>;
}
