import { describe, expect, it } from "vitest";

import { isSafeHttpUrl, linkify } from "./linkify";

describe("linkify", () => {
  it("returns plain text untouched", () => {
    expect(linkify("Bonjour à tous")).toEqual([{ type: "text", value: "Bonjour à tous" }]);
  });

  it("extracts http(s) links and strips trailing punctuation", () => {
    expect(linkify("Va sur https://www.scutify-club.com/offers/ym7bNY2K/checkout, merci !")).toEqual([
      { type: "text", value: "Va sur " },
      {
        type: "link",
        value: "https://www.scutify-club.com/offers/ym7bNY2K/checkout",
        href: "https://www.scutify-club.com/offers/ym7bNY2K/checkout",
      },
      { type: "text", value: ", merci !" },
    ]);
  });

  it("never turns javascript: into a link", () => {
    expect(linkify("javascript:alert(1)")).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
  });
});

describe("isSafeHttpUrl", () => {
  it.each([
    ["https://scutify.fr", true],
    ["http://scutify.fr", true],
    ["javascript:alert(1)", false],
    ["data:text/html,<b>x</b>", false],
    ["not a url", false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(isSafeHttpUrl(input)).toBe(expected);
  });
});
