import { describe, expect, it } from "vitest";

import { computeDeadline, createRuleSet } from "@/lib/withdrawal/deadline";
import type { WithdrawalRule } from "@/lib/withdrawal/types";

const RULES: WithdrawalRule[] = [
  { countryCode: "FR", productCategory: "standard", coolingOffDays: 14, isExempt: false, legalRef: "L221-18" },
  { countryCode: "DE", productCategory: "standard", coolingOffDays: 14, isExempt: false, legalRef: "BGB §355" },
  { countryCode: "FR", productCategory: "custom", coolingOffDays: 14, isExempt: true, legalRef: "Sur mesure — exonéré" },
];

const rules = createRuleSet(RULES, "FR");

describe("computeDeadline", () => {
  it("FR standard, recently shipped → within", () => {
    const r = computeDeadline({
      shippedAt: "2026-06-10T10:00:00Z",
      country: "FR",
      category: "standard",
      receivedAt: "2026-06-12T10:00:00Z",
      rules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("within");
    expect(r.deadlineAt?.toISOString()).toBe("2026-06-24T23:59:59.999Z");
    expect(r.refundDeadlineAt?.toISOString()).toBe("2026-06-26T23:59:59.999Z");
    expect(r.legalRef).toBe("L221-18");
  });

  it("DE standard, recently shipped → within", () => {
    const r = computeDeadline({
      shippedAt: "2026-06-15T08:00:00Z",
      country: "DE",
      category: "standard",
      rules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("within");
    expect(r.legalRef).toBe("BGB §355");
  });

  it("exempt category → exempt + legalRef, no deadline", () => {
    const r = computeDeadline({
      shippedAt: "2026-06-10T10:00:00Z",
      country: "FR",
      category: "custom",
      rules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("exempt");
    expect(r.deadlineAt).toBeNull();
    expect(r.legalRef).toBe("Sur mesure — exonéré");
  });

  it("shipped long ago → late", () => {
    const r = computeDeadline({
      shippedAt: "2026-05-01T10:00:00Z",
      country: "FR",
      category: "standard",
      rules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("late");
    expect(r.deadlineAt?.toISOString()).toBe("2026-05-15T23:59:59.999Z");
  });

  it("unknown country with no default rule → fallback 14d, status unknown", () => {
    const fallbackRules = createRuleSet(RULES, "QQ"); // default also has no rule
    const r = computeDeadline({
      shippedAt: "2026-06-10T10:00:00Z",
      country: "ZZ",
      category: "standard",
      rules: fallbackRules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("unknown");
    expect(r.usedFallback).toBe(true);
    expect(r.coolingOffDays).toBe(14);
    expect(r.deadlineAt?.toISOString()).toBe("2026-06-24T23:59:59.999Z");
  });

  it("falls back to shop default country when customer country has no rule", () => {
    const r = computeDeadline({
      shippedAt: "2026-06-15T10:00:00Z",
      country: "BE", // no BE rule → falls back to FR default
      category: "standard",
      rules,
      now: new Date("2026-06-17T00:00:00Z"),
    });
    expect(r.status).toBe("within");
    expect(r.usedFallback).toBe(false);
    expect(r.legalRef).toBe("L221-18");
  });

  it("no ship date → unknown, deadline null", () => {
    const r = computeDeadline({
      shippedAt: null,
      country: "FR",
      category: "standard",
      rules,
    });
    expect(r.status).toBe("unknown");
    expect(r.deadlineAt).toBeNull();
  });
});
