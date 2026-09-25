import { describe, expect, it, vi } from "vitest";
import { runConfirmation } from "./confirmation";

describe("runConfirmation", () => {
  it("stays pending and prevents duplicate submissions until async success", async () => {
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const inFlight = { current: false };
    const setPending = vi.fn();
    const setError = vi.fn();
    const close = vi.fn();
    const first = runConfirmation(action, inFlight, { setPending, setError, close });
    expect(inFlight.current).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(await runConfirmation(action, inFlight, { setPending, setError, close })).toBe("busy");
    expect(action).toHaveBeenCalledTimes(1);
    resolve();
    expect(await first).toBe("success");
    expect(inFlight.current).toBe(false);
    expect(setPending.mock.calls).toEqual([[true], [false]]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open on rejection and permits retry", async () => {
    const inFlight = { current: false };
    const setPending = vi.fn();
    const setError = vi.fn();
    const close = vi.fn();
    const effects = { setPending, setError, close };
    expect(await runConfirmation(() => Promise.reject(new Error("network")), inFlight, effects)).toBe("error");
    expect(close).not.toHaveBeenCalled();
    expect(setError).toHaveBeenLastCalledWith(true);
    expect(await runConfirmation(() => undefined, inFlight, effects)).toBe("success");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
