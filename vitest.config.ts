import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Neutralize `server-only` so server modules can run under Node/Vitest.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    // env.ts validates the whole server environment at import — provide valid
    // dummy values so importing any server module under test succeeds.
    env: {
      SHOPIFY_API_KEY: "test_key",
      SHOPIFY_API_SECRET: "test_secret",
      SHOPIFY_SCOPES: "read_orders,write_orders,read_customers",
      SHOPIFY_APP_URL: "http://localhost:3000",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "test_service_role",
      RESEND_API_KEY: "test_resend",
      RESEND_FROM: "EU Withdrawal <noreply@example.com>",
      // 32 zero bytes, base64.
      APP_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
  },
});
