import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, LoaderCircle, Network, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import type { TtnEnvironnement } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Accès au service web El Fatoora de TTN : adresse, identifiant, mot de passe (chiffré côté serveur, jamais relu), matricule fiscal déclaré
 * chez TTN et environnement (test / réel). « Tester la connexion » interroge le service sans rien déposer.
 */
export function TtnConnexionDialog({ open, onOpenChange }: Props) {
  const ttn = useFacturation((s) => s.ttn);
  const fetchTtn = useFacturation((s) => s.fetchTtn);
  const enregistrerTtn = useFacturation((s) => s.enregistrerTtn);
  const supprimerTtn = useFacturation((s) => s.supprimerTtn);
  const testerTtn = useFacturation((s) => s.testerTtn);

  const [url, setUrl] = useState("");
  const [login, setLogin] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [matricule, setMatricule] = useState("");
  const [environnement, setEnvironnement] = useState<TtnEnvironnement>("test");
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [resultatTest, setResultatTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotDePasse("");
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
  const peutEnregistrer = Boolean(url.trim() && login.trim() && (motDePasse || connexion)) && !occupe;

  async function enregistrer() {
    if (!peutEnregistrer) return;
    const saisi = motDePasse;
    setMotDePasse("");
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
      setOccupe(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="size-5 text-accent" aria-hidden="true" />
              Accès TTN (El Fatoora)
            </DialogTitle>
            <DialogDescription>
              Adresse du service web et identifiants El Fatoora, utilisés pour déposer les factures signées et suivre leur validation. Le mot de passe est{" "}
              <strong>chiffré</strong> avant d'être enregistré et n'est jamais réaffiché.
            </DialogDescription>
          </DialogHeader>

          {chargement && !ttn ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : !ttn ? (
            <p className="py-4 text-sm text-destructive">Impossible de lire les accès TTN pour le moment.</p>
          ) : !ttn.configuree ? (
            <p className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                L'accès à TTN n'est pas activé sur ce serveur : la clé de chiffrement (<code>SIGNATURE_CLE_SECRET</code>) n'est pas définie.
              </span>
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void enregistrer();
              }}
            >
              {environnement === "test" && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
                  ENVIRONNEMENT DE TEST : les factures déposées ici ne sont pas des factures réelles.
                </p>
              )}
              <CardField id="ttn-url" label="Adresse du service TTN" hint="Commence par https:// (ex. l'adresse du service EfactService fournie par TTN).">
                <input id="ttn-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/ElfatouraServices/EfactService" autoComplete="off" className={CARD_FIELD_INPUT} />
              </CardField>
              <div className="grid gap-3 sm:grid-cols-2">
                <CardField id="ttn-login" label="Identifiant El Fatoora">
                  <input id="ttn-login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" className={CARD_FIELD_INPUT} />
                </CardField>
                <CardField id="ttn-mdp" label="Mot de passe" hint={connexion?.motDePasseDefini ? "Déjà enregistré : laissez vide pour le conserver." : undefined}>
                  <input
                    id="ttn-mdp"
                    type="password"
                    autoComplete="new-password"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    placeholder={connexion?.motDePasseDefini ? "••••••••" : ""}
                    className={CARD_FIELD_INPUT}
                  />
                </CardField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CardField id="ttn-matricule" label="Matricule fiscal déclaré chez TTN" hint="Vide : celui du cabinet (Facturation › Cabinet).">
                  <input id="ttn-matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} autoComplete="off" className={CARD_FIELD_INPUT} />
                </CardField>
                <CardField id="ttn-env" label="Environnement">
                  <Select value={environnement} onValueChange={(v) => setEnvironnement(v as TtnEnvironnement)}>
                    <SelectTrigger id="ttn-env" className="mt-1 h-auto w-full border-0 bg-transparent p-0 text-base shadow-none focus:ring-0 focus:ring-offset-0" aria-label="Environnement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="reel">Réel (production)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardField>
              </div>

              {connexion && (
                <p className="text-xs text-muted-foreground">
                  Enregistré le {formatDate(connexion.majLe)}
                  {connexion.majPar ? ` par ${connexion.majPar}` : ""}.
                </p>
              )}
              {resultatTest && (
                <p
                  role="status"
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${resultatTest.ok ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}
                >
                  {resultatTest.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  <span>{resultatTest.message}</span>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {connexion && (
                  <Button type="button" variant="outline" className="mr-auto text-destructive hover:bg-destructive/10" disabled={occupe} onClick={() => setConfirmerSuppression(true)}>
                    Supprimer
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={!connexion || occupe} onClick={() => void tester()}>
                  {occupe ? "En cours…" : "Tester la connexion"}
                </Button>
                <Button type="submit" variant="ledger" disabled={!peutEnregistrer}>
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
