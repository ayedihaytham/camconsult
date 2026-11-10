import { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSolo, IconField } from "@/components/auth/LoginField";
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
    <AuthSolo
      icon={KeyRound}
      eyebrow="Accès sécurisé"
      titre="Choisissez votre mot de passe"
      texte={`Bonjour ${nom} — c'est votre première connexion (ou votre mot de passe vient d'être réinitialisé). Définissez-en un nouveau, connu de vous seul, pour accéder à votre espace.`}
      pied={
        <button type="button" onClick={() => logout()} className="lx-solo-out">
          <LogOut aria-hidden="true" />
          Se déconnecter
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="lx-form">
        <IconField
          label="Nouveau mot de passe"
          htmlFor="new-password"
          icon={Lock}
          trailing={
            <button type="button" onClick={() => setVisible((v) => !v)} className="lx-eye" aria-label={visible ? "Masquer" : "Afficher"}>
              {visible ? <EyeOff /> : <Eye />}
            </button>
          }
        >
          <input
            id="new-password"
            type={visible ? "text" : "password"}
            autoFocus
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="lx-input"
            placeholder="8 caractères minimum"
          />
        </IconField>
        <IconField label="Confirmer le mot de passe" htmlFor="confirm-password" icon={Lock}>
          <input
            id="confirm-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="lx-input"
            placeholder="Retapez le mot de passe"
          />
        </IconField>
        {error && (
          <p className="lx-err">
            <Lock aria-hidden="true" />
            {error}
          </p>
        )}
        <Button type="submit" className="lx-go" disabled={busy}>
          {busy ? <span className="lx-spin" aria-hidden="true" /> : null}
          {busy ? "Enregistrement…" : "Valider et continuer"}
          {!busy && <ShieldCheck aria-hidden="true" />}
        </Button>
      </form>
    </AuthSolo>
  );
}
