import { useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, FolderTree, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THEME_BAR } from "@/lib/societeTheme";
import { anneeDuLibelle, comptesParMois, fichiersDuMois, MOIS_COMPLETS, MOIS_COURTS } from "@/lib/structurationMois";
import type { Noeud, Societe } from "@/types";
import { SelecteursSocieteAnnee, useGroupeAnnee } from "./useGroupeAnnee";

/**
 * Organigramme d'UNE société à la fois (sélecteur en haut) : un arbre vertical qui tient toujours dans la largeur de l'écran.
 * Société, puis année, puis une ligne par dossier avec ses 12 mois sur la même ligne (un fichier est rangé sous le mois de sa
 * date d'ajout). Un clic sur un mois affiche ses fichiers dans le volet de droite, sans quitter le schéma ni faire défiler la page.
 */
const GENERIC_BAR = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

interface MoisChoisi {
  node: Noeud;
  mois: number;
  annee: number | null;
}

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

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function fileIcon(format: string | undefined) {
  const f = (format ?? "").toLowerCase();
  if (/^(xlsx?|csv|ods)$/.test(f)) return FileSpreadsheet;
  if (/^(png|jpe?g|gif|webp|svg)$/.test(f)) return ImageIcon;
  return FileText;
}

export function OrganigrammeView({
  nodes,
  roots,
  getSocieteById,
  onOpenNode,
  actions,
}: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  onOpenNode: (n: Noeud) => void;
  /** Boutons de la barre (ajouter une arborescence, instancier pour toutes les sociétés). */
  actions?: ReactNode;
}) {
  // Un organigramme par société (choisie en haut) plutôt que toutes côte à côte : chaque schéma reste lisible.
  const { groupes, groupe, setChoix, annees, annee, setAnneeChoix, sansArborescence } = useGroupeAnnee(nodes, roots, getSocieteById);
  const [moisChoisi, setMoisChoisi] = useState<MoisChoisi | null>(null);

  const fichiersDuChoix = moisChoisi ? fichiersDuMois(moisChoisi.node.id, nodes, moisChoisi.annee, moisChoisi.mois) : [];

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100dvh-15rem)]">
      <SelecteursSocieteAnnee
        groupes={groupes}
        groupe={groupe}
        onGroupe={(cle) => {
          setChoix(cle);
          setMoisChoisi(null);
        }}
        annees={annees}
        annee={annee}
        onAnnee={(a) => {
          setAnneeChoix(a);
          setMoisChoisi(null);
        }}
        droite={actions}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0 overflow-y-auto px-4 py-3">
          {sansArborescence && <p className="py-3 text-sm text-muted-foreground">La société active n'a pas encore d'arborescence : choisissez une autre société ou créez-en une.</p>}
          {(groupe?.roots ?? []).map((root, i) => {
            const societe = getSocieteById(root.societeId);
            const barre = societe ? THEME_BAR[societe.theme] : GENERIC_BAR[i % GENERIC_BAR.length];
            const { dossiers, fichiers } = countDescendants(root.id, nodes);
            const enfants = nodes
              .filter((n) => n.parentId === root.id && n.type === "dossier" && (annee === null || (anneeDuLibelle(n.libelle) ?? annee) === annee))
              .sort((a, b) => a.libelle.localeCompare(b.libelle));
            return (
              <div key={root.id} className="mb-4 last:mb-0">
                <div className="flex flex-wrap items-baseline gap-x-4 border-b border-border py-2">
                  <span className={cn("mr-2 inline-block h-4 w-1 self-center rounded-full", barre)} aria-hidden="true" />
                  <button type="button" onClick={() => onOpenNode(root)} className="flex items-center gap-2 text-base font-bold uppercase hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <FolderTree className="size-4 text-muted-foreground" aria-hidden="true" />
                    {root.libelle}
                  </button>
                  <span className="text-sm text-muted-foreground">{pluriel(dossiers, "dossier")} · {pluriel(fichiers, "fichier")}</span>
                </div>
                {enfants.map((annuel) => (
                  <BrancheAnnee key={annuel.id} dossier={annuel} nodes={nodes} annee={annee ?? anneeDuLibelle(annuel.libelle)} moisChoisi={moisChoisi} onOpenNode={onOpenNode} onChoisirMois={setMoisChoisi} />
                ))}
                {enfants.length === 0 && <p className="py-3 text-sm text-muted-foreground">Aucun dossier pour cette année.</p>}
              </div>
            );
          })}
        </div>

        <aside aria-label="Fichiers du mois" className="min-h-0 overflow-y-auto border-t border-border bg-card px-4 py-4 lg:border-l lg:border-t-0">
          {moisChoisi ? (
            <>
              <h3 className="text-base font-bold uppercase">
                {moisChoisi.node.libelle} · {MOIS_COMPLETS[moisChoisi.mois]}{moisChoisi.annee ? ` ${moisChoisi.annee}` : ""}
              </h3>
              {fichiersDuChoix.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun fichier ce mois-ci.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {fichiersDuChoix.map((f) => {
                    const Icone = fileIcon(f.format);
                    return (
                      <li key={f.id} className="flex items-center gap-2 py-1.5">
                        <Icone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 break-words uppercase">{f.libelle}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => onOpenNode(moisChoisi.node)}>
                Ouvrir le dossier
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Cliquez un mois pour voir ses fichiers ici, sans quitter le schéma.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Un dossier d'année (« Comptabilité générale 2026 ») : son titre, puis une ligne par dossier avec ses 12 mois. */
function BrancheAnnee({ dossier, nodes, annee, moisChoisi, onOpenNode, onChoisirMois }: {
  dossier: Noeud;
  nodes: Noeud[];
  annee: number | null;
  moisChoisi: MoisChoisi | null;
  onOpenNode: (n: Noeud) => void;
  onChoisirMois: (m: MoisChoisi) => void;
}) {
  const dossiers = nodes.filter((n) => n.parentId === dossier.id && n.type === "dossier").sort((a, b) => a.libelle.localeCompare(b.libelle));
  return (
    <div className="ml-3 border-l border-border pl-3">
      <div className="flex flex-wrap items-baseline gap-x-4 py-2">
        <button type="button" onClick={() => onOpenNode(dossier)} className="text-sm font-bold uppercase hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {dossier.libelle}
        </button>
        <span className="text-xs text-muted-foreground">{pluriel(dossiers.length, "dossier")}</span>
      </div>
      <ul>
        {dossiers.map((d) => (
          <LigneDossier key={d.id} dossier={d} nodes={nodes} annee={annee} moisChoisi={moisChoisi} onOpenNode={onOpenNode} onChoisirMois={onChoisirMois} />
        ))}
      </ul>
    </div>
  );
}

/** Une ligne : le nom du dossier, son nombre de fichiers et les 12 mois. */
function LigneDossier({ dossier, nodes, annee, moisChoisi, onOpenNode, onChoisirMois }: {
  dossier: Noeud;
  nodes: Noeud[];
  annee: number | null;
  moisChoisi: MoisChoisi | null;
  onOpenNode: (n: Noeud) => void;
  onChoisirMois: (m: MoisChoisi) => void;
}) {
  const comptes = useMemo(() => comptesParMois(dossier.id, nodes, annee), [dossier.id, nodes, annee]);
  const fichiers = useMemo(() => countDescendants(dossier.id, nodes).fichiers, [dossier.id, nodes]);
  return (
    <li className="grid items-center gap-x-3 gap-y-1.5 border-t border-border py-1.5 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="flex min-w-0 items-baseline gap-2 pl-2">
        <button type="button" onClick={() => onOpenNode(dossier)} className="truncate text-sm font-semibold uppercase hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Ouvrir le dossier">
          {dossier.libelle}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">{pluriel(fichiers, "fichier")}</span>
      </div>
      <ul className="grid grid-cols-6 gap-1 lg:grid-cols-12" aria-label={`Mois de ${dossier.libelle}`}>
        {MOIS_COURTS.map((m, i) => {
          const choisi = moisChoisi?.node.id === dossier.id && moisChoisi.mois === i;
          return (
            <li key={m}>
              <button
                type="button"
                aria-pressed={choisi}
                title={`${MOIS_COMPLETS[i]} : ${pluriel(comptes[i], "fichier")}`}
                onClick={() => onChoisirMois({ node: dossier, mois: i, annee })}
                className={cn(
                  "w-full rounded border px-0.5 py-1 text-center text-[11px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  comptes[i] > 0 ? "border-success/40 bg-success/10 text-success hover:bg-success/20" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary",
                  choisi && "ring-2 ring-accent",
                )}
              >
                {m}{comptes[i] > 0 ? ` · ${comptes[i]}` : ""}
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
