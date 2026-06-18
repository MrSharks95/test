/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shopify App Proxy calls our route WITH a trailing slash (/api/proxy/).
  // Next's default 308 trailing-slash redirect uses a relative Location, which
  // the proxy resolves against the shop domain -> 404. Skip it so the route
  // handler serves /api/proxy/ directly.
  skipTrailingSlashRedirect: true,
  // App Bridge requires the embedded app to be framable inside the Shopify admin.
  // Per-route framing headers are set in middleware / route handlers (see Prompt 2+).
  experimental: {
    // Run instrumentation.ts at boot to validate env fail-fast (Next 14).
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
};

export default nextConfig;
