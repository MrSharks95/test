import { describe, expect, it } from "vitest";

import { generateReference } from "@/lib/withdrawal/reference";

describe("generateReference", () => {
  it("matches WR- + 6 unambiguous alphanumerics", () => {
    expect(generateReference()).toMatch(/^WR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("is reasonably unique across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateReference());
    expect(set.size).toBeGreaterThan(995);
  });
});
