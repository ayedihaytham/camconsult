import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, Monitor, MonitorOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { listerSessions, listerSessionsEmploye, revoquerSession, revoquerSessionEmploye, revoquerToutesSessionsEmploye, type SessionAppareil } from "@/lib/appareils";
import { formatRelative } from "@/lib/utils";
import { useAuth } from "@/store/auth";

const estMobile = (appareil: string) => /iPhone|iPad|Android/.test(appareil);
const message = (err: unknown, defaut: string) => (err instanceof ApiError ? err.message : defaut);
const depuis = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

interface ListeProps {
  charger: () => Promise<SessionAppareil[]>;
  fermer: (id: string) => Promise<unknown>;
  /** Texte quand la liste est vide (ex. employé jamais connecté). */
  vide: string;
  /** Boutons d'actions globales, rendus sous la liste (reçoivent un « recharger »). */
  actions?: (recharger: () => Promise<void>, sessions: SessionAppareil[]) => React.ReactNode;
}

/** Liste des appareils connectés d'un compte : l'appareil, l'adresse, la connexion et la dernière activité ; « Fermer » déconnecte UN appareil. */
export function ListeAppareils({ charger, fermer, vide, actions }: ListeProps) {
  const [sessions, setSessions] = useState<SessionAppareil[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      setSessions(await charger());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, [charger]);
  useEffect(() => {
    void recharger();
  }, [recharger]);

  async function fermerUne(s: SessionAppareil) {
    setEnCours(s.id);
    try {
      await fermer(s.id);
      toast.success("Appareil déconnecté");
    } catch (err) {
      toast.error(message(err, "Déconnexion impossible."));
    }
    setEnCours(null);
    await recharger();
  }

  if (erreur) return <p role="alert" className="text-sm text-destructive">La liste des appareils n'a pas pu être chargée.</p>;
  if (!sessions) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…</p>;
  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vide}</p>
      ) : (
        <ul className="space-y-2" aria-label="Appareils connectés">
          {sessions.map((s) => {
            const Icone = estMobile(s.appareil) ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
                <Icone className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {s.appareil}
                    {s.courante && <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-success">Cet appareil</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.adresse || "adresse inconnue"} · connecté le {depuis(s.creeLe)} · actif {formatRelative(s.derniereActivite)}
                  </p>
                </div>
                {!s.courante && (
                  <Button type="button" variant="outline" size="sm" disabled={enCours === s.id} onClick={() => void fermerUne(s)} aria-label={`Déconnecter ${s.appareil} (${s.adresse})`}>
                    <MonitorOff className="size-4" /> Déconnecter
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {actions?.(recharger, sessions)}
    </div>
  );
}

/** « Mes appareils connectés » (menu du compte, tous les rôles). */
export function MesAppareilsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const deconnecterAutres = useAuth((s) => s.deconnecterAutresAppareils);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mes appareils connectés</DialogTitle>
          <DialogDescription>Les ordinateurs et téléphones où votre compte est ouvert. Déconnectez celui que vous ne reconnaissez pas, ou que vous avez perdu.</DialogDescription>
        </DialogHeader>
        {open && (
          <ListeAppareils
            charger={listerSessions}
            fermer={revoquerSession}
            vide="Aucune session ouverte."
            actions={(recharger, sessions) =>
              sessions.some((s) => !s.courante) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const r = await deconnecterAutres();
                    if (r.ok) toast.success("Vos autres appareils sont déconnectés");
                    else toast.error(r.error ?? "Action impossible");
                    await recharger();
                  }}
                >
                  <MonitorOff className="size-4" /> Déconnecter tous les autres
                </Button>
              )
            }
          />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Administrateur : appareils connectés d'un employé (« Appareils connectés » de la liste des comptes). */
export function AppareilsEmployeDialog({ employe, onClose }: { employe: { id: string; nom: string } | null; onClose: () => void }) {
  const id = employe?.id ?? "";
  const charger = useCallback(() => listerSessionsEmploye(id), [id]);
  const fermer = useCallback((sid: string) => revoquerSessionEmploye(id, sid), [id]);
  return (
    <Dialog open={employe !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Appareils connectés — {employe?.nom}</DialogTitle>
          <DialogDescription>Fermez une session en cas d'appareil perdu ou de doute. La personne pourra se reconnecter avec son mot de passe.</DialogDescription>
        </DialogHeader>
        {employe && (
          <ListeAppareils
            charger={charger}
            fermer={fermer}
            vide="Aucune session ouverte pour ce compte."
            actions={(recharger, sessions) =>
              sessions.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const r = await revoquerToutesSessionsEmploye(id);
                      toast.success(`${r.revoquees} session${r.revoquees > 1 ? "s" : ""} fermée${r.revoquees > 1 ? "s" : ""}`);
                    } catch (err) {
                      toast.error(message(err, "Action impossible."));
                    }
                    await recharger();
                  }}
                >
                  <MonitorOff className="size-4" /> Tout fermer
                </Button>
              )
            }
          />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
