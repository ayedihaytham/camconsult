import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import { AIDE, CHAMP, Carte, ETIQUETTE, FenetreFacturation, Puce, Rubrique, Valeurs } from "./FenetreFacturation";
import { SignatureDeverrouillage } from "./SignatureDeverrouillage";
import { JOURS_AVANT_EXPIRATION, joursRestants } from "./miseEnRoute";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JOUR_MS = 24 * 3600 * 1000;
const octets = (n: number) => (n < 1024 ? `${n} o` : `${(n / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`);

/**
 * Certificat de signature électronique du cabinet (facture électronique El Fatoora).
 * Le fichier .p12 / .pfx est envoyé au serveur, qui le chiffre avant de l'enregistrer ; le mot de passe n'est ni enregistré ni affiché.
 * Carte de droite : certificat enregistré (titulaire, validité avec jauge, empreinte) et rappel de sécurité.
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
  const [survol, setSurvol] = useState(false);
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

  function choisir(f: File | null | undefined) {
    if (!f) return;
    if (!/\.(p12|pfx)$/i.test(f.name)) {
      toast.error("Choisissez un fichier .p12 ou .pfx.");
      return;
    }
    setFichier(f);
  }

  function retirer() {
    setFichier(null);
    if (champFichier.current) champFichier.current.value = "";
  }

  async function charger() {
    if (!fichier || !motDePasse) return;
    const saisi = motDePasse;
    setMotDePasse("");
    setOccupe(true);
    try {
      const etat = await chargerCertificat(fichier, saisi);
      setAvertissements(etat.avertissements ?? []);
      retirer();
      setRemplacer(false);
      toast.success("Certificat enregistré (chiffré) — signature déverrouillée");
    } catch {
      // Message déjà affiché par le magasin (mot de passe incorrect, certificat expiré…).
    } finally {
      setOccupe(false);
    }
  }

  const certificat = signature?.certificat ?? null;
  const formulaire = Boolean(signature?.configuree) && (!certificat || remplacer);
  const etape = !fichier ? 1 : !motDePasse ? 2 : 3;
  const pret = Boolean(fichier && motDePasse) && !occupe;

  // Jauge de validité : part de la période restante.
  const restant = certificat && !certificat.expire ? joursRestants(certificat.validAu) : 0;
  const total = certificat ? Math.max(1, Math.round((new Date(certificat.validAu).getTime() - new Date(certificat.validDu).getTime()) / JOUR_MS)) : 1;
  const pct = Math.max(0, Math.min(100, (restant / total) * 100));
  const bientot = certificat !== null && !certificat.expire && restant <= JOURS_AVANT_EXPIRATION;

  const message = formulaire
    ? !fichier
      ? "Choisissez le fichier et saisissez son mot de passe."
      : !motDePasse
        ? "Saisissez le mot de passe du certificat."
        : "Prêt : le fichier sera vérifié puis chiffré."
    : bientot
      ? "Pensez à renouveler le certificat avant son expiration."
      : "";

  return (
    <>
      <FenetreFacturation
        open={open}
        onOpenChange={onOpenChange}
        titre="Signature électronique"
        description="Certificat du cabinet (fichier .p12 ou .pfx) servant à signer les factures électroniques. Le fichier est chiffré avant d'être enregistré ; le mot de passe n'est jamais conservé."
        aside={
          signature ? (
            <>
              {certificat ? (
                <Carte titre={certificat.expire ? "Certificat expiré" : "Certificat enregistré"}>
                  <Valeurs
                    lignes={[
                      ["Titulaire", certificat.sujet],
                      ["Émetteur", certificat.emetteur],
                      ["Valide du", formatDate(certificat.validDu)],
                      ["au", formatDate(certificat.validAu)],
                      ["Empreinte", <code key="e" className="break-all text-[11px]">{certificat.empreinte}</code>],
                      ["Chargé", `le ${formatDate(certificat.chargeLe)}${certificat.chargePar ? ` par ${certificat.chargePar}` : ""}`],
                    ]}
                  />
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Validité restante">
                    <div className={cn("h-full rounded-full", certificat.expire ? "bg-destructive" : bientot ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
                  </div>
                  <Puce ton={certificat.expire ? "erreur" : bientot ? "alerte" : "ok"}>
                    {certificat.expire ? `Expiré depuis le ${formatDate(certificat.validAu)}` : bientot ? `Expire dans ${restant} jour${restant > 1 ? "s" : ""} : à renouveler` : `Valide encore ${restant} jour${restant > 1 ? "s" : ""}`}
                  </Puce>
                </Carte>
              ) : (
                <Carte titre="Aucun certificat">
                  <p className={AIDE}>Chargez le certificat du cabinet pour pouvoir signer les factures électroniques.</p>
                  <Puce ton="alerte">Signature impossible pour l'instant</Puce>
                </Carte>
              )}
              <Carte titre="Sécurité" serif={false}>
                <ul className={cn(AIDE, "space-y-1")}>
                  <li>• Fichier chiffré (AES-256) avant enregistrement.</li>
                  <li>• Mot de passe jamais conservé.</li>
                  <li>• Clé gardée en mémoire 15 minutes seulement.</li>
                </ul>
              </Carte>
            </>
          ) : undefined
        }
        pied={
          <>
            {certificat && !remplacer && (
              <Button type="button" variant="ghost" className="h-auto px-1 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmerSuppression(true)}>
                Supprimer le certificat
              </Button>
            )}
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
            <div className="ml-auto flex gap-3">
              <Button type="button" variant="outline" className="h-11 rounded-lg px-6" onClick={() => (remplacer ? setRemplacer(false) : onOpenChange(false))}>
                {remplacer ? "Annuler" : "Fermer"}
              </Button>
              {formulaire && (
                <Button type="button" variant="ledger" className="h-11 rounded-lg px-6 text-sm uppercase tracking-[0.14em]" disabled={!pret} onClick={() => void charger()}>
                  {occupe ? "Vérification…" : "Enregistrer le certificat"}
                </Button>
              )}
            </div>
          </>
        }
      >
        {chargement && !signature ? (
          <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
        ) : !signature ? (
          <p className="py-4 text-sm text-destructive">Impossible de lire l'état de la signature pour le moment.</p>
        ) : (
          <>
            {!signature.configuree && (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3 text-sm">
                La signature électronique n'est pas activée sur ce serveur : la clé qui chiffre le certificat (<code>SIGNATURE_CLE_SECRET</code>) n'est pas définie. Demandez à l'administrateur technique de la configurer.
              </p>
            )}

            {avertissements.map((a) => (
              <p key={a} className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm">
                {a}
              </p>
            ))}

            {certificat && !remplacer && !certificat.expire && (
              <Rubrique titre="Verrouillage de la signature">
                <SignatureDeverrouillage idPrefixe="sig-dlg" />
              </Rubrique>
            )}

            {formulaire && (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void charger();
                }}
              >
                <Rubrique titre={certificat ? "Remplacer le certificat" : "Charger le certificat"}>
                  <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground" aria-label="Étapes">
                    {["Fichier", "Mot de passe", "Vérification"].map((nom, i) => (
                      <li key={nom} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "grid size-5 place-items-center rounded-full bg-muted text-[11px]",
                            etape === i + 1 && "bg-primary text-primary-foreground",
                            etape > i + 1 && "bg-success text-white",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className={cn(etape === i + 1 && "text-primary")}>{nom}</span>
                        {i < 2 && <span aria-hidden="true">→</span>}
                      </li>
                    ))}
                  </ol>

                  <input
                    id="sig-fichier"
                    ref={champFichier}
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12"
                    aria-label="Fichier du certificat (.p12 ou .pfx)"
                    className="sr-only"
                    onChange={(e) => choisir(e.target.files?.[0])}
                  />
                  {fichier ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/[0.08] px-3 py-1.5 text-sm font-semibold text-success">
                        <FileCheck2 className="size-4" aria-hidden="true" /> {fichier.name} · {octets(fichier.size)}
                      </span>
                      <button type="button" className="text-xs font-semibold text-primary underline underline-offset-4" onClick={retirer}>
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Choisir le fichier du certificat"
                      onClick={() => champFichier.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          champFichier.current?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setSurvol(true);
                      }}
                      onDragLeave={() => setSurvol(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setSurvol(false);
                        choisir(e.dataTransfer.files?.[0]);
                      }}
                      className={cn(
                        "grid cursor-pointer justify-items-center gap-1.5 rounded-xl border-2 border-dashed border-input bg-background/60 px-4 py-6 text-center transition-colors hover:border-accent hover:bg-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        survol && "border-accent bg-accent/[0.08]",
                      )}
                    >
                      <Upload className="size-6 text-accent" aria-hidden="true" />
                      <b className="text-[13.5px] text-primary">Glissez le fichier ici ou cliquez pour le choisir</b>
                      <span className={AIDE}>Formats .p12 ou .pfx — le fichier reste sur votre poste jusqu'à l'enregistrement.</span>
                    </div>
                  )}

                  <label className={ETIQUETTE}>
                    Mot de passe du certificat
                    <Input id="sig-mdp" aria-label="Mot de passe du certificat" type="password" autoComplete="off" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={CHAMP} placeholder="Utilisé une seule fois pour vérifier le fichier" />
                    <span className={AIDE}>Jamais enregistré. Il sera redemandé pour déverrouiller la signature (15 minutes).</span>
                  </label>
                </Rubrique>
              </form>
            )}

            {certificat && !remplacer && (
              <Rubrique titre="Remplacer le certificat">
                <p className={AIDE}>Un nouveau fichier remplace l'actuel ; les factures déjà signées restent valables.</p>
                <Button type="button" variant="outline" size="sm" disabled={!signature.configuree} onClick={() => setRemplacer(true)}>
                  Choisir un autre fichier…
                </Button>
              </Rubrique>
            )}
          </>
        )}
      </FenetreFacturation>

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
