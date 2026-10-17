export const MF_COMPLET: RegExp;
export function normaliserMatriculeFiscal(valeur: unknown): string;
export function validerMatriculeFiscal(valeur: unknown): { ok: boolean; normalise: string; erreur: string };
