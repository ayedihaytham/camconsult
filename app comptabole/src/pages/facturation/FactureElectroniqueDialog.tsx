import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileCode2, LoaderCircle, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import type { EinvoiceEtat, EinvoiceProbleme, Facture } from "@/types";

interface Props {
  /** Facture concernée ; null = fenêtre fermée. */
  facture: Facture | null;
  onOpenChange: (open: boolean) => void;
  /** Ouvre la fenêtre « Informations du cabinet » (identité à compléter). */
  onOpenCabinet: () => void;
}

const OU: Record<EinvoiceProbleme["ou"], string> = { cabinet: "Cabinet", societe: "Client", facture: "Facture" };

/**
 * Facture électronique (El Fatoora) — étape 1 : contrôle de conformité, préparation du message TEIF non signé et téléchargement du XML.
 * La signature électronique et le dépôt chez TTN ne sont pas encore pris en charge : le fichier se dépose sur le portail El Fatoora.
 */
export function FactureElectroniqueDialog({ facture, onOpenChange, onOpenCabinet }: Props) {
  const conformite = useFacturation((s) => s.conformite);
  const preparer = useFacturation((s) => s.preparer);
  const telechargerXml = useFacturation((s) => s.telechargerXml);
  // La ligne du magasin suit les changements (préparation) sans rouvrir la fenêtre.
  const courante = useFacturation((s) => s.list.find((f) => f.id === facture?.id)) ?? facture;

  const [etat, setEtat] = useState<EinvoiceEtat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [confirmerRegeneration, setConfirmerRegeneration] = useState(false);

  const id = facture?.id ?? null;
  const verifier = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    try {
      setEtat(await conformite(id));
    } catch {
      setEtat(null); // message déjà affiché par le store
    } finally {
      setChargement(false);
    }
  }, [id, conformite]);

  useEffect(() => {
    setEtat(null);
    if (id) void verifier();
  }, [id, verifier]);

  async function lancer(regenerer: boolean) {
    if (!id) return;
    setOccupe(true);
    try {
      const resultat = await preparer(id, regenerer);
      setEtat(resultat);
      toast.success(regenerer ? "Facture électronique régénérée" : "Facture électronique préparée");
    } catch {
      await verifier(); // refus (non conforme, déjà préparée…) : on remontre l'état réel
    } finally {
      setOccupe(false);
    }
  }

  const bloquants = etat?.problemes.filter((p) => p.niveau === "bloquant") ?? [];
  const avertissements = etat?.problemes.filter((p) => p.niveau === "avertissement") ?? [];
  const prete = courante?.einvoice?.statut === "prete";
  const annulee = courante?.statut === "annulee";

  return (
    <>
      <Dialog open={facture !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="size-5 text-accent" aria-hidden="true" />
              Facture électronique {facture?.numero}
            </DialogTitle>
            <DialogDescription>
              Message TEIF {etat?.version ?? ""} au format El Fatoora, <strong>non signé</strong>. La signature et le dépôt automatique ne sont pas encore
              disponibles : le fichier se dépose sur le portail El Fatoora.
            </DialogDescription>
          </DialogHeader>

          {chargement && !etat ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Vérification en cours…
            </p>
          ) : etat ? (
            <div className="space-y-4">
              {bloquants.length > 0 ? (
                <section aria-label="Points à corriger" className="space-y-2">
                  <h3 className="text-sm font-semibold text-destructive">À corriger avant de préparer la facture ({bloquants.length})</h3>
                  <ul className="space-y-1.5">
                    {bloquants.map((p, i) => (
                      <li key={`${p.ou}-${p.champ}-${i}`} className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                        <span>
                          <span className="font-semibold">{OU[p.ou]} · </span>
                          {p.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {bloquants.some((p) => p.ou === "cabinet") && (
                      <Button type="button" variant="outline" size="sm" onClick={onOpenCabinet}>
                        Compléter les informations du cabinet
                      </Button>
                    )}
                    {bloquants.some((p) => p.ou === "societe") && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/societes">Compléter la société cliente</Link>
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => void verifier()} disabled={chargement}>
                      <RefreshCw className="mr-1 size-4" aria-hidden="true" /> Revérifier
                    </Button>
                  </div>
                </section>
              ) : (
                <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> La facture est conforme : le message peut être produit.
                </p>
              )}

              {avertissements.length > 0 && (
                <section aria-label="Avertissements" className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-warning">À vérifier</h3>
                  <ul className="space-y-1.5">
                    {avertissements.map((p, i) => (
                      <li key={`${p.ou}-${p.champ}-${i}`} className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                        <span className="font-semibold">{OU[p.ou]} · </span>
                        {p.message}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {prete && courante?.einvoice && (
                <section aria-label="Fichier préparé" className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">Fichier prêt</p>
                  <p className="text-muted-foreground">
                    Préparé le {courante.einvoice.genereLe ? formatDate(courante.einvoice.genereLe) : "—"}. Empreinte SHA-256 :{" "}
                    <code className="break-all text-xs">{courante.einvoice.sha256}</code>
                  </p>
                </section>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-destructive">Impossible de vérifier la facture pour le moment.</p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {prete ? (
              <>
                <Button type="button" variant="outline" disabled={occupe || annulee || !etat?.pret} onClick={() => setConfirmerRegeneration(true)}>
                  Régénérer
                </Button>
                <Button type="button" variant="ledger" disabled={occupe || annulee} onClick={() => facture && void telechargerXml(facture.id, facture.numero)}>
                  <Download className="mr-1 size-4" aria-hidden="true" /> Télécharger le XML
                </Button>
              </>
            ) : (
              <Button type="button" variant="ledger" disabled={occupe || chargement || !etat?.pret || annulee} onClick={() => void lancer(false)}>
                {occupe ? "Préparation…" : "Préparer la facture électronique"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmerRegeneration}
        onOpenChange={setConfirmerRegeneration}
        title="Régénérer le fichier ?"
        destructive={false}
        description="Le message est refait à partir des données actuelles du cabinet, du client et de la facture. Le fichier précédent est remplacé ; cette action n'est possible que tant que la facture n'est ni signée ni déposée."
        confirmLabel="Régénérer"
        onConfirm={async () => {
          setConfirmerRegeneration(false);
          await lancer(true);
        }}
      />
    </>
  );
}
