import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth";

/** Page ouverte depuis le lien reçu du cabinet : la personne choisit son mot de passe (activation d'un compte ou nouveau mot de passe).
 * Le lien est à usage unique et expire ; une fois le mot de passe enregistré, elle est connectée. */
export function ActivationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const activer = useAuth((s) => s.activer);
  const [jeton] = useState(() => params.get("token") ?? "");
  // Le jeton est retiré de la barre d'adresse dès la lecture : il ne reste ni dans l'historique ni dans une capture d'écran.
  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", window.location.pathname);
  }, [params]);

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(jeton ? null : "Ce lien est incomplet. Ouvrez-le tel que vous l'avez reçu.");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (motDePasse.length < 8) return setError("Mot de passe : 8 caractères minimum.");
    if (motDePasse !== confirmation) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    const res = await activer(jeton, motDePasse);
    setBusy(false);
    if (res.ok) navigate("/", { replace: true });
    else setError(res.error ?? "Activation impossible.");
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-primary text-accent">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Choisissez votre mot de passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Il restera connu de vous seul. Une fois enregistré, vous accédez à votre espace.</p>
        </div>
        <div className="rounded-2xl border border-accent/50 bg-card p-6 shadow-pop sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="activation-mdp">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="activation-mdp"
                  type={visible ? "text" : "password"}
                  autoFocus
                  autoComplete="new-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="pr-9"
                  placeholder="8 caractères minimum"
                />
                <button type="button" onClick={() => setVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={visible ? "Masquer" : "Afficher"}>
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activation-confirmation">Confirmer le mot de passe</Label>
              <Input id="activation-confirmation" type={visible ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Retapez le mot de passe" />
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <Lock className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" variant="ledger" className="w-full" disabled={busy || !jeton}>
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Enregistrement…" : "Enregistrer et continuer"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
