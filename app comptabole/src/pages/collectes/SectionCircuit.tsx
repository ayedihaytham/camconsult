import { useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, Clock, CornerUpLeft, Lock, Send } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SECTION_STATUT_LABELS } from "@/lib/collecte/sections";
import { cn } from "@/lib/utils";
import type { SectionStatut } from "@/types";

interface Props {
  compact?: boolean;
  label: string;
  statut: SectionStatut;
  /** Ce que le cabinet a demandé de corriger quand il a renvoyé le tableau. */
  motifRenvoi: string;
  /** Le tableau est vu par le client de la société (sinon par le cabinet). */
  isClient: boolean;
  /** Admin ou responsable : peut archiver ; un collaborateur valide et renvoie seulement. */
  canArchive: boolean;
  /** Enregistre d'abord les modifications en cours du tableau ; renvoie ce qui manque (vide si le tableau est complet). */
  preparerTransfert: () => Promise<string>;
  onTransmettre: (incomplet: boolean) => Promise<void>;
  onValider: () => Promise<void>;
  onRenvoyer: (motif: string) => Promise<void>;
  onArchiver: () => Promise<void>;
  onDesarchiver: () => Promise<void>;
}

const STYLES: Record<SectionStatut, string> = {
  brouillon: "bg-secondary text-muted-foreground",
  transmis: "bg-warning/15 text-warning",
  a_corriger: "bg-destructive/10 text-destructive",
  valide: "bg-success/15 text-success",
  archive: "bg-muted text-muted-foreground",
};

/** Barre du circuit d'UN tableau : le client l'enregistre puis le transfère au cabinet (même incomplet), le cabinet le consulte,
 * le valide ou le renvoie avec un motif ; un tableau validé reste en lecture seule et peut être archivé. */
export function SectionCircuit({
  compact = false,
  label, statut, motifRenvoi, isClient, canArchive, preparerTransfert, onTransmettre, onValider, onRenvoyer, onArchiver, onDesarchiver,
}: Props) {
  const [manque, setManque] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [motif, setMotif] = useState("");

  async function avec(action: () => Promise<void>) {
    setOccupe(true);
    try {
      await action();
    } catch {
      // l'erreur est déjà affichée par le store
    } finally {
      setOccupe(false);
    }
  }

  async function demanderTransfert() {
    await avec(async () => setManque(await preparerTransfert()));
  }

  const ouverte = statut === "brouillon" || statut === "a_corriger";
  const bouton = "min-h-9 gap-1.5";

  let aide = "";
  if (isClient) {
    aide = {
      brouillon: "Saisissez les informations, puis transférez. L'enregistrement se fait avant l'envoi.",
      a_corriger: "Complétez les informations demandées, puis transférez à nouveau au cabinet.",
      transmis: "Le cabinet examine ce tableau : il ne peut plus être modifié tant qu'il n'est pas validé ou renvoyé.",
      valide: "Validé par le cabinet : lecture seule.",
      archive: "Archivé : lecture seule.",
    }[statut];
  } else {
    aide = {
      brouillon: "Le client n'a pas encore transféré ce tableau.",
      a_corriger: "Renvoyé au client : en attente de ses corrections.",
      transmis: "Transféré par le client : consultez-le, puis validez-le ou renvoyez-le avec un motif.",
      valide: "Validé : le client ne peut plus le modifier.",
      archive: "Archivé : lecture seule pour tout le monde.",
    }[statut];
  }

  return (
    <div className="space-y-2">
      {!compact && statut === "a_corriger" && motifRenvoi && (
        <div role="note" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-foreground">
          <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">Renvoyé par le cabinet</p>
          <p className="mt-0.5 whitespace-pre-wrap">{motifRenvoi}</p>
        </div>
      )}

      <div data-tour="collecte-circuit" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 bg-muted/20 px-3 py-2", !compact && "rounded-lg border border-border")}>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold", STYLES[statut])}>
          {statut === "valide" ? <CheckCircle2 className="size-3.5" /> : statut === "transmis" ? <Clock className="size-3.5" /> : statut === "archive" ? <Archive className="size-3.5" /> : statut === "a_corriger" ? <CornerUpLeft className="size-3.5" /> : null}
          {SECTION_STATUT_LABELS[statut]}
        </span>
        <p className={cn("min-w-0 flex-1 text-xs text-muted-foreground", compact && "hidden sm:block")}>{aide}</p>

        <div className="flex flex-wrap items-center gap-2">
          {isClient && ouverte && (
            <Button type="button" variant="ledger" size="sm" className={bouton} aria-label="Enregistrer et transférer au cabinet" title="Le tableau sera enregistré avant le transfert" disabled={occupe} onClick={() => void demanderTransfert()}>
              <Send className="size-4" />
              {occupe ? "Enregistrement…" : compact ? "Transférer au cabinet" : "Enregistrer et transférer au cabinet"}
            </Button>
          )}
          {isClient && !ouverte && <Lock className="size-4 text-muted-foreground" aria-hidden="true" />}

          {!isClient && statut === "transmis" && (
            <>
              <Button type="button" variant="ledger" size="sm" className={bouton} disabled={occupe} onClick={() => void avec(onValider)}>
                <CheckCircle2 className="size-4" />
                Valider ce tableau
              </Button>
              <Button type="button" variant="outline" size="sm" className={bouton} disabled={occupe} onClick={() => setRenvoi(true)}>
                <CornerUpLeft className="size-4" />
                Renvoyer au client
              </Button>
            </>
          )}
          {!isClient && statut === "valide" && (
            <>
              <Button type="button" variant="outline" size="sm" className={bouton} disabled={occupe} onClick={() => setRenvoi(true)}>
                <CornerUpLeft className="size-4" />
                Renvoyer au client
              </Button>
              {canArchive && (
                <Button type="button" variant="outline" size="sm" className={bouton} disabled={occupe} onClick={() => void avec(onArchiver)}>
                  <Archive className="size-4" />
                  Archiver ce tableau
                </Button>
              )}
            </>
          )}
          {!isClient && statut === "archive" && canArchive && (
            <Button type="button" variant="outline" size="sm" className={bouton} disabled={occupe} onClick={() => void avec(onDesarchiver)}>
              <ArchiveRestore className="size-4" />
              Désarchiver
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={manque !== null}
        onOpenChange={(o) => !o && setManque(null)}
        destructive={false}
        title={manque ? "Transférer ce tableau incomplet ?" : "Transférer ce tableau au cabinet ?"}
        description={
          manque
            ? `Il manque encore : ${manque}. Le cabinet sera prévenu que « ${label} » est incomplet ; il pourra vous le renvoyer pour le compléter. Vous ne pourrez plus le modifier d'ici là.`
            : `« ${label} » sera transmis au cabinet pour examen. Vous ne pourrez plus le modifier tant que le cabinet ne l'a pas validé ou renvoyé.`
        }
        confirmLabel="Transférer"
        onConfirm={async () => {
          await onTransmettre(Boolean(manque));
          setManque(null);
        }}
      />

      <Dialog open={renvoi} onOpenChange={(o) => !occupe && (setRenvoi(o), !o && setMotif(""))}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Renvoyer « {label} » au client</DialogTitle>
            <DialogDescription>Dites au client ce qu'il doit corriger ou compléter. Le tableau redevient modifiable pour lui.</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={4}
            placeholder="Ex. : il manque les chèques du 15 au 20 janvier ; le montant du bordereau 255558 est à vérifier."
            aria-label="Motif du renvoi"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={occupe} onClick={() => { setRenvoi(false); setMotif(""); }}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="ledger"
              disabled={occupe || !motif.trim()}
              onClick={() =>
                void avec(async () => {
                  await onRenvoyer(motif.trim());
                  setRenvoi(false);
                  setMotif("");
                })
              }
            >
              Renvoyer au client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
