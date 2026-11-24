import type { ReactNode } from "react";

/** En-tête numéroté d'une étape (1 Déposer, 2 Choisir, 3 Vérifier) : même gabarit dans les deux sens de conversion. */
export function EtapeEntete({ numero, titre, aide, droite }: { numero: number; titre: string; aide?: string; droite?: ReactNode }) {
  return (
    <div className="conv-etape">
      <span className="conv-etape__num" aria-hidden="true">{numero}</span>
      <div className="min-w-0 flex-1">
        <h2 className="conv-etape__titre">{titre}</h2>
        {aide && <p className="conv-etape__aide">{aide}</p>}
      </div>
      {droite}
    </div>
  );
}
