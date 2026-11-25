import type { Metadata } from "next";

// お父さん専用「今日の送迎」。ホーム画面に追加すると、いつもの HIROSHI DRIVE とは別のアイコン (送迎 GO) で、このページが開く
export const metadata: Metadata = {
  title: "送迎 GO · HIROSHI DRIVE",
  manifest: "/driver/go.webmanifest",
  appleWebApp: { capable: true, title: "送迎 GO", statusBarStyle: "black-translucent" },
};

export default function DriverGoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
