import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ events: [], rollback: false }));
vi.mock("../db.js", () => ({
  withTransaction: async (fn) => {
    const result = await fn({
      query: async () => {
        state.events.push("insert");
        return { rows: [] };
      },
    });
    if (state.rollback) {
      state.events.push("rollback");
      throw new Error("commit refused");
    }
    state.events.push("commit");
    return result;
  },
}));
vi.mock("../sse.js", () => ({
  pushToUser: (key) => state.events.push(`signal:${key}`),
}));
import { withApurementTransaction, notifyInternal } from "./notifications.js";
describe("transactional internal notification signals", () => {
  beforeEach(() => {
    state.events = [];
    state.rollback = false;
  });
  it("signals only after a successful commit", async () => {
    await withApurementTransaction((c) =>
      notifyInternal(c, "company", "Titre", "", ["admin"]),
    );
    expect(state.events).toEqual(["insert", "commit", "signal:admin"]);
  });
  it("does not signal a rolled-back notification", async () => {
    state.rollback = true;
    await expect(
      withApurementTransaction((c) =>
        notifyInternal(c, "company", "Titre", "", ["admin"]),
      ),
    ).rejects.toThrow();
    expect(state.events).toEqual(["insert", "rollback"]);
  });
});
