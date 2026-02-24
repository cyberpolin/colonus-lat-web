import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@colonus/shared", "@colonus/sync"],
};

export default nextConfig;
