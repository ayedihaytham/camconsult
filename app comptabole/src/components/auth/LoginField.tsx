import type { User } from "lucide-react";

/** Champ de saisie des écrans d'accès : étiquette en capitales, icône à gauche, ligne en pointillés dessous qui passe à l'or au focus.
 * À placer dans un conteneur `.lx` (styles dans index.css). */
export function IconField({
  label,
  htmlFor,
  icon: Icon,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: typeof User;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-left">
      <label htmlFor={htmlFor} className="lx-label">
        {label}
      </label>
      <div className="lx-row">
        <Icon className="lx-row-icon" aria-hidden="true" />
        {children}
        {trailing}
      </div>
    </div>
  );
}

/** Habillage commun des écrans d'accès à une seule colonne (activation, nouveau mot de passe) : fond marine du circuit, carte papier. */
export function AuthSolo({
  icon: Icon,
  eyebrow,
  titre,
  texte,
  children,
  pied,
}: {
  icon: typeof User;
  eyebrow: string;
  titre: string;
  texte: React.ReactNode;
  children: React.ReactNode;
  pied?: React.ReactNode;
}) {
  return (
    <div className="lx lx-solo">
      <div className="lx-solo-card login-rise">
        <div className="lx-hd">
          <span className="lx-av">
            <Icon aria-hidden="true" />
          </span>
          <p className="lx-eb">{eyebrow}</p>
          <h1>{titre}</h1>
          <p>{texte}</p>
        </div>
        {children}
      </div>
      {pied}
    </div>
  );
}
