import { NextRequest, NextResponse } from "next/server";

function safeStartUrl(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("start") || "/";
  try {
    const parsed = new URL(raw, req.nextUrl.origin);
    if (parsed.origin !== req.nextUrl.origin) return "/";

    const path = `${parsed.pathname}${parsed.search}`;
    if (path.startsWith("/room/") || path.startsWith("/admin/test/")) return path;
  } catch {
    /* noop */
  }
  return "/";
}

function safeName(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("name")?.trim();
  if (!raw) return "Crane Switch";
  return raw.replace(/\s+/g, " ").slice(0, 40);
}

export function GET(req: NextRequest) {
  const name = safeName(req);

  return NextResponse.json(
    {
      name: `${name} Crane Switch`,
      short_name: name,
      start_url: safeStartUrl(req),
      scope: "/",
      display: "standalone",
      background_color: "#f7f4ed",
      theme_color: "#05060a",
      icons: [
        { src: "/icon-512.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
