/** @type {import('next').NextConfig} */
const nextConfig = {
  // ゲスト画面の絵・動画・音は 1 週間スマホに置いたまま使う (毎回サーバーへ確認しに行かない)。
  // ※ 同じ名前のまま差し替えると最大 1 週間は古いものが出るので、差し替えるときは名前か ?v= を変える
  async headers() {
    const long = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    // 地球儀の写真・国の形・国の声 (?v= つきで呼ぶので、中身を変えたら v が変わる) → 1 年
    const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    // ウェルカム演出のページ: 1 日は確認なしで使い、そのあとも裏で新しくする (ゲストが 2 回目に開いたときは一瞬)
    const page = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      ...["/magic-portraits/:path*", "/rooms/:path*", "/audio/:path*", "/magic-seasons/:path*"].map((source) => ({ source, headers: long })),
      ...["/cabin/air/tex/:path*", "/cabin/air/geo/:path*", "/cabin/air/vo/:path*"].map((source) => ({ source, headers: forever })),
      ...["/cabin/air/welcome.html", "/cabin/air/welcome-wafu.html", "/cabin/air/welcome-magic.html"].map((source) => ({ source, headers: page })),
    ];
  },
  experimental: {
    // 部屋アートの画像/動画アップロード用にServer Actionの上限を引き上げ。
    // Vercelのserverless関数リクエスト上限は4.5MBのため、それに合わせる。
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
