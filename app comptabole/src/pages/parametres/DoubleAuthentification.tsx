import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, KeyRound, LoaderCircle, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activer2fa, desactiver2fa, preparer2fa, regenererCodesSecours, statut2fa, type Statut2fa } from "@/lib/doubleAuth";
import { qrSvg } from "@/lib/facturation";

type Etape = null | "motdepasse" | "scan" | "codes" | "desactiver" | "regenerer";

/** Bloc « Double authentification » des Paramètres (administrateur) : activer avec une application d'authentification, voir l'état,
 * régénérer les codes de secours, désactiver. Les actions sensibles redemandent le mot de passe et un code. */
export function DoubleAuthentification() {
  const [statut, setStatut] = useState<Statut2fa | null>(null);
  const [erreurStatut, setErreurStatut] = useState(false);
  const [etape, setEtape] = useState<Etape>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [codesSecours, setCodesSecours] = useState<string[]>([]);
  const [conserves, setConserves] = useState(false);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = () =>
    statut2fa()
      .then((s) => {
        setStatut(s);
        setErreurStatut(false);
      })
      .catch(() => setErreurStatut(true));
  useEffect(() => {
    void charger();
  }, []);

  function ouvrir(e: Etape) {
    setEtape(e);
    setMotDePasse("");
    setCode("");
    setErreur("");
    setConserves(false);
  }
  function fermer() {
    // Les codes de secours ne se revoient jamais : on ne ferme pas avant qu'ils soient confirmés conservés.
    if (etape === "codes" && !conserves) return;
    setEtape(null);
    setSecret("");
    setUri("");
    setCodesSecours([]);
    void charger();
  }

  async function lancer() {
    setOccupe(true);
    setErreur("");
    const r = await preparer2fa(motDePasse);
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    setSecret(r.secret);
    setUri(r.uri);
    setCode("");
    setEtape("scan");
  }
  async function confirmer() {
    setOccupe(true);
    setErreur("");
    const r = await activer2fa(code);
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    setCodesSecours(r.codesSecours);
    setEtape("codes");
    toast.success("Double authentification activée");
  }
  async function desactiver() {
    setOccupe(true);
    setErreur("");
    const r = await desactiver2fa(motDePasse, code);
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    toast.success("Double authentification désactivée");
    setEtape(null);
    void charger();
  }
  async function regenerer() {
    setOccupe(true);
    setErreur("");
    const r = await regenererCodesSecours(motDePasse, code);
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    setCodesSecours(r.codesSecours);
    setConserves(false);
    setEtape("codes");
  }

  const texteCodes = codesSecours.join("\n");
  async function copier() {
    try {
      await navigator.clipboard.writeText(texteCodes);
      toast.success("Codes copiés");
    } catch {
      toast.error("Copie impossible : sélectionnez les codes et copiez-les à la main.");
    }
  }
  function telecharger() {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([`Codes de secours — double authentification\n(chaque code ne sert qu'une fois)\n\n${texteCodes}\n`], { type: "text/plain" }));
    lien.download = "codes-de-secours.txt";
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  const qr = uri ? qrSvg(uri) : "";

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-card" aria-label="Double authentification">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-primary">Double authentification</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          En plus du mot de passe, la connexion demande un code à 6 chiffres généré par une application sur votre téléphone (Google Authenticator, Microsoft Authenticator, Authy…).
        </p>
      </div>
      <div className="space-y-3 p-5">
        {erreurStatut ? (
          <p className="text-sm text-destructive" role="alert">L'état de la double authentification n'a pas pu être chargé.</p>
        ) : !statut ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…</p>
        ) : statut.actif ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="size-4" aria-hidden="true" /> Active : un code est demandé à chaque connexion.</p>
            <p className="text-[13px] text-muted-foreground">
              {statut.codesSecoursRestants} code{statut.codesSecoursRestants > 1 ? "s" : ""} de secours restant{statut.codesSecoursRestants > 1 ? "s" : ""}.
              {statut.codesSecoursRestants <= 3 && <span className="font-medium text-warning"> Pensez à en générer de nouveaux.</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => ouvrir("regenerer")}><KeyRound className="size-4" /> Nouveaux codes de secours</Button>
              <Button type="button" variant="outline" onClick={() => ouvrir("desactiver")}><ShieldAlert className="size-4" /> Désactiver</Button>
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-warning"><ShieldAlert className="size-4" aria-hidden="true" /> Inactive : seul le mot de passe protège le compte administrateur.</p>
            <Button type="button" variant="ledger" onClick={() => ouvrir("motdepasse")}><Smartphone className="size-4" /> Activer la double authentification</Button>
          </>
        )}
      </div>

      <Dialog open={etape !== null} onOpenChange={(o) => !o && fermer()}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => etape === "codes" && !conserves && e.preventDefault()} onEscapeKeyDown={(e) => etape === "codes" && !conserves && e.preventDefault()}>
          {etape === "motdepasse" && (
            <>
              <DialogHeader>
                <DialogTitle>Activer la double authentification</DialogTitle>
                <DialogDescription>Confirmez votre mot de passe. Un QR code à scanner avec votre application s'affichera ensuite.</DialogDescription>
              </DialogHeader>
              <Champ id="da-mdp" label="Mot de passe actuel" type="password" valeur={motDePasse} onChange={setMotDePasse} autoComplete="current-password" />
              {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={fermer}>Annuler</Button>
                <Button type="button" variant="ledger" disabled={!motDePasse || occupe} onClick={() => void lancer()}>Continuer</Button>
              </DialogFooter>
            </>
          )}

          {etape === "scan" && (
            <>
              <DialogHeader>
                <DialogTitle>Enregistrer votre téléphone</DialogTitle>
                <DialogDescription>1. Scannez ce QR code avec votre application d'authentification. 2. Saisissez le code à 6 chiffres qu'elle affiche.</DialogDescription>
              </DialogHeader>
              {qr && <div className="mx-auto w-44 rounded-md border border-border bg-white p-2" role="img" aria-label="QR code à scanner" dangerouslySetInnerHTML={{ __html: qr }} />}
              <p className="text-center text-xs text-muted-foreground">
                Impossible de scanner ? Saisissez cette clé dans l'application :<br />
                <code className="select-all break-all font-mono text-[13px] text-foreground">{secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              </p>
              <Champ id="da-code" label="Code à 6 chiffres" valeur={code} onChange={setCode} autoComplete="one-time-code" inputMode="numeric" />
              {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={fermer}>Annuler</Button>
                <Button type="button" variant="ledger" disabled={code.replace(/\s/g, "").length < 6 || occupe} onClick={() => void confirmer()}>Activer</Button>
              </DialogFooter>
            </>
          )}

          {etape === "codes" && (
            <>
              <DialogHeader>
                <DialogTitle>Vos codes de secours</DialogTitle>
                <DialogDescription>
                  Si vous perdez votre téléphone, chacun de ces codes remplace une fois le code de l'application. <strong>Ils ne seront plus jamais affichés</strong> : conservez-les hors de cet ordinateur (coffre, papier).
                </DialogDescription>
              </DialogHeader>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border bg-muted/40 p-3 font-mono text-sm" aria-label="Codes de secours">
                {codesSecours.map((c) => <li key={c} className="select-all">{c}</li>)}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copier()}><Copy className="size-4" /> Copier</Button>
                <Button type="button" variant="outline" size="sm" onClick={telecharger}><Download className="size-4" /> Télécharger</Button>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" checked={conserves} onChange={(e) => setConserves(e.target.checked)} className="mt-1" />
                J'ai conservé ces codes en lieu sûr.
              </label>
              <DialogFooter>
                <Button type="button" variant="ledger" disabled={!conserves} onClick={fermer}>Terminer</Button>
              </DialogFooter>
            </>
          )}

          {(etape === "desactiver" || etape === "regenerer") && (
            <>
              <DialogHeader>
                <DialogTitle>{etape === "desactiver" ? "Désactiver la double authentification" : "Nouveaux codes de secours"}</DialogTitle>
                <DialogDescription>
                  {etape === "desactiver"
                    ? "Le compte ne sera plus protégé que par le mot de passe, et vos autres sessions seront fermées."
                    : "Les anciens codes de secours seront annulés."}{" "}
                  Confirmez avec votre mot de passe et un code (application ou secours).
                </DialogDescription>
              </DialogHeader>
              <Champ id="da-mdp2" label="Mot de passe actuel" type="password" valeur={motDePasse} onChange={setMotDePasse} autoComplete="current-password" />
              <Champ id="da-code2" label="Code de l'application ou code de secours" valeur={code} onChange={setCode} autoComplete="one-time-code" />
              {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={fermer}>Annuler</Button>
                <Button type="button" variant="ledger" disabled={!motDePasse || !code.trim() || occupe} onClick={() => void (etape === "desactiver" ? desactiver() : regenerer())}>
                  {etape === "desactiver" ? "Désactiver" : "Générer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Champ({ id, label, valeur, onChange, type = "text", autoComplete, inputMode }: { id: string; label: string; valeur: string; onChange: (v: string) => void; type?: string; autoComplete?: string; inputMode?: "numeric" | "text" }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-primary">{label}</Label>
      <Input id={id} type={type} value={valeur} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} />
    </div>
  );
}
