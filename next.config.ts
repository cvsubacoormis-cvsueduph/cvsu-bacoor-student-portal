import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.cvsu.edu.ph https://clerk.cvsu-bacoor.com; style-src 'self' 'unsafe-inline' https://clerk.cvsu-bacoor.com; font-src 'self' data:; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.cvsu-bacoor.com https://api.openweathermap.org; frame-src 'self' https://*.clerk.accounts.dev https://clerk.cvsu-bacoor.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    return [
      {
        // Static download endpoint — immutable, cache for 1 day
        source: "/api/download/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, immutable",
          },
        ],
      },
      {
        // Static files in /public (images, fonts, etc.) — cache for 1 hour. Excludes dashboard pages which use page-level revalidate.
        source: "/((?!api|_next/static|_next/image|favicon.ico|list|admin|student).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // Security headers — applied to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
