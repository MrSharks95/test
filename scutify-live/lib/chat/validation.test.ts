import { describe, expect, it } from "vitest";

import { cleanText, validateEmail, validatePseudo } from "./validation";

describe("cleanText", () => {
  it("collapses whitespace and strips invisible characters", () => {
    expect(cleanText("  Bonjour \n\n à​   tous\t ")).toBe("Bonjour à tous");
  });
});

describe("validatePseudo", () => {
  it.each(["Marie", "Jean-Éric", "Zoé_75", "D'Artagnan", "Œdipe roi"])("accepts %s", (pseudo) => {
    expect(validatePseudo(pseudo)).toBeNull();
  });

  it.each(["a", "   b   ", "x".repeat(21), "<script>", "emoji 🚀"])("rejects %s", (pseudo) => {
    expect(validatePseudo(pseudo)).not.toBeNull();
  });
});

describe("validateEmail", () => {
  it("accepts a regular address", () => {
    expect(validateEmail(" marie@example.com ")).toBeNull();
  });

  it.each(["marie", "marie@", "marie@example", "a b@example.com"])("rejects %s", (email) => {
    expect(validateEmail(email)).not.toBeNull();
  });
});
