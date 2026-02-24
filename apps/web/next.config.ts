import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@colonus/shared", "@colonus/sync"],
  async rewrites() {
    return [
      { source: "/app", destination: "/" },
      { source: "/app/:path*", destination: "/:path*" }
    ];
  }
};

export default nextConfig;
