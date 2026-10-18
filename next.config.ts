import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
