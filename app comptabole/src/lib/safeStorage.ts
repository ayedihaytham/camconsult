/**
 * Enveloppe de `localStorage` qui intercepte les erreurs de quota :
 * la donnée en mémoire (zustand) reste correcte, mais on prévient l'utilisateur
 * que la persistance a échoué (fichiers importés trop volumineux, etc.).
 */
let onQuotaError: (() => void) | null = null;
export function registerQuotaHandler(fn: () => void) {
  onQuotaError = fn;
}

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof localStorage === "undefined") return; // env non-navigateur (tests, SSR)
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (isQuota) onQuotaError?.();
      else console.warn("safeLocalStorage.setItem a échoué", err);
    }
  },
  removeItem: (key: string): void => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
