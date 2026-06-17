import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  verifyOAuthHmac,
  verifyProxySignature,
  verifyWebhookHmac,
} from "@/lib/shopify/hmac";

const SECRET = "test_secret"; // matches vitest.config.ts test env

describe("verifyOAuthHmac", () => {
  function sign(params: Record<string, string>): URLSearchParams {
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const hmac = crypto
      .createHmac("sha256", SECRET)
      .update(message)
      .digest("hex");
    return new URLSearchParams({ ...params, hmac });
  }

  it("accepts a correctly signed callback", () => {
    expect(
      verifyOAuthHmac(sign({ shop: "demo.myshopify.com", code: "abc" })),
    ).toBe(true);
  });

  it("rejects a tampered param", () => {
    const sp = sign({ shop: "demo.myshopify.com", code: "abc" });
    sp.set("code", "tampered");
    expect(verifyOAuthHmac(sp)).toBe(false);
  });

  it("rejects when hmac is missing", () => {
    expect(verifyOAuthHmac(new URLSearchParams({ shop: "x" }))).toBe(false);
  });
});

describe("verifyProxySignature", () => {
  // App Proxy format: key=value sorted, joined with NO separator, hex digest.
  function sign(params: Record<string, string>): URLSearchParams {
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("");
    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(message)
      .digest("hex");
    return new URLSearchParams({ ...params, signature });
  }

  it("accepts a correctly signed proxy request", () => {
    expect(
      verifyProxySignature(
        sign({ shop: "demo.myshopify.com", path_prefix: "/apps/retractation", timestamp: "123" }),
      ),
    ).toBe(true);
  });

  it("rejects a tampered param", () => {
    const sp = sign({ shop: "demo.myshopify.com", timestamp: "123" });
    sp.set("shop", "evil.myshopify.com");
    expect(verifyProxySignature(sp)).toBe(false);
  });

  it("rejects when signature is missing", () => {
    expect(verifyProxySignature(new URLSearchParams({ shop: "x" }))).toBe(false);
  });
});

describe("verifyWebhookHmac", () => {
  const body = JSON.stringify({ shop_domain: "demo.myshopify.com" });
  const header = crypto
    .createHmac("sha256", SECRET)
    .update(body, "utf8")
    .digest("base64");

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookHmac(body, header)).toBe(true);
  });

  it("rejects a modified body", () => {
    expect(verifyWebhookHmac(body + " ", header)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookHmac(body, null)).toBe(false);
  });
});
