import { canSeeSociete } from "./auth.js";

/** Cabinet documents retain their restriction when moved or duplicated. */
export function canReadNoeud(session, node) {
  return (
    canSeeSociete(session, node.societe_id) &&
    (!node.cabinet_only ||
      (session.role !== "societe_employe" &&
        session.poste !== "societe_employe"))
  );
}
