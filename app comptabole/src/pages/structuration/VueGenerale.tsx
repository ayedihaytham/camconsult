import { useMemo, useState, type ReactNode } from "react";
import { Folder, FolderOpen, Search, UploadCloud } from "lucide-react";
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

type FiltreTiroirs = "tous" | "remplis" | "vides";

/** Vue générale de l'arborescence d'une société, en « liste et volet » : la société a une armoire (son dossier d'année), chaque dossier de l'armoire est un tiroir.
 * À gauche, la liste des tiroirs (nombre de fichiers, dernier dépôt) ; à droite, le tiroir choisi : ses dossiers suspendus (sous-dossiers), ses fichiers et une zone de dépôt.
 * Les chiffres du haut filtrent les tiroirs (tous, remplis, vides) ; la recherche met en évidence les tiroirs qui contiennent le fichier. */
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
  const [filtre, setFiltre] = useState<FiltreTiroirs>("tous");
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

      {armoires.map(({ root, annuel, tiroirs }) => {
        const total = tiroirs.reduce((s, t) => s + t.fichiers.length, 0);
        const remplis = tiroirs.filter((t) => t.fichiers.length > 0).length;
        const affiches = tiroirs.filter((t) => (filtre === "remplis" ? t.fichiers.length > 0 : filtre === "vides" ? t.fichiers.length === 0 : true));
        // Le tiroir choisi reste celui de l'utilisateur tant qu'il est affiché ; sinon le premier rempli, ou le premier de la liste.
        const choisi = affiches.find((t) => t.dossier.id === ouvertId) ?? affiches.find((t) => t.fichiers.length > 0) ?? affiches[0] ?? null;
        return (
          <section key={annuel.id} aria-label={`Armoire ${annuel.libelle}`}>
            <div className="flex flex-wrap items-stretch gap-x-0.5 border-b border-border/80 bg-muted/20 px-3">
              <div role="group" aria-label="Filtrer les tiroirs" className="flex flex-wrap items-stretch">
                {([["tous", "Tiroirs", tiroirs.length, "text-primary"], ["remplis", "Remplis", remplis, "text-success"], ["vides", "Vides", tiroirs.length - remplis, "text-muted-foreground"]] as const).map(([valeur, nom, n, ton]) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={filtre === valeur}
                    onClick={() => setFiltre(valeur)}
                    className={cn("relative flex items-baseline gap-2 px-4 py-3 text-[0.8125rem] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", filtre === valeur ? "font-semibold text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded after:bg-primary" : "text-muted-foreground")}
                  >
                    <b className={cn("text-xl font-bold leading-none tabular-nums tracking-tight", n === 0 ? "text-muted-foreground/50" : ton)}>{n}</b>
                    {nom}
                  </button>
                ))}
                <div className="flex items-baseline gap-2 px-4 py-3 text-[0.8125rem] text-muted-foreground" aria-label="Fichiers de l'armoire">
                  <b className="text-xl font-bold leading-none tabular-nums tracking-tight text-primary">{total}</b>
                  {total > 1 ? "Fichiers" : "Fichier"}
                </div>
              </div>
              <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs text-muted-foreground">
                <span className="rounded-md border border-accent/70 bg-accent/10 px-2.5 py-0.5 font-serif text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-primary [overflow-wrap:anywhere]">{annuel.libelle}</span>
                <span>Armoire de {root.libelle}</span>
                <button type="button" onClick={() => onOpenNode(annuel)} className="font-semibold text-primary underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Ouvrir dans Documents
                </button>
              </div>
            </div>

            {tiroirs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Aucun tiroir : ajoutez des dossiers à ce dossier d'année.</p>
            ) : (
              <div className="grid lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]" data-testid="structuration-liste-volet">
                <ul className="min-w-0 lg:border-r lg:border-border" aria-label={`Tiroirs de ${annuel.libelle}`}>
                  {affiches.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun tiroir {filtre === "vides" ? "vide" : "rempli"}.</li>}
                  {affiches.map(({ dossier, fichiers }) => {
                    const k = fichiers.length;
                    const trouve = q !== "" && fichiers.some((f) => f.fichier.libelle.toLowerCase().includes(q));
                    const actif = choisi?.dossier.id === dossier.id;
                    return (
                      <li key={dossier.id}>
                        <button
                          type="button"
                          aria-current={actif ? "true" : undefined}
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
                            "grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/70 px-4 py-2.5 text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            actif && "bg-accent/15 shadow-[inset_3px_0_0_hsl(var(--accent))]",
                            trouve && "ring-2 ring-inset ring-accent",
                            q !== "" && !trouve && "opacity-40",
                            survol === dossier.id && "bg-accent/25",
                          )}
                        >
                          <span aria-hidden="true" className={cn("grid size-10 place-items-center rounded-xl", k > 0 ? "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground")}>
                            {actif ? <FolderOpen className="size-[1.15rem]" /> : <Folder className="size-[1.15rem]" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8125rem] font-bold uppercase tracking-[0.09em] text-primary">{dossier.libelle}</span>
                            <span className="block truncate text-xs text-muted-foreground">{k > 0 ? `${pluriel(k, "fichier")} · dernier dépôt ${formatDate(fichiers[0].fichier.majLe)}` : "Vide — à remplir"}</span>
                            {k > 0 && <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded bg-muted"><i className="block h-full w-full bg-accent" /></span>}
                          </span>
                          {k > 0 ? (
                            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-success">{k}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Vide</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="min-w-0 border-t border-border lg:border-t-0">
                  {choisi ? (() => {
                    const { dossier, fichiers } = choisi;
                    const sousDossiers = nodes.filter((n) => n.parentId === dossier.id && n.type === "dossier").sort((a, b) => a.libelle.localeCompare(b.libelle));
                    // Le dossier suspendu choisi appartient à un autre tiroir : on revient à « Tous ».
                    const sousActif = sousDossiers.some((s) => s.id === sousId) ? sousId : null;
                    const liste = fichiers.filter((f) => (sousActif === null || f.sous?.id === sousActif) && (q === "" || f.fichier.libelle.toLowerCase().includes(q)));
                    const AFFICHES = 60;
                    return (
                      <section aria-label={`Contenu du tiroir ${dossier.libelle}`} className="bg-gradient-to-b from-muted/40 to-card">
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/10 px-[18px] py-3.5">
                          <div className="min-w-0">
                            <h3 className="font-serif text-xl font-semibold uppercase text-primary [overflow-wrap:anywhere]">{dossier.libelle}</h3>
                            <p className="text-xs text-muted-foreground">
                              {annuel.libelle} · {pluriel(fichiers.length, "fichier")}
                              {fichiers.length > 0 && ` · dernier dépôt ${formatDate(fichiers[0].fichier.majLe)}`}
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => onOpenNode(dossier)}>
                            <FolderOpen className="size-4" aria-hidden="true" /> Ouvrir dans Documents
                          </Button>
                        </header>

                        {sousDossiers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-[18px] pt-3" role="group" aria-label="Dossiers suspendus">
                            {[{ id: null as string | null, libelle: "Tous", n: fichiers.length }, ...sousDossiers.map((s) => ({ id: s.id as string | null, libelle: s.libelle, n: fichiers.filter((f) => f.sous?.id === s.id).length }))].map((s) => (
                              <button
                                key={s.id ?? "tous"}
                                type="button"
                                aria-pressed={sousActif === s.id}
                                onClick={() => setSousId(s.id)}
                                className={cn("rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sousActif === s.id ? "border-accent bg-card text-primary shadow-sm" : "border-border bg-muted text-muted-foreground hover:text-primary")}
                              >
                                {s.libelle}<i className="ml-1.5 font-normal not-italic tabular-nums opacity-65">{s.n}</i>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className={cn("grid gap-4 p-[18px]", onDeposer && "xl:grid-cols-[minmax(0,1fr)_15rem]")}>
                          <div className="min-w-0">
                            {liste.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">
                                {q !== "" ? "Aucun fichier ne correspond à la recherche." : `Ce tiroir est vide${sousActif ? " pour ce dossier" : ""}.${onDeposer ? " Déposez un fichier pour commencer le classement." : ""}`}
                              </p>
                            ) : (
                              <ul className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                                {liste.slice(0, AFFICHES).map(({ fichier, sous }) => {
                                  const contenu = (
                                    <>
                                      <span aria-hidden="true" className="grid h-10 w-[34px] flex-none place-items-center rounded-[4px_10px_4px_4px] border border-primary/15 bg-primary/[0.08] text-[9px] font-bold uppercase text-primary">{(fichier.format ?? "").slice(0, 4) || "—"}</span>
                                      <span className="min-w-0">
                                        <b className="block break-words text-[12.5px] font-semibold leading-tight">{fichier.libelle}</b>
                                        <small className="text-[11px] text-muted-foreground">{[fichier.taille, formatDate(fichier.majLe), sous?.libelle].filter(Boolean).join(" · ")}</small>
                                      </span>
                                    </>
                                  );
                                  const carte = "flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-background px-3 py-2.5 text-left";
                                  return (
                                    <li key={fichier.id}>
                                      {onPreview ? (
                                        <button type="button" className={cn(carte, "transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")} onClick={() => onPreview(fichier)} aria-label={`Aperçu de ${fichier.libelle}`}>{contenu}</button>
                                      ) : (
                                        <div className={carte}>{contenu}</div>
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
                              className={cn("grid min-h-[150px] content-center justify-items-center gap-1 rounded-xl border-2 border-dashed border-input bg-background/60 px-3 py-4 text-center transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", survol === "depot" && "border-accent bg-accent/10")}
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
                  })() : (
                    <p className="px-5 py-8 text-sm text-muted-foreground">Choisissez un tiroir pour voir son contenu.</p>
                  )}
                </div>
              </div>
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
