import { describe, expect, it } from "vitest";

import {
  addCounts,
  emptyCounts,
  parseReactionCounts,
  particlesFor,
  subtractOwn,
  sumSince,
  takeBatch,
  totalOf,
} from "./reactions";

const counts = (fire = 0, money = 0, heart = 0, thumbs = 0) => ({ fire, money, heart, thumbs });

describe("parseReactionCounts", () => {
  it("lit les totaux d'un lot", () => {
    expect(parseReactionCounts({ fire: 3, money: 0, heart: 12, thumbs: 1 })).toEqual(counts(3, 0, 12, 1));
  });

  it("accepte des types manquants", () => {
    expect(parseReactionCounts({ heart: 2 })).toEqual(counts(0, 0, 2, 0));
  });

  it("rejette les valeurs invalides et les lots vides", () => {
    expect(parseReactionCounts(undefined)).toBeNull();
    expect(parseReactionCounts("fire")).toBeNull();
    expect(parseReactionCounts({ fire: -1 })).toBeNull();
    expect(parseReactionCounts({ fire: "3" })).toBeNull();
    expect(parseReactionCounts({ fire: Number.NaN })).toBeNull();
    expect(parseReactionCounts(counts())).toBeNull();
  });
});

describe("takeBatch", () => {
  it("plafonne chaque type et garde le reste", () => {
    const { batch, rest } = takeBatch(counts(45, 2, 30, 0), 30);
    expect(batch).toEqual(counts(30, 2, 30, 0));
    expect(rest).toEqual(counts(15, 0, 0, 0));
  });
});

describe("subtractOwn", () => {
  it("retire ses propres réactions des totaux reçus", () => {
    const { others, remainingOwn } = subtractOwn(counts(10, 0, 3, 0), counts(4, 0, 5, 0));
    expect(others).toEqual(counts(6, 0, 0, 0));
    expect(remainingOwn).toEqual(counts(0, 0, 2, 0));
  });
});

describe("particlesFor", () => {
  it("1 émoji par réaction jusqu'à 8", () => {
    expect(particlesFor(0)).toBe(0);
    expect(particlesFor(1)).toBe(1);
    expect(particlesFor(8)).toBe(8);
  });

  it("croît lentement puis plafonne", () => {
    expect(particlesFor(16)).toBe(11);
    expect(particlesFor(64)).toBe(16);
    expect(particlesFor(100_000)).toBe(16);
    expect(particlesFor(5, 3)).toBe(3);
  });
});

describe("compteurs", () => {
  it("additionne et totalise", () => {
    expect(totalOf(addCounts(counts(1, 2, 3, 4), counts(1, 1, 1, 1)))).toBe(14);
  });

  it("somme glissante depuis une date", () => {
    const entries = [
      { at: 1_000, counts: counts(5) },
      { at: 61_000, counts: counts(1, 1) },
      { at: 70_000, counts: counts(0, 0, 2) },
    ];
    expect(sumSince(entries, 60_000)).toEqual(counts(1, 1, 2, 0));
    expect(sumSince([], 0)).toEqual(emptyCounts());
  });
});
