import type { Metadata, Viewport } from "next";

// スタッフ画面 (お母さん用)。ホーム画面に追加するとアプリのように開ける。
export const metadata: Metadata = {
  title: "Xiaobo 助手",
  applicationName: "Xiaobo 助手",
  robots: { index: false, follow: false },
  icons: { icon: "/staff/icon.png", apple: "/staff/icon.png" },
  appleWebApp: { capable: true, title: "Xiaobo 助手", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#f6efe2" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f6efe2] text-[#3b3228] [color-scheme:light]">{children}</div>;
}
