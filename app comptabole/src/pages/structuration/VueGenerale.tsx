import { useMemo, useState, type ReactNode } from "react";
import { FolderOpen, Search, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anneeDuLibelle } from "@/lib/structurationMois";
import { cn, formatDate } from "@/lib/utils";
import type { Noeud, Societe } from "@/types";
import { SelecteursSocieteAnnee, useGroupeAnnee } from "./useGroupeAnnee";
import "./armoire.css";

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

/** Vue générale de l'arborescence d'une société, en armoire de classement : la société est l'armoire, son dossier d'année un jeu de tiroirs,
 * chaque dossier un tiroir. Les onglets qui dépassent comptent les fichiers (un tiroir vide n'a rien qui dépasse). Un clic ouvre le tiroir :
 * ses fichiers, ses dossiers suspendus (sous-dossiers) et une zone de dépôt. */
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
  /** Boutons de la barre (ajouter une arborescence, instancier pour toutes les sociétés). */
  actions?: ReactNode;
}) {
  const { groupes, groupe, setChoix, annees, annee, setAnneeChoix, sansArborescence } = useGroupeAnnee(nodes, roots, getSocieteById);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [sousId, setSousId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [survol, setSurvol] = useState<string | null>(null);
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

  function ouvrir(id: string) {
    setOuvertId((courant) => (courant === id ? null : id));
    setSousId(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <SelecteursSocieteAnnee groupes={groupes} groupe={groupe} onGroupe={setChoix} annees={annees} annee={annee} onAnnee={setAnneeChoix} droite={actions} />
      <div className="space-y-5 bg-secondary/30 px-4 py-5">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un fichier…" aria-label="Chercher un fichier" className="h-9 pl-9" />
        </div>

        {armoires.map(({ root, annuel, tiroirs }) => {
          const total = tiroirs.reduce((s, t) => s + t.fichiers.length, 0);
          const remplis = tiroirs.filter((t) => t.fichiers.length > 0).length;
          const ouvert = tiroirs.find((t) => t.dossier.id === ouvertId);
          return (
            <section key={annuel.id} className="armoire" aria-label={`Armoire ${annuel.libelle}`}>
              <div className="armoire__haut">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <span className="armoire__plaque">{annuel.libelle}</span>
                  <span className="text-xs text-primary-foreground/80">Armoire de {root.libelle}</span>
                  <button type="button" onClick={() => onOpenNode(annuel)} className="text-xs font-semibold text-accent underline underline-offset-2 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    Ouvrir dans Documents
                  </button>
                </div>
                <dl className="armoire__chiffres" aria-label="Chiffres de l'armoire">
                  <div><dt>Tiroirs</dt><dd>{tiroirs.length}</dd></div>
                  <div><dt>Fichiers</dt><dd>{total}</dd></div>
                  <div><dt>Remplis</dt><dd>{remplis}</dd></div>
                  <div><dt>Vides</dt><dd>{tiroirs.length - remplis}</dd></div>
                </dl>
              </div>

              {tiroirs.length === 0 ? (
                <p className="text-sm text-primary-foreground/80">Aucun tiroir : ajoutez des dossiers à ce dossier d'année.</p>
              ) : (
                <ul className="armoire__tiroirs" aria-label={`Tiroirs de ${annuel.libelle}`}>
                  {tiroirs.map(({ dossier, fichiers }) => {
                    const k = fichiers.length;
                    const trouve = q !== "" && fichiers.some((f) => f.fichier.libelle.toLowerCase().includes(q));
                    return (
                      <li key={dossier.id}>
                        <button
                          type="button"
                          aria-expanded={ouvertId === dossier.id}
                          aria-label={`Tiroir ${dossier.libelle}, ${pluriel(k, "fichier")}`}
                          onClick={() => ouvrir(dossier.id)}
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
                          className={cn("tiroir", k === 0 && "tiroir--vide", trouve && "tiroir--trouve", q !== "" && !trouve && "tiroir--estompe", survol === dossier.id && "tiroir--survol")}
                        >
                          <span className="tiroir__onglets" aria-hidden="true">
                            {Array.from({ length: Math.min(k, 8) }, (_, i) => (
                              <i key={i} style={{ "--i": i, "--h": `${10 + ((i * 5) % 9)}px` } as React.CSSProperties} />
                            ))}
                          </span>
                          {k > 0 && <span className="tiroir__pastille" aria-hidden="true">{k}</span>}
                          <span className="tiroir__face">
                            <span className="tiroir__plaque">
                              <b>{dossier.libelle}</b>
                              <small>{k > 0 ? pluriel(k, "fichier") : "Vide — à remplir"}</small>
                            </span>
                            <span className="tiroir__poignee" aria-hidden="true" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ul className="armoire__legende" aria-hidden="true">
                <li><i style={{ background: "hsl(var(--card))" }} />un onglet = un fichier</li>
                <li><i style={{ background: "hsl(var(--accent))" }} />poignée dorée : tiroir rempli</li>
                <li><i style={{ background: "hsl(var(--input))" }} />poignée grise : tiroir vide</li>
              </ul>

              {ouvert && (() => {
                const { dossier, fichiers } = ouvert;
                const sousDossiers = nodes.filter((n) => n.parentId === dossier.id && n.type === "dossier").sort((a, b) => a.libelle.localeCompare(b.libelle));
                const liste = fichiers.filter((f) => (sousId === null || f.sous?.id === sousId) && (q === "" || f.fichier.libelle.toLowerCase().includes(q)));
                const AFFICHES = 60;
                return (
                  <section className="ouvert" aria-label={`Contenu du tiroir ${dossier.libelle}`}>
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/10 px-[18px] py-3.5">
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-semibold uppercase text-primary">{dossier.libelle}</h3>
                        <p className="text-xs text-muted-foreground">
                          {annuel.libelle} · {pluriel(fichiers.length, "fichier")}
                          {fichiers.length > 0 && ` · dernier dépôt ${formatDate(fichiers[0].fichier.majLe)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenNode(dossier)}>
                          <FolderOpen className="size-4" aria-hidden="true" /> Ouvrir dans Documents
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setOuvertId(null)}>
                          <X className="size-4" aria-hidden="true" /> Fermer le tiroir
                        </Button>
                      </div>
                    </header>

                    {sousDossiers.length > 0 && (
                      <div className="ouvert__suspendus" role="group" aria-label="Dossiers suspendus">
                        <button type="button" className="ouvert__sus" aria-pressed={sousId === null} onClick={() => setSousId(null)}>
                          Tous<i>{fichiers.length}</i>
                        </button>
                        {sousDossiers.map((s) => (
                          <button key={s.id} type="button" className="ouvert__sus" aria-pressed={sousId === s.id} onClick={() => setSousId(s.id)}>
                            {s.libelle}<i>{fichiers.filter((f) => f.sous?.id === s.id).length}</i>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={cn("grid gap-4 border-t border-border p-[18px]", onDeposer && "md:grid-cols-[minmax(0,1fr)_260px]")}>
                      <div className="min-w-0">
                        {liste.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">
                            {q !== "" ? "Aucun fichier ne correspond à la recherche." : `Ce tiroir est vide${sousId ? " pour ce dossier" : ""}.${onDeposer ? " Déposez un fichier pour commencer le classement." : ""}`}
                          </p>
                        ) : (
                          <ul className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                            {liste.slice(0, AFFICHES).map(({ fichier, sous }, i) => {
                              const contenu = (
                                <>
                                  <span className="ouvert__fi" aria-hidden="true">{(fichier.format ?? "").slice(0, 4) || "—"}</span>
                                  <span className="min-w-0">
                                    <b className="block break-words text-[12.5px] font-semibold leading-tight">{fichier.libelle}</b>
                                    <small className="text-[11px] text-muted-foreground">{[fichier.taille, formatDate(fichier.majLe), sous?.libelle].filter(Boolean).join(" · ")}</small>
                                  </span>
                                </>
                              );
                              return (
                                <li key={fichier.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                                  {onPreview ? (
                                    <button type="button" className="ouvert__doc w-full" onClick={() => onPreview(fichier)} aria-label={`Aperçu de ${fichier.libelle}`}>{contenu}</button>
                                  ) : (
                                    <div className="ouvert__doc">{contenu}</div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {liste.length > AFFICHES && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {AFFICHES} fichiers sur {liste.length} affichés. <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => onOpenNode(dossier)}>Voir tout dans Documents</button>
                          </p>
                        )}
                      </div>
                      {onDeposer && (
                        <button
                          type="button"
                          className={cn("ouvert__depot", survol === "depot" && "ouvert__depot--survol")}
                          aria-label={`Déposer dans ${dossier.libelle}`}
                          onClick={() => onDeposer(dossier)}
                          onDragOver={(e) => {
                            if (!aDesFichiers(e.dataTransfer)) return;
                            e.preventDefault();
                            setSurvol("depot");
                          }}
                          onDragLeave={() => setSurvol(null)}
                          onDrop={(e) => {
                            if (!aDesFichiers(e.dataTransfer)) return;
                            e.preventDefault();
                            setSurvol(null);
                            onDeposer(dossier, Array.from(e.dataTransfer.files));
                          }}
                        >
                          <UploadCloud className="size-6 text-accent" aria-hidden="true" />
                          <b className="text-[13px] text-primary">Déposer dans ce tiroir</b>
                          <span className="text-[11.5px] text-muted-foreground">Glissez des fichiers ici ou cliquez</span>
                        </button>
                      )}
                    </div>
                  </section>
                );
              })()}
            </section>
          );
        })}
        {armoires.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {sansArborescence ? "La société active n'a pas encore d'arborescence : choisissez une autre société ou créez-en une." : "Aucun dossier pour cette année."}
          </p>
        )}
      </div>
    </div>
  );
}
