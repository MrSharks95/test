import { describe, expect, it } from "vitest";

import { mapCategoryFromTags, mapOrderCategory } from "@/lib/withdrawal/category";

describe("mapCategoryFromTags", () => {
  it("defaults to standard with no matching tags", () => {
    expect(mapCategoryFromTags(["sale", "new"])).toBe("standard");
  });

  it("maps a known tag (case-insensitive)", () => {
    expect(mapCategoryFromTags(["Perishable"])).toBe("perishable");
    expect(mapCategoryFromTags(["sur-mesure"])).toBe("custom");
  });

  it("prefers an exemption over standard", () => {
    expect(mapCategoryFromTags(["new", "custom"])).toBe("custom");
  });

  it("honours a custom mapping", () => {
    expect(
      mapCategoryFromTags(["fleurs"], { fleurs: "perishable" }),
    ).toBe("perishable");
  });
});

describe("mapOrderCategory", () => {
  it("returns the most restrictive category across products", () => {
    expect(
      mapOrderCategory([["new"], ["custom"], ["sale"]]),
    ).toBe("custom");
  });

  it("returns standard when nothing matches", () => {
    expect(mapOrderCategory([["a"], ["b"]])).toBe("standard");
  });
});
