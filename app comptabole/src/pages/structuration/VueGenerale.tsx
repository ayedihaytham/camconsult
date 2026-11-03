import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Plus, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anneeDuLibelle } from "@/lib/structurationMois";
import { cn, formatDate } from "@/lib/utils";
import type { Noeud, Societe } from "@/types";
import { SelecteursSocieteAnnee, useGroupeAnnee } from "./useGroupeAnnee";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Fichiers sous un dossier, à tous les niveaux, avec le sous-dossier direct dont ils dépendent (null : directement dans le dossier). */
function fichiersDe(dossier: Noeud, nodes: Noeud[]): { fichier: Noeud; sous: Noeud | null }[] {
  const sortie: { fichier: Noeud; sous: Noeud | null }[] = [];
  const parcourir = (id: string, sous: Noeud | null) => {
    for (const n of nodes) {
      if (n.parentId !== id) continue;
      if (n.type === "fichier") sortie.push({ fichier: n, sous });
      else parcourir(n.id, sous ?? n);
    }
  };
  parcourir(dossier.id, null);
  return sortie.sort((a, b) => b.fichier.majLe.localeCompare(a.fichier.majLe));
}

const aDesFichiers = (e: DataTransfer | null) => Boolean(e && Array.from(e.types).includes("Files"));

/** Vue générale de l'arborescence d'une société : la société a une ou plusieurs armoires (ses dossiers d'année) ; chaque dossier d'une armoire est un tiroir.
 * Les tiroirs sont des onglets (avec leur nombre de fichiers) ; sous les onglets, les dossiers suspendus (sous-dossiers) du tiroir filtrent un tableau de ses fichiers,
 * paginé et triable. On dépose en cliquant sur « Déposer » ou en glissant des fichiers sur le tableau ou sur un onglet. La recherche met en évidence les tiroirs qui contiennent le fichier. */
const PAGE = 25;
type Tri = { cle: "nom" | "date"; sens: 1 | -1 };

export function VueGenerale({ nodes, roots, getSocieteById, onOpenNode, onPreview, onDeposer, actions }: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  /** Ouvre un dossier dans « Documents ». */
  onOpenNode: (n: Noeud) => void;
  /** Aperçu d'un fichier (clic sur sa fiche). */
  onPreview?: (n: Noeud) => void;
  /** Dépose des fichiers dans un dossier : sans fichiers, ouvre le choix de fichiers ; absent, la zone de dépôt n'est pas proposée. */
  onDeposer?: (dossier: Noeud, fichiers?: File[]) => void;
  /** Boutons de la barre (ajouter une arborescence, instancier pour toutes les sociétés) quand ils ne sont pas dans la barre du haut de la page. */
  actions?: ReactNode;
}) {
  const { groupes, groupe, setChoix, annees, annee, setAnneeChoix, sansArborescence } = useGroupeAnnee(nodes, roots, getSocieteById);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [sousId, setSousId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [survol, setSurvol] = useState<string | null>(null);
  // Page du tableau pour le tiroir, le dossier suspendu, la recherche et le tri en cours (on repart de la première page dès que l'un d'eux change).
  const [pageEtat, setPageEtat] = useState<{ cle: string; n: number }>({ cle: "", n: 0 });
  const [tri, setTri] = useState<Tri>({ cle: "date", sens: -1 });
  const [armoireId, setArmoireId] = useState<string | null>(null);
  const q = recherche.trim().toLowerCase();

  const armoires = useMemo(
    () =>
      (groupe?.roots ?? []).flatMap((root) =>
        nodes
          .filter((n) => n.parentId === root.id && n.type === "dossier" && (annee === null || (anneeDuLibelle(n.libelle) ?? annee) === annee))
          .sort((a, b) => a.libelle.localeCompare(b.libelle))
          .map((annuel) => ({
            root,
            annuel,
            tiroirs: nodes
              .filter((n) => n.parentId === annuel.id && n.type === "dossier")
              .sort((a, b) => a.libelle.localeCompare(b.libelle))
              .map((dossier) => ({ dossier, fichiers: fichiersDe(dossier, nodes) })),
          })),
      ),
    [groupe, nodes, annee],
  );

  // Une seule armoire à la fois (celle que l'on choisit ; sinon la première qui contient des fichiers) : la page ne s'allonge pas avec le nombre d'armoires.
  const armoireVisible = armoires.find((a) => a.annuel.id === armoireId) ?? armoires.find((a) => a.tiroirs.some((t) => t.fichiers.length > 0)) ?? armoires[0] ?? null;

  function choisir(id: string) {
    setOuvertId(id);
    setSousId(null);
  }

  const champRecherche = (
    <div className="relative min-w-[12rem] max-w-sm flex-1">
      <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
      <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un fichier…" aria-label="Chercher un fichier" className="h-9 pl-9" />
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <SelecteursSocieteAnnee groupes={groupes} groupe={groupe} onGroupe={setChoix} annees={annees} annee={annee} onAnnee={setAnneeChoix} droite={<>{champRecherche}{actions}</>} />

      {armoires.length > 1 && (
        <div role="tablist" aria-label="Armoires de la société" className="flex flex-wrap gap-2 border-b border-border/80 px-3 py-2.5">
          {armoires.map(({ annuel, tiroirs }) => {
            const n = tiroirs.reduce((t, x) => t + x.fichiers.length, 0);
            const actif = armoireVisible?.annuel.id === annuel.id;
            return (
              <button
                key={annuel.id}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => {
                  setArmoireId(annuel.id);
                  setOuvertId(null);
                  setSousId(null);
                }}
                className={cn("inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", actif ? "border-accent bg-card text-primary shadow-sm" : "border-border bg-muted text-muted-foreground hover:text-primary")}
              >
                <FolderOpen className="size-4" aria-hidden="true" />
                {annuel.libelle}
                <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", n > 0 ? "bg-success/10 text-success" : "bg-background text-muted-foreground")}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {(armoireVisible ? [armoireVisible] : []).map(({ root, annuel, tiroirs }) => {
        const total = tiroirs.reduce((t, x) => t + x.fichiers.length, 0);
        const remplis = tiroirs.filter((t) => t.fichiers.length > 0).length;
        // Le tiroir choisi reste celui de l'utilisateur ; sinon le premier rempli, ou le premier de la liste.
        const choisi = tiroirs.find((t) => t.dossier.id === ouvertId) ?? tiroirs.find((t) => t.fichiers.length > 0) ?? tiroirs[0] ?? null;
        return (
          <section key={annuel.id} aria-label={`Armoire ${annuel.libelle}`}>
            {tiroirs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Aucun tiroir : ajoutez des dossiers à ce dossier d'année.</p>
            ) : (
              <>
                <div role="tablist" aria-label={`Tiroirs de ${annuel.libelle}`} className="flex gap-0.5 overflow-x-auto border-b border-border bg-muted/60 px-3 [scrollbar-width:thin]" data-testid="structuration-onglets">
                  {tiroirs.map(({ dossier, fichiers }) => {
                    const k = fichiers.length;
                    const trouve = q !== "" && fichiers.some((f) => f.fichier.libelle.toLowerCase().includes(q));
                    const actif = choisi?.dossier.id === dossier.id;
                    return (
                      <button
                        key={dossier.id}
                        type="button"
                        role="tab"
                        aria-selected={actif}
                        aria-label={`Tiroir ${dossier.libelle}, ${pluriel(k, "fichier")}`}
                        data-etat={trouve ? "trouve" : q !== "" ? "estompe" : undefined}
                        onClick={() => choisir(dossier.id)}
                        onDoubleClick={() => onOpenNode(dossier)}
                        onDragOver={(e) => {
                          if (!onDeposer || !aDesFichiers(e.dataTransfer)) return;
                          e.preventDefault();
                          setSurvol(dossier.id);
                        }}
                        onDragLeave={() => setSurvol(null)}
                        onDrop={(e) => {
                          if (!onDeposer || !aDesFichiers(e.dataTransfer)) return;
                          e.preventDefault();
                          setSurvol(null);
                          onDeposer(dossier, Array.from(e.dataTransfer.files));
                        }}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[0.8125rem] uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          actif ? "bg-card font-bold text-primary shadow-[inset_0_2px_0_hsl(var(--accent))]" : "text-muted-foreground hover:text-primary",
                          trouve && "ring-2 ring-inset ring-accent",
                          q !== "" && !trouve && "opacity-40",
                          survol === dossier.id && "bg-accent/25",
                        )}
                      >
                        {dossier.libelle}
                        <em className={cn("text-[0.6875rem] font-bold not-italic tabular-nums", k > 0 ? "text-success" : "text-muted-foreground/70")}>{k}</em>
                      </button>
                    );
                  })}
                </div>

                {choisi && (() => {
                  const { dossier, fichiers } = choisi;
                  const sousDossiers = nodes.filter((n) => n.parentId === dossier.id && n.type === "dossier").sort((a, b) => a.libelle.localeCompare(b.libelle));
                  // Le dossier suspendu choisi appartient à un autre tiroir : on revient à « Tous ».
                  const sousActif = sousDossiers.some((x) => x.id === sousId) ? sousId : null;
                  const liste = fichiers
                    .filter((f) => (sousActif === null || f.sous?.id === sousActif) && (q === "" || f.fichier.libelle.toLowerCase().includes(q)))
                    .sort((a, b) => tri.sens * (tri.cle === "nom" ? a.fichier.libelle.localeCompare(b.fichier.libelle, "fr", { numeric: true }) : a.fichier.majLe.localeCompare(b.fichier.majLe)));
                  const cleListe = `${dossier.id}|${sousActif ?? ""}|${q}|${tri.cle}${tri.sens}`;
                  const page = pageEtat.cle === cleListe ? pageEtat.n : 0;
                  const debut = page * PAGE;
                  const visibles = liste.slice(debut, debut + PAGE);
                  const triable = (cle: Tri["cle"], titre: string) => (
                    <th aria-sort={tri.cle === cle ? (tri.sens === 1 ? "ascending" : "descending") : "none"} className="px-4 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      <button type="button" onClick={() => setTri((t) => (t.cle === cle ? { cle, sens: t.sens === 1 ? -1 : 1 } : { cle, sens: cle === "nom" ? 1 : -1 }))} className="inline-flex items-center gap-1 uppercase tracking-[0.1em] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {titre}
                        {tri.cle === cle && <span aria-hidden="true">{tri.sens === 1 ? "▴" : "▾"}</span>}
                      </button>
                    </th>
                  );
                  return (
                    <section
                      aria-label={`Contenu du tiroir ${dossier.libelle}`}
                      className={cn("bg-card transition-colors", survol === "depot" && "bg-accent/10")}
                      onDragOver={(e) => {
                        if (!onDeposer || !aDesFichiers(e.dataTransfer)) return;
                        e.preventDefault();
                        setSurvol("depot");
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSurvol(null);
                      }}
                      onDrop={(e) => {
                        if (!onDeposer || !aDesFichiers(e.dataTransfer)) return;
                        e.preventDefault();
                        setSurvol(null);
                        onDeposer(dossier, Array.from(e.dataTransfer.files));
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        {sousDossiers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dossiers suspendus">
                            {[{ id: null as string | null, libelle: "Tous", n: fichiers.length }, ...sousDossiers.map((x) => ({ id: x.id as string | null, libelle: x.libelle, n: fichiers.filter((f) => f.sous?.id === x.id).length }))].map((x) => (
                              <button
                                key={x.id ?? "tous"}
                                type="button"
                                aria-pressed={sousActif === x.id}
                                onClick={() => setSousId(x.id)}
                                title={x.libelle}
                                className={cn("max-w-[16rem] truncate rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sousActif === x.id ? "border-accent bg-card text-primary shadow-sm" : "border-border bg-muted text-muted-foreground hover:text-primary")}
                              >
                                {x.libelle}<i className="ml-1.5 font-normal not-italic tabular-nums opacity-65">{x.n}</i>
                              </button>
                            ))}
                          </div>
                        )}
                        <span className="min-w-0 text-xs text-muted-foreground">
                          {sousDossiers.length === 0 && <>{pluriel(fichiers.length, "fichier")}{fichiers.length > 0 && ` · dernier dépôt ${formatDate(fichiers[0].fichier.majLe)}`} · </>}
                          Armoire de {root.libelle} · {pluriel(remplis, "tiroir")} rempli{remplis > 1 ? "s" : ""} sur {tiroirs.length} · {pluriel(total, "fichier")}
                        </span>
                        <span className="ml-auto flex flex-wrap items-center gap-2">
                          {onDeposer && (
                            <Button type="button" variant="outline" size="sm" aria-label={`Déposer dans ${dossier.libelle}`} onClick={() => onDeposer(dossier)}>
                              <Plus className="size-4" aria-hidden="true" /> Déposer
                            </Button>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={() => onOpenNode(dossier)}>
                            <FolderOpen className="size-4" aria-hidden="true" /> Ouvrir dans Documents
                          </Button>
                          <button type="button" onClick={() => onOpenNode(annuel)} className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Ouvrir l'armoire
                          </button>
                        </span>
                      </div>

                      {liste.length === 0 ? (
                        <div className="px-4 pb-4">
                          <p className="py-1 text-sm text-muted-foreground">
                            {q !== "" ? "Aucun fichier ne correspond à la recherche." : `Ce tiroir est vide${sousActif ? " pour ce dossier" : ""}.${onDeposer ? " Déposez un fichier pour commencer le classement." : ""}`}
                          </p>
                          {onDeposer && q === "" && (
                            <div className="mt-2 grid place-items-center gap-1 rounded-xl border-2 border-dashed border-input bg-background/60 px-3 py-6 text-center">
                              <UploadCloud className="size-6 text-accent" aria-hidden="true" />
                              <span className="text-[12.5px] text-muted-foreground">Glissez des fichiers ici, ou utilisez « Déposer »</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-accent/[0.07]">
                                  {triable("nom", "Nom")}
                                  <th className="hidden px-4 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Dossier</th>
                                  <th className="hidden px-4 py-2.5 text-left text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">Taille</th>
                                  {triable("date", "Déposé le")}
                                </tr>
                              </thead>
                              <tbody>
                                {visibles.map(({ fichier, sous }) => {
                                  const nom = (
                                    <span className="flex min-w-0 items-center gap-2.5">
                                      <span aria-hidden="true" className="grid h-8 w-7 flex-none place-items-center rounded-[4px_9px_4px_4px] border border-primary/15 bg-primary/[0.08] text-[8.5px] font-bold uppercase text-primary">{(fichier.format ?? "").slice(0, 4) || "—"}</span>
                                      <span className="min-w-0 truncate font-semibold" title={fichier.libelle}>{fichier.libelle}</span>
                                    </span>
                                  );
                                  return (
                                    <tr key={fichier.id} className="border-t border-border/70 hover:bg-accent/[0.08]">
                                      <td className="max-w-0 px-4 py-2 sm:max-w-[28rem]">
                                        {onPreview ? (
                                          <button type="button" className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onPreview(fichier)} aria-label={`Aperçu de ${fichier.libelle}`}>{nom}</button>
                                        ) : (
                                          nom
                                        )}
                                      </td>
                                      <td className="hidden max-w-[14rem] truncate px-4 py-2 text-muted-foreground sm:table-cell" title={sous?.libelle}>{sous?.libelle ?? "—"}</td>
                                      <td className="hidden whitespace-nowrap px-4 py-2 tabular-nums sm:table-cell">{fichier.taille ?? "—"}</td>
                                      <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(fichier.majLe)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                            <span aria-live="polite">{debut + 1}–{Math.min(debut + PAGE, liste.length)} sur {liste.length}</span>
                            {liste.length > PAGE && (
                              <span className="flex items-center gap-1.5">
                                <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPageEtat({ cle: cleListe, n: page - 1 })}>
                                  <ChevronLeft className="size-4" aria-hidden="true" /> Précédent
                                </Button>
                                <Button type="button" variant="outline" size="sm" disabled={debut + PAGE >= liste.length} onClick={() => setPageEtat({ cle: cleListe, n: page + 1 })}>
                                  Suivant <ChevronRight className="size-4" aria-hidden="true" />
                                </Button>
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </section>
                  );
                })()}
              </>
            )}
          </section>
        );
      })}
      {armoires.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {sansArborescence ? "La société active n'a pas encore d'arborescence : choisissez une autre société ou créez-en une." : "Aucun dossier pour cette année."}
        </p>
      )}
    </div>
  );
}
