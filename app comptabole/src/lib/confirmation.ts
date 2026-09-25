/** Shared confirmation sequencing: never report completion before an async action settles. */
export async function runConfirmation(
  action: () => void | Promise<void>,
  inFlight: { current: boolean },
  effects: {
    setPending: (pending: boolean) => void;
    setError: (error: boolean) => void;
    close: () => void;
  },
): Promise<"success" | "error" | "busy"> {
  if (inFlight.current) return "busy";
  inFlight.current = true;
  effects.setPending(true);
  effects.setError(false);
  try {
    await action();
    inFlight.current = false;
    effects.setPending(false);
    effects.close();
    return "success";
  } catch {
    inFlight.current = false;
    effects.setPending(false);
    effects.setError(true);
    return "error";
  }
}
