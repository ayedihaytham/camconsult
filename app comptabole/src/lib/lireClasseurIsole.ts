import { ClasseurRefuse } from "./fichierImport";
import type { FeuilleSimple } from "./extraireClasseur";
import type { ReponseClasseur } from "./classeurWorker";

/** Délai PROVISOIRE de lecture, en millisecondes (à confirmer d'après des classeurs réels). */
export const DELAI_LECTURE_MS = 20_000;

/** Ce que le service attend d'un travailleur (permet de le simuler en test). */
export interface TravailleurLecture {
  postMessage(message: unknown, transfert?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<ReponseClasseur>) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessageerror: ((e: unknown) => void) | null;
}

const creerParDefaut = (): TravailleurLecture =>
  new Worker(new URL("./classeurWorker.ts", import.meta.url), { type: "module" }) as unknown as TravailleurLecture;

let enCours: { annuler: () => void } | null = null;

/**
 * Lit un classeur dans un travailleur jetable : une lecture à la fois, délai strict (`terminate()`), nettoyage dans tous les cas.
 * LIMITE : le délai borne la durée, pas la mémoire consommée avant son expiration ; les bornes de zipLimites.ts et de extraireClasseur.ts
 * réduisent ce risque sans l'éliminer, et un travailleur épuisé par la mémoire s'arrête seul (traité comme une erreur).
 */
export function lireClasseurIsole(
  donnees: ArrayBuffer,
  options: { cellDates?: boolean; delaiMs?: number; creer?: () => TravailleurLecture } = {},
): { promesse: Promise<FeuilleSimple[]>; annuler: () => void } {
  if (enCours) throw new ClasseurRefuse("Une lecture de classeur est déjà en cours.");
  const travailleur = (options.creer ?? creerParDefaut)();
  let termine = false;
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let rejeter: (e: Error) => void = () => undefined;

  const finir = () => {
    if (termine) return false;
    termine = true;
    clearTimeout(minuterie);
    travailleur.onmessage = travailleur.onerror = travailleur.onmessageerror = null;
    travailleur.terminate();
    enCours = null;
    return true;
  };
  const promesse = new Promise<FeuilleSimple[]>((resolve, reject) => {
    rejeter = reject;
    travailleur.onmessage = (e) => {
      if (!finir()) return;
      const r = e.data;
      if (r.ok) resolve(r.feuilles);
      else reject(new ClasseurRefuse(r.code === "limite" ? "Classeur trop grand (trop de feuilles, de lignes ou de cellules) — fichier refusé." : "Fichier illisible — export Excel (.xlsx) ou CSV attendu."));
    };
    const echec = () => {
      if (finir()) reject(new ClasseurRefuse("Fichier illisible ou trop complexe — lecture interrompue."));
    };
    travailleur.onerror = echec;
    travailleur.onmessageerror = echec;
    minuterie = setTimeout(() => {
      if (finir()) reject(new ClasseurRefuse("Lecture interrompue : le fichier est trop complexe."));
    }, options.delaiMs ?? DELAI_LECTURE_MS);
    travailleur.postMessage({ donnees, cellDates: options.cellDates ?? true }, [donnees]);
  });
  enCours = { annuler: () => finir() && rejeter(new ClasseurRefuse("Lecture annulée.")) };
  return { promesse, annuler: () => enCours?.annuler() };
}
