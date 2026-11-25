import type { NextConfig } from "next";

/**
 * Two deployment shapes are supported:
 * 1. Split origins (app.example.ng + api.example.ng): set NEXT_PUBLIC_API_URL to the API's URL.
 * 2. Single origin (Docker, Codespaces, one domain): leave NEXT_PUBLIC_API_URL empty and set
 *    API_PROXY_TARGET (build time) to the API's internal URL; requests to /api, /sanctum and /storage
 *    are proxied, so cookies are first-party on whatever public URL serves the app.
 */
const proxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const apiHost = new URL(apiUrl);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  images: proxyTarget
    ? // Photos come from the app's own origin via the proxy; skip the optimiser's host allow-list.
      { unoptimized: true }
    : {
        remotePatterns: [
          {
            protocol: apiHost.protocol.replace(":", "") as "http" | "https",
            hostname: apiHost.hostname,
            port: apiHost.port,
            pathname: "/storage/**",
          },
        ],
      },
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      { source: "/api/v1/:path*", destination: `${proxyTarget}/api/v1/:path*` },
      { source: "/sanctum/:path*", destination: `${proxyTarget}/sanctum/:path*` },
      { source: "/storage/:path*", destination: `${proxyTarget}/storage/:path*` },
      { source: "/docs/api/:path*", destination: `${proxyTarget}/docs/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
