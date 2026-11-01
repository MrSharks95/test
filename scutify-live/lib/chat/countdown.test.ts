import { describe, expect, it } from "vitest";

import { countdownParts, formatStartDate, pad2, parseStartsAt, toDateTimeLocal } from "./countdown";

const START = Date.parse("2026-11-02T19:00:00Z"); // lundi 2 novembre, 20h00 à Paris

describe("countdownParts", () => {
  it("découpe le temps restant", () => {
    const now = START - (1 * 86_400 + 2 * 3_600 + 3 * 60 + 4) * 1000;
    expect(countdownParts(START, now)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4, done: false });
  });

  it("arrondit à la seconde supérieure (jamais 0 avant l'heure)", () => {
    expect(countdownParts(START, START - 200)).toMatchObject({ seconds: 1, done: false });
  });

  it("s'arrête à zéro à l'heure et après", () => {
    expect(countdownParts(START, START)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
    expect(countdownParts(START, START + 60_000).done).toBe(true);
  });
});

describe("dates", () => {
  it("lit une date ISO ou rien", () => {
    expect(parseStartsAt("2026-11-02T19:00:00+00:00")).toBe(START);
    expect(parseStartsAt(null)).toBeNull();
    expect(parseStartsAt("pas une date")).toBeNull();
  });

  it("affiche l'heure de Paris", () => {
    expect(formatStartDate(START)).toBe("Lundi 2 novembre à 20h00");
  });

  it("format datetime-local aller-retour", () => {
    const value = toDateTimeLocal(START);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(value).getTime()).toBe(START);
    expect(pad2(7)).toBe("07");
  });
});
