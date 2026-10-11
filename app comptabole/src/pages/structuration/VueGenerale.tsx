import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { anneeDuLibelle } from "@/lib/structurationMois";
import type { Noeud, Societe } from "@/types";
import { SelecteursSocieteAnnee, useGroupeAnnee } from "./useGroupeAnnee";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function contenu(id: string, nodes: Noeud[]): { dossiers: number; fichiers: number } {
  let dossiers = 0;
  let fichiers = 0;
  for (const n of nodes) {
    if (n.parentId !== id) continue;
    if (n.type === "dossier") {
      dossiers += 1;
      const sous = contenu(n.id, nodes);
      dossiers += sous.dossiers;
      fichiers += sous.fichiers;
    } else fichiers += 1;
  }
  return { dossiers, fichiers };
}

function Carte({ titre, detail, onClick, className }: { titre: string; detail: string; onClick?: () => void; className?: string }) {
  const contenuCarte = (
    <>
      <span className="block text-sm font-bold text-foreground">{titre}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </>
  );
  const classes = cn("w-full rounded-lg border border-border border-l-4 border-l-primary bg-card px-3.5 py-2 text-left shadow-sm", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, "hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {contenuCarte}
    </button>
  ) : (
    <div className={classes}>{contenuCarte}</div>
  );
}

/** Vue générale de l'arborescence d'une société : la société, son dossier d'année, puis ses dossiers rangés sur plusieurs lignes
 * (toujours dans la largeur de l'écran), chacun avec son nombre de fichiers. Un clic sur un dossier l'ouvre dans « Documents ». */
export function VueGenerale({ nodes, roots, getSocieteById, onOpenNode, actions }: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  onOpenNode: (n: Noeud) => void;
  /** Boutons de la barre (ajouter une arborescence, instancier pour toutes les sociétés). */
  actions?: ReactNode;
}) {
  const { groupes, groupe, setChoix, annees, annee, setAnneeChoix } = useGroupeAnnee(nodes, roots, getSocieteById);
  const etroit = useMediaQuery("(max-width: 700px)");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <SelecteursSocieteAnnee groupes={groupes} groupe={groupe} onGroupe={setChoix} annees={annees} annee={annee} onAnnee={setAnneeChoix} droite={actions} />
      <div
        className="space-y-8 px-4 py-6"
        style={{ backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.09) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        {(groupe?.roots ?? []).map((root) => {
          const total = contenu(root.id, nodes);
          const annuels = nodes
            .filter((n) => n.parentId === root.id && n.type === "dossier" && (annee === null || (anneeDuLibelle(n.libelle) ?? annee) === annee))
            .sort((a, b) => a.libelle.localeCompare(b.libelle));
          return (
            <div key={root.id} className="flex flex-col items-center">
              <div className="w-60"><Carte titre={root.libelle} detail={`${pluriel(total.dossiers, "dossier")} · ${pluriel(total.fichiers, "fichier")}`} onClick={() => onOpenNode(root)} /></div>
              {annuels.map((annuel) => {
                const dossiers = nodes.filter((n) => n.parentId === annuel.id && n.type === "dossier").sort((a, b) => a.libelle.localeCompare(b.libelle));
                const colonnes = Math.max(1, Math.min(etroit ? 2 : 4, dossiers.length));
                return (
                  <div key={annuel.id} className="flex w-full flex-col items-center">
                    <span className="h-4 w-0.5 bg-primary" aria-hidden="true" />
                    <div className="w-72"><Carte titre={annuel.libelle} detail={pluriel(dossiers.length, "dossier")} onClick={() => onOpenNode(annuel)} /></div>
                    {dossiers.length > 0 && (
                      <>
                        <span className="h-4 w-0.5 bg-primary" aria-hidden="true" />
                        <ul
                          className="relative grid w-full max-w-4xl gap-x-3 gap-y-4 pt-4"
                          style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}
                          aria-label={`Dossiers de ${annuel.libelle}`}
                        >
                          {/* Trait horizontal : du milieu de la première colonne au milieu de la dernière. */}
                          <span
                            className="absolute top-0 h-0.5 bg-primary"
                            style={{ left: `${50 / colonnes}%`, right: `${50 / colonnes}%` }}
                            aria-hidden="true"
                          />
                          {dossiers.map((d) => {
                            const c = contenu(d.id, nodes);
                            return (
                              <li key={d.id} className="relative before:absolute before:-top-4 before:left-1/2 before:h-4 before:w-0.5 before:bg-primary before:content-['']">
                                <Carte titre={d.libelle} detail={pluriel(c.fichiers, "fichier")} onClick={() => onOpenNode(d)} />
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })}
              {annuels.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Aucun dossier pour cette année.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
