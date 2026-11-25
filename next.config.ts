import type { NextConfig } from "next";

// Note: npm scripts launch Next through scripts/run-next.cjs, which preloads a small fs shim so the
// project also builds on filesystems without symlink support (e.g. exFAT drives).

const isProd = process.env.NODE_ENV === "production";

// CSP lives in proxy.ts, where a per-request nonce is generated — script-src has no 'unsafe-inline'.

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "thumb.wikimedia.org" },
    ],
  },
  poweredByHeader: false,
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      // Voice input in the concierge uses the microphone; "near me" features may use location.
      { key: "Permissions-Policy", value: "camera=(), payment=(), usb=(), microphone=(self), geolocation=(self)" },
      ...(isProd && process.env.COOKIE_SECURE === "true" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
    ];
    return [
      { source: "/:path*", headers: security },
      // The public API is meant to be called from other origins.
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, X-Api-Key, Content-Type" },
          { key: "Access-Control-Expose-Headers", value: "X-RateLimit-Limit, X-RateLimit-Remaining" },
        ],
      },
    ];
  },
};

export default nextConfig;
