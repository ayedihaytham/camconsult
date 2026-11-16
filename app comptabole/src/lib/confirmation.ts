/** Shared confirmation sequencing: never report completion before an async action settles. */
export async function runConfirmation(
  action: () => void | Promise<void>,
  inFlight: { current: boolean },
  effects: {
    setPending: (pending: boolean) => void;
    setError: (error: boolean) => void;
    /** Message du serveur à montrer sous la fenêtre (erreur d'API lisible), sinon null : texte générique. */
    setDetail?: (message: string | null) => void;
    close: () => void;
  },
): Promise<"success" | "error" | "busy"> {
  if (inFlight.current) return "busy";
  inFlight.current = true;
  effects.setPending(true);
  effects.setError(false);
  effects.setDetail?.(null);
  try {
    await action();
    inFlight.current = false;
    effects.setPending(false);
    effects.close();
    return "success";
  } catch (err) {
    inFlight.current = false;
    effects.setPending(false);
    effects.setError(true);
    // Une erreur de l'API porte un message en français destiné à l'utilisateur (ex. « Suppression impossible : … »).
    effects.setDetail?.(err instanceof Error && typeof (err as { status?: unknown }).status === "number" ? err.message : null);
    return "error";
  }
}
