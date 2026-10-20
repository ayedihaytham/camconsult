import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, LoaderCircle, MonitorSmartphone, ShieldCheck, ShieldOff, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { ListeAppareils } from "@/components/auth/AppareilsConnectes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  agirSurAdministrateur,
  creerAdministrateur,
  listerAdministrateurs,
  listerSessionsAdministrateur,
  reinitialiserAdministrateur,
  revoquerSessionAdministrateur,
  type ActionAdministrateur,
  type Administrateur,
} from "@/lib/administrateurs";
import { formatRelative } from "@/lib/utils";

type Demande =
  | { type: "creer" }
  | { type: "action"; admin: Administrateur; action: ActionAdministrateur | "reinitialiser" }
  | { type: "appareils"; admin: Administrateur }
  | { type: "provisoire"; admin: { nom: string; identifiant: string }; motDePasse: string; creation: boolean };

const TEXTES: Record<ActionAdministrateur | "reinitialiser", { titre: (a: Administrateur) => string; texte: string; bouton: string }> = {
  desactiver: { titre: (a) => `Désactiver ${a.nom}`, texte: "Son accès est coupé aussitôt, sessions ouvertes comprises. Vous pourrez le réactiver.", bouton: "Désactiver" },
  reactiver: { titre: (a) => `Réactiver ${a.nom}`, texte: "Le compte pourra de nouveau se connecter avec son mot de passe.", bouton: "Réactiver" },
  reinitialiser: { titre: (a) => `Réinitialiser le mot de passe de ${a.nom}`, texte: "Un mot de passe provisoire vous est donné à transmettre ; ses sessions sont fermées et il choisira son mot de passe à la prochaine connexion.", bouton: "Réinitialiser" },
  "retirer-2fa": { titre: (a) => `Retirer la double authentification de ${a.nom}`, texte: "À utiliser si le téléphone est perdu et les codes de secours épuisés. Ses sessions sont fermées ; il pourra la réactiver.", bouton: "Retirer" },
};

/** Bloc « Administrateurs » des Paramètres : plusieurs comptes administrateur, chacun avec son mot de passe, sa double authentification et ses appareils.
 * L'administrateur principal (compte historique) ne peut être désactivé ni réinitialisé par un autre. */
export function Administrateurs() {
  const [liste, setListe] = useState<Administrateur[] | null>(null);
  const [erreurListe, setErreurListe] = useState(false);
  const [demande, setDemande] = useState<Demande | null>(null);

  const charger = useCallback(
    () =>
      listerAdministrateurs()
        .then((l) => {
          setListe(l);
          setErreurListe(false);
        })
        .catch(() => setErreurListe(true)),
    [],
  );
  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-card" aria-label="Administrateurs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-primary">Administrateurs</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Les comptes qui gèrent le cabinet. Chacun a son mot de passe, sa double authentification et ses appareils ; toutes les actions sont inscrites au journal.</p>
        </div>
        <Button type="button" onClick={() => setDemande({ type: "creer" })}><UserPlus className="size-4" /> Ajouter un administrateur</Button>
      </div>
      <div className="p-5">
        {erreurListe ? (
          <p className="text-sm text-destructive" role="alert">La liste des administrateurs n'a pas pu être chargée.</p>
        ) : !liste ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…</p>
        ) : (
          <ul className="divide-y divide-border rounded-sm border border-border" aria-label="Liste des administrateurs">
            {liste.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {a.nom}
                    {a.principal && <Etiquette ton="primaire">Principal</Etiquette>}
                    {a.moi && <Etiquette ton="succes">Vous</Etiquette>}
                    {a.statut === "desactive" && <Etiquette ton="danger">Désactivé</Etiquette>}
                    {a.doitChangerMotDePasse && <Etiquette ton="alerte">Mot de passe provisoire</Etiquette>}
                    {a.doubleAuthentification && <Etiquette ton="succes"><ShieldCheck className="size-3" aria-hidden="true" /> 2FA</Etiquette>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.identifiant}
                    {a.fonction ? ` · ${a.fonction}` : ""} · {a.derniereConnexion ? `connecté ${formatRelative(a.derniereConnexion)}` : "jamais connecté"}
                  </p>
                </div>
                {!a.moi && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDemande({ type: "appareils", admin: a })} aria-label={`Appareils connectés de ${a.nom}`}>
                      <MonitorSmartphone className="size-4" /> Appareils
                    </Button>
                    {!a.principal && a.statut === "actif" && (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDemande({ type: "action", admin: a, action: "reinitialiser" })} aria-label={`Réinitialiser le mot de passe de ${a.nom}`}>
                          <KeyRound className="size-4" /> Mot de passe
                        </Button>
                        {a.doubleAuthentification && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setDemande({ type: "action", admin: a, action: "retirer-2fa" })} aria-label={`Retirer la double authentification de ${a.nom}`}>
                            <ShieldOff className="size-4" /> 2FA
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => setDemande({ type: "action", admin: a, action: "desactiver" })} aria-label={`Désactiver ${a.nom}`}>
                          <UserMinus className="size-4" /> Désactiver
                        </Button>
                      </>
                    )}
                    {!a.principal && a.statut === "desactive" && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setDemande({ type: "action", admin: a, action: "reactiver" })} aria-label={`Réactiver ${a.nom}`}>
                        <UserCheck className="size-4" /> Réactiver
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {demande?.type === "creer" && (
        <DialogCreation
          onClose={() => setDemande(null)}
          onCree={(admin, motDePasse) => {
            setDemande({ type: "provisoire", admin, motDePasse, creation: true });
            void charger();
          }}
        />
      )}
      {demande?.type === "action" && (
        <DialogAction
          admin={demande.admin}
          action={demande.action}
          onClose={() => setDemande(null)}
          onFait={(motDePasse) => {
            void charger();
            if (motDePasse) setDemande({ type: "provisoire", admin: demande.admin, motDePasse, creation: false });
            else setDemande(null);
          }}
        />
      )}
      {demande?.type === "provisoire" && <DialogProvisoire demande={demande} onClose={() => setDemande(null)} />}
      <Dialog open={demande?.type === "appareils"} onOpenChange={(o) => !o && setDemande(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Appareils connectés — {demande?.type === "appareils" ? demande.admin.nom : ""}</DialogTitle>
            <DialogDescription>Fermez une session en cas d'appareil perdu ou de doute.</DialogDescription>
          </DialogHeader>
          {demande?.type === "appareils" && <AppareilsAdministrateur id={demande.admin.id} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDemande(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AppareilsAdministrateur({ id }: { id: string }) {
  const charger = useCallback(() => listerSessionsAdministrateur(id), [id]);
  const fermer = useCallback((sid: string) => revoquerSessionAdministrateur(id, sid), [id]);
  return <ListeAppareils charger={charger} fermer={fermer} vide="Aucune session ouverte pour ce compte." />;
}

const TONS = {
  primaire: "bg-primary/10 text-primary",
  succes: "bg-success/15 text-success",
  alerte: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
} as const;
function Etiquette({ ton, children }: { ton: keyof typeof TONS; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${TONS[ton]}`}>{children}</span>;
}

function ChampConfirmation({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 rounded-sm border border-accent/40 bg-accent/10 p-3">
      <Label htmlFor="admin-confirmation">Votre mot de passe · requis pour confirmer</Label>
      <Input id="admin-confirmation" type="password" autoComplete="current-password" value={valeur} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DialogCreation({ onClose, onCree }: { onClose: () => void; onCree: (admin: { nom: string; identifiant: string }, motDePasse: string) => void }) {
  const [nom, setNom] = useState("");
  const [fonction, setFonction] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");
    const r = await creerAdministrateur({ nom, fonction, identifiant, motDePasse });
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    onCree({ nom: r.administrateur.nom, identifiant: r.administrateur.identifiant }, r.motDePasseProvisoire);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={valider} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ajouter un administrateur</DialogTitle>
            <DialogDescription>Un mot de passe provisoire est généré ; la personne choisira le sien à sa première connexion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="admin-nom">Nom complet</Label>
            <Input id="admin-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-fonction">Fonction (facultatif)</Label>
            <Input id="admin-fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-identifiant">Identifiant de connexion</Label>
            <Input id="admin-identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="off" />
          </div>
          <ChampConfirmation valeur={motDePasse} onChange={setMotDePasse} />
          {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={occupe || nom.trim().length < 2 || identifiant.trim().length < 3 || !motDePasse}>Créer le compte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogAction({ admin, action, onClose, onFait }: { admin: Administrateur; action: ActionAdministrateur | "reinitialiser"; onClose: () => void; onFait: (motDePasseProvisoire?: string) => void }) {
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const t = TEXTES[action];

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");
    if (action === "reinitialiser") {
      const r = await reinitialiserAdministrateur(admin.id, motDePasse);
      setOccupe(false);
      if (!r.ok) return setErreur(r.error);
      return onFait(r.motDePasseProvisoire);
    }
    const r = await agirSurAdministrateur(admin.id, action, motDePasse);
    setOccupe(false);
    if (!r.ok) return setErreur(r.error);
    toast.success(action === "desactiver" ? "Administrateur désactivé" : action === "reactiver" ? "Administrateur réactivé" : "Double authentification retirée");
    onFait();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={valider} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t.titre(admin)}</DialogTitle>
            <DialogDescription>{t.texte}</DialogDescription>
          </DialogHeader>
          <ChampConfirmation valeur={motDePasse} onChange={setMotDePasse} />
          {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant={action === "reactiver" ? "default" : "destructive"} disabled={occupe || !motDePasse}>{t.bouton}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Le mot de passe provisoire n'est montré qu'ici, une fois : on ne ferme pas avant que l'administrateur confirme l'avoir transmis. */
function DialogProvisoire({ demande, onClose }: { demande: Extract<Demande, { type: "provisoire" }>; onClose: () => void }) {
  const [transmis, setTransmis] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(demande.motDePasse);
      toast.success("Mot de passe copié");
    } catch {
      toast.error("Copie impossible : sélectionnez le mot de passe et copiez-le à la main.");
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && transmis && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{demande.creation ? "Compte créé" : "Mot de passe réinitialisé"} — {demande.admin.nom}</DialogTitle>
          <DialogDescription>
            Transmettez ces accès à la personne par un canal sûr. Le mot de passe provisoire ne sera plus jamais affiché ; elle devra en choisir un nouveau dès sa première connexion.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 rounded-sm border border-border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Identifiant</dt><dd className="font-mono font-semibold">{demande.admin.identifiant}</dd></div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Mot de passe provisoire</dt>
            <dd className="flex items-center gap-2 font-mono font-semibold" data-testid="mdp-provisoire">
              {demande.motDePasse}
              <Button type="button" variant="outline" size="sm" onClick={copier} aria-label="Copier le mot de passe"><Copy className="size-4" /></Button>
            </dd>
          </div>
        </dl>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={transmis} onChange={(e) => setTransmis(e.target.checked)} />
          <span>J'ai transmis ces accès à la personne.</span>
        </label>
        <DialogFooter>
          <Button type="button" disabled={!transmis} onClick={onClose}>Terminer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
