import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSolo, IconField } from "@/components/auth/LoginField";
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
    <AuthSolo icon={KeyRound} eyebrow="Accès sécurisé" titre="Choisissez votre mot de passe" texte="Il restera connu de vous seul. Une fois enregistré, vous accédez à votre espace.">
      <form onSubmit={handleSubmit} className="lx-form">
        <IconField
          label="Nouveau mot de passe"
          htmlFor="activation-mdp"
          icon={Lock}
          trailing={
            <button type="button" onClick={() => setVisible((v) => !v)} className="lx-eye" aria-label={visible ? "Masquer" : "Afficher"}>
              {visible ? <EyeOff /> : <Eye />}
            </button>
          }
        >
          <input
            id="activation-mdp"
            type={visible ? "text" : "password"}
            autoFocus
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="lx-input"
            placeholder="8 caractères minimum"
          />
        </IconField>
        <IconField label="Confirmer le mot de passe" htmlFor="activation-confirmation" icon={Lock}>
          <input
            id="activation-confirmation"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="lx-input"
            placeholder="Retapez le mot de passe"
          />
        </IconField>
        {error && (
          <p role="alert" className="lx-err">
            <Lock aria-hidden="true" />
            {error}
          </p>
        )}
        <Button type="submit" className="lx-go" disabled={busy || !jeton}>
          {busy ? <span className="lx-spin" aria-hidden="true" /> : null}
          {busy ? "Enregistrement…" : "Enregistrer et continuer"}
          {!busy && <ShieldCheck aria-hidden="true" />}
        </Button>
      </form>
    </AuthSolo>
  );
}
