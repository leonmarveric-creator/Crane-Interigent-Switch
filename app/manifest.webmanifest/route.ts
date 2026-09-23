import { NextResponse } from "next/server";

// Android/Chrome の「ホーム画面に追加」用の既定 manifest (/manifest.webmanifest)。
//  - ゲスト操作画面では AddToHomePrompt が現在の部屋URL用 manifest に差し替える。
//  - スタッフ画面 (/staff) は app/staff/layout.tsx で /staff/manifest.webmanifest を使う。
//  ※ app/manifest.ts (ファイル規約) だと全ページで固定されて上書きできないため、ルートで返す。
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      name: "Crane Switch",
      short_name: "Crane",
      start_url: "/",
      display: "standalone",
      background_color: "#05060a",
      theme_color: "#05060a",
      icons: [
        { src: "/icon-512.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
