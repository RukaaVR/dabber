import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
};

export default nextConfig;
