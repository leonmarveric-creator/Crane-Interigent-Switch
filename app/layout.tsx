import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Crane Switch",
  applicationName: "Crane Switch",
  robots: { index: false, follow: false }, // ゲストURLを検索除外
  manifest: "/manifest.webmanifest",
  // ホーム画面追加用アイコン (public/icon-512.png を置く)
  icons: {
    icon: "/icon-512.png",
    shortcut: "/icon-512.png",
    apple: "/icon-512.png",
  },
  // iOS「ホーム画面に追加」時のラベル・全画面表示
  appleWebApp: {
    capable: true,
    title: "Crane Switch",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // モバイルでのズーム抑制 (操作UI崩れ防止)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
