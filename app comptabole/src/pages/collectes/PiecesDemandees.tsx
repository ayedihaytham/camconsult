import { useState } from "react";
import { CheckCircle2, Clock, Download, Eye, FilePlus2, FileQuestion, Send, Trash2, Truck, UploadCloud, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadDataUrl } from "@/lib/file";
import { cn, formatRelative } from "@/lib/utils";
import { FileUploadDialog, type NewFichier } from "../structuration/FileUploadDialog";
import type { CollecteFichier, CollecteFull, DemandePiece } from "@/types";

type Categorie = DemandePiece["categorie"];

export interface NouvelleDemande {
  texte: string;
  categorie: Categorie;
  tiers: string;
}

interface Props {
  collecte: CollecteFull;
  isClient: boolean;
  /** Cabinet : peut demander une pièce et retirer une demande. */
  peutDemander: boolean;
  /** Archivée : plus de réponse possible. */
  lectureSeule?: boolean;
  onDemander: (demande: NouvelleDemande) => Promise<void>;
  onSupprimer: (demandeId: string) => Promise<void>;
  onFournir: (demandeId: string, fichiers: NewFichier[]) => Promise<void>;
  onPreview: (fichier: CollecteFichier) => void;
}

const CATEGORIES: { key: Categorie; titre: string; bouton: string; tiers: string; exemple: string; icone: typeof Users }[] = [
  {
    key: "client",
    titre: "Pièces client",
    bouton: "Demander une pièce client",
    tiers: "Client concerné",
    exemple: "Ex. Facture de vente n° 2100001269, ou le relevé du compte client d'octobre",
    icone: Users,
  },
  {
    key: "fournisseur",
    titre: "Pièces fournisseur",
    bouton: "Demander une pièce fournisseur",
    tiers: "Fournisseur concerné",
    exemple: "Ex. Facture d'achat du fournisseur, bon de livraison ou relevé fournisseur",
    icone: Truck,
  },
];

/** Pièces demandées par le cabinet : deux listes indépendantes (pièces client, pièces fournisseur). Une note sans pièce
 * jointe, puis la société répond en ajoutant le document. */
export function PiecesDemandees({ collecte, isClient, peutDemander, lectureSeule = false, onDemander, onSupprimer, onFournir, onPreview }: Props) {
  const demandes = collecte.demandesPieces ?? [];
  const [categorieOuverte, setCategorieOuverte] = useState<Categorie | null>(null);
  const [texte, setTexte] = useState("");
  const [tiers, setTiers] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [reponseA, setReponseA] = useState<DemandePiece | null>(null);
  const courante = CATEGORIES.find((c) => c.key === categorieOuverte);

  async function envoyer() {
    if (!categorieOuverte || !texte.trim()) return;
    setEnvoi(true);
    try {
      await onDemander({ texte: texte.trim(), categorie: categorieOuverte, tiers: tiers.trim() });
      setTexte("");
      setTiers("");
      setCategorieOuverte(null);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div aria-label="Pièces demandées">
      {CATEGORIES.map((cat) => {
        const liste = demandes.filter((d) => d.categorie === cat.key);
        const enAttente = liste.filter((d) => d.statut === "en_attente").length;
        // Côté société : une catégorie sans demande n'a rien à montrer.
        if (isClient && liste.length === 0) return null;
        const Icone = cat.icone;
        return (
          <section key={cat.key} aria-label={cat.titre} className="border-b border-border">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <Icone className="size-4 text-accent" aria-hidden="true" />
              <h3 className="text-sm font-bold text-primary">{cat.titre}</h3>
              {enAttente > 0 && <span className="rounded-full bg-warning/15 px-2 text-[11px] font-semibold text-warning">{enAttente} en attente</span>}
              {peutDemander && !lectureSeule && (
                <Button type="button" variant="outline" size="sm" className="ml-auto h-8 gap-1.5 border-accent bg-accent/15 text-xs font-semibold hover:bg-accent/30" onClick={() => setCategorieOuverte(cat.key)}>
                  <FilePlus2 className="size-3.5" aria-hidden="true" />
                  {cat.bouton}
                </Button>
              )}
            </div>

            {liste.length === 0 ? (
              <p className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">
                <FileQuestion className="size-3.5" aria-hidden="true" />
                Aucune pièce {cat.key} demandée : la société reçoit une notification avec votre note et répond en ajoutant le document.
              </p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {liste.map((d) => {
                  const fournie = d.statut === "fournie";
                  const fichiers = (collecte.fichiers ?? []).filter((f) => f.demandeId === d.id);
                  return (
                    <li key={d.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", fournie ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                        {fournie ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {d.tiers && <p className="text-xs font-bold uppercase tracking-wide text-primary">{d.tiers}</p>}
                        <p className="whitespace-pre-line text-sm text-foreground">{d.texte}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Demandée par {d.demandePar || "le cabinet"} · {formatRelative(d.creeLe)}
                          {fournie && ` · fournie par ${d.fourniePar || "?"}`}
                        </p>
                        {fichiers.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {fichiers.map((f) => (
                              <li key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                                <span className="min-w-0 truncate font-medium">{f.nom}</span>
                                {f.dataUrl && (
                                  <>
                                    <button type="button" onClick={() => onPreview(f)} className="text-muted-foreground hover:text-primary" aria-label={`Aperçu de ${f.nom}`}>
                                      <Eye className="size-3.5" />
                                    </button>
                                    <button type="button" onClick={() => downloadDataUrl(f.dataUrl!, f.nom)} className="text-muted-foreground hover:text-primary" aria-label={`Télécharger ${f.nom}`}>
                                      <Download className="size-3.5" />
                                    </button>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isClient && !lectureSeule && (
                          <Button type="button" size="sm" variant={fournie ? "outline" : "default"} className="h-8 gap-1.5 text-xs font-semibold" onClick={() => setReponseA(d)}>
                            <UploadCloud className="size-3.5" aria-hidden="true" />
                            {fournie ? "Ajouter un autre document" : "Ajouter le document"}
                          </Button>
                        )}
                        {peutDemander && !lectureSeule && (
                          <button type="button" onClick={() => void onSupprimer(d.id)} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" aria-label="Retirer cette demande">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <Dialog open={categorieOuverte !== null} onOpenChange={(ouvert) => !ouvert && setCategorieOuverte(null)}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{courante?.bouton ?? "Demander une pièce"}</DialogTitle>
            <DialogDescription>Décrivez le document attendu : la société est prévenue par une notification, lit votre note et répond en ajoutant le document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="demande-piece-tiers">{courante?.tiers} (facultatif)</Label>
              <Input id="demande-piece-tiers" value={tiers} onChange={(e) => setTiers(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demande-piece-texte">Pièce demandée</Label>
              <Textarea id="demande-piece-texte" rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={courante?.exemple} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCategorieOuverte(null)}>
              Annuler
            </Button>
            <Button type="button" className="gap-2" disabled={!texte.trim() || envoi} onClick={() => void envoyer()}>
              <Send className="size-4" aria-hidden="true" />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileUploadDialog
        open={reponseA !== null}
        onOpenChange={(ouvert) => !ouvert && setReponseA(null)}
        destinationLabel={reponseA ? `Réponse à : ${reponseA.texte.slice(0, 60)}` : ""}
        onSubmit={async (fichiers) => {
          if (reponseA) await onFournir(reponseA.id, fichiers);
        }}
      />
    </div>
  );
}
