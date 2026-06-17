import { describe, expect, it } from "vitest";

import { decrypt, encrypt } from "@/lib/shopify/crypto";

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a value", () => {
    const token = "shpat_0123456789abcdef";
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("uses the iv:tag:ciphertext format", () => {
    expect(encrypt("x").split(":")).toHaveLength(3);
  });

  it("rejects a tampered ciphertext (auth tag)", () => {
    const enc = encrypt("secret");
    const [iv, tag, data] = enc.split(":") as [string, string, string];
    const flipped = data.slice(0, -1) + (data.endsWith("0") ? "1" : "0");
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt("not-valid")).toThrow();
  });
});
