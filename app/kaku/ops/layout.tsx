import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "K-OPS · AGENT KAKU",
  robots: { index: false, follow: false },
  manifest: "/kaku/manifest.webmanifest",
  icons: { apple: [{ url: "/kaku/apple-touch-icon.png?v=1", sizes: "180x180" }] },
  appleWebApp: { capable: true, title: "K-OPS", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function KOpsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
