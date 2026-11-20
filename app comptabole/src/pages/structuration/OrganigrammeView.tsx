import { useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { anneeDuLibelle, comptesParMois, fichiersDuMois, MOIS_COMPLETS } from "@/lib/structurationMois";
import type { Noeud, Societe } from "@/types";
import { SelecteursSocieteAnnee, useGroupeAnnee } from "./useGroupeAnnee";
import "./structuration-armoire.css";

/**
 * Organigramme d'UNE société à la fois (sélecteur en haut) : un schéma de gauche à droite, Société → Armoire (le dossier de l'année) → Tiroirs.
 * Chaque tiroir porte sa jauge et son nombre de fichiers ; un clic sur un tiroir affiche à droite ses douze mois (un fichier est rangé sous le mois
 * de sa date d'ajout), puis les fichiers du mois choisi, sans quitter le schéma.
 */
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function countDescendants(id: string, nodes: Noeud[]): { dossiers: number; fichiers: number } {
  let dossiers = 0;
  let fichiers = 0;
  for (const n of nodes) {
    if (n.parentId !== id) continue;
    if (n.type === "dossier") {
      dossiers += 1;
      const sub = countDescendants(n.id, nodes);
      dossiers += sub.dossiers;
      fichiers += sub.fichiers;
    } else {
      fichiers += 1;
    }
  }
  return { dossiers, fichiers };
}

function fileIcon(format: string | undefined) {
  const f = (format ?? "").toLowerCase();
  if (/^(xlsx?|csv|ods)$/.test(f)) return FileSpreadsheet;
  if (/^(png|jpe?g|gif|webp|svg)$/.test(f)) return ImageIcon;
  return FileText;
}

interface Armoire {
  root: Noeud;
  annuel: Noeud;
  annee: number | null;
  tiroirs: { dossier: Noeud; fichiers: number }[];
}

export function OrganigrammeView({
  nodes,
  roots,
  getSocieteById,
  onOpenNode,
  onDeposer,
  actions,
}: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  onOpenNode: (n: Noeud) => void;
  /** Dépose des fichiers dans un tiroir (sans fichiers : ouvre le choix de fichiers) ; absent, le bouton « Déposer » n'est pas proposé. */
  onDeposer?: (dossier: Noeud, fichiers?: File[]) => void;
  /** Boutons de la barre (ajouter une arborescence, instancier pour toutes les sociétés). */
  actions?: ReactNode;
}) {
  // Un organigramme par société (choisie en haut) plutôt que toutes côte à côte : chaque schéma reste lisible.
  const { groupes, groupe, setChoix, annees, annee, setAnneeChoix, sansArborescence } = useGroupeAnnee(nodes, roots, getSocieteById);
  const [tiroirId, setTiroirId] = useState<string | null>(null);
  const [mois, setMois] = useState<number | null>(null);

  const armoires: Armoire[] = useMemo(
    () =>
      (groupe?.roots ?? []).flatMap((root) =>
        nodes
          .filter((n) => n.parentId === root.id && n.type === "dossier" && (annee === null || (anneeDuLibelle(n.libelle) ?? annee) === annee))
          .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { numeric: true }))
          .map((annuel) => ({
            root,
            annuel,
            annee: annee ?? anneeDuLibelle(annuel.libelle),
            tiroirs: nodes
              .filter((n) => n.parentId === annuel.id && n.type === "dossier")
              .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { numeric: true }))
              .map((dossier) => ({ dossier, fichiers: countDescendants(dossier.id, nodes).fichiers })),
          })),
      ),
    [groupe, nodes, annee],
  );

  // Tiroir affiché à droite : celui que l'on a cliqué ; sinon le premier qui contient des fichiers, ou le premier de la liste.
  const tous = armoires.flatMap((a) => a.tiroirs.map((t) => ({ ...t, armoire: a })));
  const choisi = tous.find((t) => t.dossier.id === tiroirId) ?? tous.find((t) => t.fichiers > 0) ?? tous[0] ?? null;
  const comptes = useMemo(() => (choisi ? comptesParMois(choisi.dossier.id, nodes, choisi.armoire.annee) : new Array<number>(12).fill(0)), [choisi, nodes]);
  const fichiersDuChoix = choisi && mois !== null ? fichiersDuMois(choisi.dossier.id, nodes, choisi.armoire.annee, mois) : [];
  const maintenant = new Date();
  const maxFichiers = Math.max(1, ...tous.map((t) => t.fichiers));
  const maxMois = Math.max(1, ...comptes);

  const reinitialiser = () => {
    setTiroirId(null);
    setMois(null);
  };

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-[14px] border border-primary/10 bg-card shadow-[0_1px_2px_hsl(var(--primary)/0.05),0_12px_32px_-18px_hsl(var(--primary)/0.18)]">
      <div className="struct-bande border-b border-border">
        <SelecteursSocieteAnnee
          groupes={groupes}
          groupe={groupe}
          onGroupe={(cle) => {
            setChoix(cle);
            reinitialiser();
          }}
          annees={annees}
          annee={annee}
          onAnnee={(a) => {
            setAnneeChoix(a);
            reinitialiser();
          }}
          droite={actions}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 overflow-x-auto bg-[#F6F7FA] px-4 py-5 lg:px-7 lg:py-7">
          {sansArborescence && <p className="py-3 text-sm text-muted-foreground">La société active n'a pas encore d'arborescence : choisissez une autre société ou créez-en une.</p>}
          {armoires.map(({ root, annuel, tiroirs }) => {
            const societe = getSocieteById(root.societeId);
            const { dossiers, fichiers } = countDescendants(root.id, nodes);
            const totalArmoire = tiroirs.reduce((t, x) => t + x.fichiers, 0);
            return (
              <div key={annuel.id} className="struct-schema">
                <div className="struct-schema__niveaux">
                  <button type="button" onClick={() => onOpenNode(root)} className="struct-boite struct-boite--societe focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Ouvrir le dossier de la société">
                    <span className="struct-boite__eb">Société</span>
                    <b>{root.libelle}</b>
                    <small>{societe ? `${societe.code} · ${societe.theme}` : `${pluriel(dossiers, "dossier")} · ${pluriel(fichiers, "fichier")}`}</small>
                  </button>
                  <span className="struct-lien" aria-hidden="true" />
                  <button type="button" onClick={() => onOpenNode(annuel)} className="struct-boite struct-boite--armoire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Ouvrir l'armoire">
                    <span className="struct-boite__eb">Armoire</span>
                    <b>{annuel.libelle}</b>
                    <small>{pluriel(tiroirs.length, "tiroir")} · {pluriel(totalArmoire, "fichier")}</small>
                  </button>
                  <span className="struct-lien struct-lien--branche" aria-hidden="true" />
                </div>
                {tiroirs.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Aucun tiroir : ajoutez des dossiers à ce dossier d'année.</p>
                ) : (
                  <ul className="struct-tiroirs-schema" aria-label={`Tiroirs de ${annuel.libelle}`}>
                    {tiroirs.map(({ dossier, fichiers: nb }) => {
                      const actif = choisi?.dossier.id === dossier.id;
                      return (
                        <li key={dossier.id}>
                          <button
                            type="button"
                            aria-pressed={actif}
                            aria-label={`Tiroir ${dossier.libelle}, ${pluriel(nb, "fichier")}`}
                            onClick={() => {
                              setTiroirId(dossier.id);
                              setMois(null);
                            }}
                            onDoubleClick={() => onOpenNode(dossier)}
                            className={cn("struct-carte-tiroir focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", actif && "is-actif")}
                          >
                            <span className="struct-carte-tiroir__nom">{dossier.libelle}</span>
                            <i className="struct-carte-tiroir__jauge" aria-hidden="true">
                              <b style={{ width: `${Math.round((nb / maxFichiers) * 100)}%` }} />
                            </i>
                            <span className={cn("struct-carte-tiroir__nb", nb === 0 && "is-zero")}>{nb}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {armoires.length === 0 && !sansArborescence && <p className="py-3 text-sm text-muted-foreground">Aucun dossier pour cette année.</p>}
        </div>

        <aside aria-label="Détail du tiroir" className="min-h-0 border-t border-border bg-card lg:border-l lg:border-t-0">
          {choisi ? (
            <>
              <div className="border-b border-border px-5 pb-3 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tiroir</p>
                <h3 className="struct-titre text-xl leading-tight text-primary">{choisi.dossier.libelle}</h3>
                <p className="text-xs text-muted-foreground">{pluriel(choisi.fichiers, "fichier")} · {choisi.armoire.annuel.libelle}</p>
              </div>
              <ul className="px-5 py-1.5" aria-label={`Mois de ${choisi.dossier.libelle}`}>
                {MOIS_COMPLETS.map((nom, i) => {
                  const n = comptes[i];
                  const actuel = choisi.armoire.annee === maintenant.getFullYear() && i === maintenant.getMonth();
                  return (
                    <li key={nom}>
                      <button
                        type="button"
                        aria-pressed={mois === i}
                        title={`${nom} : ${pluriel(n, "fichier")}`}
                        aria-label={`${nom} : ${pluriel(n, "fichier")}`}
                        onClick={() => setMois(i)}
                        className={cn("struct-mois focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mois === i && "is-actif", actuel && "is-courant")}
                      >
                        <span className="struct-mois__nom">{nom}</span>
                        <i className="struct-mois__jauge" aria-hidden="true">
                          <b style={{ width: `${Math.round((n / maxMois) * 100)}%` }} />
                        </i>
                        <span className={cn("struct-mois__nb", n === 0 && "is-zero")}>{n === 0 ? "Aucun" : pluriel(n, "fichier")}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {mois !== null && (
                <div className="border-t border-border px-5 py-3" aria-label="Fichiers du mois" role="region">
                  <h4 className="text-sm font-bold text-primary">
                    {choisi.dossier.libelle} · {MOIS_COMPLETS[mois]}{choisi.armoire.annee ? ` ${choisi.armoire.annee}` : ""}
                  </h4>
                  {fichiersDuChoix.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Aucun fichier ce mois-ci.</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-border text-sm">
                      {fichiersDuChoix.map((f) => {
                        const Icone = fileIcon(f.format);
                        return (
                          <li key={f.id} className="flex items-center gap-2 py-1.5">
                            <Icone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0 break-words">{f.libelle}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3.5">
                {onDeposer && (
                  <Button type="button" variant="ledger" size="sm" className="flex-1" aria-label={`Déposer dans ${choisi.dossier.libelle}`} onClick={() => onDeposer(choisi.dossier)}>
                    <Plus className="size-4" aria-hidden="true" /> Déposer dans {choisi.dossier.libelle}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenNode(choisi.dossier)}>
                  Ouvrir le dossier
                </Button>
              </div>
            </>
          ) : (
            <p className="px-5 py-5 text-sm text-muted-foreground">Choisissez un tiroir pour voir ses mois et ses fichiers ici, sans quitter le schéma.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
