import { useEffect, useMemo } from "react";
import { Home, Plus, X } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useChoisirSociete, useSocieteActive } from "@/hooks/useSocieteActive";
import { cn } from "@/lib/utils";
import { useDossiersOuverts } from "@/store/dossiersOuverts";
import { useSocietes } from "@/store/data";
import { useUi } from "@/store/ui";

/** Onglets de dossiers de la barre du haut (maquette) : « Cabinet » (toutes les sociétés) et les sociétés ouvertes ; un clic change la société
 * active, la croix ferme l'onglet, « + » ouvre la recherche pour en ouvrir une autre. Aucun droit nouveau : mêmes sociétés que le sélecteur. */
export function DossierTabs() {
  const { canSeeSociete, lectureSeule } = usePermissions();
  const societes = useSocietes();
  const active = useSocieteActive();
  const choisir = useChoisirSociete();
  const ids = useDossiersOuverts((s) => s.ids);
  const ouvrir = useDossiersOuverts((s) => s.ouvrir);
  const fermer = useDossiersOuverts((s) => s.fermer);

  // Toute société rendue active (sélecteur, adresse, palette) devient un onglet.
  useEffect(() => {
    if (active) ouvrir(active.id);
  }, [active, ouvrir]);

  const onglets = useMemo(
    () => ids.map((id) => societes.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => Boolean(s) && canSeeSociete(s!.id)),
    // canSeeSociete change à chaque rendu : la liste ne dépend que des onglets et des sociétés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, societes],
  );

  if (lectureSeule) return null;

  function fermerOnglet(id: string) {
    fermer(id);
    if (active?.id === id) choisir(null);
  }

  return (
    <div role="tablist" aria-label="Dossiers ouverts" className="dossier-tabs">
      <button type="button" role="tab" aria-selected={!active} onClick={() => choisir(null)} className="dossier-tab" data-actif={!active}>
        <Home className="size-4 shrink-0" aria-hidden="true" />
        <span>Cabinet</span>
      </button>
      {onglets.map((s) => {
        const actif = active?.id === s.id;
        return (
          <div key={s.id} className={cn("dossier-tab", "dossier-tab--societe")} data-actif={actif}>
            <button type="button" role="tab" aria-selected={actif} onClick={() => choisir(s.id)} className="dossier-tab__corps" title={s.raisonSociale}>
              <span className="dossier-tab__point" aria-hidden="true" />
              <span className="truncate">{s.raisonSociale}</span>
            </button>
            <button type="button" onClick={() => fermerOnglet(s.id)} className="dossier-tab__fermer" aria-label={`Fermer le dossier ${s.raisonSociale}`}>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => useUi.getState().setPaletteOpen(true)} className="dossier-tab__plus" aria-label="Ouvrir un autre dossier">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
