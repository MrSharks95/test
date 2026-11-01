import { describe, expect, it } from "vitest";

import { activeQuickReplies } from "./relance";

const now = Date.parse("2026-11-02T20:30:00.000Z");

describe("activeQuickReplies", () => {
  it("returns the replies while the relance is running", () => {
    expect(
      activeQuickReplies({ quick_replies: ["OUI 🔥", "Chaud !"], quick_replies_until: "2026-11-02T20:30:45.000Z" }, now),
    ).toEqual(["OUI 🔥", "Chaud !"]);
  });

  it("returns nothing once expired, stopped or empty", () => {
    expect(activeQuickReplies({ quick_replies: ["OUI"], quick_replies_until: "2026-11-02T20:29:59.000Z" }, now)).toEqual([]);
    expect(activeQuickReplies({ quick_replies: null, quick_replies_until: null }, now)).toEqual([]);
    expect(activeQuickReplies({ quick_replies: [], quick_replies_until: "2026-11-02T20:31:00.000Z" }, now)).toEqual([]);
    expect(activeQuickReplies(null, now)).toEqual([]);
  });

  it("keeps at most 4 non-empty replies", () => {
    expect(
      activeQuickReplies({ quick_replies: ["a", " ", "b", "c", "d", "e"], quick_replies_until: "2026-11-02T20:31:00.000Z" }, now),
    ).toEqual(["a", "b", "c", "d"]);
  });
});
