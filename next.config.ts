import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    // Only proxy backend routes that are not handled by Next.js app/api/*
    return [
      {
        source: "/api/simulation/:path*",
        destination: `${backendUrl}/api/simulation/:path*`,
      },
      {
        source: "/api/analytics/:path*",
        destination: `${backendUrl}/api/analytics/:path*`,
      },
      {
        source: "/api/audit/:path*",
        destination: `${backendUrl}/api/audit/:path*`,
      },
      {
        source: "/api/verification/:path*",
        destination: `${backendUrl}/api/verification/:path*`,
      },
      {
        source: "/api/network/:path*",
        destination: `${backendUrl}/api/network/:path*`,
      },
      {
        source: "/api/reputation/:path*",
        destination: `${backendUrl}/api/reputation/:path*`,
      },
      {
        source: "/api/director/:path*",
        destination: `${backendUrl}/api/director/:path*`,
      },
      {
        source: "/api/agents/:path*",
        destination: `${backendUrl}/api/agents/:path*`,
      },
      {
        source: "/api/health",
        destination: `${backendUrl}/api/health`,
      },
    ];
  },
};

export default nextConfig;
