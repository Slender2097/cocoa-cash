import type { NextConfig } from "next";

// Security headers. The wallet keeps bearer ecash in this origin's storage, so
// injected script must not run and wallet pages must not be framed. Mints and
// Nostr relays are chosen by the user, so connect-src allows any https/wss
// host. Only /tip is meant to be embedded (an iframe on creators' sites).
const dev = process.env.NODE_ENV !== "production";

const csp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    // next dev needs eval (fast refresh) and loads the analytics debug script from Vercel's CDN
    `script-src 'self'${dev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}`,
    "style-src 'self' 'unsafe-inline'", // styled-jsx, next/image and the QR scanner set inline styles
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https: wss:${dev ? " http: ws:" : ""}`, // user-chosen mints and relays (dev: local mints, HMR)
    "media-src 'self' blob: mediastream:", // QR scanner camera preview
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: false,
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp("'none'") },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
      // Legacy anti-framing for the pages that hold or show the wallet. Not on /tip.
      ...["/", "/creator", "/privacy", "/terms"].map((source) => ({
        source,
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      })),
      // The tip widget is embedded anywhere. A later rule replaces the same header key.
      { source: "/tip", headers: [{ key: "Content-Security-Policy", value: csp("*") }] },
    ];
  },
};

export default nextConfig;
