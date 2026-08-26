import type { MetadataRoute } from "next";

// Android/Chrome の「ホーム画面に追加」用の既定 manifest。
// ゲスト操作画面では AddToHomePrompt が現在の部屋URL用 manifest に差し替える。
export default function manifest(): MetadataRoute.Manifest {
  return {
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
  };
}
