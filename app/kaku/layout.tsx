import type { Metadata, Viewport } from "next";
import "./kaku.css";

// Kaku さん専用のミッション画面。ホーム画面に追加すると AGENT KAKU のアイコンでアプリのように開ける。
export const metadata: Metadata = {
  title: "AGENT KAKU",
  applicationName: "AGENT KAKU",
  robots: { index: false, follow: false },
  manifest: "/kaku/manifest.webmanifest",
  icons: {
    icon: [{ url: "/kaku/icon-192.png?v=1", sizes: "192x192" }, { url: "/kaku/icon.png?v=1", sizes: "512x512" }],
    apple: [{ url: "/kaku/apple-touch-icon.png?v=1", sizes: "180x180" }],
    shortcut: "/kaku/icon-192.png?v=1",
  },
  appleWebApp: { capable: true, title: "AGENT KAKU", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function KakuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
