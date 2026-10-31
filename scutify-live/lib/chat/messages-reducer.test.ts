import { describe, expect, it } from "vitest";

import { MAX_DOM_MESSAGES } from "./constants";
import { initialMessagesState, messagesReducer, type MessagesState } from "./messages-reducer";
import type { ChatMessage } from "./types";

const base = Date.parse("2026-11-01T18:00:00.000Z");

function msg(n: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${String(n).padStart(4, "0")}`,
    user_id: "u1",
    pseudo: "Marie",
    content: `message ${n}`,
    is_team: false,
    created_at: new Date(base + n * 1000).toISOString(),
    ...overrides,
  };
}

function range(from: number, to: number): ChatMessage[] {
  return Array.from({ length: to - from + 1 }, (_, i) => msg(from + i));
}

const ids = (list: ChatMessage[]) => list.map((m) => m.id);

describe("messagesReducer", () => {
  it("replace sorts chronologically and caps", () => {
    const state = messagesReducer(initialMessagesState, {
      type: "replace",
      messages: [msg(3), msg(1), msg(2)],
    });
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003"]);
  });

  it("append dedupes by id (own message + broadcast echo)", () => {
    let state = messagesReducer(initialMessagesState, { type: "append", messages: [msg(1)] });
    state = messagesReducer(state, { type: "append", messages: [msg(1), msg(2)] });
    expect(ids(state.messages)).toEqual(["m0001", "m0002"]);
  });

  it("inserts out-of-order messages at their chronological position", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: [msg(1), msg(3)] });
    state = messagesReducer(state, { type: "append", messages: [msg(2)] });
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003"]);
  });

  it(`never keeps more than ${MAX_DOM_MESSAGES} rendered messages`, () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 150) });
    state = messagesReducer(state, { type: "append", messages: range(151, 260) });
    expect(state.messages).toHaveLength(MAX_DOM_MESSAGES);
    expect(state.messages[0]?.id).toBe("m0061");
    expect(state.messages.at(-1)?.id).toBe("m0260");
  });

  it("buffers new messages while paused and flushes them on resume", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 3) });
    state = messagesReducer(state, { type: "pause" });
    state = messagesReducer(state, { type: "append", messages: [msg(4), msg(5)] });
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003"]);
    expect(ids(state.pending)).toEqual(["m0004", "m0005"]);

    state = messagesReducer(state, { type: "resume" });
    expect(state.paused).toBe(false);
    expect(state.pending).toHaveLength(0);
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003", "m0004", "m0005"]);
  });

  it("caps the pending buffer too", () => {
    let state: MessagesState = messagesReducer(initialMessagesState, { type: "pause" });
    state = messagesReducer(state, { type: "append", messages: range(1, 500) });
    expect(state.pending).toHaveLength(MAX_DOM_MESSAGES);
    state = messagesReducer(state, { type: "resume" });
    expect(state.messages).toHaveLength(MAX_DOM_MESSAGES);
    expect(state.messages.at(-1)?.id).toBe("m0500");
  });

  it("remove deletes from rendered and pending lists", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 3) });
    state = messagesReducer(state, { type: "pause" });
    state = messagesReducer(state, { type: "append", messages: [msg(4)] });
    state = messagesReducer(state, { type: "remove", ids: ["m0002", "m0004"] });
    expect(ids(state.messages)).toEqual(["m0001", "m0003"]);
    expect(state.pending).toHaveLength(0);
  });

  it("remove of unknown ids keeps the same state object", () => {
    const state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 3) });
    expect(messagesReducer(state, { type: "remove", ids: ["nope"] })).toBe(state);
  });

  it("clear empties everything", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 3) });
    state = messagesReducer(state, { type: "clear" });
    expect(state.messages).toHaveLength(0);
  });

  it("reconcile adds missed messages and drops those deleted during the outage", () => {
    // Local : 1..10. Pendant la coupure : 6 et 8 supprimés, 11..12 envoyés.
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 10) });
    const server = [msg(4), msg(5), msg(7), msg(9), msg(10), msg(11), msg(12)];
    state = messagesReducer(state, { type: "reconcile", messages: server });
    // 1..3 sont hors de la fenêtre serveur : conservés tels quels.
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003", "m0004", "m0005", "m0007", "m0009", "m0010", "m0011", "m0012"]);
  });

  it("reconcile with an empty server window clears the chat (cleared during outage)", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 5) });
    state = messagesReducer(state, { type: "reconcile", messages: [] });
    expect(state.messages).toHaveLength(0);
  });

  it("reconcile keeps local messages newer than a (cached) snapshot", () => {
    // Instantané généré à t=5 (cache CDN) : 6 et 7 sont arrivés en direct depuis.
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 7) });
    state = messagesReducer(state, {
      type: "reconcile",
      messages: [msg(1), msg(2), msg(4), msg(5)],
      until: base + 5500,
    });
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0004", "m0005", "m0006", "m0007"]);
  });

  it("reconcile with an empty snapshot only clears messages older than it", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 5) });
    state = messagesReducer(state, { type: "reconcile", messages: [], until: base + 3500 });
    expect(ids(state.messages)).toEqual(["m0004", "m0005"]);
  });

  it("reconcile while paused routes missed messages to pending", () => {
    let state = messagesReducer(initialMessagesState, { type: "replace", messages: range(1, 3) });
    state = messagesReducer(state, { type: "pause" });
    state = messagesReducer(state, { type: "reconcile", messages: range(1, 5) });
    expect(ids(state.messages)).toEqual(["m0001", "m0002", "m0003"]);
    expect(ids(state.pending)).toEqual(["m0004", "m0005"]);
  });
});
