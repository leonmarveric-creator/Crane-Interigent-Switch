/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 部屋アートの画像/動画アップロード用にServer Actionの上限を引き上げ。
    // Vercelのserverless関数リクエスト上限は4.5MBのため、それに合わせる。
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
