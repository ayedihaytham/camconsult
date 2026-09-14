const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "!@#$%&*?-_";

/** Génère un mot de passe robuste (par défaut 14 caractères). */
export function generatePassword(length = 14): string {
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () =>
    pick(all),
  );
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join("");
}

export type StrengthLevel = "faible" | "moyen" | "fort" | "excellent";

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  level: StrengthLevel;
}

/** Évalue grossièrement la robustesse d'un mot de passe (front only). */
export function scorePassword(pwd: string): PasswordStrength {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const level: StrengthLevel =
    clamped <= 1
      ? "faible"
      : clamped === 2
        ? "moyen"
        : clamped === 3
          ? "fort"
          : "excellent";
  return { score: clamped, level };
}
