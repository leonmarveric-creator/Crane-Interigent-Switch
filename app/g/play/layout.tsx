import type { Viewport } from "next";
import "../../cabin/cabin.css";

export const metadata = { title: "CRANE NEST · Guide", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#02050d", viewportFit: "cover", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export default function L({ children }: { children: React.ReactNode }) { return <>{children}</>; }
