import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/rpc/:path*",
        destination: `${backendUrl}/rpc/:path*`,
      },
      {
        source: "/rpg/:path*",
        destination: `${backendUrl}/rpg/:path*`,
      },
    ];
  },
};

export default nextConfig;
