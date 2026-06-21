/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 部屋アートの画像アップロード用にServer Actionの上限を引き上げ (既定1MB→8MB)
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
