import type { NextConfig } from "next";
import { browserCacheControl, CLIENT_CACHE_CONFIG } from "./src/config/site";

const cacheHeaders = (policy: { maxAge: number; staleWhileRevalidate: number }) => [
  { key: "Cache-Control", value: browserCacheControl(policy) },
];

const BASE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb", "pdfkit", "mailtrap"],
  outputFileTracingIncludes: {
    "/api/source-view": ["./src/assets/fonts/*.ttf"],
  },
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    staleTimes: CLIENT_CACHE_CONFIG.routerStaleSeconds,
  },
  async headers() {
    return [
      { source: "/widget.js", headers: cacheHeaders(CLIENT_CACHE_CONFIG.widget) },
      { source: "/logo.svg", headers: cacheHeaders(CLIENT_CACHE_CONFIG.brand) },
      { source: "/logo-wordmark.svg", headers: cacheHeaders(CLIENT_CACHE_CONFIG.brand) },
      {
        source: "/embed",
        headers: [
          ...BASE_SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        source: "/((?!embed$).*)",
        headers: [
          ...BASE_SECURITY_HEADERS,
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
