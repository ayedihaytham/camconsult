import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileKey2, LoaderCircle, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import { SignatureDeverrouillage } from "./SignatureDeverrouillage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Certificat de signature électronique du cabinet (facture électronique El Fatoora).
 * Le fichier .p12 / .pfx est envoyé au serveur, qui le chiffre avant de l'enregistrer ; le mot de passe n'est ni enregistré ni affiché.
 */
export function SignatureElectroniqueDialog({ open, onOpenChange }: Props) {
  const signature = useFacturation((s) => s.signature);
  const fetchSignature = useFacturation((s) => s.fetchSignature);
  const chargerCertificat = useFacturation((s) => s.chargerCertificat);
  const supprimerCertificat = useFacturation((s) => s.supprimerCertificat);

  const [chargement, setChargement] = useState(false);
  const [remplacer, setRemplacer] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const champFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setRemplacer(false);
    setFichier(null);
    setMotDePasse("");
    setAvertissements([]);
    setChargement(true);
    fetchSignature()
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, [open, fetchSignature]);

  async function charger() {
    if (!fichier || !motDePasse) return;
    const saisi = motDePasse;
    setMotDePasse("");
    setOccupe(true);
    try {
      const etat = await chargerCertificat(fichier, saisi);
      setAvertissements(etat.avertissements ?? []);
      setFichier(null);
      setRemplacer(false);
      if (champFichier.current) champFichier.current.value = "";
      toast.success("Certificat enregistré (chiffré) — signature déverrouillée");
    } catch {
      // Message déjà affiché par le magasin (mot de passe incorrect, certificat expiré…).
    } finally {
      setOccupe(false);
    }
  }

  const certificat = signature?.certificat ?? null;
  const formulaire = signature?.configuree && (!certificat || remplacer);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileKey2 className="size-5 text-accent" aria-hidden="true" />
              Signature électronique
            </DialogTitle>
            <DialogDescription>
              Certificat du cabinet (fichier .p12 ou .pfx) servant à signer les factures électroniques El Fatoora. Le fichier est <strong>chiffré</strong> avant
              d'être enregistré ; le mot de passe n'est <strong>jamais conservé</strong> : il est demandé pour déverrouiller la signature (15 minutes).
            </DialogDescription>
          </DialogHeader>

          {chargement && !signature ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : !signature ? (
            <p className="py-4 text-sm text-destructive">Impossible de lire l'état de la signature pour le moment.</p>
          ) : (
            <div className="space-y-4">
              {!signature.configuree && (
                <p className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    La signature électronique n'est pas activée sur ce serveur : la clé qui chiffre le certificat (<code>SIGNATURE_CLE_SECRET</code>) n'est pas
                    définie. Demandez à l'administrateur technique de la configurer.
                  </span>
                </p>
              )}

              {certificat && (
                <section aria-label="Certificat enregistré" className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    {certificat.expire ? (
                      <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    )}
                    {certificat.expire ? "Certificat expiré" : "Certificat enregistré"}
                  </p>
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                    <dt>Titulaire</dt>
                    <dd className="break-words text-foreground">{certificat.sujet}</dd>
                    <dt>Émetteur</dt>
                    <dd className="break-words text-foreground">{certificat.emetteur}</dd>
                    <dt>Validité</dt>
                    <dd className="text-foreground">
                      du {formatDate(certificat.validDu)} au {formatDate(certificat.validAu)}
                    </dd>
                    <dt>Empreinte</dt>
                    <dd>
                      <code className="break-all text-xs text-foreground">{certificat.empreinte}</code>
                    </dd>
                    <dt>Chargé</dt>
                    <dd className="text-foreground">
                      le {formatDate(certificat.chargeLe)}
                      {certificat.chargePar ? ` par ${certificat.chargePar}` : ""}
                    </dd>
                  </dl>
                </section>
              )}

              {avertissements.map((a) => (
                <p key={a} className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                  {a}
                </p>
              ))}

              {certificat && !certificat.expire && <SignatureDeverrouillage idPrefixe="sig-dlg" />}

              {formulaire && (
                <form
                  className="space-y-3 border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void charger();
                  }}
                >
                  <h3 className="text-sm font-semibold text-primary">{certificat ? "Remplacer le certificat" : "Charger le certificat"}</h3>
                  <CardField id="sig-fichier" label="Fichier du certificat (.p12 ou .pfx)">
                    <input
                      id="sig-fichier"
                      ref={champFichier}
                      type="file"
                      accept=".p12,.pfx,application/x-pkcs12"
                      onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                      className={CARD_FIELD_INPUT}
                    />
                  </CardField>
                  <CardField id="sig-mdp" label="Mot de passe du certificat" hint="Utilisé une seule fois pour vérifier le fichier ; jamais enregistré.">
                    <input
                      id="sig-mdp"
                      type="password"
                      autoComplete="off"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      className={CARD_FIELD_INPUT}
                    />
                  </CardField>
                  <div className="flex flex-wrap justify-end gap-2">
                    {remplacer && (
                      <Button type="button" variant="ghost" onClick={() => setRemplacer(false)}>
                        Annuler
                      </Button>
                    )}
                    <Button type="submit" variant="ledger" disabled={!fichier || !motDePasse || occupe}>
                      {occupe ? "Vérification…" : "Enregistrer le certificat"}
                    </Button>
                  </div>
                </form>
              )}

              {certificat && !remplacer && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  <Button type="button" variant="outline" disabled={!signature.configuree} onClick={() => setRemplacer(true)}>
                    Remplacer
                  </Button>
                  <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmerSuppression(true)}>
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmerSuppression}
        onOpenChange={setConfirmerSuppression}
        title="Supprimer le certificat ?"
        description="Le certificat chiffré est effacé du serveur. Les factures déjà signées restent valables ; pour en signer de nouvelles, il faudra recharger le fichier et son mot de passe."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          setConfirmerSuppression(false);
          try {
            await supprimerCertificat();
            toast.success("Certificat supprimé");
          } catch {
            // Message déjà affiché par le magasin.
          }
        }}
      />
    </>
  );
}
