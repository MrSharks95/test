import { describe, expect, it } from "vitest";

import {
  buildItemsHtml,
  escapeHtml,
  formatDate,
  interpolate,
  localeForCountry,
} from "@/lib/email/render";
import { pickTemplate } from "@/lib/email/templates";

describe("interpolate", () => {
  it("replaces known variables", () => {
    expect(interpolate("Réf {{reference}} pour {{customer_name}}", {
      reference: "WR-ABC123",
      customer_name: "Marie",
    })).toBe("Réf WR-ABC123 pour Marie");
  });

  it("tolerates spaces in the placeholder and drops unknown keys", () => {
    expect(interpolate("{{ reference }}/{{missing}}", { reference: "X" })).toBe("X/");
  });
});

describe("buildItemsHtml", () => {
  it("renders a list and escapes titles", () => {
    const html = buildItemsHtml(
      [{ title: "T-shirt <M>", quantity: 2 }],
      "fr",
    );
    expect(html).toBe("<ul><li>T-shirt &lt;M&gt; × 2</li></ul>");
  });

  it("handles empty items per locale", () => {
    expect(buildItemsHtml([], "en")).toContain("No item specified");
  });
});

describe("formatDate", () => {
  it("formats in UTC for the locale", () => {
    const d = new Date("2026-06-17T08:00:00Z");
    expect(formatDate(d, "fr")).toBe("17 juin 2026");
    expect(formatDate(d, "en")).toBe("17 June 2026");
  });
});

describe("localeForCountry", () => {
  it("maps FR-speaking countries to fr, others to en, null to fr", () => {
    expect(localeForCountry("FR")).toBe("fr");
    expect(localeForCountry("BE")).toBe("fr");
    expect(localeForCountry("DE")).toBe("en");
    expect(localeForCountry(null)).toBe("fr");
  });
});

describe("pickTemplate", () => {
  it("falls back to defaults when no override", () => {
    expect(pickTemplate(null, "fr").subject).toContain("{{reference}}");
  });

  it("uses merchant override when present, falls back per field", () => {
    const t = pickTemplate({ subject_fr: "Bonjour {{reference}}" }, "fr");
    expect(t.subject).toBe("Bonjour {{reference}}");
    expect(t.body).toContain("{{items}}"); // body still default
  });
});

describe("escapeHtml", () => {
  it("escapes the dangerous characters", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});
