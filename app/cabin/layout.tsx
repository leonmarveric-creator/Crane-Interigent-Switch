import type { Metadata, Viewport } from "next";
import "./cabin.css";

// 車内 iPad (お客さん用の画面)。ホーム画面に追加すると全画面で開ける。
export const metadata: Metadata = {
  title: "CRANE NEST DRIVE",
  applicationName: "CRANE NEST DRIVE",
  robots: { index: false, follow: false },
  manifest: "/cabin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CRANE NEST", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#02050d", viewportFit: "cover", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function CabinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
