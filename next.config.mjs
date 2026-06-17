/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App Bridge requires the embedded app to be framable inside the Shopify admin.
  // Per-route framing headers are set in middleware / route handlers (see Prompt 2+).
  experimental: {
    // Run instrumentation.ts at boot to validate env fail-fast (Next 14).
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
};

export default nextConfig;
