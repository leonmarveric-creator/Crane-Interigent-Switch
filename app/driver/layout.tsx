import type { Metadata, Viewport } from "next";
import "./driver.css";

// お父さん専用の送迎画面。ホーム画面に追加すると HIROSHI DRIVE のアイコンでアプリのように開ける。
export const metadata: Metadata = {
  title: "HIROSHI DRIVE",
  applicationName: "HIROSHI DRIVE",
  robots: { index: false, follow: false },
  manifest: "/driver/manifest.webmanifest",
  icons: {
    icon: [{ url: "/driver/icon-192.png?v=1", sizes: "192x192" }, { url: "/driver/icon.png?v=1", sizes: "512x512" }],
    apple: [{ url: "/driver/apple-touch-icon.png?v=1", sizes: "180x180" }],
    shortcut: "/driver/icon-192.png?v=1",
  },
  appleWebApp: { capable: true, title: "HIROSHI DRIVE", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#030713", viewportFit: "cover" };

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <div className="drv-root">{children}</div>;
}
