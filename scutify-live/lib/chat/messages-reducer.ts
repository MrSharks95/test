import { MAX_DOM_MESSAGES } from "./constants";
import type { ChatMessage } from "./types";

/**
 * État du fil :
 * - `messages` : ce qui est rendu (≤ MAX_DOM_MESSAGES, ordre chronologique) ;
 * - `pending`  : messages arrivés pendant que l'utilisateur a remonté le fil
 *                (rendus seulement quand il revient en bas → le fil ne
 *                « saute » pas pendant la lecture et le DOM reste plafonné) ;
 * - `paused`   : l'utilisateur n'est plus en bas du fil.
 */
export type MessagesState = {
  messages: ChatMessage[];
  pending: ChatMessage[];
  paused: boolean;
};

export type MessagesAction =
  | { type: "replace"; messages: ChatMessage[] }
  | {
      type: "reconcile";
      messages: ChatMessage[];
      /**
       * Horodatage (ms) de l'instantané serveur. Les messages locaux plus
       * récents sont conservés (instantané potentiellement en cache CDN).
       */
      until?: number;
    }
  | { type: "append"; messages: ChatMessage[] }
  | { type: "remove"; ids: readonly string[] }
  | { type: "clear" }
  | { type: "pause" }
  | { type: "resume" };

export const initialMessagesState: MessagesState = { messages: [], pending: [], paused: false };

function time(message: ChatMessage): number {
  const t = Date.parse(message.created_at);
  return Number.isNaN(t) ? 0 : t;
}

function compare(a: ChatMessage, b: ChatMessage): number {
  return time(a) - time(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Insère en conservant l'ordre chronologique (cas courant : ajout en fin). */
function insertSorted(list: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const result = list.slice();
  for (const message of incoming) {
    const last = result[result.length - 1];
    if (!last || compare(message, last) >= 0) {
      result.push(message);
      continue;
    }
    let index = result.length - 1;
    while (index > 0 && compare(message, result[index - 1] as ChatMessage) < 0) index -= 1;
    result.splice(index, 0, message);
  }
  return result;
}

function cap(list: ChatMessage[]): ChatMessage[] {
  return list.length > MAX_DOM_MESSAGES ? list.slice(list.length - MAX_DOM_MESSAGES) : list;
}

function dedupe(state: MessagesState, incoming: readonly ChatMessage[]): ChatMessage[] {
  const known = new Set<string>();
  for (const m of state.messages) known.add(m.id);
  for (const m of state.pending) known.add(m.id);
  const fresh: ChatMessage[] = [];
  for (const m of incoming) {
    if (known.has(m.id)) continue;
    known.add(m.id);
    fresh.push(m);
  }
  return fresh;
}

function add(state: MessagesState, incoming: readonly ChatMessage[]): MessagesState {
  const fresh = dedupe(state, incoming);
  if (fresh.length === 0) return state;
  if (state.paused) return { ...state, pending: cap(insertSorted(state.pending, fresh)) };
  return { ...state, messages: cap(insertSorted(state.messages, fresh)) };
}

export function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case "replace":
      return {
        messages: cap(insertSorted([], action.messages.slice().sort(compare))),
        pending: [],
        paused: false,
      };

    case "append":
      return add(state, action.messages);

    case "reconcile": {
      // Après une reconnexion : `action.messages` = les N derniers messages
      // côté serveur. Dans la fenêtre [plus ancien reçu, until], tout message
      // local absent de l'instantané a été supprimé pendant la coupure.
      const fetched = action.messages.slice().sort(compare);
      const first = fetched[0];
      const last = fetched[fetched.length - 1];
      const lower = first ? time(first) : Number.NEGATIVE_INFINITY;
      const upper = action.until ?? (last ? time(last) : Number.POSITIVE_INFINITY);
      const fetchedIds = new Set(fetched.map((m) => m.id));
      const keep = (m: ChatMessage) => {
        const t = time(m);
        return t < lower || t > upper || fetchedIds.has(m.id);
      };
      const kept: MessagesState = {
        ...state,
        messages: state.messages.filter(keep),
        pending: state.pending.filter(keep),
      };
      return add(kept, fetched);
    }

    case "remove": {
      if (action.ids.length === 0) return state;
      const ids = new Set(action.ids);
      const messages = state.messages.filter((m) => !ids.has(m.id));
      const pending = state.pending.filter((m) => !ids.has(m.id));
      if (messages.length === state.messages.length && pending.length === state.pending.length) return state;
      return { ...state, messages, pending };
    }

    case "clear":
      return { ...state, messages: [], pending: [] };

    case "pause":
      return state.paused ? state : { ...state, paused: true };

    case "resume":
      if (!state.paused && state.pending.length === 0) return state;
      return {
        messages: cap(insertSorted(state.messages, state.pending)),
        pending: [],
        paused: false,
      };
  }
}
