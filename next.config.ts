import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse 2.x is ESM-only — exclude from Turbopack/webpack bundling
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [],
  },
  // Allow serving uploaded files from /public/uploads
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
