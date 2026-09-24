// Contenu des fichiers (data URL base64) chargé à la demande : les listes
// (chargement initial, Structuration, Messagerie) n'envoient plus que la
// description de chaque fichier, pour ne pas transférer des Mo à chaque
// ouverture de l'app. Mis en cache le temps de la session.
import { api } from "@/lib/api";
import type { Message, Noeud } from "@/types";

const cache = new Map<string, Promise<string | undefined>>();

function charger(cle: string, url: string): Promise<string | undefined> {
  let p = cache.get(cle);
  if (!p) {
    p = api
      .get<{ dataUrl: string }>(url)
      .then((r) => r.dataUrl)
      .catch((err) => {
        cache.delete(cle); // réessayable plus tard
        throw err;
      });
    cache.set(cle, p);
  }
  return p;
}

/** Un fichier de la Structuration a-t-il un contenu téléchargeable ? */
export const noeudADuContenu = (n: Pick<Noeud, "dataUrl" | "aContenu"> | null | undefined) =>
  Boolean(n?.dataUrl || n?.aContenu);

/** Contenu d'un fichier de la Structuration (undefined s'il n'en a pas). */
export async function contenuNoeud(
  n: Pick<Noeud, "id" | "dataUrl" | "aContenu">,
): Promise<string | undefined> {
  if (n.dataUrl) return n.dataUrl;
  if (!n.aContenu) return undefined;
  return charger(`n:${n.id}`, `/noeuds/${n.id}/contenu`);
}

/** Contenu de la pièce jointe d'un message (undefined s'il n'en a pas). */
export async function contenuPieceJointe(
  messageId: string,
  pj: Message["pieceJointe"],
): Promise<string | undefined> {
  if (!pj) return undefined;
  if (pj.dataUrl) return pj.dataUrl;
  if (!pj.aContenu) return undefined;
  return charger(`m:${messageId}`, `/messages/${messageId}/piece-jointe`);
}
