import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normaliserMatriculeFiscal } from "../../../shared/mf.js";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import type { TtnEnvironnement } from "@/types";
import { AIDE, CHAMP, Carte, ETIQUETTE, FenetreFacturation, Puce, Rubrique, Valeurs } from "./FenetreFacturation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dateHeure = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Accès au service web El Fatoora de TTN : adresse, environnement (test / réel), identifiants, matricule déclaré chez TTN.
 * Le mot de passe est chiffré côté serveur et n'est jamais relu. La carte d'état montre ce qui est enregistré et le dernier essai ;
 * « Tester la connexion » interroge le service sans rien déposer (il porte sur les accès ENREGISTRÉS).
 */
export function TtnConnexionDialog({ open, onOpenChange }: Props) {
  const ttn = useFacturation((s) => s.ttn);
  const cabinet = useFacturation((s) => s.cabinet);
  const fetchTtn = useFacturation((s) => s.fetchTtn);
  const enregistrerTtn = useFacturation((s) => s.enregistrerTtn);
  const supprimerTtn = useFacturation((s) => s.supprimerTtn);
  const testerTtn = useFacturation((s) => s.testerTtn);

  const [url, setUrl] = useState("");
  const [login, setLogin] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [changerMdp, setChangerMdp] = useState(false);
  const [matricule, setMatricule] = useState("");
  const [environnement, setEnvironnement] = useState<TtnEnvironnement>("test");
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [resultatTest, setResultatTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotDePasse("");
    setChangerMdp(false);
    setResultatTest(null);
    setChargement(true);
    fetchTtn()
      .then((etat) => {
        setUrl(etat.connexion?.url ?? "");
        setLogin(etat.connexion?.login ?? "");
        setMatricule(etat.connexion?.matricule ?? "");
        setEnvironnement(etat.connexion?.environnement ?? "test");
      })
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, [open, fetchTtn]);

  const connexion = ttn?.connexion ?? null;
  const demandeMdp = !connexion || changerMdp;
  const peutEnregistrer = Boolean(url.trim() && login.trim() && (!demandeMdp || motDePasse)) && !occupe;
  // Des modifications non enregistrées : l'essai de connexion porterait sur d'anciens accès.
  const modifie = Boolean(connexion) && (url.trim() !== connexion!.url || login.trim() !== connexion!.login || matricule.trim() !== connexion!.matricule || environnement !== connexion!.environnement || motDePasse !== "");
  const matriculeEnvoye = matricule.trim() || normaliserMatriculeFiscal(cabinet?.matriculeFiscal ?? "");

  async function enregistrer() {
    if (!peutEnregistrer) return;
    const saisi = motDePasse;
    setMotDePasse("");
    setChangerMdp(false);
    setOccupe(true);
    setResultatTest(null);
    try {
      await enregistrerTtn({ url: url.trim(), login: login.trim(), motDePasse: saisi || undefined, matricule: matricule.trim(), environnement });
      toast.success("Accès TTN enregistrés (mot de passe chiffré)");
    } catch {
      // Message déjà affiché par le magasin.
    } finally {
      setOccupe(false);
    }
  }

  async function tester() {
    setOccupe(true);
    setResultatTest(null);
    try {
      setResultatTest({ ok: true, message: await testerTtn() });
    } catch (e) {
      setResultatTest({ ok: false, message: e instanceof Error ? e.message : "Essai impossible" });
    } finally {
      await fetchTtn().catch(() => undefined); // le résultat est mémorisé côté serveur : on le relit pour la carte d'état
      setOccupe(false);
    }
  }

  const essai = connexion?.dernierEssai ?? null;
  const reel = environnement === "reel";

  return (
    <>
      <FenetreFacturation
        open={open}
        onOpenChange={onOpenChange}
        titre="Accès TTN (El Fatoora)"
        description="Adresse du service web et identifiants El Fatoora, utilisés pour déposer les factures signées et suivre leur validation. Le mot de passe est chiffré et n'est jamais réaffiché."
        enTete={
          ttn?.configuree !== false && (
            <span className={cn("inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.08em]", reel ? "bg-primary text-primary-foreground" : "bg-warning/15 text-warning")}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {reel ? "Environnement réel" : "Environnement de test"}
            </span>
          )
        }
        aside={
          ttn?.configuree ? (
            <>
              <Carte titre="État de la connexion">
                <Valeurs
                  lignes={[
                    ["Environnement", connexion ? (connexion.environnement === "reel" ? "Réel" : "Test") : "—"],
                    ["Enregistrés", connexion ? `${formatDate(connexion.majLe)}${connexion.majPar ? ` · ${connexion.majPar}` : ""}` : "Pas encore"],
                    ["Dernier essai", !connexion ? "—" : essai ? <Puce ton={essai.ok ? "ok" : "erreur"}>{essai.ok ? "Réussi" : "Échoué"} · {dateHeure(essai.le)}</Puce> : <Puce ton="neutre">Jamais essayé</Puce>],
                  ]}
                />
                <Button type="button" variant="outline" className="w-full border-accent bg-accent/15 font-semibold text-primary shadow-none hover:bg-accent/30" disabled={!connexion || modifie || occupe} onClick={() => void tester()}>
                  {occupe ? "En cours…" : "Tester la connexion"}
                </Button>
                {modifie && <p className={AIDE}>Enregistrez d'abord vos modifications : l'essai porte sur les accès enregistrés.</p>}
                {resultatTest && (
                  <p
                    role="status"
                    className={cn("rounded-lg px-2.5 py-2 text-xs", resultatTest.ok ? "bg-success/10 text-success" : "bg-destructive/[0.08] text-destructive")}
                  >
                    {resultatTest.message}
                  </p>
                )}
                <p className={AIDE}>L'essai interroge TTN sur un numéro qui n'existe pas : rien n'est déposé.</p>
              </Carte>
              <Carte titre="Avant le premier dépôt" serif={false}>
                <ol className={cn(AIDE, "space-y-1.5")}>
                  <li>① L'adresse IP de votre serveur doit être déclarée chez TTN.</li>
                  <li>② Testez d'abord en environnement de test.</li>
                  <li>③ Passez en « Réel » seulement après un dépôt de test validé.</li>
                </ol>
              </Carte>
            </>
          ) : undefined
        }
        pied={
          <>
            {connexion && (
              <Button type="button" variant="ghost" className="h-auto px-1 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={occupe} onClick={() => setConfirmerSuppression(true)}>
                Supprimer les accès
              </Button>
            )}
            <p className={cn("text-sm", reel ? "font-semibold text-primary" : "text-muted-foreground")} role="status">
              {reel ? "Réel : les factures déposées seront définitives." : ""}
            </p>
            <div className="ml-auto flex gap-3">
              <Button type="button" variant="outline" className="h-11 rounded-lg px-6" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="button" variant="ledger" className="h-11 rounded-lg px-6 text-sm uppercase tracking-[0.14em]" disabled={!peutEnregistrer || ttn?.configuree === false} onClick={() => void enregistrer()}>
                Enregistrer
              </Button>
            </div>
          </>
        }
      >
        {chargement && !ttn ? (
          <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
        ) : !ttn ? (
          <p className="py-4 text-sm text-destructive">Impossible de lire les accès TTN pour le moment.</p>
        ) : !ttn.configuree ? (
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3 text-sm">
            L'accès à TTN n'est pas activé sur ce serveur : la clé de chiffrement (<code>SIGNATURE_CLE_SECRET</code>) n'est pas définie. Demandez à l'administrateur technique de la configurer.
          </p>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void enregistrer();
            }}
          >
            <Rubrique titre="Service">
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                <label className={ETIQUETTE}>
                  Adresse du service TTN
                  <Input id="ttn-url" aria-label="Adresse du service TTN" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/ElfatouraServices/EfactService" autoComplete="off" className={CHAMP} />
                  <span className={AIDE}>Commence par https:// — adresse fournie par TTN.</span>
                </label>
                <div className={ETIQUETTE}>
                  Environnement
                  <div role="group" aria-label="Environnement" className="inline-grid h-10 grid-flow-col overflow-hidden rounded-lg border border-input bg-card">
                    {(["test", "reel"] as const).map((e) => (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={environnement === e}
                        onClick={() => setEnvironnement(e)}
                        className={cn(
                          "border-r border-input px-5 text-sm font-semibold transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          environnement === e ? "bg-primary text-primary-foreground" : "hover:bg-accent/15",
                        )}
                      >
                        {e === "test" ? "Test" : "Réel"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Rubrique>

            <Rubrique titre="Identifiants">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={ETIQUETTE}>
                  Identifiant El Fatoora
                  <Input id="ttn-login" aria-label="Identifiant El Fatoora" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" className={CHAMP} />
                </label>
                {demandeMdp ? (
                  <label className={ETIQUETTE}>
                    Mot de passe
                    <Input id="ttn-mdp" aria-label="Mot de passe" type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={CHAMP} placeholder={connexion ? "Nouveau mot de passe" : ""} />
                  </label>
                ) : (
                  <div className={ETIQUETTE}>
                    Mot de passe
                    <div className="flex h-10 items-center gap-3">
                      <Puce ton="ok">Enregistré (chiffré)</Puce>
                      <button type="button" className="text-xs font-semibold text-primary underline underline-offset-4" onClick={() => setChangerMdp(true)}>
                        Changer
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <label className={ETIQUETTE}>
                Matricule fiscal déclaré chez TTN
                <Input id="ttn-matricule" aria-label="Matricule fiscal déclaré chez TTN" value={matricule} onChange={(e) => setMatricule(e.target.value)} autoComplete="off" className={CHAMP} placeholder="Vide : celui du cabinet" />
                <span className={AIDE}>
                  {matriculeEnvoye ? (
                    <>
                      Envoyé à TTN : <b className="text-foreground">{matriculeEnvoye}</b>
                      {!matricule.trim() && " (matricule du cabinet)"}.
                    </>
                  ) : (
                    "Aucun matricule : renseignez-le ici ou dans Facturation › Cabinet."
                  )}
                </span>
              </label>
            </Rubrique>
            {connexion && !modifie && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5 text-success" strokeWidth={3} aria-hidden="true" /> Les champs ci-dessus correspondent aux accès enregistrés.
              </p>
            )}
          </form>
        )}
      </FenetreFacturation>

      <ConfirmDialog
        open={confirmerSuppression}
        onOpenChange={setConfirmerSuppression}
        title="Supprimer les accès TTN ?"
        description="L'adresse et les identifiants sont effacés du serveur. Les factures déjà déposées restent déposées ; pour en déposer d'autres, il faudra les saisir de nouveau."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          setConfirmerSuppression(false);
          try {
            await supprimerTtn();
            setUrl("");
            setLogin("");
            setMatricule("");
            toast.success("Accès TTN supprimés");
          } catch {
            // Message déjà affiché par le magasin.
          }
        }}
      />
    </>
  );
}
