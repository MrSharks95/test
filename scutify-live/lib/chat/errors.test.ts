import { describe, expect, it } from "vitest";

import { parseChatError } from "./errors";

describe("parseChatError", () => {
  it("keeps the French message of known SQL errors", () => {
    expect(parseChatError({ message: "Le chat est fermé pour le moment.", hint: "chat_closed", code: "P0001" })).toEqual({
      kind: "chat_closed",
      message: "Le chat est fermé pour le moment.",
    });
  });

  it("extracts the retry delay of slow mode errors", () => {
    expect(
      parseChatError({
        message: "Doucement ! Attends encore 7 s avant ton prochain message.",
        hint: "slow_mode",
        details: "7",
        code: "P0001",
      }),
    ).toMatchObject({ kind: "slow_mode", retryAfter: 7 });
  });

  it("maps network failures", () => {
    expect(parseChatError({ message: "TypeError: Failed to fetch" }).kind).toBe("network");
  });

  it("hides unknown technical errors", () => {
    expect(parseChatError({ message: 'relation "x" does not exist', code: "42P01" })).toEqual({
      kind: "unknown",
      message: "Une erreur est survenue. Réessaie.",
    });
  });
});
