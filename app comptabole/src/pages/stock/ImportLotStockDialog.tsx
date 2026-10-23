import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readFileAsDataUrl } from "@/lib/file";
import { alleger } from "@/lib/image";
import { cn } from "@/lib/utils";
import { completerCours, coursAutoInitial } from "@/lib/coursStock";
import { mouvementDuGroupe, regrouperPieces, resumeMontant, resumeQuantite, type GroupeLot, type PieceAffectee, type PieceLot, type TypeAffecte } from "@/lib/stockLot";
import { useCoursChange } from "@/store/coursChange";
import { useStock, type StockMouvementInput } from "@/store/stock";
import type { StockDocType, StockMouvement } from "@/types";
import { avecTauxDouane } from "./StockMouvementFormSheet";
import { DocPreviewDialog } from "./DocPreviewDialog";

/** Plafond de fichiers par lot : chaque page lue est un appel au moteur d'extraction. */
export const MAX_FICHIERS_LOT = 40;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societeId: string;
  /** Appelé après la création, pour rafraîchir le tableau et mettre en évidence le dernier mouvement. */
  onCrees?: (mouvements: StockMouvement[]) => void;
}

type Etape = "choix" | "lecture" | "resultat";
type EtatFichier = "attente" | "lecture" | "ok" | "erreur";

interface Fichier {
  nom: string;
  etat: EtatFichier;
  pages: number;
  /** Pages non lues par le moteur et avertissements de lecture (fichier coupé, par exemple). */
  nonLues: number;
  avertissements: string[];
}

const TITRES: Record<StockDocType, string> = { achat: "Achat", vente: "Vente", douane: "Douane" };
const DOC_FIELD = { achat: "achatDocDataUrl", vente: "venteDocDataUrl", douane: "douaneDocDataUrl" } as const;

/** Cours comme dans le formulaire de saisie : taux de la douane, sinon cours moyen du mois de la date de la facture. */
function avecCours(m: StockMouvementInput): StockMouvementInput {
  const auto = coursAutoInitial();
  const { cours, devises, coursUsd } = useCoursChange.getState();
  const t = { cours, devises, coursUsd };
  let x = m.douaneTauxChange ? avecTauxDouane(m, m.douaneTauxChange, auto) : m;
  x = completerCours(x, "achat", auto, t);
  return completerCours(x, "vente", auto, t);
}

function Resume({ piece, type }: { piece: PieceAffectee; type: StockDocType }) {
  const c = piece.champs;
  if (type === "douane") {
    return (
      <>
        <span className="block font-mono text-xs">{c.numDeclaration || "sans n°"}</span>
        <span className="block text-xs text-muted-foreground">{c.exportateur || "—"}</span>
        <span className="block text-xs tabular-nums">{c.valeurTnd ? `${c.valeurTnd.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND` : "—"}</span>
      </>
    );
  }
  return (
    <>
      <span className="block font-mono text-xs">{c.numFacture || "sans n°"} · {c.date || "sans date"}</span>
      <span className="block text-xs text-muted-foreground">{(type === "achat" ? c.fournisseur : c.client) || "—"}</span>
      <span className="block text-xs tabular-nums">{resumeQuantite(c.lignes) ? `${resumeQuantite(c.lignes)} · ` : ""}{resumeMontant(c.lignes, c.devise)}</span>
    </>
  );
}

/** Import d'un lot de pièces : lecture de chaque fichier, rapprochement automatique en mouvements, vérification à l'écran, création des lignes cochées. */
export function ImportLotStockDialog({ open, onOpenChange, societeId, onCrees }: Props) {
  const extractPages = useStock((s) => s.extractPages);
  const create = useStock((s) => s.create);
  const entree = useRef<HTMLInputElement>(null);
  const annule = useRef(false);

  const [etape, setEtape] = useState<Etape>("choix");
  const [choisis, setChoisis] = useState<File[]>([]);
  const [fichiers, setFichiers] = useState<Fichier[]>([]);
  const [pieces, setPieces] = useState<PieceLot[]>([]);
  const [affectations, setAffectations] = useState<Record<string, TypeAffecte | undefined>>({});
  const [coches, setCoches] = useState<Record<string, boolean | undefined>>({});
  // Mouvements du stock au moment de l'analyse : sert à repérer les doublons sans compter ce qu'on vient de créer.
  const [existants, setExistants] = useState<StockMouvement[]>([]);
  const [crees, setCrees] = useState<Set<string>>(new Set());
  const [enregistrement, setEnregistrement] = useState(false);
  const [apercu, setApercu] = useState<{ titre: string; dataUrl: string } | null>(null);

  const groupes = useMemo(() => regrouperPieces(pieces, affectations, existants), [pieces, affectations, existants]);
  const coche = (g: GroupeLot) => !crees.has(g.cle) && g.statut !== "doublon" && (coches[g.cle] ?? g.statut === "pret");
  const aCreer = groupes.filter(coche);
  const nbPrets = groupes.filter((g) => g.statut === "pret" && !crees.has(g.cle)).length;
  const nbVerifier = groupes.filter((g) => g.statut === "verifier" && !crees.has(g.cle)).length;
  const nbDoublons = groupes.filter((g) => g.statut === "doublon" && !crees.has(g.cle)).length;

  function reinitialiser() {
    annule.current = false;
    setEtape("choix");
    setChoisis([]);
    setFichiers([]);
    setPieces([]);
    setAffectations({});
    setCoches({});
    setCrees(new Set());
  }

  function fermer(o: boolean) {
    if (!o) {
      annule.current = true;
      if (enregistrement) return;
      onOpenChange(false);
      reinitialiser();
      return;
    }
    onOpenChange(true);
  }

  function choisir(liste: FileList | null) {
    if (!liste) return;
    const fichiersValides = [...liste].filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (fichiersValides.length < liste.length) toast.warning("Seuls les PDF et les images sont pris en compte.");
    const total = [...choisis, ...fichiersValides];
    if (total.length > MAX_FICHIERS_LOT) toast.warning(`Un lot est limité à ${MAX_FICHIERS_LOT} fichiers : les suivants ont été ignorés.`);
    setChoisis(total.slice(0, MAX_FICHIERS_LOT));
    if (entree.current) entree.current.value = "";
  }

  async function analyser() {
    annule.current = false;
    setExistants([...useStock.getState().list]);
    setEtape("lecture");
    const suivi: Fichier[] = choisis.map((f) => ({ nom: f.name, etat: "attente", pages: 0, nonLues: 0, avertissements: [] }));
    setFichiers(suivi);
    const lues: PieceLot[] = [];
    const modifier = (i: number, partiel: Partial<Fichier>) => setFichiers((prev) => prev.map((f, j) => (j === i ? { ...f, ...partiel } : f)));
    for (const [i, fichier] of choisis.entries()) {
      if (annule.current) break;
      modifier(i, { etat: "lecture" });
      try {
        const { pages, avertissements } = await extractPages(societeId, await readFileAsDataUrl(fichier));
        for (const p of pages) {
          lues.push({
            id: `${i}:${fichier.name}#${p.index}`,
            fichier: fichier.name,
            page: p.index,
            imageDataUrl: p.imageDataUrl,
            typeDevine: p.guessedType,
            confiance: p.confidence,
            champsByType: p.champsByType,
            ...(p.erreur ? { erreur: p.erreur } : {}),
          });
        }
        modifier(i, { etat: "ok", pages: pages.length, nonLues: pages.filter((p) => p.erreur).length, avertissements });
      } catch {
        // Le store affiche déjà l'erreur ; les autres fichiers continuent.
        modifier(i, { etat: "erreur" });
      }
      setPieces([...lues]);
    }
    if (annule.current) return;
    if (lues.length === 0) {
      toast.error("Aucune pièce n'a pu être lue dans ce lot.");
      setEtape("choix");
      return;
    }
    setEtape("resultat");
  }

  async function creer() {
    if (aCreer.length === 0) return;
    setEnregistrement(true);
    const faits: StockMouvement[] = [];
    const nouveaux = new Set(crees);
    let echecs = 0;
    try {
      for (const g of aCreer) {
        try {
          let m = avecCours(mouvementDuGroupe(g, societeId));
          for (const type of ["achat", "vente", "douane"] as const) {
            const image = g[type]?.imageDataUrl;
            if (image) m = { ...m, [DOC_FIELD[type]]: await alleger(image) };
          }
          faits.push(await create(m));
          nouveaux.add(g.cle);
        } catch {
          // Le store affiche l'erreur de ce mouvement ; les suivants sont tentés.
          echecs++;
        }
      }
    } finally {
      setCrees(nouveaux);
      setEnregistrement(false);
    }
    if (faits.length > 0) {
      onCrees?.(faits);
      toast.success(`${faits.length} mouvement${faits.length > 1 ? "s" : ""} créé${faits.length > 1 ? "s" : ""}${echecs ? `, ${echecs} en échec` : ""} — comparez-les avec leurs pièces.`);
    }
  }

  const progression = fichiers.filter((f) => f.etat === "ok" || f.etat === "erreur").length;

  return (
    <>
      <Dialog open={open} onOpenChange={fermer}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-3 overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importer un lot de factures</DialogTitle>
            <DialogDescription>
              Déposez les factures d'achat, de vente et les déclarations douanières : chaque page est lue, son type reconnu, puis les pièces d'une même opération sont rapprochées. Rien n'est enregistré avant votre validation.
            </DialogDescription>
          </DialogHeader>

          {etape === "choix" && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              <input ref={entree} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => choisir(e.target.files)} />
              <button
                type="button"
                onClick={() => entree.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground hover:bg-muted/40"
              >
                <FileUp className="size-6" aria-hidden="true" />
                Choisir des PDF ou des images (jusqu'à {MAX_FICHIERS_LOT} fichiers)
              </button>
              {choisis.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {choisis.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate">{f.name}</span>
                      <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setChoisis((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Chaque page lue est un appel au moteur d'extraction, payant pour certaines sociétés : un lot de {choisis.length || "N"} fichier{choisis.length > 1 ? "s" : ""} en compte au moins autant. La lecture d'un fichier peut prendre quelques dizaines de secondes.
              </p>
            </div>
          )}

          {etape === "lecture" && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              <p className="text-sm font-medium">
                Lecture en cours : {progression} / {fichiers.length}
              </p>
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {fichiers.map((f, i) => (
                  <li key={`${f.nom}-${i}`} className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-1.5">
                    <span className="min-w-0 truncate">{f.nom}</span>
                    <span className={cn("flex shrink-0 items-center gap-1 text-xs", f.etat === "erreur" ? "text-destructive" : "text-muted-foreground")}>
                      {f.etat === "lecture" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                      {f.etat === "ok" && <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />}
                      {f.etat === "attente" && "En attente"}
                      {f.etat === "lecture" && "Lecture…"}
                      {f.etat === "ok" && `${f.pages} page${f.pages > 1 ? "s" : ""}`}
                      {f.etat === "erreur" && "Échec de lecture"}
                    </span>
                    {f.etat === "ok" && (f.nonLues > 0 || f.avertissements.length > 0) && (
                      <span className="basis-full text-xs text-warning">
                        {f.nonLues > 0 && <span className="block">{f.nonLues} page{f.nonLues > 1 ? "s" : ""} non lue{f.nonLues > 1 ? "s" : ""} : à relancer ou à saisir à la main.</span>}
                        {f.avertissements.map((a) => <span key={a} className="block">{a}</span>)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {etape === "resultat" && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {fichiers.some((f) => f.nonLues > 0 || f.avertissements.length > 0) && (
                <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <p className="font-semibold">Lecture incomplète</p>
                  {fichiers.filter((f) => f.nonLues > 0 || f.avertissements.length > 0).map((f) => (
                    <p key={f.nom}>{f.nom} : {[f.nonLues > 0 ? `${f.nonLues} page${f.nonLues > 1 ? "s" : ""} non lue${f.nonLues > 1 ? "s" : ""}` : "", ...f.avertissements].filter(Boolean).join(" · ")}</p>
                  ))}
                </div>
              )}
              <p className="text-sm">
                <span className="font-semibold">{groupes.length}</span> mouvement{groupes.length > 1 ? "s" : ""} proposé{groupes.length > 1 ? "s" : ""} :{" "}
                <span className="font-semibold text-success">{nbPrets} prêt{nbPrets > 1 ? "s" : ""}</span> (cochés d'office),{" "}
                <span className="font-semibold text-warning">{nbVerifier} à vérifier</span> (à cocher après relecture)
                {nbDoublons > 0 && <>, <span className="font-semibold text-destructive">{nbDoublons} refusé{nbDoublons > 1 ? "s" : ""}</span> (facture déjà présente)</>}.
              </p>
              {groupes.map((g, rang) => {
                const cree = crees.has(g.cle);
                return (
                  <section key={g.cle} className={cn("rounded-lg border p-3", cree ? "border-success/40 bg-success/5" : g.statut === "doublon" ? "border-destructive/40 bg-destructive/5" : g.statut === "verifier" ? "border-warning/50" : "border-border")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox checked={coche(g)} disabled={cree || g.statut === "doublon"} onCheckedChange={(v) => setCoches((prev) => ({ ...prev, [g.cle]: v === true }))} aria-label={`Créer le mouvement ${rang + 1}`} />
                      <h3 className="text-sm font-semibold">Mouvement {rang + 1}</h3>
                      <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", cree ? "bg-success/15 text-success" : g.statut === "pret" ? "bg-success/15 text-success" : g.statut === "doublon" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning")}>
                        {cree ? "Créé" : g.statut === "pret" ? "Prêt" : g.statut === "doublon" ? "Refusé : doublon" : "À vérifier"}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      {(["achat", "vente", "douane"] as const).map((type) => {
                        const p = g[type];
                        return (
                          <div key={type} className="min-w-0 rounded-md bg-muted/30 p-2">
                            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{TITRES[type]}</p>
                            {p ? (
                              <>
                                <Resume piece={p} type={type} />
                                {(g.anomalies[p.id] ?? []).map((a) => (
                                  <p key={a} className="mt-0.5 flex items-start gap-1 text-[0.7rem] text-warning">
                                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                                    {a}
                                  </p>
                                ))}
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <Select value={affectations[p.id] ?? p.typeDevine ?? "ignorer"} onValueChange={(val) => setAffectations((prev) => ({ ...prev, [p.id]: val as TypeAffecte }))} disabled={cree}>
                                    <SelectTrigger className="h-7 flex-1 text-xs" aria-label={`Type de la page ${p.page + 1} de ${p.fichier}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="achat">Achat</SelectItem>
                                      <SelectItem value="vente">Vente</SelectItem>
                                      <SelectItem value="douane">Douane</SelectItem>
                                      <SelectItem value="ignorer">Ignorer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {p.imageDataUrl && (
                                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setApercu({ titre: `${p.fichier} — page ${p.page + 1}`, dataUrl: p.imageDataUrl as string })}>
                                      Voir
                                    </Button>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground" title={p.fichier}>{p.fichier} · p. {p.page + 1}</p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {g.alertes.map((a) => (
                      <p key={a} className="mt-1.5 flex items-start gap-1 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {a}
                      </p>
                    ))}
                  </section>
                );
              })}
              {pieces.every((p) => (affectations[p.id] ?? p.typeDevine ?? "ignorer") === "ignorer") && <p className="text-sm text-muted-foreground">Toutes les pièces sont ignorées.</p>}
            </div>
          )}

          <DialogFooter>
            {etape === "choix" && (
              <>
                <Button type="button" variant="outline" onClick={() => fermer(false)}>Annuler</Button>
                <Button type="button" disabled={choisis.length === 0} onClick={() => void analyser()}>
                  Analyser {choisis.length > 0 ? `${choisis.length} fichier${choisis.length > 1 ? "s" : ""}` : ""}
                </Button>
              </>
            )}
            {etape === "lecture" && (
              <Button type="button" variant="outline" onClick={() => { annule.current = true; setEtape(pieces.length > 0 ? "resultat" : "choix"); }}>
                Arrêter la lecture
              </Button>
            )}
            {etape === "resultat" && (
              <>
                <Button type="button" variant="outline" onClick={() => fermer(false)} disabled={enregistrement}>Fermer</Button>
                <Button type="button" variant="ledger" disabled={aCreer.length === 0 || enregistrement} onClick={() => void creer()}>
                  {enregistrement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Créer {aCreer.length} mouvement{aCreer.length > 1 ? "s" : ""}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DocPreviewDialog open={Boolean(apercu)} onOpenChange={(o) => !o && setApercu(null)} title={apercu?.titre ?? ""} dataUrl={apercu?.dataUrl ?? null} />
    </>
  );
}
