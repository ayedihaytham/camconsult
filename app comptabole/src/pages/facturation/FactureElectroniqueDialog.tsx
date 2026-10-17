import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileCode2, LoaderCircle, PenLine, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import type { EinvoiceEtat, EinvoiceProbleme, Facture } from "@/types";
import { SignatureDeverrouillage } from "./SignatureDeverrouillage";

interface Props {
  /** Facture concernée ; null = fenêtre fermée. */
  facture: Facture | null;
  onOpenChange: (open: boolean) => void;
  /** Ouvre la fenêtre « Informations du cabinet » (identité à compléter). */
  onOpenCabinet: () => void;
  /** Ouvre la fenêtre « Signature électronique » (certificat à charger). */
  onOpenSignature: () => void;
  /** Ouvre la fenêtre « Accès TTN » (adresse et identifiants à saisir). */
  onOpenTtn: () => void;
}

const OU: Record<EinvoiceProbleme["ou"], string> = { cabinet: "Cabinet", societe: "Client", facture: "Facture" };

/**
 * Facture électronique (El Fatoora) : contrôle de conformité, préparation du message TEIF, signature XAdES avec le certificat du cabinet
 * et téléchargement du XML. Le dépôt automatique chez TTN n'est pas encore pris en charge : le fichier se dépose sur le portail El Fatoora.
 */
export function FactureElectroniqueDialog({ facture, onOpenChange, onOpenCabinet, onOpenSignature, onOpenTtn }: Props) {
  const conformite = useFacturation((s) => s.conformite);
  const preparer = useFacturation((s) => s.preparer);
  const telechargerXml = useFacturation((s) => s.telechargerXml);
  const signature = useFacturation((s) => s.signature);
  const fetchSignature = useFacturation((s) => s.fetchSignature);
  const signer = useFacturation((s) => s.signer);
  const ttn = useFacturation((s) => s.ttn);
  const fetchTtn = useFacturation((s) => s.fetchTtn);
  const deposer = useFacturation((s) => s.deposer);
  const actualiser = useFacturation((s) => s.actualiser);
  const rouvrir = useFacturation((s) => s.rouvrir);
  // La ligne du magasin suit les changements (préparation) sans rouvrir la fenêtre.
  const courante = useFacturation((s) => s.list.find((f) => f.id === facture?.id)) ?? facture;

  const [etat, setEtat] = useState<EinvoiceEtat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [confirmerRegeneration, setConfirmerRegeneration] = useState(false);
  const [confirmerSignature, setConfirmerSignature] = useState(false);
  const [confirmerDepot, setConfirmerDepot] = useState(false);
  const [confirmerReouverture, setConfirmerReouverture] = useState(false);

  const id = facture?.id ?? null;
  const statutEi = (useFacturation((s) => s.list.find((f) => f.id === id)) ?? facture)?.einvoice?.statut;
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

  // L'état de la signature (certificat, verrouillage) n'est utile que pour une facture préparée.
  useEffect(() => {
    if (id && statutEi === "prete") fetchSignature().catch(() => undefined);
  }, [id, statutEi, fetchSignature]);

  // L'état de l'accès TTN (adresse, environnement) sert dès que la facture est signée.
  useEffect(() => {
    if (id && (statutEi === "signee" || statutEi === "deposee")) fetchTtn().catch(() => undefined);
  }, [id, statutEi, fetchTtn]);

  /** Exécute une opération TTN ; en cas de refus (déjà déposée, accès absents, service injoignable…), on remontre l'état réel. */
  async function operationTtn(action: () => Promise<EinvoiceEtat>, succes: string) {
    setOccupe(true);
    try {
      setEtat(await action());
      toast.success(succes);
    } catch {
      await verifier();
    } finally {
      setOccupe(false);
    }
  }

  async function lancerSignature() {
    if (!id) return;
    setOccupe(true);
    try {
      setEtat(await signer(id));
      toast.success("Facture électronique signée");
    } catch {
      await verifier(); // refus (verrouillée, données modifiées…) : on remontre l'état réel
    } finally {
      setOccupe(false);
    }
  }

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
  const signee = courante?.einvoice?.statut === "signee";
  const deposee = courante?.einvoice?.statut === "deposee";
  const validee = courante?.einvoice?.statut === "validee";
  const rejetee = courante?.einvoice?.statut === "rejetee";
  const estSignee = signee || deposee || validee || rejetee;
  const ei = courante?.einvoice ?? null;
  const reel = ttn?.connexion?.environnement === "reel";
  const annulee = courante?.statut === "annulee";
  const certificat = signature?.certificat ?? null;
  const peutSigner = prete && !annulee && Boolean(signature?.configuree) && Boolean(certificat) && !certificat?.expire && Boolean(signature?.deverrouille);

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
              Message TEIF {etat?.version ?? ""} au format El Fatoora, {estSignee ? <strong>signé</strong> : <strong>non signé</strong>}.{" "}
              {validee ? "Validé par TTN." : deposee ? "Déposé chez TTN, en attente de validation." : rejetee ? "Rejeté par TTN." : estSignee ? "Il peut être déposé chez TTN." : "À signer avant le dépôt chez TTN."}
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

              {prete && !annulee && (
                <section aria-label="Signature électronique" className="space-y-2 rounded-md border border-border px-3 py-2 text-sm">
                  <h3 className="flex items-center gap-2 font-semibold text-primary">
                    <PenLine className="size-4" aria-hidden="true" /> Signature électronique
                  </h3>
                  {!signature ? (
                    <p className="text-muted-foreground">Vérification de l'état de la signature…</p>
                  ) : !signature.configuree ? (
                    <p className="text-muted-foreground">La signature n'est pas activée sur ce serveur (clé de chiffrement absente).</p>
                  ) : !certificat ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-muted-foreground">Aucun certificat de signature n'est enregistré.</p>
                      <Button type="button" variant="outline" size="sm" onClick={onOpenSignature}>
                        Charger le certificat
                      </Button>
                    </div>
                  ) : certificat.expire ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-destructive">Le certificat de signature est expiré.</p>
                      <Button type="button" variant="outline" size="sm" onClick={onOpenSignature}>
                        Remplacer le certificat
                      </Button>
                    </div>
                  ) : (
                    <SignatureDeverrouillage idPrefixe="ei-sig" />
                  )}
                </section>
              )}

              {estSignee && ei && (
                <section aria-label="Facture signée" className="space-y-1 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-success">
                    <ShieldCheck className="size-4" aria-hidden="true" /> Facture électronique signée
                  </p>
                  <p className="text-muted-foreground">
                    Signée le {ei.signeLe ? formatDate(ei.signeLe) : "—"}. Le fichier est figé : toute correction passera par un avoir{rejetee ? " (sauf rejet par TTN : voir ci-dessous)" : ""}.
                  </p>
                </section>
              )}

              {estSignee && !annulee && (
                <section aria-label="Dépôt chez TTN" className="space-y-2 rounded-md border border-border px-3 py-2 text-sm">
                  <h3 className="flex items-center gap-2 font-semibold text-primary">
                    <Send className="size-4" aria-hidden="true" /> Dépôt chez TTN
                    {ttn?.connexion && (
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${reel ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning"}`}>
                        {reel ? "Réel" : "Test"}
                      </span>
                    )}
                  </h3>
                  {signee && !ttn?.connexion && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-muted-foreground">{ttn && !ttn.configuree ? "L'accès à TTN n'est pas activé sur ce serveur." : "Les accès TTN ne sont pas encore enregistrés."}</p>
                      {(!ttn || ttn.configuree) && (
                        <Button type="button" variant="outline" size="sm" onClick={onOpenTtn}>
                          Configurer l'accès TTN
                        </Button>
                      )}
                    </div>
                  )}
                  {signee && ttn?.connexion && <p className="text-muted-foreground">Prête à être déposée sur {reel ? "le service RÉEL" : "le service de TEST"} de TTN.</p>}
                  {deposee && (
                    <p className="text-muted-foreground">
                      Déposée le {ei?.deposeLe ? formatDate(ei.deposeLe) : "—"}. TTN n'a pas encore rendu sa décision : la vérification est automatique (toutes les 5 minutes) ou immédiate avec « Actualiser ».
                    </p>
                  )}
                  {validee && (
                    <p className="text-success">
                      Validée par TTN{ei?.refTtnDate ? ` le ${formatDate(ei.refTtnDate)}` : ""}. Référence : <code className="break-all">{ei?.refTtn}</code>. Le QR officiel s'imprime sur la facture.
                    </p>
                  )}
                  {rejetee && (
                    <div className="space-y-1">
                      <p className="font-semibold text-destructive">TTN a rejeté cette facture.</p>
                      {(ei?.acquittements ?? []).length > 0 ? (
                        <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                          {(ei?.acquittements ?? []).map((a, i) => (
                            <li key={i}>{Object.values(a).join(" — ")}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">Aucun motif détaillé n'a été renvoyé.</p>
                      )}
                      <p className="text-muted-foreground">Rouvrez la facture pour la corriger, la régénérer, la signer de nouveau et la redéposer.</p>
                    </div>
                  )}
                  {ei?.messageTtn && <p className="text-xs text-muted-foreground">Message de TTN : « {ei.messageTtn} »</p>}
                  {ei?.erreurTtn && <p className="text-xs text-destructive">Dernier échec de communication : {ei.erreurTtn}</p>}
                </section>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-destructive">Impossible de vérifier la facture pour le moment.</p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {estSignee ? (
              <>
                <Button type="button" variant="outline" disabled={annulee} onClick={() => facture && void telechargerXml(facture.id, facture.numero, "non-signe")}>
                  Sans signature
                </Button>
                {validee && (
                  <Button type="button" variant="outline" onClick={() => facture && void telechargerXml(facture.id, facture.numero, "ttn")}>
                    <Download className="mr-1 size-4" aria-hidden="true" /> XML validé TTN
                  </Button>
                )}
                <Button type="button" variant={signee || validee ? "outline" : "ledger"} disabled={annulee} onClick={() => facture && void telechargerXml(facture.id, facture.numero, "signe")}>
                  <Download className="mr-1 size-4" aria-hidden="true" /> Télécharger le XML signé
                </Button>
                {deposee && (
                  <Button type="button" variant="ledger" disabled={occupe} onClick={() => id && void operationTtn(() => actualiser(id), "État vérifié auprès de TTN")}>
                    <RefreshCw className="mr-1 size-4" aria-hidden="true" /> {occupe ? "Vérification…" : "Actualiser"}
                  </Button>
                )}
                {rejetee && (
                  <Button type="button" variant="ledger" disabled={occupe || annulee} onClick={() => setConfirmerReouverture(true)}>
                    <RotateCcw className="mr-1 size-4" aria-hidden="true" /> Rouvrir pour corriger
                  </Button>
                )}
                {signee && (
                  <Button type="button" variant="ledger" disabled={occupe || annulee || !ttn?.connexion} onClick={() => setConfirmerDepot(true)}>
                    <Send className="mr-1 size-4" aria-hidden="true" /> {occupe ? "Dépôt…" : "Déposer chez TTN"}
                  </Button>
                )}
              </>
            ) : prete ? (
              <>
                <Button type="button" variant="outline" disabled={occupe || annulee || !etat?.pret} onClick={() => setConfirmerRegeneration(true)}>
                  Régénérer
                </Button>
                <Button type="button" variant="outline" disabled={occupe || annulee} onClick={() => facture && void telechargerXml(facture.id, facture.numero)}>
                  <Download className="mr-1 size-4" aria-hidden="true" /> Télécharger le XML
                </Button>
                <Button type="button" variant="ledger" disabled={occupe || !peutSigner || !etat?.pret} onClick={() => setConfirmerSignature(true)}>
                  {occupe ? "Signature…" : "Signer la facture"}
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

      <ConfirmDialog
        open={confirmerDepot}
        onOpenChange={setConfirmerDepot}
        title={reel ? "Déposer cette facture chez TTN (RÉEL) ?" : "Déposer cette facture chez TTN (test) ?"}
        destructive={false}
        description={
          reel
            ? "ENVIRONNEMENT RÉEL : le dépôt est définitif. Une facture déposée ne peut plus être modifiée ni annulée ici ; en cas d'erreur, TTN peut la rejeter ou un avoir sera nécessaire."
            : "Environnement de TEST : la facture est envoyée au service de test de TTN. Elle ne peut plus être modifiée ici une fois déposée."
        }
        confirmLabel="Déposer"
        onConfirm={async () => {
          setConfirmerDepot(false);
          if (id) await operationTtn(() => deposer(id), "Facture déposée chez TTN");
        }}
      />

      <ConfirmDialog
        open={confirmerReouverture}
        onOpenChange={setConfirmerReouverture}
        title="Rouvrir la facture pour correction ?"
        destructive={false}
        description="La signature et le dépôt sont effacés ; la facture redevient « préparée ». Corrigez-la (menu ⋯ › Modifier), régénérez le fichier, signez-le de nouveau puis redéposez-le."
        confirmLabel="Rouvrir"
        onConfirm={async () => {
          setConfirmerReouverture(false);
          if (id) await operationTtn(() => rouvrir(id), "Facture rouverte : elle peut être corrigée");
        }}
      />

      <ConfirmDialog
        open={confirmerSignature}
        onOpenChange={setConfirmerSignature}
        title="Signer la facture électronique ?"
        destructive={false}
        description="La facture est signée avec le certificat du cabinet. Une fois signée, elle ne peut plus être régénérée, modifiée ni annulée ici : toute correction passera par un avoir."
        confirmLabel="Signer"
        onConfirm={async () => {
          setConfirmerSignature(false);
          await lancerSignature();
        }}
      />
    </>
  );
}
