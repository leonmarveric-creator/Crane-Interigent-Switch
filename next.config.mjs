/** @type {import('next').NextConfig} */
const nextConfig = {
  // ゲスト画面の絵・動画・音は 1 週間スマホに置いたまま使う (毎回サーバーへ確認しに行かない)。
  // ※ 同じ名前のまま差し替えると最大 1 週間は古いものが出るので、差し替えるときは名前か ?v= を変える
  async headers() {
    const long = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    return ["/magic-portraits/:path*", "/rooms/:path*", "/audio/:path*", "/magic-seasons/:path*"].map((source) => ({ source, headers: long }));
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
