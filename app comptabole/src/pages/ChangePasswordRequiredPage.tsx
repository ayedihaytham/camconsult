import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth";

/** Écran bloquant — 1ère connexion ou après une réinitialisation par
 * l'admin/le responsable des collaborateurs : impossible d'accéder au
 * reste de l'app tant que l'employé n'a pas choisi son propre mot de
 * passe (voir App.tsx, qui rend cet écran à la place des routes tant que
 * session.doitChangerMotDePasse est vrai). Pas d'option pour ignorer,
 * seule la déconnexion permet de sortir sans s'y soumettre. */
export function ChangePasswordRequiredPage() {
  const nom = useAuth((s) => s.session?.nom ?? "");
  const changePassword = useAuth((s) => s.changePassword);
  const logout = useAuth((s) => s.logout);

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (motDePasse.length < 8) {
      setError("8 caractères minimum.");
      return;
    }
    if (motDePasse !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    const res = await changePassword(motDePasse);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Changement impossible.");
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-primary text-accent">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Choisissez votre mot de passe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bonjour {nom} — c'est votre première connexion (ou votre mot de
            passe vient d'être réinitialisé). Définissez-en un nouveau,
            connu de vous seul, pour accéder à votre espace.
          </p>
        </div>

        <div className="rounded-2xl border border-accent/50 bg-card p-6 shadow-pop sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={visible ? "text" : "password"}
                  autoFocus
                  autoComplete="new-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="pr-9"
                  placeholder="8 caractères minimum"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={visible ? "Masquer" : "Afficher"}
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Retapez le mot de passe"
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <Lock className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="ledger"
              className="w-full"
              disabled={busy}
            >
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Enregistrement…" : "Valider et continuer"}
            </Button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
